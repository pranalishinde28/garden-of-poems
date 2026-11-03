import { $, siteURL, uid } from '../core/util.js';
import { state } from '../core/state.js';
import { toast } from './helpers.js';
import { keys } from './input.js';
import { Cloud, listBooks, removeBook, saveBook } from '../cloud/cloud.ts';
import { FAMOUS, gutenberg } from './libraryBooks.js';
import { provide } from '../core/late.js';

provide({ get openLibrary() { return openLibrary; } });

/* ================= the library's shelves: famous books, and a shelf of your own ================= */
// Opened at a bookcase in the library (world/libraryHall.js). Each book stands on a walnut shelf as an old
// binding; take one down and it opens as a book, two pages at a time, the page turning over the spine. You can
// write your own books at the desk; they stand on your shelf. Signed in, they are kept in your account (table
// books); otherwise on this device. Visiting a public garden, its poet's shelf shows the books they share.

const box = $('#library'), shelvesEl = $('#lb-shelves'), openEl = $('#lb-open'), writeEl = $('#lb-write');
const LOCAL = 'garden-of-poems:books';
const local = { get() { try { return JSON.parse(localStorage.getItem(LOCAL) || '[]'); } catch (e) { return []; } }, set(v) { try { localStorage.setItem(LOCAL, JSON.stringify(v)); } catch (e) { toast('This device has no room to keep the book.'); } } };
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const BIND = ['#6e2a22', '#2f4a6a', '#3f5a32', '#5a3a5e', '#7a5a22', '#3a3a44', '#8a3a3a', '#2a5a5a'];
let prevMode = 'walk', mine = [], view = 'shelves', book = null, spread = 0, pages = 1;

// ---- your shelf: from your account when signed in (with this device's books brought in), otherwise this device ----
const fromRow = r => ({ id: r.id, title: r.title, author: r.author, text: r.body, private: r.private, created: r.created_at, own: true });
async function loadMine() {
  if (state.visiting) {
    const rows = await listBooks(state.visiting.owner).catch(() => null);
    return (rows || []).map(r => ({ ...fromRow(r), own: false }));
  }
  if (Cloud.ready && Cloud.user) {
    let rows = await listBooks(Cloud.user.id).catch(() => null);
    if (rows) {
      const here = local.get();
      if (here.length) { for (const b of here) { try { await saveBook({ id: b.id, title: b.title, author: b.author || '', body: b.text, private: !!b.private }); } catch (e) { /* keep it here */ } } local.set([]); rows = await listBooks(Cloud.user.id).catch(() => rows) || rows; }
      return rows.map(fromRow);
    }
  }
  return local.get().map(b => ({ ...b, own: true }));
}
const keepsInAccount = () => !state.visiting && Cloud.ready && Cloud.user;

