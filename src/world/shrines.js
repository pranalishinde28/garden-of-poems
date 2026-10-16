import * as THREE from 'three';
import { C, V3, rng } from '../core/util.js';
import { groundH } from './terrain.js';
import { scene } from './renderer.js';
import { DS, GEO, Merge, VC } from './geometry.js';
import { decor } from './paths.js';
import { Kit, PAL, brackets, hipRoof, lantern, pagoda, rafters, railing, roofMat, storey, torii } from './architecture.js';
import { SFX } from '../animals/animals.js';
import { addTick, regThing } from '../core/things.js';
import { late } from '../core/late.js';

/* ================= inside the garden: a pagoda, a bell tower, and a Shinto shrine ================= */
// Out past the poem regions, so they never crowd a tree: the pagoda and the bell tower beyond the Wild
// Garden, the shrine on the west beyond the Old Hollow. Each faces the pond. The shrine bell and the
// temple bell can be rung (core/things.js).

const ROOF = roofMat('#4a5553');
function site(x, z, s = 1) {
  const g = new THREE.Group(); g.position.set(x, groundH(x, z) - 0.12, z); g.rotation.y = Math.atan2(-x, -z); g.scale.setScalar(s); scene.add(g);
  return g;
}
// local (x, z) of a site to world, for collision circles
const toWorld = (g, x, z) => { g.updateMatrixWorld(true); const v = g.localToWorld(new V3(x, 0, z)); return v; };
function block(g, x, z, r, collide) { const w = toWorld(g, x, z); decor.push({ x: w.x, z: w.z, r, collide }); }

/* ---------- the three-storey pagoda ---------- */
const PAGODA = { x: 41, z: -31 };
(function buildPagoda() {
  const g = site(PAGODA.x, PAGODA.z), kit = new Kit();
  pagoda(kit, 3, 4.3, { h0: 2.6, h: 1.95 });
  lantern(kit, -4.6, 5.2, 1.1); lantern(kit, 4.6, 5.2, 1.1);
  torii(kit, 3.4, 4.0, 10.5); // the approach to the pagoda passes under a torii
  kit.build(g, VC, ROOF);
  block(g, 0, 0, 6.2, 4.6); for (const sx of [-1, 1]) block(g, sx * 1.75, 10.5, 0.4, 0.3); block(g, -4.6, 5.2, 0.6, 0.35); block(g, 4.6, 5.2, 0.6, 0.35);
})();

