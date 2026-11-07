import { $ } from '../core/util.js';
import { state } from '../core/state.js';
import { toast } from '../ui/helpers.js';
import { setTendedLanterns, tendedLanterns } from '../world/lanternPath.js';
import { Cloud, NEEDS_UPDATE, tendGarden, tendedGardens, tendedSeen, untendGarden } from './cloud.ts';
import { late, provide } from '../core/late.js';

provide({
  get onVisited() { return onVisited; },
  get onHome() { return refresh; },
  get renderTended() { return renderTended; },
  get tendedLanterns() { return tendedLanterns; },
});

/* ================= tending gardens ================= */
// Following, without a feed. While visiting a public garden, "Tend this garden" keeps it near you: a lantern for it
// stands on the path by your gate, lit when something new has grown there since you last walked it, and it is
// listed under "Gardens you tend" in the Gardens panel. Nobody sees whom you tend; the poet only learns how many.
let list = [], tending = new Set(), uid = null;
const btn = $('#visit-tend');
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const news = g => g.fresh ? (g.fresh === 1 ? `a new poem${g.newest ? ': ' + g.newest : ''}` : `${g.fresh} new poems`) : 'nothing new since you last walked it';

async function refresh() {
  if (!Cloud.ready || !Cloud.user) { list = []; tending = new Set(); setTendedLanterns([], visit); return; }
  const rows = await tendedGardens();
  list = rows || []; tending = new Set(list.map(g => g.owner));
  setTendedLanterns(list, visit);
}
const visit = g => late.visitGarden(g);

function setBtn() {
  const v = state.visiting, show = !!(v && v.isPublic && Cloud.user && Cloud.user.id !== v.owner);
  btn.hidden = !show; if (!show) return;
  const on = tending.has(v.owner);
  btn.classList.toggle('on', on); btn.setAttribute('aria-pressed', String(on));
  btn.lastChild.textContent = on ? 'Tending' : 'Tend this garden';
  btn.title = on ? 'You tend this garden: its lantern stands by your gate. Press to stop.' : 'Keep a lantern for this garden by your gate; it glows when a new poem grows here.';
}
async function onVisited(g) {
  setBtn();
  if (!Cloud.user || !tending.has(g.owner)) return;
  await tendedSeen(g.owner);
  const row = list.find(r => r.owner === g.owner); if (row) { row.fresh = 0; row.newest = null; }
  setTendedLanterns(list, visit);
}
btn.onclick = async () => {
  const v = state.visiting; if (!v || !Cloud.user) return;
  btn.disabled = true;
  try {
    if (tending.has(v.owner)) {
      if (await untendGarden(v.owner)) { tending.delete(v.owner); list = list.filter(r => r.owner !== v.owner); toast('You no longer tend this garden. Its lantern is put away.'); }
    } else {
      await tendGarden(v.owner); tending.add(v.owner);
      toast(`You tend ${v.name} now. A lantern for it stands by your gate, and it glows when something new grows here.`, 6000);
      const rows = await tendedGardens(); if (rows) list = rows;
    }
    setTendedLanterns(list, visit);
  } catch (e) { toast(e.message === NEEDS_UPDATE ? NEEDS_UPDATE : 'That did not work just now. Try again in a moment.'); }
  btn.disabled = false; setBtn();
};

// the Gardens panel's list
async function renderTended() {
  const box = $('#g-tend'), out = $('#g-tend-list');
  if (!Cloud.ready || !Cloud.user) { box.hidden = true; return; }
  const rows = await tendedGardens();
  if (rows === null) { box.hidden = true; return; }
  list = rows; tending = new Set(rows.map(g => g.owner)); setTendedLanterns(list, visit);
  out.innerHTML = ''; box.hidden = false;
  if (!rows.length) { out.append(el('p', 'g-m', 'When you visit a garden you love, choose “Tend this garden”. Its lantern will stand by your gate.')); return; }
  rows.forEach(g => {
    const row = el('div', 'g-row' + (g.fresh ? ' fresh' : '')), t = el('div', 'g-t');
    t.append(el('div', 'g-n', g.name || 'A quiet garden'), el('div', 'g-m', `${g.display_name || 'A poet'} · ${news(g)}`));
    const b = el('button', '', 'Visit'); b.onclick = () => visit(g);
    row.append(t, b); out.append(row);
  });
}

// on signing in or out, and now and then while you stay
setInterval(() => {
  const id = Cloud.user ? Cloud.user.id : null;
  if (id !== uid) { uid = id; refresh(); }
  setBtn();
}, 2000);
setInterval(() => { if (Cloud.user && !state.visiting) refresh(); }, 5 * 60 * 1000);
