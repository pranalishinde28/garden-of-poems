import * as THREE from 'three';
import { $, clamp, isTouch } from '../core/util.js';
import { groundH } from '../world/terrain.js';
import { T, state } from '../core/state.js';
import { camera, canvas } from '../world/renderer.js';
import { featOn } from '../world/paths.js';
import { plants } from '../plants/registry.js';
import { koiLure, river, water } from '../water/water.js';
import { bench, sign } from '../world/decor.js';
import { swings } from '../world/swings.js';
import { animals } from '../animals/animals.js';
import { player } from '../player/camera.js';
import { things } from '../core/things.js';
import { late, provide } from '../core/late.js';

// names other modules reach through late (see core/late.js)
provide({
  get hoverPlant() { return hoverPlant; }, set hoverPlant(v) { hoverPlant = v; },
});

/* ================= input ================= */
export const keys = new Set();
// only text fields keep keys for themselves; buttons and toggles never take W, Space or the arrows
const isTyping = e => !!(e.target.closest && e.target.closest('textarea, select, [contenteditable="true"], input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=range]):not([type=file])'));
addEventListener('keydown', e => {
  if (isTyping(e)) { if (e.key === 'Escape') late.closeEditor(); return; }
  if (state.mode === 'swing') {
    if (e.code === 'Escape' && late.swingReaderOpen()) { late.closeSwingReader(); return; }
    if (e.code === 'KeyE' || e.code === 'Escape') { late.leaveSwing(); return; }
    if (e.code === 'KeyR' && !e.repeat) { late.toggleSwingReader(); return; }
    if (late.swingReaderOpen() && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) { e.preventDefault(); late.stepSwingReader(e.code === 'ArrowLeft' ? -1 : 1); return; }
    if (e.code === 'Space') e.preventDefault();
  }
  if (e.code === 'Escape') { if (state.mode === 'focus') late.closeReader(); else if (state.mode === 'writing') late.closeEditor(); late.closePops(); return; }
  if (state.mode === 'focus' && !state.reflection) { if (e.code === 'ArrowLeft') { late.stepPoem(-1); return; } if (e.code === 'ArrowRight') { late.stepPoem(1); return; } }
  if ((e.key === '?' || e.code === 'KeyH') && !e.repeat && (state.mode === 'walk' || state.mode === 'swing')) { late.openHelp(); return; }
  if (e.code === 'KeyM' && !e.repeat && (state.mode === 'walk' || state.mode === 'swing')) { late.toggleMap(); return; }
  if (e.code === 'KeyV' && !e.repeat && (state.mode === 'walk' || state.mode === 'swing')) { late.toggleView(); return; }
  if (e.code === 'KeyE' && state.mode === 'walk' && late.cueTarget) { e.preventDefault(); interact(late.cueTarget); return; }
  if (/^(Key[WASD]|Arrow|Shift|Space)/.test(e.code)) { keys.add(e.code); if ((e.code.startsWith('Arrow') || e.code === 'Space') && (state.mode === 'walk' || state.mode === 'swing')) e.preventDefault(); }
});
// a focused button would otherwise 'click' on Space keyup while it pumps the swing
addEventListener('keyup', e => { keys.delete(e.code); if (state.mode === 'swing' && e.code === 'Space' && !isTyping(e)) e.preventDefault(); });
addEventListener('blur', () => keys.clear());

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
export let drag = null, hoverXY = null, hoverPlant = null;
canvas.addEventListener('pointerdown', e => {
  if (state.mode === 'intro' || drag) return;
  try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 };
  late.closePops();
});
canvas.addEventListener('pointermove', e => {
  if (e.pointerType === 'mouse') hoverXY = [e.clientX, e.clientY];
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
  if (state.mode === 'swing' && state.swing && drag.moved > 4) { const k = isTouch ? 0.0048 : 0.0034; state.swing.yaw = clamp(state.swing.yaw - dx * k, -1.4, 1.4); state.swing.pitch = clamp(state.swing.pitch - dy * k * 0.85, -0.8, 0.6); }
  if (state.mode === 'walk' && drag.moved > 4) { const k = isTouch ? 0.0048 : 0.0034; player.yaw -= dx * k; player.pitch = clamp(player.pitch - dy * k * 0.85, -1.05, 0.85); }
});
function endDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const click = drag.moved < 8 && performance.now() - drag.t < 600; drag = null;
  if (click) handleClick(e.clientX, e.clientY);
}
canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', e => { if (drag && e.pointerId === drag.id) drag = null; });
canvas.addEventListener('pointerleave', () => { hoverXY = null; hoverPlant = null; });

