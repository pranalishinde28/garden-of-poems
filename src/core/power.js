import { reduceMotion } from './util.js';
import { state, tween, seed } from './state.js';
import { keys, drag, jv } from '../ui/input.js';

/* ================= power: draw only as often as the moment needs ================= */
// The garden used to draw every frame (60 a second on most screens) even while you read, stood still,
// or had the map over it. Now: full rate while anything moves, 20 when you stand still, 24 behind a
// panel, 8 when the window isn't focused, nothing under the map. Resting frames look the same, so
// what you see never changes; moving is always full rate (a 30 fps battery cap made walking feel worse).
let lastActive = performance.now(), lastDrawn = 0;
export const power = { framesDrawn: 0, growing: false, target: 60 }; // target: the rate this frame was drawn at
const wake = () => { lastActive = performance.now(); };
['keydown', 'pointerdown', 'pointermove', 'wheel', 'touchstart', 'resize'].forEach(e => addEventListener(e, wake, { passive: true }));

function targetFps(now) {
  if (state.mode === 'map') return 0;
  if (!document.hasFocus()) return 8;
  let fps = 60;
  const moving = tween || seed || drag || keys.size || jv.x || jv.y || state.mode === 'swing' || state.mode === 'cinematic' || state.mode === 'intro' || state.mode === 'fountain' || power.growing; // the koi swim smoothly while you watch
  if (!moving && now - lastActive > 2500) fps = (state.mode === 'focus' || state.mode === 'writing' || document.body.classList.contains('panel-open')) ? 24 : 20;
  if (reduceMotion) fps = Math.min(fps, 30);
  return fps;
}
// call at the top of the frame; false means skip this one (nothing is updated or drawn)
export function shouldDraw(now) {
  const fps = targetFps(now); power.target = fps;
  if (fps === 0) return false;
  if (fps < 60 && now - lastDrawn < 1000 / fps - 4) return false;
  lastDrawn = now; power.framesDrawn++; return true;
}
export const wakePower = wake;