// ---- the shelves ----
function spine(b, i) {
  // tall enough for the whole title on its spine; a long title in smaller type, on a thicker book
  const n = b.title.length, btn = document.createElement('button'), h = Math.min(310, Math.max(170, 96 + n * (n > 22 ? 7.6 : 10.6))) + ((i * 13) % 14), w = 34 + Math.min(18, Math.round(n * 0.5));
  btn.className = n > 22 ? 'lb-spine long' : 'lb-spine'; btn.style.setProperty('--c', b.color || BIND[i % BIND.length]); btn.style.height = h + 'px'; btn.style.width = w + 'px';
  btn.innerHTML = `<span>${esc(b.title)}</span>`; btn.title = `${b.title}, ${b.author || 'anonymous'}`; btn.setAttribute('aria-label', `Read ${b.title} by ${b.author || 'an unknown writer'}`);
  btn.onclick = () => openBook(b); return btn;
}
function shelf(title, sub, list, empty, extra) {
  const sec = document.createElement('section'); sec.className = 'lb-sec';
  sec.innerHTML = `<h3>${esc(title)}</h3>${sub ? `<p class="lb-note">${esc(sub)}</p>` : ''}`;
  const row = document.createElement('div'); row.className = 'lb-shelf';
  list.forEach((b, i) => row.append(spine(b, i)));
  if (!list.length) { const e = document.createElement('p'); e.className = 'lb-empty'; e.textContent = empty; row.append(e); }
  if (extra) row.append(extra);
  sec.append(row); return sec;
}
async function renderShelves() {
  view = 'shelves'; shelvesEl.hidden = false; openEl.hidden = true; writeEl.hidden = true;
  shelvesEl.innerHTML = '';
  shelvesEl.append(shelf('Famous books', 'Each one whole, to read here from the first page to the last.', FAMOUS, ''));
  const loading = shelf(state.visiting ? `${state.visiting.by}’s shelf` : 'Your shelf', '', [], 'Finding your books…');
  shelvesEl.append(loading);
  mine = await loadMine();
  let add = null;
  if (!state.visiting) { add = document.createElement('button'); add.className = 'lb-add'; add.innerHTML = '<b>+</b><span>Write a book</span>'; add.onclick = () => openWrite(); }
  const sub = state.visiting ? 'The books this poet shares.' : keepsInAccount() ? 'The books you write. They are kept in your account.' : 'The books you write. They are kept on this device; sign in to keep them in your account.';
  loading.replaceWith(shelf(state.visiting ? `${state.visiting.by}’s shelf` : 'Your shelf', sub, mine, state.visiting ? 'No books here yet.' : 'Nothing on your shelf yet.', add));
}

