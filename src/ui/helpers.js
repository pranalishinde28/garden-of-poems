import { $, isTouch } from '../core/util.js';
import { bridgeH, riverDist } from '../world/terrain.js';
import { poems } from '../settings/storage.js';
import { state } from '../core/state.js';
import { REGIONS, regionKeyFor } from '../plants/mapping.js';
import { featOn, inTulip } from '../world/paths.js';
import { SWING_GARDEN } from '../world/swings.js';
import { interact } from './input.js';
import { late, provide } from '../core/late.js';

// names other modules reach through late (see core/late.js)
provide({
  get toast() { return toast; },
  get cueTarget() { return cueTarget; }, set cueTarget(v) { cueTarget = v; },
});

/* ================= UI helpers ================= */
let toastTimer = null;
export function toast(msg, ms = 4200, action) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show'); t.classList.toggle('has-action', !!action);
  if (action) { const b = document.createElement('button'); b.textContent = action.label; b.onclick = () => { t.classList.remove('show'); clearTimeout(toastTimer); action.run(); }; t.append(' ', b); }
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}
let hintTimer = null;
export function showHint(ms = 9000) {
  const h = $('#hint');
  h.textContent = isTouch ? 'Use the circle to walk, swipe to look around, and tap anything that glows.' : 'Walk with WASD or the arrow keys. Drag to look around. Press E, or click, when something glows.';
  h.classList.add('show'); clearTimeout(hintTimer); hintTimer = setTimeout(() => h.classList.remove('show'), ms);
}
const cueEl = $('#cue'); let cueTarget = null, cueKey = '';
export function setCue(t) {
  cueTarget = t;
  const label = !t ? '' : t.kind === 'plant' ? `Read “${t.plant.poem.title}”` : t.kind === 'pond' ? 'Look into the water' : t.kind === 'board' ? 'Read the garden sign' : t.kind === 'swing' ? 'Sit on the swing' : 'Sit and write';
  if (label !== cueKey) {
    cueKey = label; if (label) $('#cue-t').textContent = label; cueEl.classList.toggle('show', !!label);
    // only a prompt with words is offered to assistive technology
    cueEl.setAttribute('aria-hidden', label ? 'false' : 'true'); cueEl.tabIndex = label ? 0 : -1; if (label) cueEl.setAttribute('aria-label', label + (isTouch ? '' : ' (E)'));
  }
}
cueEl.addEventListener('click', () => { if (cueTarget && state.mode === 'walk') interact(cueTarget); });
export let regionKey = '', regionTimer = null;
export function showRegion(reg) {
  const el = $('#region'), key = reg ? reg.name : '';
  if (key === regionKey) return; regionKey = key; clearTimeout(regionTimer);
  if (!reg) { el.classList.remove('show'); return; }
  el.querySelector('.n').textContent = reg.name; el.querySelector('.s').textContent = reg.sub;
  el.classList.add('show'); regionTimer = setTimeout(() => el.classList.remove('show'), 4500);
}
export function regionAt(x, z) {
  const r = Math.hypot(x, z);
  if (r < 12.2) return poems.length ? { name: 'The Pond', sub: isTouch ? 'Tap the water to see an older poem' : 'Click the water to see an older poem' } : null;
  if (featOn('swings') && Math.hypot(x - SWING_GARDEN.x, z - SWING_GARDEN.z) < 11) return { name: 'The Swing Garden', sub: 'sit, and let the flowers sway above you' };
  if (bridgeH(x, z) !== null) return { name: 'The Bridge', sub: 'over the stream' };
  if (Math.abs(x) < 2.4 && z > 19.5 && z < 33.7) return { name: 'The Wisteria Walk', sub: 'under the hanging flowers' };
  if (inTulip(x, z, 1.5)) return { name: 'The Tulip Fields', sub: 'rows of colour' };
  if (riverDist(x, z) < 6.5) return { name: 'The Stream', sub: 'follow it toward the mountains' };
  const a = Math.atan2(z, x); let best = null, bs = 9;
  for (const k in REGIONS) {
    const g = REGIONS[k], d = Math.abs(Math.atan2(Math.sin(a - g.a), Math.cos(a - g.a)));
    if (d < g.sa + 0.15 && r > g.r0 - 3 && r < g.r1 + 5 && d / g.sa < bs) {
      if (!poems.some(p => regionKeyFor(p) === k && late.inFilter(p))) continue;
      bs = d / g.sa; best = g;
    }
  }
  return best;
}

