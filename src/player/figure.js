import * as THREE from 'three';
import { V3, clamp } from '../core/util.js';
import { state, T } from '../core/state.js';
import { scene, camera } from '../world/renderer.js';
import { POND_R } from '../world/terrain.js';
import { flag } from '../settings/storage.js';
import { decor, featOn } from '../world/paths.js';
import { bench } from '../world/decor.js';
import { plants } from '../plants/registry.js';
import { curLook, floorH, lookDir, player } from './camera.js';
import { animateAvatar, buildAvatar, cleanAvatar, figureMetrics } from './avatar.js';

/* ================= your figure in the garden, and the third-person camera ================= */
// In first person the figure only appears where the camera is elsewhere (it never blocks your eyes).
// In third person (V) the camera follows over the shoulder and pulls in rather than pass through
// arbor posts, swings, lanterns or trees.

let config = cleanAvatar((() => { try { return JSON.parse(flag.get('avatar') || 'null'); } catch (e) { return null; } })());
export const getAvatar = () => ({ ...config });
let fig = buildAvatar(config); scene.add(fig.root);
state.thirdPerson = flag.get('view') === 'third';

// a soft round shadow, cheaper than redrawing the shadow map whenever you move
const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
  map: (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(20,28,16,.42)'); gr.addColorStop(1, 'rgba(20,28,16,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })(),
  transparent: true, depthWrite: false }));
blob.renderOrder = 2; scene.add(blob);

export function setAvatar(cfg) {
  config = cleanAvatar(cfg); flag.set('avatar', JSON.stringify(config));
  const old = fig; fig = buildAvatar(config); fig.root.position.copy(old.root.position); fig.root.quaternion.copy(old.root.quaternion); fig.phase = old.phase;
  scene.remove(old.root); scene.add(fig.root);
  if (config.kind !== 'bird' && config.kind !== 'cat') { player.alt = 0; player.vy = 0; }
}
export function setThirdPerson(on) { state.thirdPerson = !!on; flag.set('view', on ? 'third' : 'first'); camD = 0; }

// ---- third-person camera ----
const cam = { pos: new V3(), ready: false }; let camD = 0;
function obstacles() {
  const list = [];
  decor.forEach(o => { if (o.collide > 0 && (!o.key || featOn(o.key))) list.push([o.x, o.z, o.collide + 0.25]); });
  plants.forEach(pl => { if (pl.vis < 0.5 || pl.dying || !pl.root.visible) return; const r = pl.h > 2.5 ? Math.max(pl.radius * 0.45, (pl.collide || 0) + 0.35) : (pl.collide || 0) + 0.3; if (r > 0.3) list.push([pl.root.position.x, pl.root.position.z, r]); });
  return list;
}
// how far the camera can sit behind a point, along a horizontal direction, before something is in the way
function clearDistance(x, z, dx, dz, max) {
  let best = max;
  for (const [cx, cz, r] of obstacles()) {
    const fx = x - cx, fz = z - cz; if (fx * fx + fz * fz < r * r) continue;
    const b = fx * dx + fz * dz, c = fx * fx + fz * fz - r * r, disc = b * b - c;
    if (disc < 0) continue; const t = -b - Math.sqrt(disc); if (t > 0 && t < best) best = t;
  }
  return Math.max(0.6, best - 0.3);
}
function followCamera(dt, head, dir, right, want) {
  const hx = -dir.x, hz = -dir.z, hl = Math.hypot(hx, hz) || 1;
  const allowed = clearDistance(head.x, head.z, hx / hl, hz / hl, want);
  camD += (allowed - camD) * (1 - Math.exp(-dt * (allowed < camD ? 22 : 3)));
  const s = camD / want, p = head.clone().addScaledVector(dir, -camD).addScaledVector(right, 0.45 * s); p.y += 0.3 * s;
  p.y = Math.max(p.y, floorH(p.x, p.z) + 0.4);
  if (!cam.ready) { cam.pos.copy(camera.position); cam.ready = true; }
  cam.pos.lerp(p, 1 - Math.exp(-dt * 10));
  camera.position.copy(cam.pos);
  curLook.copy(head).addScaledVector(dir, 8).addScaledVector(right, 0.45 * s); camera.lookAt(curLook);
}

// ---- placing the figure for each activity ----
const tmp = new V3(), up = new V3(), q = new THREE.Quaternion(), flip = new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), Math.PI);
let prevMode = state.mode, kneel = null, facing = 0;
const turnTo = (a, b, k) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * k; };
function placeAt(x, z, yaw, dt, snap) {
  const y = floorH(x, z), r = fig.root;
  if (snap) r.position.set(x, y, z); else r.position.lerp(tmp.set(x, y, z), 1 - Math.exp(-dt * 12));
  facing = snap ? yaw : turnTo(facing, yaw, 1 - Math.exp(-dt * 9)); r.quaternion.setFromAxisAngle(up.set(0, 1, 0), facing);
}
function kneelSpot(plant) {
  const c = plant.root.position, a = Math.atan2(camera.position.z - c.z, camera.position.x - c.x) + 1.15, d = Math.max(0.75, (plant.collide || 0) + 0.65, plant.radius * 0.35);
  const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
  return { x, z, yaw: Math.atan2(-(c.x - x), -(c.z - z)) };
}