// ---- an open book: whole books are read here, so the text is laid out a part at a time ----
// The paragraphs are grouped into parts of about 20,000 characters; the open part flows into columns two pages
// wide and a turn moves on two pages; turning past the last spread opens the next part (and back). The slider
// under the book goes anywhere in it; where you stopped in each book is remembered on this device.
const flow = $('#lb-flow'), leaf = $('#lb-leaf'), seek = $('#lb-seek'), PART = 20000, MARK = 'garden-of-poems:bookmark:';
const fullText = {};
let parts = [], part = 0, partStart = [], total = 1;
const mark = { get(id) { try { return JSON.parse(localStorage.getItem(MARK + id) || 'null'); } catch (e) { return null; } }, set(id, v) { try { localStorage.setItem(MARK + id, JSON.stringify(v)); } catch (e) { /* no storage */ } } };
function split(text) {
  const ps = text.replace(/\r/g, '').split(/\n{2,}/).filter(p => p.trim()); parts = []; partStart = []; let cur = [], n = 0, at = 0;
  for (const p of ps) { cur.push(p); n += p.length; if (n >= PART) { parts.push(cur); partStart.push(at); at += n; cur = []; n = 0; } }
  if (cur.length || !parts.length) { parts.push(cur); partStart.push(at); at += n; }
  total = Math.max(1, at);
}
function renderPart() {
  const b = book, last = part === parts.length - 1;
  const html = parts[part].map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
  flow.innerHTML = (part === 0 ? `<div class="lb-title-page"><span class="orn">✿</span><h2>${esc(b.title)}</h2>${b.author ? `<p class="by">${esc(b.author)}</p>` : ''}${b.year ? `<p class="yr">${esc(b.year)}</p>` : ''}${b.loading ? '<p class="note">the whole book is on its way…</p>' : ''}</div>` : '') + html + (last ? '<p class="lb-end">✿ ✿ ✿</p>' : '');
  measure();
}
function openBook(b) {
  book = b; view = 'book'; shelvesEl.hidden = true; writeEl.hidden = true; openEl.hidden = false;
  $('#lb-btitle').textContent = b.title; $('#lb-bby').textContent = [b.author, b.year].filter(Boolean).join(', ');
  $('#lb-edit').hidden = $('#lb-remove').hidden = !b.own;
  const begin = text => { split(text); seek.max = String(parts.length - 1); seek.hidden = parts.length < 2; const m = mark.get(b.id); part = m && m.part < parts.length ? m.part : 0; spread = m && m.part < parts.length ? m.spread : 0; requestAnimationFrame(() => { renderPart(); show(); }); };
  if (b.famous && b.file && !fullText[b.file]) {
    b.loading = true; begin(b.text);
    fetch(siteURL() + 'books/' + b.file + '.txt').then(r => r.ok ? r.text() : Promise.reject(r.status)).then(t => { fullText[b.file] = t; b.loading = false; if (book === b && view === 'book') begin(t); })
      .catch(() => { b.loading = false; if (book === b) toast('The whole book could not be fetched just now; here are its opening pages.', 4200); });
  } else begin(b.famous && b.file ? fullText[b.file] : b.text);
}
function measure() {
  const pw = flow.parentElement.clientWidth, gap = parseFloat(getComputedStyle(flow).columnGap) || 0;
  const colW = (pw - gap) / 2; flow.style.columnWidth = colW + 'px'; flow.style.width = pw + 'px';
  pages = Math.max(1, Math.round((flow.scrollWidth + gap) / (colW + gap)));
}
function show() {
  const pw = flow.parentElement.clientWidth, gap = parseFloat(getComputedStyle(flow).columnGap) || 0, last = Math.max(0, Math.ceil(pages / 2) - 1);
  if (spread < 0) spread = last; // came back from the next part: its last spread
  spread = Math.max(0, Math.min(spread, last));
  flow.style.transform = `translateX(${-spread * (pw + gap)}px)`;
  const len = parts[part].reduce((n, p) => n + p.length, 0), pct = Math.min(100, Math.round((partStart[part] + len * (spread + 1) / (last + 1)) / total * 100));
  $('#lb-pg').textContent = parts.length > 1 ? `${pct}% through` + (book.loading ? ' · the rest is on its way' : '') : `pages ${spread * 2 + 1}–${Math.min(pages, spread * 2 + 2)} of ${pages}`;
  seek.value = String(part);
  $('#lb-prev').disabled = spread === 0 && part === 0; $('#lb-next').disabled = spread >= last && part === parts.length - 1;
  if (!book.loading) mark.set(book.id, { part, spread });
}
function turn(dir) {
  const last = Math.max(0, Math.ceil(pages / 2) - 1);
  if (dir > 0 && spread >= last && part >= parts.length - 1) return;
  if (dir < 0 && spread <= 0 && part <= 0) return;
  // a leaf of paper turns over the spine; the pages change as it passes the middle
  leaf.classList.remove('fwd', 'back'); void leaf.offsetWidth; leaf.classList.add(dir > 0 ? 'fwd' : 'back');
  setTimeout(() => {
    if (dir > 0 && spread >= last) { part++; spread = 0; renderPart(); }
    else if (dir < 0 && spread <= 0) { part--; spread = -1; renderPart(); }
    else spread += dir;
    show();
  }, 300);
}
seek.oninput = () => { part = +seek.value; spread = 0; renderPart(); show(); };
$('#lb-prev').onclick = () => turn(-1); $('#lb-next').onclick = () => turn(1);
$('#lb-back').onclick = () => renderShelves();
addEventListener('resize', () => { if (view === 'book') { measure(); show(); } });

