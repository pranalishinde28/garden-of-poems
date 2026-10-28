import { $ } from '../core/util.js';
import { poems } from '../settings/storage.js';
import { state } from '../core/state.js';
import { toast } from '../ui/helpers.js';
import { Cloud, db, heartsFor, setHeart } from './cloud.ts';
import { el } from './gardensPanel.js';
import { provide } from '../core/late.js';

// names other modules reach through late (see core/late.js)
provide({
  get loadSocial() { return loadSocial; },
  get canHeart() { return canHeart; },
  get heartPoem() { return heartPoem; },
});

/* ---------- hearts and kind notes on the poem card ---------- */
// Only in a public garden: visiting one, or your own once it is open. Visitors leave hearts and notes;
// the poet sees how many hearts, and the notes. Before the database update there are no hearts, and
// the card simply leaves the heart out.
let cur = null; // { p, owner, poemId, visiting, hearts: { likes, mine } | null }
const heartBtn = $('#r-heart'), talkBtn = $('#r-talk'), likesEl = $('#r-likes'), notesBox = $('#r-notes');
const isPublic = () => !!state.visiting || !!(Cloud.user && Cloud.garden && Cloud.garden.is_public);
const canHeart = () => !!(cur && cur.hearts && !heartBtn.hidden);
function setPoet(name) { const n = $('#r-poet'); n.textContent = name; $('#r-av').textContent = (name.trim()[0] || '·').toUpperCase(); }

async function loadSocial(p) {
  cur = null; heartBtn.hidden = talkBtn.hidden = likesEl.hidden = notesBox.hidden = true;
  notesBox.classList.remove('all'); talkBtn.setAttribute('aria-expanded', 'false');
  if (!state.visiting && Cloud.user && Cloud.profile) setPoet(Cloud.profile.display_name || Cloud.profile.username || 'Your garden');
  if (!Cloud.ready) return;
  // hearts: on any poem in a public garden, and always on your own (signed in, even while private);
  // notes only where the garden is public
  const pub = isPublic(), own = !state.visiting && !!Cloud.user;
  if (!pub && !own) return;
  const visiting = !!state.visiting, owner = visiting ? state.visiting.owner : Cloud.user.id, poemId = visiting ? p._oid : String(p.id);
  const c = cur = { p, owner, poemId, visiting, hearts: null };
  if (pub) { talkBtn.hidden = false; loadNotes(); }
  try {
    const all = await heartsFor(owner);
    if (cur !== c || !all) return;
    c.hearts = all.get(poemId) || { likes: 0, mine: false }; showHearts();
  } catch (e) { /* hearts are a nicety; the poem still reads */ }
}

function showHearts() {
  const h = cur.hearts;
  heartBtn.hidden = false; likesEl.hidden = false;
  heartBtn.setAttribute('aria-pressed', String(!!h.mine)); heartBtn.setAttribute('aria-disabled', 'false');
  heartBtn.setAttribute('aria-label', h.mine ? 'Take back your heart (J)' : 'Love this poem (J)');
  likesEl.textContent = h.likes === 0 ? 'Be the first to love this'
    : h.mine ? (h.likes === 1 ? 'You loved this' : `You and ${h.likes - 1} other${h.likes === 2 ? '' : 's'} loved this`)
    : `${h.likes} ${h.likes === 1 ? 'person' : 'people'} loved this`;
}
const replay = (node, cls) => { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); };
// a double tap only ever gives a heart; the button or J toggles it
async function heartPoem(fromDouble) {
  if (!cur || !cur.hearts) return;
  if (!Cloud.user) { toast('Sign in to leave a heart for the poet.'); return; }
  const c = cur, h = c.hearts, on = fromDouble ? true : !h.mine;
  if (fromDouble) replay($('#r-bigheart'), 'beat'); // not 'pop': that is the menus' class
  if (on === h.mine) return;
  h.mine = on; h.likes += on ? 1 : -1; showHearts(); if (on) replay(heartBtn, 'beat');
  if (await setHeart(c.owner, c.poemId, on)) return;
  h.mine = !on; h.likes += on ? -1 : 1; if (cur === c) showHearts();
  toast('That heart did not reach the poet just now.');
}
heartBtn.onclick = () => { if (heartBtn.getAttribute('aria-disabled') !== 'true') heartPoem(false); };