/* ---------- the bell tower (shōrō) ---------- */
const BELL = { x: 29, z: -43 };
const bellParts = {};
(function buildBellTower() {
  const g = site(BELL.x, BELL.z), kit = new Kit();
  kit.box(5.2, 0.8, 5.2, 0, 0.4, 0, PAL.stone); kit.box(5.4, 0.1, 5.4, 0, 0.82, 0, PAL.stoneDark);
  for (let s = 0; s < 3; s++) { const sh = 0.27 * (s + 1); kit.box(1.6, sh, 0.36, 0, sh / 2, 2.6 + 0.18 + (2 - s) * 0.36, PAL.stoneDark); }
  // four posts leaning in a little, tied by two rows of beams
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    kit.limb(new V3(sx * 1.85, 0.86, sz * 1.85), new V3(sx * 1.6, 4.3, sz * 1.6), 0.15, 0.13, PAL.red);
    kit.post(0.24, 0.22, sx * 1.85, 0.86, sz * 1.85, PAL.stoneDark, 0.2);
  }
  for (const y of [1.6, 3.5, 4.25]) { const k = (y - 0.86) / 3.44, h = 1.85 - 0.25 * k; for (const s of [-1, 1]) { kit.box(h * 2 + 0.3, 0.16, 0.16, 0, y, s * h, PAL.red); kit.box(0.16, 0.16, h * 2 + 0.3, s * h, y, 0, PAL.red); } }
  kit.box(3.6, 0.24, 0.3, 0, 4.12, 0, PAL.redDark); // the beam the bell hangs from
  brackets(kit, 3.3, 3.3, 4.3, 2);
  rafters(kit, 3.3, 3.3, 4.75, 6.6, 6.6);
  kit.geo(hipRoof(6.8, 6.8, 1.9, 0.7), 0, 4.85, 0, '#ffffff', undefined, 0, 0, 0, true);
  kit.rbox(2.2, 0.32, 0.34, 0, 6.72, 0, '#bdbdbd'); // ridge
  railing(kit, 4.8, 4.8, 0.86, PAL.red, 0);
  torii(kit, 2.8, 3.5, 6.6);
  kit.build(g, VC, ROOF);
  // the bell: bronze, banded, with its rows of nipples and the dragon loop on top
  const bell = new THREE.Group(); bell.position.set(0, 4.0, 0); g.add(bell);
  const bm = new Merge(), bronze = C('#4f6359'), dark = C('#3d4c45');
  const prof = [[0.64, 0], [0.6, 0.08], [0.575, 0.45], [0.565, 1.1], [0.5, 1.38], [0.3, 1.5], [0.01, 1.52]].map(([r, y]) => new THREE.Vector2(r, y));
  bm.add(new THREE.LatheGeometry(prof, 32), new V3(0, -1.52, 0), new V3(1, 1, 1), bronze);
  const band = new THREE.TorusGeometry(1, 0.035, 6, 32).rotateX(Math.PI / 2);
  for (const [y, r] of [[-1.36, 0.6], [-1.02, 0.585], [-0.45, 0.575], [-0.2, 0.52]]) bm.add(band, new V3(0, y, 0), new V3(r, r * 1.4, r), dark);
  for (let p = 0; p < 4; p++) for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
    const a = p * Math.PI / 2 + (i - 1.5) * 0.17, y = -0.55 - j * 0.14; bm.add(GEO.sph, new V3(Math.cos(a) * 0.585, y, Math.sin(a) * 0.585), new V3(0.03, 0.03, 0.03), dark);
  }
  bm.add(new THREE.TorusGeometry(0.16, 0.05, 6, 14), new V3(0, 0.08, 0), new V3(1, 1, 1), dark); // ryūzu
  const bellMesh = new THREE.Mesh(bm.build(), new THREE.MeshLambertMaterial({ vertexColors: true, side: DS })); bellMesh.castShadow = true; bell.add(bellMesh);
  // the striker log, slung on two ropes beside the bell
  const striker = new THREE.Group(); striker.position.set(1.45, 4.12, 0); g.add(striker);
  const sm = new Merge();
  sm.add(new THREE.CylinderGeometry(0.13, 0.13, 1.3, 10).rotateZ(Math.PI / 2), new V3(0.05, -1.12, 0), new V3(1, 1, 1), C('#8a6a4a'));
  for (const x of [-0.35, 0.45]) sm.limb(new V3(x, 0, 0), new V3(x, -1.0, 0), 0.02, 0.02, C('#d8cfb4'));
  const sMesh = new THREE.Mesh(sm.build(), VC); sMesh.castShadow = true; striker.add(sMesh);
  Object.assign(bellParts, { bell, striker });
  block(g, 0, 0, 4.4, 3.2); for (const sx of [-1, 1]) block(g, sx * 1.45, 6.6, 0.4, 0.3);
  const w = toWorld(g, 0, 3.2);
  regThing(g, 'Strike the temple bell', strikeBell, { x: w.x, z: w.z, r: 4.2 });
})();