export function updateFigure(dt) {
  const m = state.mode, third = state.thirdPerson, r = fig.root;
  // coming back to walking from reading or writing: stand where the figure was, not where the camera was
  if (m !== prevMode) cam.ready = false;
  if (m === 'walk' && prevMode !== 'walk') {
    if (third && kneel && prevMode === 'focus') { player.pos.set(kneel.x, 0, kneel.z); player.yaw = kneel.yaw; }
    camD = Math.min(camD, 1);
  }
  if (m !== 'focus') kneel = null;
  prevMode = m;
  let show = false, pose = 'idle', a = {};
  if (m === 'walk') {
    show = third; const sp = Math.hypot(player.vel.x, player.vel.z);
    const want = sp > 0.3 ? Math.atan2(-player.vel.x, -player.vel.z) : facing;
    placeAt(player.pos.x, player.pos.z, sp > 0.3 ? want : facing, dt, !r.visible);
    pose = 'walk'; a.speed = sp; a.alt = player.alt || 0; a.vy = player.vy || 0; a.fly = config.kind === 'bird' && a.alt > 0.15;
    if (third) {
      const M = figureMetrics(config), head = tmp.set(player.pos.x, floorH(player.pos.x, player.pos.z) + M.head + 0.25 * (M.head / 0.9) + a.alt, player.pos.z).clone();
      const dir = lookDir(), right = new V3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
      followCamera(dt, head, dir, right, M.cam + (a.fly ? 0.9 : 0));
    }
  } else if (m === 'swing' && state.swing) {
    show = third; pose = 'swing'; const sw = state.swing; a.omega = sw.omega;
    sw.g.updateMatrixWorld(true); sw.pivot.getWorldQuaternion(q); up.set(0, 1, 0).applyQuaternion(q);
    const hips = sw.pivot.localToWorld(new V3(0, -sw.L + 0.04, 0.02));
    r.position.copy(hips).addScaledVector(up, -figureMetrics(config).sit); r.quaternion.copy(q).multiply(flip);
    if (third) { // watch from behind the swing, toward the pond; dragging turns the view
      const f = new V3(0, 0, 1).applyQuaternion(sw.g.quaternion), side = new V3(f.z, 0, -f.x), ya = sw.yaw * 0.8;
      const base = sw.g.position, dirH = f.clone().multiplyScalar(Math.cos(ya)).addScaledVector(side, Math.sin(ya));
      const p = base.clone().addScaledVector(dirH, 4.4); p.y = floorH(p.x, p.z) + 1.4 - sw.pitch * 2;
      if (!cam.ready) { cam.pos.copy(camera.position); cam.ready = true; }
      cam.pos.lerp(p, 1 - Math.exp(-dt * 4)); camera.position.copy(cam.pos); curLook.copy(base).setY(base.y + 1.25); camera.lookAt(curLook);
    }
  } else if (m === 'writing') {
    show = third; pose = 'write';
    const seat = bench.localToWorld(new V3(0, 0, 0.02)); r.position.set(seat.x, bench.position.y + 0.485 - figureMetrics(config).sit, seat.z); // sit on the slats, feet swinging
    facing = bench.rotation.y + Math.PI; r.quaternion.setFromAxisAngle(up.set(0, 1, 0), facing);
  } else if (m === 'focus') {
    show = third;
    if (state.reflection) {
      // on the shore just ahead of the reflection camera (reading.js puts it 11 m out, looking a little right)
      // reading.js picks a clear spot on the shore and frames it (state.pondSpot)
      const sp = state.pondSpot || { x: 0, z: POND_R + 0.55 };
      placeAt(sp.x, sp.z, Math.atan2(sp.x, sp.z), dt, false); pose = 'pond';
    } else {
      const pl = plants.get(state.reading);
      if (pl) { if (!kneel) kneel = kneelSpot(pl); placeAt(kneel.x, kneel.z, kneel.yaw, dt, false); pose = 'kneel'; }
    }
  } else if (m === 'cinematic') {
    show = third && r.visible && !state.gliding && !state.swing; pose = 'idle';
  }
  r.visible = show; blob.visible = show;
  if (!show) return;
  animateAvatar(fig, pose, dt, T, a);
  const bx = r.position.x, bz = r.position.z; blob.position.set(bx, floorH(bx, bz) + 0.03, bz); blob.scale.setScalar(pose === 'swing' ? 0.7 : 0.85);
}
