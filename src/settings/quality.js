import { $, isTouch } from '../core/util.js';
import { flag } from './storage.js';
import { state } from '../core/state.js';
import { renderer, reflQuality, onResize } from '../world/renderer.js';
import { dirL } from '../world/lights.js';
import { grassChunks } from '../world/grass.js';
import { setShadowDirty } from '../plants/registry.js';
import { toast } from '../ui/helpers.js';
import { power } from '../core/power.js';

/* ================= quality: how much the garden draws on this device ================= */
// Low, Medium, High, or Auto (the default), which watches frame times for a few seconds after you
// enter and steps down while frames are slow. The choice belongs to this device, not the garden.
const LEVELS = {
  high:   { pr: isTouch ? 2 : 2, grass: 1, shadows: true, shadowMap: isTouch ? 2048 : 4096, reflEvery: 1, reflScale: isTouch ? 0.5 : 0.75, post: true }, // full sharpness
  medium: { pr: 1.25, grass: 0.6, shadows: true, shadowMap: 1024, reflEvery: 2, reflScale: 0.35, post: true },
  low:    { pr: 1, grass: 0.3, shadows: false, shadowMap: 512, reflEvery: 3, reflScale: 0.25, post: false },
};
const ORDER = ['high', 'medium', 'low'];
export const quality = { choice: ['auto', 'high', 'medium', 'low'].includes(flag.get('quality')) ? flag.get('quality') : 'auto', level: 'high', ...LEVELS.high };

function apply(level) {
  const L = LEVELS[level]; Object.assign(quality, L, { level });
  renderer.setPixelRatio(Math.min(devicePixelRatio, L.pr)); reflQuality.scale = L.reflScale; onResize();
  grassChunks.forEach(c => { c.m.count = Math.max(1, Math.round(c.items.length * L.grass)); });
  if (dirL.castShadow !== L.shadows || dirL.shadow.mapSize.x !== L.shadowMap) {
    dirL.castShadow = L.shadows;
    if (dirL.shadow.mapSize.x !== L.shadowMap) { dirL.shadow.mapSize.set(L.shadowMap, L.shadowMap); if (dirL.shadow.map) { dirL.shadow.map.dispose(); dirL.shadow.map = null; } }
    setShadowDirty(true);
  }
  setLabel();
}
function setLabel() { $('#m-quality .t').textContent = quality.choice === 'auto' ? `Picture: Auto (${quality.level})` : `Picture: ${quality.choice[0].toUpperCase() + quality.choice.slice(1)}`; }

// ---- Auto: sample frame times while walking, step down while the median is slow ----
let samples = [], last = 0, settled = false;
// Only frames drawn at the full rate count: when the garden rests on purpose (core/power.js draws 20 a
// second standing still), the gaps are long by design, and counting them stepped Auto down to Low.
export function noteFrame(now) {
  const d = now - last; last = now;
  if (quality.choice !== 'auto' || settled || state.mode !== 'walk' || power.target < 60 || d > 250) return;
  samples.push(d); if (samples.length < 150) return;
  samples.sort((a, b) => a - b); const median = samples[samples.length >> 1]; samples = [];
  const i = ORDER.indexOf(quality.level);
  if (median > 40 && i < ORDER.length - 1) apply(ORDER[i + 1]); // only when truly struggling (under ~25 fps)
  else settled = true;
}
export function chooseQuality(c) {
  quality.choice = c; flag.set('quality', c); settled = false; samples = [];
  apply(c === 'auto' ? 'high' : c);
}
$('#m-quality').onclick = () => {
  const next = { auto: 'high', high: 'medium', medium: 'low', low: 'auto' }[quality.choice];
  chooseQuality(next); toast(next === 'auto' ? 'Quality follows this device now.' : `Quality: ${next}.`, 2400);
};
chooseQuality(quality.choice);

