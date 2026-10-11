import { poems } from '../settings/storage.js';
import { state } from '../core/state.js';
import { seasonOf } from '../plants/mapping.js';
import { SEASON } from '../world/renderer.js';
import { plants } from '../plants/registry.js';
import { rebuildConnections, rebuildPetals } from '../world/particles.js';
import { toast } from './helpers.js';
import { late, provide } from '../core/late.js';

// names other modules reach through late (see core/late.js)
provide({
  get inFilter() { return inFilter; },
});

/* ================= filter & seasons ================= */
export function inFilter(p) {
  if (state.filter === 'all') return true;
  const d = new Date(p.createdAt), n = new Date();
  if (d.getFullYear() !== n.getFullYear()) return false;
  if (state.filter === 'year') return true;
  if (d.getMonth() !== n.getMonth()) return false;
  if (state.filter === 'month') return true;
  return d.getDate() === n.getDate();
}
export const visiblePoems = () => poems.filter(inFilter);
export const byDate = (a, b) => new Date(a.createdAt) - new Date(b.createdAt);
export function computeSeason() {
  const vis = visiblePoems(); if (!vis.length) return seasonOf(new Date().toISOString());
  const c = {}; vis.forEach(p => { const s = seasonOf(p.createdAt); c[s] = (c[s] || 0) + 1; });
  const mx = Math.max(...Object.values(c)), top = Object.keys(c).filter(k => c[k] === mx);
  if (top.length === 1) return top[0];
  return seasonOf(vis.slice().sort(byDate).reverse().find(p => top.includes(seasonOf(p.createdAt))).createdAt);
}
export function applyFilter(f, announce) {
  state.filter = f;
  document.querySelectorAll('#timebar button').forEach(b => b.setAttribute('aria-checked', b.dataset.f === f ? 'true' : 'false'));
  plants.forEach(pl => { if (pl.dying) return; const v = inFilter(pl.poem) ? 1 : 0; if (v !== pl.target) { pl.target = v; pl.speed = 1 / 1.7; pl.delay = Math.random() * 0.6; } });
  rebuildConnections(); rebuildPetals();
  state.season = computeSeason();
  if (announce) {
    const vis = visiblePoems(), label = { today: 'Today', month: 'This month', year: 'This year', all: 'All poems' }[f];
    if (!vis.length) toast(`${label}: nothing written yet. Sit at the bench to write something.`);
    else toast(`${label}: ${vis.length} poem${vis.length === 1 ? '' : 's'}, ${f === 'today' ? 'still fresh' : SEASON[state.season].words}.`);
  }
}

