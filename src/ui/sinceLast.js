import { $ } from '../core/util.js';
import { state } from '../core/state.js';
import { Cloud, tendedGardens, whatsNew } from '../cloud/cloud.ts';
import { plants } from '../plants/registry.js';
import { openPoem } from './reading.js';
import { late } from '../core/late.js';

/* ================= since you were last here ================= */
// On arriving in your own garden (signed in), a quiet note says what has happened since you were last here:
// hearts on your poems and who gave them, notes left, how many people walked your garden or began tending it, and
// new poems in the gardens you tend. Each line takes you there. Nothing new, no note. "Last here" is remembered per person on this
// device, moved on when you leave the page and after the note is read; the first visit on a device just starts it.
const note = $('#sincelast'), KEY = id => 'garden-of-poems:last-here:' + id;
const store = { get(id) { try { return localStorage.getItem(KEY(id)); } catch (e) { return null; } }, set(id) { try { localStorage.setItem(KEY(id), new Date().toISOString()); } catch (e) { /* no storage */ } } };
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const names = (list, n) => { const shown = list.slice(0, Math.min(2, list.length)), more = n - shown.length; return more > 0 ? `${shown.join(', ')} and ${more === 1 ? 'one other' : more + ' others'}` : shown.length === 2 ? `${shown[0]} and ${shown[1]}` : shown[0] || 'Someone'; };
function line(html, go) { const b = document.createElement('button'); b.className = 'sl-line'; b.innerHTML = html; b.onclick = () => { if (state.mode !== 'walk') return; hide(); go(); }; return b; }
const toPoem = id => () => { const pl = plants.get(id); if (pl) openPoem(pl); };
function hide() { note.classList.remove('show'); setTimeout(() => { if (!note.classList.contains('show')) note.hidden = true; }, 500); }
$('#sl-close').onclick = hide;

let done = false;
async function check() {
  if (done || state.mode !== 'walk' || state.visiting || state.world !== 'garden' && state.world || !Cloud.ready || !Cloud.user) return;
  done = true;
  const id = Cloud.user.id, since = store.get(id); store.set(id);
  if (!since) return; // the first visit on this device: from now on there will be news
  const n = await whatsNew(since); if (!n) return;
  const list = $('#sl-lines'); list.innerHTML = '';
  n.hearts.forEach(h => list.append(line(`<b>${esc(names(h.names, h.n))}</b> hearted <i>${esc(h.title)}</i>.`, toPoem(h.poem_id))));
  n.notes.slice(0, 4).forEach(t => list.append(line(`<b>${esc(t.name)}</b> left a note on <i>${esc(t.title)}</i>: “${esc(t.text.length > 70 ? t.text.slice(0, 68) + '…' : t.text)}”`, toPoem(t.poem_id))));
  if (n.notes.length > 4) list.append(line(`and ${n.notes.length - 4} more notes.`, toPoem(n.notes[4].poem_id)));
  if (n.visitors) list.append(line(n.visitors === 1 ? 'One person walked your garden.' : `<b>${n.visitors} people</b> walked your garden.`, () => late.openGardens && late.openGardens()));
  if (n.tenders) list.append(line(n.tenders === 1 ? 'Someone began tending your garden.' : `<b>${n.tenders} people</b> began tending your garden.`, () => late.openGardens && late.openGardens()));
  // only poems grown since you were last here: the lantern by the gate keeps glowing until you visit
  const tended = ((await tendedGardens()) || []).filter(g => g.fresh > 0 && g.newest_at && new Date(g.newest_at) > new Date(since)).slice(0, 3);
  tended.forEach(g => list.append(line(`New in <b>${esc(g.name || 'a garden you tend')}</b>: ${g.fresh === 1 && g.newest ? `<i>${esc(g.newest)}</i>` : `${g.fresh} new poems`}.`, () => late.visitGarden(g))));
  if (!list.children.length) return;
  note.hidden = false; requestAnimationFrame(() => note.classList.add('show'));
}
setInterval(check, 1500);
addEventListener('pagehide', () => { if (Cloud.user) store.set(Cloud.user.id); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && Cloud.user) store.set(Cloud.user.id); });