let bellBusy = false;
function strikeBell() {
  if (bellBusy) return; bellBusy = true;
  const { bell, striker } = bellParts; let t = 0, rang = false, sway = 0;
  addTick(dt => {
    t += dt;
    // pull back, swing in, rebound
    striker.rotation.z = t < 0.7 ? 0.42 * Math.sin(t / 0.7 * Math.PI / 2) : t < 0.95 ? 0.42 * (1 - (t - 0.7) / 0.25) : -0.05 * Math.exp(-(t - 0.95) * 3) * Math.cos((t - 0.95) * 9);
    if (!rang && t >= 0.95) { rang = true; sway = 0.045; SFX.bonsho && SFX.bonsho(); }
    if (rang) { sway *= Math.exp(-dt * 0.5); bell.rotation.z = -sway * Math.sin((t - 0.95) * 4.2); }
    if (t > 7) { bell.rotation.z = 0; striker.rotation.z = 0; bellBusy = false; return false; }
    return true;
  });
  setTimeout(() => late.toast('The bell’s voice carries across the garden.', 3600), 1100);
}

/* ---------- the Shinto shrine ---------- */
const SHRINE = { x: -47, z: -4 };
const shrineParts = {};
(function buildShrine() {
  const g = site(SHRINE.x, SHRINE.z), kit = new Kit();
  kit.box(9.5, 0.1, 17, 0, 0.06, 2, '#cbc3b0'); // the raked gravel court
  for (let z = 13.5; z > 3.6; z -= 1.05) kit.box(1.5, 0.08, 0.82, 0, 0.12, z, PAL.stone); // sandō paving
  // the honden, the inner sanctuary: raised on posts, plain hinoki, a thatched gable with chigi and katsuogi
  const hz = -5.2;
  kit.box(4.6, 0.55, 4.0, 0, 0.27, hz, PAL.stone);
  for (const x of [-1.6, 0, 1.6]) for (const z of [-1.2, 1.2]) kit.post(0.12, 1.4, x, 0.55, hz + z, PAL.hinoki);
  kit.box(3.9, 0.14, 3.1, 0, 1.95, hz, PAL.hinoki);
  railing(kit, 3.8, 3.0, 2.02, '#a9865e', 0);
  kit.box(3.0, 1.8, 2.2, 0, 2.92, hz, PAL.hinoki);
  for (const x of [-1.5, -0.5, 0.5, 1.5]) for (const z of [-1.1, 1.1]) kit.box(0.14, 1.8, 0.14, x, 2.92, hz + z, '#a9865e');
  kit.box(0.95, 1.4, 0.05, 0, 2.75, hz + 1.12, '#6b4a2e'); kit.box(0.08, 1.4, 0.06, 0, 2.75, hz + 1.13, PAL.gold);
  for (let s = 0; s < 4; s++) { const sh = 0.5 * (s + 1); kit.box(1.2, sh, 0.32, 0, sh / 2, hz + 2.0 + (3 - s) * 0.32, '#a9865e'); }
  const slope = Math.atan2(1.2, 1.7), sl = Math.hypot(1.2, 1.7) + 0.2;
  for (const s of [-1, 1]) kit.rbox(4.6, 0.2, sl, 0, 4.42, hz + s * 0.85, '#ffffff', 0, s * slope);
  kit.rbox(4.7, 0.26, 0.42, 0, 5.05, hz, '#c8c8c8');
  for (const sx of [-1, 1]) for (const s of [-1, 1]) kit.box(0.1, 2.0, 0.16, sx * 2.32, 5.0, hz + s * 0.05, '#9c7a52', 0, s * 0.95);
  for (let k = 0; k < 5; k++) { const x = -1.6 + k * 0.8; kit.geo(new THREE.CylinderGeometry(0.12, 0.12, 0.85, 10), x, 5.3, hz, PAL.hinoki, undefined, 0, Math.PI / 2); for (const s of [-1, 1]) kit.geo(new THREE.CylinderGeometry(0.125, 0.125, 0.05, 10), x, 5.3, hz + s * 0.43, PAL.gold, undefined, 0, Math.PI / 2); }
  // the tamagaki fence around it, open at the front
  for (let f = 0; f < 4; f++) {
    const a = f * Math.PI / 2, nx = Math.sin(a), nz = Math.cos(a), half = f % 2 ? 3.4 : 2.9, span = f % 2 ? 5.8 : 6.8, tx = nz, tz = -nx;
    for (let i = 0; i <= 12; i++) { const u = (i / 12 - 0.5) * span; if (f === 0 && Math.abs(u) < 0.8) continue; kit.box(0.09, 0.95, 0.09, tx * u + nx * half, 0.47, hz + tz * u + nz * half, '#7b5e42'); }
    for (const y of [0.85, 0.4]) for (const s of (f === 0 ? [-1, 1] : [0])) { const len = f === 0 ? span / 2 - 0.8 : span, c = f === 0 ? s * (0.8 + len / 2) : 0; kit.box(len, 0.06, 0.06, tx * c + nx * half, y, hz + tz * c + nz * half, '#7b5e42', a + Math.PI / 2); }
  }
  // the haiden, the hall of worship, with a canopy over its steps
  const fz = 1.3;
  kit.box(6.6, 0.5, 5.0, 0, 0.25, fz, PAL.stone);
  for (const x of [-2.6, 0, 2.6]) for (const z of [-1.9, 1.9]) kit.post(0.13, 0.6, x, 0.5, fz + z, PAL.red);
  kit.box(6.0, 0.14, 4.4, 0, 1.08, fz, PAL.wood);
  railing(kit, 5.9, 4.3, 1.15, PAL.red, 0);
  kit.o.set(0, 0, fz); storey(kit, 4.8, 3.2, 1.15, 2.3, 7.6, 6.0, 1.7, 0.5, { doors: false, tiers: 2, bells: false }); kit.o.set(0, 0, 0);
  kit.box(3.2, 1.9, 0.06, 0, 2.15, fz + 1.62, '#2b1e16'); // the dim inside, seen through the open front
  for (let i = -3; i <= 3; i++) kit.box(0.05, 1.9, 0.08, i * 0.45, 2.15, fz + 1.66, '#5a2a1c');
  for (let s = 0; s < 4; s++) { const sh = 0.27 * (s + 1); kit.box(2.6, sh, 0.36, 0, sh / 2, fz + 2.2 + (3 - s) * 0.36, PAL.wood); }
  for (const sx of [-1.4, 1.4]) kit.post(0.11, 3.15, sx, 0, fz + 3.5, PAL.red);
  kit.box(3.1, 0.18, 0.18, 0, 3.12, fz + 3.5, PAL.red);
  kit.rbox(3.6, 0.16, 2.3, 0, 3.4, fz + 3.05, '#ffffff', 0, 0.3);
  // shimenawa: a straw rope with zigzag paper streamers across the front
  const rope = []; for (let i = 0; i <= 12; i++) { const u = i / 12; rope.push(new V3(-1.9 + u * 3.8, 3.0 - Math.sin(u * Math.PI) * 0.28, fz + 3.62)); }
  kit.geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rope), 30, 0.13, 8), 0, 0, 0, PAL.straw);
  for (const u of [0.18, 0.39, 0.61, 0.82]) { const x = -1.9 + u * 3.8, y = 3.0 - Math.sin(u * Math.PI) * 0.28 - 0.18; for (let k = 0; k < 4; k++) kit.box(0.14, 0.12, 0.01, x + (k % 2 ? 0.07 : 0), y - k * 0.13, fz + 3.64, PAL.paper); }
  // the offering box
  kit.box(1.4, 0.62, 0.66, 0, 0.31, fz + 4.4, '#6e4b30');
  for (let i = 0; i < 7; i++) kit.box(1.32, 0.04, 0.06, 0, 0.64, fz + 4.14 + i * 0.087, '#4a3120');
  // komainu, the guardian lion-dogs, on their plinths facing the path
  for (const sx of [-1, 1]) komainu(kit, sx * 2.2, 7.6, sx);
  lantern(kit, -2.7, 10.0, 1.15); lantern(kit, 2.7, 10.0, 1.15);
  // the chōzuya, where hands are washed: a stone basin under a small roof, bamboo ladles on it
  const cx = 3.6, cz = 5.6;
  kit.box(1.3, 0.62, 0.8, cx, 0.31, cz, PAL.stone); kit.box(1.12, 0.03, 0.62, cx, 0.6, cz, '#5d8b95');
  for (let k = 0; k < 3; k++) { kit.limb(new V3(cx - 0.35 + k * 0.32, 0.64, cz - 0.42), new V3(cx - 0.3 + k * 0.32, 0.66, cz + 0.36), 0.015, 0.015, '#b6a46a'); kit.post(0.06, 0.09, cx - 0.35 + k * 0.32, 0.6, cz - 0.48, '#b6a46a'); }
  for (const sx of [-0.8, 0.8]) for (const sz of [-0.55, 0.55]) kit.post(0.07, 2.0, cx + sx, 0, cz + sz, PAL.hinoki);
  for (const s of [-1, 1]) kit.rbox(2.2, 0.1, 1.15, cx, 2.25, cz + s * 0.45, '#ffffff', 0, s * 0.55);
  kit.rbox(2.3, 0.14, 0.2, cx, 2.52, cz, '#c8c8c8');
  torii(kit, 3.5, 4.1, 12.4);
  kit.build(g, VC, ROOF);
  // the bell and its rope, which swing when rung
  const suzu = new THREE.Group(); suzu.position.set(0, 3.05, fz + 3.95); g.add(suzu);
  const bm = new Merge();
  for (const [x, y] of [[0, -0.12], [-0.13, -0.2], [0.13, -0.2]]) bm.add(GEO.sph, new V3(x, y, 0), new V3(0.14, 0.14, 0.14), C(PAL.gold));
  for (let i = 0; i < 8; i++) bm.limb(new V3(0.0, -0.3 - i * 0.22, 0), new V3(0.0, -0.3 - (i + 1) * 0.22, 0), 0.045, 0.045, C(i % 2 ? '#c8352a' : '#f2ece2'));
  for (const sx of [-0.06, 0.06]) bm.limb(new V3(sx, -2.06, 0), new V3(sx * 2, -2.4, 0), 0.03, 0.02, C('#c8352a'));
  const sMesh = new THREE.Mesh(bm.build(), VC); sMesh.castShadow = true; suzu.add(sMesh);
  shrineParts.suzu = suzu;
  block(g, 0, -2.2, 5.2, 3.9); block(g, 0, 4.4, 0.9, 0.7); block(g, cx, cz, 1.1, 0.85);
  for (const sx of [-1, 1]) { block(g, sx * 1.8, 12.4, 0.4, 0.3); block(g, sx * 2.2, 7.6, 0.7, 0.5); block(g, sx * 2.7, 10.0, 0.6, 0.35); }
  block(g, 0, 3, 9.5, -1); // poems keep clear of the whole court
  const w = toWorld(g, 0, fz + 5.2);
  regThing(suzu, 'Ring the shrine bell', ringSuzu, { x: w.x, z: w.z, r: 2.6 });
})();

