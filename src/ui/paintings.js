import { $, uid } from '../core/util.js';
import { state } from '../core/state.js';
import { toast } from './helpers.js';
import { keys } from './input.js';
import { Cloud, listPaintings, paintingBlob, removePainting, savePainting } from '../cloud/cloud.ts';
import { FAMOUS_ART } from '../world/paintingHall.js';
import { late, provide } from '../core/late.js';

provide({ get viewPainting() { return viewPainting; } });

/* ================= looking at paintings, and hanging your own (the Hall of Paintings) ================= */
// Walk up to a painting and it opens here, large, with its painter, year, where it hangs and a few words; ← → walk
// along the wall. "Hang a painting of your own" takes a picture from this device, shrinks it to at most 1600 px and
// hangs it on the gallery's end wall. Signed in, it goes to your account (Storage bucket paintings + table
// paintings); otherwise it stays on this device (IndexedDB). Visiting a public garden shows its painter's wall.

const box = $('#paintview'), img = $('#pv-img'), info = $('#pv-info'), form = $('#pv-form');
let prevMode = 'walk', list = [], at = 0, mine = [];
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---- this device's paintings: IndexedDB, pictures as blobs ----
const DB = { db: null, open() { if (this.db) return Promise.resolve(this.db); return new Promise((res, rej) => { const r = indexedDB.open('garden-of-poems-paintings', 1); r.onupgradeneeded = () => r.result.createObjectStore('p', { keyPath: 'id' }); r.onsuccess = () => res(this.db = r.result); r.onerror = () => rej(r.error); }); },
  async all() { const d = await this.open(); return new Promise(res => { const q = d.transaction('p').objectStore('p').getAll(); q.onsuccess = () => res(q.result || []); q.onerror = () => res([]); }); },
  async put(v) { const d = await this.open(); return new Promise((res, rej) => { const t = d.transaction('p', 'readwrite'); t.objectStore('p').put(v); t.oncomplete = res; t.onerror = () => rej(t.error); }); },
  async del(id) { const d = await this.open(); return new Promise(res => { const t = d.transaction('p', 'readwrite'); t.objectStore('p').delete(id); t.oncomplete = res; t.onerror = res; }); } };
const inAccount = () => !state.visiting && Cloud.ready && Cloud.user;
const toImage = blob => new Promise((res, rej) => { const u = URL.createObjectURL(blob), im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = u; });

// your wall (or the visited painter's), with each picture loaded
async function loadMine() {
  let rows = [];
  if (state.visiting) {
    const r = await listPaintings(state.visiting.owner).catch(() => null);
    rows = (r || []).map(p => ({ id: p.id, title: p.title, artist: p.artist, note: p.note, path: p.path, w: p.width, h: p.height }));
  } else if (inAccount()) {
    const r = await listPaintings(Cloud.user.id).catch(() => null);
    if (r) {
      // paintings hung on this device before signing in move into the account
      const here = await DB.all().catch(() => []);
      for (const p of here) { try { await savePainting({ id: p.id, title: p.title, artist: p.artist || '', note: p.note || '', private: false, width: p.w, height: p.h }, p.blob); await DB.del(p.id); } catch (e) { /* keep it here */ } }
      const r2 = here.length ? (await listPaintings(Cloud.user.id).catch(() => r)) || r : r;
      rows = r2.map(p => ({ id: p.id, title: p.title, artist: p.artist, note: p.note, path: p.path, w: p.width, h: p.height, private: p.private, own: true }));
    } else rows = (await DB.all().catch(() => [])).map(p => ({ ...p, own: true }));
  } else rows = (await DB.all().catch(() => [])).map(p => ({ ...p, own: true }));
  for (const p of rows) { try { const blob = p.blob || (p.path && await paintingBlob(p.path)); if (blob) { p.image = await toImage(blob); p.url = p.image.src; } } catch (e) { /* shown as an empty frame */ } }
  mine = rows.filter(p => p.image);
  late.hangOwnPaintings && late.hangOwnPaintings(mine);
  return mine;
}
// refresh the wall whenever you come into the gallery's world
let loadedFor = null;
setInterval(() => { const k = state.world === 'sun' ? (state.visiting ? state.visiting.owner : (Cloud.user ? Cloud.user.id : 'device')) : null; if (k && k !== loadedFor) { loadedFor = k; loadMine(); } }, 2000);