// ---- writing a book ----
let editing = null;
function openWrite(b) {
  editing = b || null; view = 'write'; shelvesEl.hidden = true; openEl.hidden = true; writeEl.hidden = false;
  $('#lb-w-title').value = b ? b.title : ''; $('#lb-w-author').value = b ? (b.author || '') : ((Cloud.profile && Cloud.profile.display_name) || '');
  $('#lb-w-body').value = b ? b.text : ''; $('#lb-w-private').checked = !!(b && b.private);
  $('#lb-w-privrow').hidden = !keepsInAccount(); count();
  $('#lb-w-head').textContent = b ? `Revising “${b.title}”` : 'A new book';
  setTimeout(() => $('#lb-w-title').focus(), 50);
}
function count() { const n = $('#lb-w-body').value.length, w = $('#lb-w-body').value.trim() ? $('#lb-w-body').value.trim().split(/\s+/).length : 0; $('#lb-w-count').textContent = `${w} ${w === 1 ? 'word' : 'words'}${n > 180000 ? ` · ${(200000 - n).toLocaleString()} characters left` : ''}`; }
$('#lb-w-body').oninput = count;
$('#lb-w-cancel').onclick = () => (editing ? openBook(editing) : renderShelves());
$('#lb-w-save').onclick = async () => {
  const title = $('#lb-w-title').value.trim(), author = $('#lb-w-author').value.trim(), text = $('#lb-w-body').value.replace(/\s+$/, '');
  if (!title) { toast('Give your book a title.'); $('#lb-w-title').focus(); return; }
  if (!text.trim()) { toast('Write a little first; the pages are empty.'); $('#lb-w-body').focus(); return; }
  const b = { id: editing ? editing.id : uid(), title: title.slice(0, 120), author: author.slice(0, 80), text: text.slice(0, 200000), private: $('#lb-w-private').checked, created: editing ? editing.created : new Date().toISOString(), own: true };
  const btn = $('#lb-w-save'); btn.disabled = true;
  try {
    if (keepsInAccount()) await saveBook({ id: b.id, title: b.title, author: b.author, body: b.text, private: b.private });
    else { const all = local.get().filter(x => x.id !== b.id); all.push(b); local.set(all); }
    toast(editing ? 'Your book is revised.' : 'Your book is on the shelf.'); await renderShelves(); openBook(b);
  } catch (e) { toast(e.message || 'The book could not be kept just now. Try again.'); }
  finally { btn.disabled = false; }
};
$('#lb-edit').onclick = () => book && book.own && openWrite(book);
$('#lb-remove').onclick = async () => {
  if (!book || !book.own) return;
  const btn = $('#lb-remove');
  if (btn.dataset.sure !== '1') { btn.dataset.sure = '1'; btn.textContent = 'Take it off the shelf for good?'; setTimeout(() => { btn.dataset.sure = ''; btn.textContent = 'Remove'; }, 4000); return; }
  btn.dataset.sure = ''; btn.textContent = 'Remove';
  if (keepsInAccount()) { if (!(await removeBook(book.id))) { toast('That did not work. Try again.'); return; } }
  else local.set(local.get().filter(x => x.id !== book.id));
  toast('The book is off the shelf.'); renderShelves();
};

// ---- opening and closing the library ----
function openLibrary(start) {
  if (!box.hidden) return;
  prevMode = state.mode; state.mode = 'library'; keys.clear();
  box.hidden = false; requestAnimationFrame(() => box.classList.add('open'));
  document.body.classList.add('lib-open');
  if (start === 'write' && !state.visiting) openWrite(); else renderShelves();
}
function closeLibrary() { document.body.classList.remove('lib-open'); box.classList.remove('open'); setTimeout(() => { if (!box.classList.contains('open')) box.hidden = true; }, 400); if (state.mode === 'library') state.mode = prevMode === 'library' ? 'walk' : prevMode; view = 'shelves'; }
$('#lb-close').onclick = closeLibrary;
addEventListener('keydown', e => {
  if (box.hidden) return;
  const typing = e.target.closest && e.target.closest('input, textarea');
  if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (view === 'shelves') closeLibrary(); else if (view === 'write') $('#lb-w-cancel').click(); else renderShelves(); return; }
  if (view === 'book' && !typing && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { e.preventDefault(); e.stopImmediatePropagation(); turn(e.key === 'ArrowRight' ? 1 : -1); }
}, true);
