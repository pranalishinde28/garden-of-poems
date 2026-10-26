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
let samples = [], last = 0, slowRuns = 0;
// Only frames drawn at the full rate count (the map pauses drawing). Auto keeps watching for as long as you
// walk: two slow stretches in a row (median over ~34 ms, under 30 fps) step it down one level. One quick
// stretch never settles it for good, since frame times on a weak machine come and go.
export function noteFrame(now) {
  const d = now - last; last = now;
  if (quality.choice !== 'auto' || state.mode !== 'walk' || power.target < 60 || d > 250) return;
  samples.push(d); if (samples.reduce((a, b) => a + b, 0) < 2000 || samples.length < 8) return; // two seconds of walking, however few frames that is
  samples.sort((a, b) => a - b); const median = samples[samples.length >> 1]; samples = [];
  const i = ORDER.indexOf(quality.level);
  slowRuns = median > 34 ? slowRuns + 1 : 0;
  // very slow (under 20 fps) steps down at once; merely slow needs two windows in a row
  if ((median > 50 || slowRuns >= 2) && i < ORDER.length - 1) { apply(ORDER[i + 1]); slowRuns = 0; }
}
export function chooseQuality(c) {
  quality.choice = c; flag.set('quality', c); slowRuns = 0; samples = [];
  // Auto starts at High on a capable computer; a phone, tablet or a machine with few cores or little memory starts at Medium
  const weak = isTouch || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  apply(c === 'auto' ? (weak ? 'medium' : 'high') : c);
}
$('#m-quality').onclick = () => {
  const next = { auto: 'high', high: 'medium', medium: 'low', low: 'auto' }[quality.choice];
  chooseQuality(next); toast(next === 'auto' ? 'Quality follows this device now.' : `Quality: ${next}.`, 2400);
};
chooseQuality(quality.choice);

