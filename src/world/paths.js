import * as THREE from 'three';
import { C, V3, rng, smooth } from '../core/util.js';
import { RIVER, groundH, riverDist } from './terrain.js';
import { SETTINGS } from '../settings/storage.js';
import { scene } from './renderer.js';
import { VC, rockGeo } from './geometry.js';
import { groundMesh } from './ground.js';

/* ================= paths ================= */
export const stones = [];
// the writing bench and the swings stand round to the west, at right angles to the gate (round 36): moved
// round the pond on their circles by SIDE_TURN, but still facing exactly the way they did beside the gate
export const SIDE_TURN = -0.883;
export const turnRound = (x, z) => { const c = Math.cos(SIDE_TURN), s = Math.sin(SIDE_TURN); return { x: x * c + z * s, z: -x * s + z * c }; };
export const BENCH = { ...turnRound(-9.4, 12.6), face: Math.atan2(9.4, -12.6) };
export const TULIPS = [{ x0: 2.7, x1: 8.2, z0: 16.5, z1: 31.5 }, { x0: -8.2, x1: -2.7, z0: 16.5, z1: 31.5 }, { x0: 24, x1: 38, z0: 40, z1: 52, field: true }, { x0: -38, x1: -24, z0: 40, z1: 52, field: true }];
export const inTulip = (x, z, m) => TULIPS.some(t => x > t.x0 - m && x < t.x1 + m && z > t.z0 - m && z < t.z1 + m);
function addPath(pts, spacing, R) {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new V3(p[0], 0, p[1])));
  const n = Math.floor(curve.getLength() / spacing);
  for (let i = 0; i <= n; i++) {
    const p = curve.getPointAt(i / n), tg = curve.getTangentAt(i / n), j = (R() - 0.5) * 0.45;
    const x = p.x - tg.z * j, z = p.z + tg.x * j;
    if (stones.some(s => Math.hypot(s.x - x, s.z - z) < 0.75)) continue;
    if (riverDist(x, z) < 2.6) continue;
    stones.push({ x, z, s: 0.8 + R() * 0.45, r: R() * 6.28 });
  }
}
(function buildPaths() {
  const R = rng(11);
  addPath([[0, 41], [0.8, 33], [-0.6, 25], [0.5, 17.5], [0, 10.6]], 1.05, R);
  // a short spur from the pond's ring path to the front of the writing bench
  { const u = Math.hypot(BENCH.x, BENCH.z), ux = BENCH.x / u, uz = BENCH.z / u, fx = BENCH.x + Math.sin(BENCH.face) * 1.3, fz = BENCH.z + Math.cos(BENCH.face) * 1.3;
    addPath([[ux * 10.4, uz * 10.4], [(ux * 10.4 + fx) / 2, (uz * 10.4 + fz) / 2], [fx, fz]], 1.0, R); }
  const ring = []; for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.25) ring.push([Math.cos(a) * 10.4, Math.sin(a) * 10.4]);
  addPath(ring, 1.1, R);
  const ring2 = []; for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.12) ring2.push([Math.cos(a) * 44, Math.sin(a) * 44]);
  addPath(ring2, 1.25, R);
  const rs = []; for (let i = 10; i < 82; i += 3) { const p = RIVER[i], q = RIVER[i + 1]; const tx = q.x - p.x, tz = q.z - p.z, L = Math.hypot(tx, tz); rs.push([p.x + tz / L * 4.2, p.z - tx / L * 4.2]); }
  addPath(rs, 1.15, R);
  const mesh = new THREE.InstancedMesh(rockGeo(4), VC, stones.length);
  const d = new THREE.Object3D();
  stones.forEach((s, i) => {
    d.position.set(s.x, groundH(s.x, s.z) + 0.01, s.z); d.rotation.set(0, s.r, 0);
    d.scale.set(0.45 * s.s * (0.85 + R() * 0.3), 0.09, 0.4 * s.s); d.updateMatrix(); mesh.setMatrixAt(i, d.matrix);
    mesh.setColorAt(i, C('#ffffff').lerp(C('#c9c0ad'), R()));
  });
  mesh.frustumCulled = false; mesh.receiveShadow = true; scene.add(mesh);
})();
export const stoneNear = (x, z, d) => stones.some(s => Math.hypot(s.x - x, s.z - z) < d);
(function wearGround() {
  const grid = new Map(), key = (x, z) => Math.floor(x / 3) + ',' + Math.floor(z / 3);
  stones.forEach(s => { const k = key(s.x, s.z); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(s); });
  const pos = groundMesh.geometry.attributes.position, col = groundMesh.geometry.attributes.color, soil = C('#7d6b52'), t = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i); let best = 9;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const cell = grid.get((Math.floor(x / 3) + a) + ',' + (Math.floor(z / 3) + b)); if (cell) cell.forEach(s => { const d = Math.hypot(s.x - x, s.z - z); if (d < best) best = d; }); }
    if (best < 1.3) { t.setRGB(col.getX(i), col.getY(i), col.getZ(i)).lerp(soil, (1 - smooth(0.4, 1.3, best)) * 0.55); col.setXYZ(i, t.r, t.g, t.b); }
  }
  col.needsUpdate = true;
})();

/* decor obstacles (lanterns, rocks) so poems never grow into them */
export const decor = [];
export const REG = {}; let regKey = null, regS = 0, regD = 0;
export function regBegin(k) { regEnd(); regKey = k; regS = scene.children.length; regD = decor.length; }
export function regEnd() { if (!regKey) return; (REG[regKey] = REG[regKey] || []).push(...scene.children.slice(regS)); decor.slice(regD).forEach(o => { o.key = regKey; }); regKey = null; }
export const featOn = k => SETTINGS.show[k] !== false;
export const decorNear = (x, z, d) => decor.some(o => Math.hypot(o.x - x, o.z - z) < d + o.r);

