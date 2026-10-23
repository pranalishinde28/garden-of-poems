import { $, V3, clamp } from '../core/util.js';
import { state } from '../core/state.js';
import { camera } from '../world/renderer.js';
import { camTween, curLook, floorH, syncPlayerFromCamera } from '../player/camera.js';
import { keys } from './input.js';
import { setCue } from './helpers.js';
import { closeSwingReader, toggleSwingReader } from './swingReader.js';
import { late, provide } from '../core/late.js';

// names other modules reach through late (see core/late.js)
provide({
  get hideSwingUI() { return hideSwingUI; },
  get sitSwing() { return sitSwing; },
  get leaveSwing() { return leaveSwing; },
  get toggleKeepSwinging() { return toggleKeepSwinging; },
  get setSwingViewUI() { return setSwingViewUI; },
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
  late.closePops(); setCue(null); state.mode = 'cinematic'; state.swing = sw; state.swingAuto = false; state.swingKeep = 0; { const b = $('#sw-keep'); b.setAttribute('aria-pressed', 'false'); b.innerHTML = '<span class="long">Keep swinging</span><span class="short">Keep</span>'; } sw.yaw = 0; sw.pitch = -0.04; sw.omega = 0; sw.theta = 0; sw.pivot.rotation.x = 0;
  const e = swingEye(sw);
  document.body.classList.add('on-swing');
  camTween(e.pos, e.look, 1.6, () => { state.mode = 'swing'; setSwingViewUI(); const el = $('#swingui'); el.hidden = false; requestAnimationFrame(() => el.classList.add('show')); });
}
export function leaveSwing() {
  const sw = state.swing; if (!sw) return; closeSwingReader(); hideSwingUI(); document.body.classList.remove('on-swing');
  sw.g.updateMatrixWorld(true);
  const front = sw.g.localToWorld(new V3(0, 0, 1.6)); front.y = floorH(front.x, front.z) + 1.6;
  const look = sw.g.localToWorld(new V3(0, 0, 6)); look.y = front.y - 0.3;
  state.mode = 'cinematic';
  camTween(front, look, 1.1, () => { state.mode = 'walk'; state.swing = null; syncPlayerFromCamera(); });
}
const swingAmp = sw => Math.acos(clamp(Math.cos(sw.theta) - sw.omega * sw.omega * sw.Lw / (2 * 9.8), -1, 1));
export function toggleKeepSwinging() {
  const sw = state.swing; if (!sw) return;
  state.swingAuto = !state.swingAuto; const a = swingAmp(sw); state.swingKeep = state.swingAuto ? (a < 0.2 ? 0.45 : clamp(a, 0.25, 1.0)) : 0; // from still, a gentle 26°
  const b = $('#sw-keep'); b.setAttribute('aria-pressed', state.swingAuto ? 'true' : 'false'); b.innerHTML = state.swingAuto ? '<span class="long">Keeping this pace</span><span class="short">Keeping</span>' : '<span class="long">Keep swinging</span><span class="short">Keep</span>';
  late.renderSwingReader && late.renderSwingReader();
}
export function updateSwing(dt) {
  const sw = state.swing; if (!sw) return;
  const pump = keys.has('KeyW') || keys.has('Space') || keys.has('ArrowUp') || swingHold;
  let acc = -(9.8 / sw.Lw) * Math.sin(sw.theta) - 0.14 * sw.omega;
  if (pump) acc += Math.abs(sw.omega) < 0.08 ? 1.4 : 1.7 * Math.sign(sw.omega);
  // keep swinging: hold the height you chose (the pace you were at when you pressed it), or a gentle
  // 26° if you were still. Pumping while it is on raises the pace it keeps.
  else if (state.swingAuto) {
    const amp = Math.acos(clamp(Math.cos(sw.theta) - sw.omega * sw.omega * sw.Lw / (2 * 9.8), -1, 1)), want = state.swingKeep || 0.45;
    if (amp < want - 0.02) acc += Math.abs(sw.omega) < 0.05 ? 0.7 : 0.7 * Math.sign(sw.omega);
    else if (amp > want + 0.03) acc -= 0.45 * sw.omega;
    else acc += 0.14 * sw.omega; // cancel the friction: no slowing at the chosen height
  }
  if (pump && state.swingAuto) state.swingKeep = Math.max(state.swingKeep || 0, swingAmp(sw));
  sw.omega += acc * dt; sw.theta = clamp(sw.theta + sw.omega * dt, -1.15, 1.15); if (Math.abs(sw.theta) >= 1.15) sw.omega *= -0.3;
  sw.pivot.rotation.x = sw.theta;
  const e = swingEye(sw); camera.position.copy(e.pos); curLook.copy(e.look); camera.lookAt(curLook);
}
$('#sw-off').onclick = () => leaveSwing();
// on the swing: see the garden through your own eyes, or watch yourself swing (V does the same)
export function setSwingViewUI() { const b = $('#sw-view'), third = !!state.thirdPerson; b.innerHTML = `<span class="long">${third ? 'My eyes' : 'See myself'}</span><span class="short">View</span>`; b.setAttribute('aria-pressed', third ? 'false' : 'true'); b.setAttribute('aria-label', third ? 'See from my own eyes (V)' : 'Watch myself swing (V)'); }
$('#sw-view').onclick = e => { late.toggleView(); setSwingViewUI(); e.currentTarget.blur(); };
$('#sw-keep').onclick = e => { toggleKeepSwinging(); e.currentTarget.blur(); };
$('#sw-read').onclick = e => { toggleSwingReader(); e.currentTarget.blur(); };
const swp = $('#sw-pump');
swp.addEventListener('pointerdown', e => { swingHold = true; e.preventDefault(); });
['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => swp.addEventListener(ev, () => { swingHold = false; }));

