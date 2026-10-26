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
  h -= smooth(182, 206, r) * 24; // the ground's far edge tucks under the hills (world/ground.js)
  return h;
}
// Takachiho Gorge, beyond the hedge to the east (world/gorge.js builds it). In the gorge's own frame, along =
// distance out from the centre on its axis and across = sideways from its centre line, which bends right
// as it goes in so the far end stays hidden. A meadow valley runs from the lookout down to a pool at the
// gorge's mouth; the canyon is wide at the pool and narrows to a slot at the far end.
// the water lies a few metres below the lawn, so from the lookout you look down onto it
export const GORGE = { a: 0.12, r0: 104, r1: 186, floor: -2.2 };
export const gorgeBend = u => smooth(130, 186, u) * 26;
export const gorgeHalf = u => 12 + 7 * (1 - smooth(GORGE.r0, GORGE.r0 + 26, u)) - 8 * smooth(160, 184, u);
export const gorgeLocal = (x, z) => { const c = Math.cos(GORGE.a), s = Math.sin(GORGE.a), along = x * c + z * s; return { along, across: -x * s + z * c - gorgeBend(along) }; };
export const gorgeWorld = (along, across, y = 0) => { const c = Math.cos(GORGE.a), s = Math.sin(GORGE.a), v = across + gorgeBend(along); return new V3(along * c - v * s, y, along * s + v * c); };
// the pool at the mouth: an irregular oval, its near shore about 20 m beyond the lookout
export function gorgePool(u, v) { const du = (u - (GORGE.r0 - 6)) / 12, dv = v / 19, a = Math.atan2(dv, du); return Math.hypot(du, dv) * (1 + 0.1 * Math.sin(a * 3 + 1) + 0.05 * Math.sin(a * 7 + 2)); }
function gorgeCarve(x, z, h) {
  const g = gorgeLocal(x, z), u = g.along, a = Math.abs(g.across), A0 = GORGE.r0;
  if (u < 74 || u > GORGE.r1 + 8) return h;
  // the meadow from the lookout down to the pool
  const kv = (1 - smooth(9, 24, a)) * smooth(74, 80, u) * (1 - smooth(A0 + 2, A0 + 12, u));
  if (kv > 0) h = lerp(h, lerp(Math.min(h, 0.95), GORGE.floor + 0.35, smooth(77, 87, u)), kv);
  // the canyon floor
  if (u > A0 - 4) { const w = gorgeHalf(Math.max(u, A0)), k = (1 - smooth(w, w + 9, a)) * smooth(A0 - 4, A0 + 2, u); if (k > 0) h = lerp(h, GORGE.floor - 0.7, k); }
  // the cave behind Manai Falls, on the left wall (world/gorge.js builds its vault)
  if (g.across < 0 && Math.abs(u - 146) < 4.8 && -g.across < gorgeHalf(u) + 12.5) h = Math.min(h, GORGE.floor - 0.9);
  // the pool
  const kb = 1 - smooth(0.8, 1.05, gorgePool(u, g.across));
  if (kb > 0) h = lerp(h, GORGE.floor - 0.9, kb);
  return h;
}
// the way down from the lookout: stepping stones over the meadow to a jetty on the pool's near shore
export const JETTY = { u0: 85.5, u1: 93.5, half: 0.95, y: GORGE.floor + 0.32 };
export function gorgeJettyH(x, z) { if (x < 60) return null; const g = gorgeLocal(x, z); return g.along > JETTY.u0 && g.along < JETTY.u1 && Math.abs(g.across) < JETTY.half ? JETTY.y : null; }
// where you may walk beyond the hedge: through its gap, down the meadow to the shore, and out along the jetty
export function gorgeWalk(x, z) {
  if (x < 60) return false;
  const g = gorgeLocal(x, z), a = Math.abs(g.across);
  if (g.along < 70 || g.along > GORGE.r0 - 2) return false;
  if (gorgeJettyH(x, z) !== null) return true;
  return a < (g.along < 79 ? 5.2 : 11) && gorgePool(g.along, g.across) > 1.02;
}
export function groundH(x, z) {
  let h = baseH(x, z);
  if (x > 60) h = gorgeCarve(x, z, h);
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


/* the shore, when the garden looks out to sea (world/horizon.js turns it on): the sand slopes from the
   garden's edge into the water, and you may walk down it and wade until the sea is about a metre deep */
export const SEA_Y = -0.9, SHORE_MAX_R = 112;
export const shore = { on: false };
export function beachH(x, z) {
  const r = Math.hypot(x, z), k = smooth(70, 80, r);
  return (1 - k) * groundH(x, z) + k * Math.max(-9, 0.35 - (r - 80) * 0.09) + Math.sin(x * 0.11 + z * 0.07) * 0.08 * k;
}
export const seaDepth = (x, z) => shore.on && Math.hypot(x, z) > 70 ? Math.max(0, SEA_Y - beachH(x, z)) : 0;