// a guardian lion-dog sitting on a plinth, turned toward the path
function komainu(kit, x, z, side) {
  const st = '#9a978f', dk = '#85827a', ry = -side * 0.5;
  const at = (lx, ly, lz) => { const c = Math.cos(ry), s = Math.sin(ry); return [x + lx * c + lz * s, ly, z - lx * s + lz * c]; };
  kit.box(1.0, 0.9, 1.0, x, 0.45, z, PAL.stoneDark); kit.box(1.1, 0.12, 1.1, x, 0.95, z, PAL.stone);
  const put = (geo, lx, ly, lz, sx, sy, sz, col) => { const [px, py, pz] = at(lx, ly, lz); kit.geo(geo, px, py, pz, col, new V3(sx, sy, sz), ry); };
  put(GEO.sph, 0, 1.38, -0.12, 0.3, 0.36, 0.38, st); // haunches and body
  put(GEO.sph, 0, 1.55, 0.12, 0.25, 0.32, 0.22, st); // chest
  for (const s of [-1, 1]) { put(GEO.box, s * 0.13, 1.25, 0.24, 0.1, 0.42, 0.1, st); put(GEO.box, s * 0.13, 1.06, 0.29, 0.13, 0.06, 0.16, dk); }
  put(GEO.sph, 0, 1.98, 0.16, 0.22, 0.21, 0.22, st); // head
  put(GEO.sph, 0, 1.94, 0.33, 0.13, 0.1, 0.1, dk); // muzzle
  for (let k = 0; k < 7; k++) { const a = (k / 6 - 0.5) * 2.6; put(GEO.sph, Math.sin(a) * 0.22, 1.98 + Math.cos(a) * 0.12, 0.06, 0.1, 0.1, 0.1, dk); } // curled mane
  put(GEO.sph, 0, 1.6, -0.42, 0.13, 0.22, 0.1, dk); // tail flame
  if (side > 0) put(GEO.sph, 0.14, 1.12, 0.33, 0.09, 0.09, 0.09, dk); // a ball under one paw
}