// ---- notes: the newest two, then all of them when asked ----
const SHOWN = 2;
async function loadNotes() {
  const c = cur, list = $('#r-notes-list'), form = $('#r-note-form'), more = $('#r-notes-all');
  list.innerHTML = ''; more.hidden = true; notesBox.hidden = false;
  form.hidden = !(c.visiting && Cloud.user);
  $('#r-notes-h').textContent = c.visiting ? 'Kind words left here' : 'Notes visitors left you';
  const q = cols => Cloud.sb.from('notes').select(cols).eq('garden_owner', c.owner).eq('poem_id', c.poemId).order('created_at').limit(100);
  let { data, error } = await q('id,text,created_at,author,hidden,profiles(display_name,username)');
  if (error && error.code === '42703') ({ data, error } = await q('id,text,created_at,author,profiles(display_name,username)')); // before the update: no hidden column
  if (cur !== c) return;
  list.innerHTML = '';
  if (error) { list.append(el('p', 'n-empty', 'Notes could not be loaded just now.')); return; }
  talkBtn.setAttribute('aria-label', `Notes${data.length ? ` (${data.length})` : ''} (K)`);
  if (!data.length) list.append(el('p', 'n-empty', c.visiting ? (Cloud.user ? 'No notes yet. Be the first to leave one.' : 'No notes yet.') : 'No notes on this poem yet.'));
  const folded = data.length > SHOWN && !notesBox.classList.contains('all');
  if (folded) { more.hidden = false; more.textContent = `View all ${data.length} notes`; }
  (folded ? data.slice(-SHOWN) : data).forEach(n => list.appendChild(noteRow(n, c)));
  if (c.visiting && !Cloud.user) list.append(el('p', 'n-empty', 'Sign in to leave a kind note for the poet.'));
}
function noteRow(n, c) {
  const row = el('div', 'n-row' + (n.hidden ? ' is-hidden' : ''));
  row.append(el('b', '', (n.profiles && n.profiles.display_name) || 'A visitor'), el('span', 'n-t', n.text),
    el('span', 'n-w', new Date(n.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' }) + (n.hidden ? ' · hidden from visitors' : '')));
  const acts = el('div', 'n-acts'), me = Cloud.user && Cloud.user.id;
  if (me && c.owner === me && !db.legacy) { // the poet: hide without deleting
    const hide = el('button', 'g-link', n.hidden ? 'Show to visitors' : 'Hide from visitors');
    hide.onclick = async () => { const { error } = await Cloud.sb.from('notes').update({ hidden: !n.hidden }).eq('id', n.id); if (error) toast('That did not work just now.'); else loadNotes(); };
    acts.append(hide);
  }
  if (me && (n.author === me || c.owner === me)) {
    const del = el('button', 'g-link', 'Remove'); del.onclick = async () => { const { error } = await Cloud.sb.from('notes').delete().eq('id', n.id); if (!error) loadNotes(); };
    acts.append(del);
  }
  if (me && n.author !== me && c.owner !== me && 'hidden' in n) { // a visitor can report an unkind note (after the update)
    const rep = el('button', 'g-link', 'Report');
    rep.onclick = async () => { rep.disabled = true; const { error } = await Cloud.sb.from('note_reports').insert({ note_id: n.id }); rep.textContent = error ? (error.code === '23505' ? 'Reported' : 'Could not report') : 'Reported. Thank you.'; };
    acts.append(rep);
  }
  if (acts.children.length) row.append(acts);
  return row;
}
$('#r-notes-all').onclick = () => { notesBox.classList.add('all'); loadNotes(); };
talkBtn.onclick = async () => {
  if (!cur) return;
  notesBox.classList.add('all'); talkBtn.setAttribute('aria-expanded', 'true');
  await loadNotes();
  if (!$('#r-note-form').hidden) $('#r-note').focus(); else notesBox.scrollIntoView({ block: 'nearest' });
};

// ---- leaving a note ----
const ta = $('#r-note');
ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'; });
ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#r-note-send').click(); } });
$('#r-note-send').onclick = async () => {
  const text = ta.value.trim().slice(0, 280);
  if (!text || !state.visiting || !Cloud.user || !cur) return;
  const p = poems.find(q => q.id === state.reading); if (!p) return;
  $('#r-note-send').disabled = true;
  const { error } = await Cloud.sb.from('notes').insert({ garden_owner: state.visiting.owner, poem_id: p._oid, text });
  if (error) toast(error.code === 'P0001' ? error.message : 'Your note could not be left just now.', 6000);
  else { ta.value = ''; ta.style.height = 'auto'; notesBox.classList.add('all'); loadNotes(); }
  $('#r-note-send').disabled = false;
};
