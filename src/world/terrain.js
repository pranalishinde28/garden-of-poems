import * as THREE from 'three';
import { V3, clamp, lerp, smooth } from '../core/util.js';

/* ================= terrain, pond and river ================= */
export const WATER_Y = -0.38, POND_R = 8.3, WORLD_R = 72;
export const RIVER = new THREE.CatmullRomCurve3([[-2.4, -5], [-4.4, -12], [-2.6, -19], [-6.8, -26.5], [-5.2, -34], [-10.5, -43], [-9, -55], [-15.5, -70], [-13.5, -92], [-22, -130], [-26, -170]].map(p => new V3(p[0], 0, p[1]))).getPoints(150).map(v => ({ x: v.x, z: v.z }));
export function riverDist(x, z) {
  if (z > 2) return 99;
  let best = 1e9;
  for (let i = 0; i < RIVER.length - 1; i++) {
    const a = RIVER[i], b = RIVER[i + 1], abx = b.x - a.x, abz = b.z - a.z;
    const t = clamp(((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz), 0, 1);
    const dx = x - (a.x + abx * t), dz = z - (a.z + abz * t), d = dx * dx + dz * dz;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}
function baseH(x, z) {
  const r = Math.hypot(x, z);
  let h = Math.sin(x * 0.07 + 1.3) * 0.55 + Math.cos(z * 0.06) * 0.55 + Math.sin((x - z) * 0.13) * 0.22 + Math.sin(x * 0.31 + z * 0.27) * 0.06;
  h *= smooth(9, 22, r);
  h -= (1 - smooth(5.5, 9, r)) * 1.0;
  h += smooth(72, 100, r) * 4 + smooth(85, 165, r) * (5 + 3.5 * Math.sin(x * 0.031) + 3.5 * Math.cos(z * 0.027));
  return h;
}
export function groundH(x, z) {
  let h = baseH(x, z);
  const rd = riverDist(x, z);
  if (rd < 4) h = lerp(h, -0.95, 1 - smooth(1.3, 3.5, rd));
  return h;
}

/* bridge over the river where the pond-ring path crosses it */
function makeBridge(rr) {
  let best = null, bd = 9;
  RIVER.forEach(p => { const d = Math.abs(Math.hypot(p.x, p.z) - rr); if (d < bd) { bd = d; best = p; } });
  const a = Math.atan2(best.z, best.x), D = { x: -Math.sin(a), z: Math.cos(a) }, half = 3.6;
  const y0 = Math.max(baseH(best.x + D.x * half, best.z + D.z * half), baseH(best.x - D.x * half, best.z - D.z * half), WATER_Y + 0.25);
  return { x: best.x, z: best.z, D, half, y0 };
}
export const BRIDGES = [makeBridge(10.4), makeBridge(44)];
const BRIDGE = BRIDGES[0];
export function bridgeH(x, z) {
  for (const B of BRIDGES) {
    const dx = x - B.x, dz = z - B.z, u = dx * B.D.x + dz * B.D.z, v = -dx * B.D.z + dz * B.D.x;
    if (Math.abs(u) > B.half + 0.3 || Math.abs(v) > 0.9) continue;
    return B.y0 + 0.6 * Math.cos(clamp(u / B.half, -1, 1) * Math.PI / 2) + 0.1;
  }
  return null;
}