function groundHitDist(o, d) {
  for (let t = 0.5; t < 90; t += t < 20 ? 0.35 : 0.8) { const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t; if (y < groundH(x, z)) return t; }
  return Infinity;
}
export function pick(cx, cy) {
  ndc.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const targets = [water, river, bench];
  plants.forEach(p => { if (p.root.visible && p.vis > 0.5 && !p.dying) targets.push(p.root); });
  if (sign.visible) targets.push(sign);
  targets.push(late.board);
  things.forEach(t => { if (t.root.visible) targets.push(t.root); });
  if (featOn('swings')) swings.forEach(s => targets.push(s.g)); animals.forEach(a => { if (a.root.visible) targets.push(a.root); });
  const hits = ray.intersectObjects(targets, true);
  if (!hits.length) return null;
  const gd = groundHitDist(ray.ray.origin, ray.ray.direction);
  for (const h of hits) {
    if (h.distance > gd + 0.3) return null;
    let o = h.object;
    if (o.userData.plant) return { kind: 'plant', plant: o.userData.plant };
    if (o === water) return { kind: 'pond', point: h.point };
    if (o === river) return null;
    if (o.userData.bench) return { kind: 'bench' };
    if (o.userData.sign) return { kind: 'sign' };
    if (o.userData.board) return { kind: 'board' };
    if (o.userData.swing) return { kind: 'swing', sw: o.userData.swing };
    if (o.userData.animal) return { kind: 'animal', a: o.userData.animal };
    if (o.userData.thing) return { kind: 'thing', it: o.userData.thing, point: h.point };
  }
  return null;
}
function handleClick(x, y) {
  if (state.mode === 'walk') { const t = pick(x, y); if (t) interact(t); }
  else if (state.mode === 'focus') { const t = pick(x, y); if (t && t.kind === 'plant' && t.plant.poem.id !== state.reading) late.openPoem(t.plant); else if (!t) late.closeReader(); }
}
export function interact(t) {
  if (t.kind === 'plant') late.openPoem(t.plant);
  else if (t.kind === 'pond') {
    // the koi come to where you touched the water (or the edge nearest you)
    const p = t.point || player.pos, r = Math.hypot(p.x, p.z) || 1, k = t.point ? Math.min(1, 6.8 / r) : 6 / r;
    Object.assign(koiLure, { x: p.x * k, z: p.z * k, until: T + 12 });
    late.reflect(t.point);
  }
  else if (t.kind === 'swing') late.sitSwing(t.sw);
  else if (t.kind === 'board') late.openBoard();
  else if (t.kind === 'animal') t.a.click();
  else if (t.kind === 'thing') t.it.act(t.point);
  else late.openEditor(null);
}
export const joy = $('#joy'), knob = $('#knob'), jv = { x: 0, y: 0 }; let joyId = null;
function updJoy(e) {
  const r = joy.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, m = r.width / 2 - 14;
  let dx = e.clientX - cx, dy = e.clientY - cy; const l = Math.hypot(dx, dy); if (l > m) { dx *= m / l; dy *= m / l; }
  knob.style.transform = `translate(${dx}px,${dy}px)`;
  // a small dead zone, then a gentle curve: easier to stroll slowly, still full speed at the edge
  const n = Math.min(1, Math.hypot(dx, dy) / m), k = n < 0.12 ? 0 : Math.pow((n - 0.12) / 0.88, 1.35) / (n || 1);
  jv.x = dx / m * k; jv.y = -dy / m * k;
}
joy.addEventListener('pointerdown', e => { joyId = e.pointerId; try { joy.setPointerCapture(e.pointerId); } catch (_) {} updJoy(e); e.preventDefault(); });
joy.addEventListener('pointermove', e => { if (e.pointerId === joyId) updJoy(e); });
const joyEnd = e => { if (e.pointerId !== joyId) return; joyId = null; jv.x = jv.y = 0; knob.style.transform = ''; };
joy.addEventListener('pointerup', joyEnd); joy.addEventListener('pointercancel', joyEnd);