// ---- the viewer ----
function show(i) {
  form.hidden = true; $('#pv-look').hidden = false;
  at = (i + list.length) % list.length; const a = list[at];
  img.src = a.famous ? `${import.meta.env.BASE_URL}art/gallery/${a.file}.jpg` : a.url; img.alt = a.title;
  info.innerHTML = `<h2>${esc(a.title)}</h2><p class="pv-by">${esc(a.artist || 'Unknown painter')}${a.year ? ', ' + esc(a.year) : ''}</p>${a.where ? `<p class="pv-where">${esc(a.where)}</p>` : ''}${a.note ? `<p class="pv-note">${esc(a.note)}</p>` : ''}${a.famous ? '<p class="pv-pd">In the public domain. Photograph: Wikimedia Commons.</p>' : ''}`;
  $('#pv-count').textContent = `${at + 1} of ${list.length}`;
  $('#pv-remove').hidden = !(a.own); $('#pv-remove').textContent = 'Take it down'; $('#pv-remove').dataset.sure = '';
}
function viewPainting(id) {
  if (!box.hidden) return;
  prevMode = state.mode; state.mode = 'paintings'; keys.clear(); document.body.classList.add('lib-open');
  list = [...FAMOUS_ART, ...mine];
  box.hidden = false; requestAnimationFrame(() => box.classList.add('open'));
  if (id === 'upload') { if (state.visiting) { toast('Paintings are hung in your own garden. Return home first.'); show(0); } else openForm(); return; }
  const i = list.findIndex(a => a.id === id); show(i < 0 ? 0 : i);
}
function close() { document.body.classList.remove('lib-open'); box.classList.remove('open'); setTimeout(() => { if (!box.classList.contains('open')) box.hidden = true; }, 350); if (state.mode === 'paintings') state.mode = prevMode === 'paintings' ? 'walk' : prevMode; }
$('#pv-close').onclick = close; $('#pv-prev').onclick = () => show(at - 1); $('#pv-next').onclick = () => show(at + 1);
$('#pv-hang').onclick = () => (state.visiting ? toast('Paintings are hung in your own garden. Return home first.') : openForm());
addEventListener('keydown', e => {
  if (box.hidden) return; const typing = e.target.closest && e.target.closest('input, textarea');
  if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (!form.hidden && list.length) show(at); else close(); return; }
  if (!typing && form.hidden && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { e.preventDefault(); e.stopImmediatePropagation(); show(at + (e.key === 'ArrowRight' ? 1 : -1)); }
}, true);

// ---- hanging your own ----
let picked = null;
function openForm() {
  form.hidden = false; $('#pv-look').hidden = true; picked = null;
  $('#pv-preview').hidden = true; $('#pv-file').value = ''; $('#pv-title').value = ''; $('#pv-note').value = '';
  $('#pv-artist').value = (Cloud.profile && Cloud.profile.display_name) || '';
  $('#pv-where').textContent = inAccount() ? 'It will hang in your gallery and be kept in your account.' : 'It will hang in your gallery, kept on this device. Sign in to keep it in your account.';
  $('#pv-privrow').hidden = !inAccount();
}
$('#pv-file').onchange = async () => {
  const f = $('#pv-file').files[0]; if (!f) return;
  if (!/^image\//.test(f.type)) { toast('Choose a picture: a JPEG, PNG or WebP.'); return; }
  try {
    const im = await toImage(f), k = Math.min(1, 1600 / Math.max(im.width, im.height)), c = document.createElement('canvas');
    c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.86));
    picked = { blob, w: c.width, h: c.height }; $('#pv-preview').src = URL.createObjectURL(blob); $('#pv-preview').hidden = false;
    if (!$('#pv-title').value) $('#pv-title').value = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 120);
  } catch (e) { toast('That picture could not be opened.'); }
};
$('#pv-cancel').onclick = () => (list.length && $('#pv-look').dataset.seen ? show(at) : close());
$('#pv-save').onclick = async () => {
  if (!picked) { toast('Choose a picture first.'); return; }
  const title = $('#pv-title').value.trim(); if (!title) { toast('Give your painting a title.'); $('#pv-title').focus(); return; }
  const p = { id: uid(), title: title.slice(0, 120), artist: $('#pv-artist').value.trim().slice(0, 80), note: $('#pv-note').value.trim().slice(0, 600), private: $('#pv-private').checked, width: picked.w, height: picked.h };
  const btn = $('#pv-save'); btn.disabled = true;
  try {
    if (inAccount()) await savePainting(p, picked.blob);
    else await DB.put({ id: p.id, title: p.title, artist: p.artist, note: p.note, w: p.width, h: p.height, blob: picked.blob, created: new Date().toISOString() });
    await loadMine(); list = [...FAMOUS_ART, ...mine];
    toast('Your painting is hanging in the gallery.'); show(list.findIndex(a => a.id === p.id));
  } catch (e) { toast(e.message || 'The painting could not be hung just now. Try again.'); }
  finally { btn.disabled = false; }
};
$('#pv-remove').onclick = async () => {
  const a = list[at]; if (!a || !a.own) return; const b = $('#pv-remove');
  if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Take it down for good?'; return; }
  if (inAccount()) { if (!(await removePainting(a.id))) { toast('That did not work. Try again.'); return; } } else await DB.del(a.id);
  await loadMine(); list = [...FAMOUS_ART, ...mine]; toast('The painting is taken down.'); show(Math.min(at, list.length - 1));
};