let suzuBusy = false;
function ringSuzu() {
  if (suzuBusy) return; suzuBusy = true;
  const { suzu } = shrineParts; let t = 0;
  SFX.suzu && SFX.suzu();
  addTick(dt => {
    t += dt; suzu.rotation.x = 0.16 * Math.exp(-t * 0.9) * Math.sin(t * 7.5); suzu.rotation.z = 0.05 * Math.exp(-t) * Math.sin(t * 5.3);
    if (t > 3.2) { suzu.rotation.set(0, 0, 0); suzuBusy = false; return false; }
    return true;
  });
  late.toast('The bell rings. Make a wish, or simply say thank you.', 3800);
}

/* ---------- their voices ---------- */
// the temple bell: a deep hum with its own beating partials, fading over many seconds
SFX.bonsho = function () {
  const o = this.out(); if (!o) return; const ctx = late.Music.ctx, t = ctx.currentTime + 0.02, f0 = 98;
  [[1, 0.32, 9], [2.02, 0.16, 7], [2.76, 0.12, 5], [3.52, 0.07, 4], [5.4, 0.045, 2.6], [6.8, 0.03, 1.8]].forEach(([r, a, d]) => {
    for (const det of [1, 1.0035]) {
      const os = ctx.createOscillator(), g = ctx.createGain(); os.frequency.value = f0 * r * det;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(a / 2, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      os.connect(g); g.connect(o); os.start(t); os.stop(t + d + 0.1);
    }
  });
  const len = ctx.sampleRate * 0.12, buf = ctx.createBuffer(1, len, ctx.sampleRate), dd = buf.getChannelData(0); for (let i = 0; i < len; i++) dd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
  const n = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), ng = ctx.createGain(); n.buffer = buf; lp.type = 'lowpass'; lp.frequency.value = 500; ng.gain.value = 0.35; n.connect(lp); lp.connect(ng); ng.connect(o); n.start(t);
};
// the shrine bell: a cluster of small brass bells shaken on their rope
SFX.suzu = function () {
  const o = this.out(); if (!o) return; const ctx = late.Music.ctx, t0 = ctx.currentTime + 0.02, R = rng(Math.floor(Math.random() * 1e6));
  for (let k = 0; k < 14; k++) {
    const t = t0 + k * 0.055 + R() * 0.03, amp = 0.05 * Math.exp(-k * 0.16);
    [3100, 4650, 6200].forEach((f, i) => { const os = ctx.createOscillator(), g = ctx.createGain(); os.frequency.value = f * (0.97 + R() * 0.06); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amp / (i + 1), t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28); os.connect(g); g.connect(o); os.start(t); os.stop(t + 0.3); });
  }
};

export const LANDMARKS = { pagoda: PAGODA, bell: BELL, shrine: SHRINE };
