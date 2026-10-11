import { $, V3, clamp } from '../core/util.js';
import { state } from '../core/state.js';
import { camera } from '../world/renderer.js';
import { camTween, curLook, floorH, syncPlayerFromCamera } from '../player/camera.js';
import { keys } from './input.js';
import { setCue } from './helpers.js';
import { late, provide } from '../core/late.js';

// names other modules reach through late (see core/late.js)
provide({
  get hideSwingUI() { return hideSwingUI; },
  get sitSwing() { return sitSwing; },
  get leaveSwing() { return leaveSwing; },
});

/* ================= swings ================= */
let swingHold = false;
export function hideSwingUI() { const el = $('#swingui'); el.classList.remove('show'); el.hidden = true; }
function swingEye(sw) {
  const eye = new V3(0, -sw.L + 0.74, 0.03), dir = new V3(Math.sin(sw.yaw) * Math.cos(sw.pitch), Math.sin(sw.pitch), Math.cos(sw.yaw) * Math.cos(sw.pitch)).applyAxisAngle(new V3(1, 0, 0), -sw.theta * 0.35);
  sw.g.updateMatrixWorld(true);
  return { pos: sw.pivot.localToWorld(eye.clone()), look: sw.pivot.localToWorld(eye.clone().add(dir)) };
}
function sitSwing(sw) {
  late.closePops(); setCue(null); state.mode = 'cinematic'; state.swing = sw; sw.yaw = 0; sw.pitch = -0.04; sw.omega = 0; sw.theta = 0; sw.pivot.rotation.x = 0;
  const e = swingEye(sw);
  camTween(e.pos, e.look, 1.6, () => { state.mode = 'swing'; const el = $('#swingui'); el.hidden = false; requestAnimationFrame(() => el.classList.add('show')); });
}
export function leaveSwing() {
  const sw = state.swing; if (!sw) return; hideSwingUI();
  sw.g.updateMatrixWorld(true);
  const front = sw.g.localToWorld(new V3(0, 0, 1.6)); front.y = floorH(front.x, front.z) + 1.6;
  const look = sw.g.localToWorld(new V3(0, 0, 6)); look.y = front.y - 0.3;
  state.mode = 'cinematic';
  camTween(front, look, 1.1, () => { state.mode = 'walk'; state.swing = null; syncPlayerFromCamera(); });
}
export function updateSwing(dt) {
  const sw = state.swing; if (!sw) return;
  const pump = keys.has('KeyW') || keys.has('Space') || keys.has('ArrowUp') || swingHold;
  let acc = -(9.8 / sw.Lw) * Math.sin(sw.theta) - 0.14 * sw.omega;
  if (pump) acc += Math.abs(sw.omega) < 0.08 ? 1.4 : 1.7 * Math.sign(sw.omega);
  sw.omega += acc * dt; sw.theta = clamp(sw.theta + sw.omega * dt, -1.15, 1.15); if (Math.abs(sw.theta) >= 1.15) sw.omega *= -0.3;
  sw.pivot.rotation.x = sw.theta;
  const e = swingEye(sw); camera.position.copy(e.pos); curLook.copy(e.look); camera.lookAt(curLook);
}
$('#sw-off').onclick = () => leaveSwing();
const swp = $('#sw-pump');
swp.addEventListener('pointerdown', e => { swingHold = true; e.preventDefault(); });
['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => swp.addEventListener(ev, () => { swingHold = false; }));

