import * as THREE from 'three';
import { C, V3, lerp, rng } from '../core/util.js';
import { groundH } from './terrain.js';
import { scene } from './renderer.js';
import { racemeTex } from './textures.js';
import { windify } from './wind.js';
import { DS, GEO, M, Merge, VC, part, rockGeo } from './geometry.js';
import { nightGlow } from '../plants/registry.js';
import { BENCH, decor, regBegin, regEnd, turnRound } from './paths.js';
import { arborLeaves, wisGeoBase } from './arbors.js';
import { GREEN_PALS, mapleMat } from '../plants/autumnLeaves.js';

/* ================= swings ================= */
export const swings = [];
export const swingVeilTex = racemeTex('#ffe6ee', '#e5739c', 59);
export const swingVeilMat = windify(new THREE.MeshLambertMaterial({ map: swingVeilTex, alphaTest: 0.42, side: DS, emissive: '#2a1018' }), 0.03, 'const');
export const SWING_GARDEN = (() => { const p = turnRound(-19, 21); return { ...p, face: Math.atan2(-p.x, -p.z) }; })(); // west of the pond beside the writing bench, facing the pond
// a white pergola swing, after the owner's picture: four thick square posts, beams and rafters, climbing
// leaves, a coral bench on chains (slatted seat and back, white arms and frame), flower baskets hanging
// from the beams, planter boxes at the front, and a string of lights that glows at sunset and at night
const WHITE = '#f1ede4', WHITE_D = '#ddd7cb', CORAL = '#d85a43';
const lightMat = new THREE.MeshLambertMaterial({ color: '#fff3cf', emissive: '#ffcf7a', emissiveIntensity: 0.4 });
nightGlow.push({ m: lightMat, day: 0.35, night: 2.2 });
function buildSwing(x, z, ry, seed) {
  const g = new THREE.Group(); g.position.set(x, groundH(x, z), z); g.rotation.y = ry; scene.add(g);
  const H = 3.25, PX = 1.35, PZ = 1.05, R = rng(seed);
  const frame = new Merge(), w = C(WHITE), wd = C(WHITE_D);
  const box = (sx, sy, sz, px, py, pz, c = w) => frame.add(GEO.box, new V3(px, py, pz), new V3(sx, sy, sz), c);
  for (const sx of [-PX, PX]) for (const sz of [-PZ, PZ]) {
    box(0.2, H, 0.2, sx, H / 2, sz); box(0.3, 0.22, 0.3, sx, 0.11, sz, wd); // posts on plinths
    for (const [dx, dz] of [[1, 0], [0, 1]]) { const k = new V3(sx - Math.sign(sx) * 0.35 * dx, H - 0.38, sz - Math.sign(sz) * 0.35 * dz); frame.add(GEO.box, k, new V3(0.09, 0.62, 0.09), w, new THREE.Quaternion().setFromEuler(new THREE.Euler(dz * Math.sign(sz) * -0.78, 0, dx * Math.sign(sx) * 0.78))); } // knee braces
  }
  for (const sz of [-PZ, PZ]) box(2 * PX + 0.7, 0.26, 0.16, 0, H + 0.02, sz); // the two main beams the swing hangs between
  box(0.16, 0.26, 2 * PZ + 0.5, -PX, H + 0.02, 0); box(0.16, 0.26, 2 * PZ + 0.5, PX, H + 0.02, 0);
  box(2 * PX + 0.3, 0.22, 0.18, 0, H + 0.02, 0); // the swing beam, across the middle
  for (let k = -5; k <= 5; k++) box(0.09, 0.16, 2 * PZ + 0.85, k * 0.27, H + 0.22, 0); // rafters
  for (let k = -3; k <= 3; k++) box(2 * PX + 0.9, 0.05, 0.07, 0, H + 0.33, k * 0.36); // top slats
  const fm = new THREE.Mesh(frame.build(), VC); fm.castShadow = true; fm.receiveShadow = true; g.add(fm);
  // climbing leaves on the posts and along the beams (they turn with the season)
  const NL = 230, lg = GEO.card.clone(); lg.boundingSphere = new THREE.Sphere(new V3(0, H / 2, 0), H + 2);
  const leaves = new THREE.InstancedMesh(lg, mapleMat, NL), dv = new THREE.Object3D(), flowers = new Merge();
  for (let i = 0; i < NL; i++) {
    const t = R(), onBeam = R() < 0.55, sx = R() < 0.5 ? -PX : PX, sz = R() < 0.5 ? -PZ : PZ;
    const p = onBeam ? new V3(-PX - 0.3 + t * (2 * PX + 0.6), H + 0.1 + (R() - 0.3) * 0.35, sz + (R() - 0.5) * 0.4) : new V3(sx + (R() - 0.5) * 0.3, Math.pow(t, 0.7) * H, sz + (R() - 0.5) * 0.3);
    if (onBeam && R() < 0.3) p.y -= R() * 0.7; // trailing strands
    dv.position.copy(p); dv.rotation.set(R() * 6.28, R() * 6.28, R() * 6.28); dv.scale.setScalar(0.22 + R() * 0.16); dv.updateMatrix();
    leaves.setMatrixAt(i, dv.matrix); leaves.setColorAt(i, C(GREEN_PALS[1][i % 4]));
    if (i % 6 === 0) flowers.add(GEO.ico, p.clone().add(new V3(0, 0.03, 0.05)), new V3(0.05, 0.04, 0.05), C(['#ffffff', '#f6c6d6'][i % 2]));
  }
  g.add(leaves); arborLeaves.push(leaves);
  // hanging baskets of white flowers at the back corners, planter boxes of red and pink at the front
  const pot = new Merge();
  for (const sx of [-PX + 0.15, PX - 0.15]) {
    const by = H - 1.15, bz = -PZ - 0.05;
    for (const a of [0, 2.1, 4.2]) pot.limb(new V3(sx, H - 0.1, bz), new V3(sx + Math.cos(a) * 0.2, by + 0.15, bz + Math.sin(a) * 0.2), 0.008, 0.008, C('#8c8a86'));
    pot.add(GEO.half, new V3(sx, by + 0.15, bz), new V3(0.24, -0.2, 0.24), C('#6e5b47'));
    for (let k = 0; k < 26; k++) { const a = R() * 6.28, r = Math.sqrt(R()) * 0.32; pot.add(GEO.ico, new V3(sx + Math.cos(a) * r, by + 0.18 + R() * 0.12 - r * 0.4, bz + Math.sin(a) * r), new V3(0.06, 0.05, 0.06), C(k % 3 ? '#fbfbf6' : '#6f9a4a')); }
    for (let k = 0; k < 10; k++) { const a = R() * 6.28; pot.limb(new V3(sx + Math.cos(a) * 0.2, by + 0.12, bz + Math.sin(a) * 0.2), new V3(sx + Math.cos(a) * 0.32, by - 0.25 - R() * 0.3, bz + Math.sin(a) * 0.32), 0.012, 0.008, C('#5f8a40')); }
  }
  for (const sx of [-PX - 0.55, PX + 0.55]) {
    const pz = PZ + 0.45; pot.add(GEO.box, new V3(sx, 0.22, pz), new V3(0.75, 0.44, 0.5), C('#9a7a5c'));
    for (let k = 0; k < 4; k++) pot.add(GEO.box, new V3(sx, 0.07 + k * 0.11, pz + 0.255), new V3(0.76, 0.012, 0.012), C('#7a5c44'));
    for (let k = 0; k < 30; k++) pot.add(GEO.ico, new V3(sx + (R() - 0.5) * 0.66, 0.5 + R() * 0.16, pz + (R() - 0.5) * 0.42), new V3(0.06, 0.05, 0.06), C(['#d94040', '#f07aa6', '#ffffff', '#4f7a3c', '#c2376a'][k % 5]));
    decor.push({ ...(() => { const v = new V3(sx, 0, pz).applyAxisAngle(new V3(0, 1, 0), ry); return { x: x + v.x, z: z + v.z }; })(), r: 0.5, collide: 0.4 });
  }
  const pm = new THREE.Mesh(pot.build(), VC); pm.castShadow = true; g.add(pm);
  // a string of lights draped along the beams and down the front posts
  const bulbs = new Merge(), cable = new Merge();
  const drape = (a, b, n, sag) => { for (let k = 0; k <= n; k++) { const t = k / n, p = a.clone().lerp(b, t); p.y -= Math.sin(t * Math.PI) * sag; bulbs.add(GEO.sph, p.clone().add(new V3(0, -0.05, 0)), new V3(0.045, 0.055, 0.045), C('#ffffff')); if (k) { const q = a.clone().lerp(b, (k - 1) / n); q.y -= Math.sin((k - 1) / n * Math.PI) * sag; cable.limb(q, p, 0.005, 0.005, C('#3a3a36')); } } };
  for (const sz of [-PZ, PZ]) drape(new V3(-PX, H - 0.12, sz + Math.sign(sz) * 0.1), new V3(PX, H - 0.12, sz + Math.sign(sz) * 0.1), 12, 0.22);
  for (const sx of [-PX, PX]) drape(new V3(sx + Math.sign(sx) * 0.12, H - 0.12, PZ + 0.12), new V3(sx + Math.sign(sx) * 0.12, 0.6, PZ + 0.12), 7, 0);
  g.add(new THREE.Mesh(bulbs.build(), lightMat)); g.add(new THREE.Mesh(cable.build(), VC));
  // the swing: a bench on chains, its seat about 0.95 m up
  const pivot = new THREE.Group(); pivot.position.set(0, H - 0.1, 0); g.add(pivot);
  const L = H - 0.1 - 0.95, bench = new Merge(), coral = C(CORAL), cw = C(WHITE);
  const bb = (sx, sy, sz, px, py, pz, c) => bench.add(GEO.box, new V3(px, py, pz), new V3(sx, sy, sz), c);
  bb(1.5, 0.1, 0.62, 0, -L - 0.08, 0, cw); bb(1.5, 0.05, 0.62, 0, -L - 0.2, 0, cw); for (const sx of [-0.62, 0, 0.62]) bb(0.12, 0.13, 0.62, sx, -L - 0.14, 0, cw); // the white pallet base
  for (let k = 0; k < 5; k++) bb(1.38, 0.045, 0.1, 0, -L, -0.24 + k * 0.12, coral); // seat slats
  for (let k = 0; k < 4; k++) { const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.2, 0, 0)); bench.add(GEO.box, new V3(0, -L + 0.17 + k * 0.12, -0.3 - k * 0.025), new V3(1.38, 0.09, 0.035), coral, q); } // backrest, behind the sitter (who faces +z, the pond)
  for (const sx of [-0.72, 0.72]) { bb(0.08, 0.6, 0.08, sx, -L + 0.22, -0.31, cw); bb(0.08, 0.3, 0.08, sx, -L + 0.12, 0.27, cw); bb(0.1, 0.06, 0.66, sx, -L + 0.29, 0.02, cw); } // white arms and uprights
  const links = new THREE.TorusGeometry(0.03, 0.008, 5, 10);
  for (const sx of [-0.68, 0.68]) for (const sz of [0.26, -0.3]) {
    const top = new V3(sx * 0.9, 0, 0), bot = new V3(sx, -L + (sz < 0 ? 0.52 : 0.32), sz), d = bot.clone().sub(top), n = Math.round(d.length() / 0.055);
    const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), d.clone().normalize());
    for (let k = 0; k < n; k++) { const qq = q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, k % 2 ? Math.PI / 2 : 0, 0))); bench.add(links, top.clone().addScaledVector(d, (k + 0.5) / n), new V3(1, 1.6, 1), C('#a9a8a3'), qq); }
  }
  const bm = new THREE.Mesh(bench.build(), VC); bm.castShadow = true; pivot.add(bm);
  const sw = { g, pivot, L, Lw: L, theta: 0, omega: 0, yaw: 0, pitch: -0.05 };
  g.traverse(o => { if (o.isMesh) o.castShadow = o.material !== lightMat; o.userData.swing = sw; });
  g.updateMatrixWorld(true);
  for (const sx of [-PX, PX]) for (const sz of [-PZ, PZ]) { const wpt = g.localToWorld(new V3(sx, 0, sz)); decor.push({ x: wpt.x, z: wpt.z, r: 0.4, collide: 0.22 }); }
  decor.push({ x, z, r: 2.6, collide: -1 });
  swings.push(sw); return sw;
}
(function swingGarden() {
  regBegin('swings');
  const C0 = SWING_GARDEN, face = C0.face, fx = Math.sin(face), fz = Math.cos(face), rx = Math.cos(face), rz = -Math.sin(face);
  let seed = 1;
  // more room between swings: 6.4 m apart in a row, 6.6 m between the rows
  for (let row = 0; row < 2; row++) for (let col = -1; col <= 1; col++) buildSwing(C0.x + rx * col * 6.4 - fx * row * 6.6, C0.z + rz * col * 6.4 - fz * row * 6.6, face, seed++);
  // no court: the swings stand on the lawn
  // stepping stones from the front of the swings to the bench path
  const S0 = { x: C0.x + fx * 4.5, z: C0.z + fz * 4.5 }, S1 = { x: BENCH.x + Math.sin(BENCH.face) * 1.6 - Math.cos(BENCH.face) * 1.6, z: BENCH.z + Math.cos(BENCH.face) * 1.6 + Math.sin(BENCH.face) * 1.6 };
  const NS = Math.max(2, Math.round(Math.hypot(S1.x - S0.x, S1.z - S0.z) / 1.05) + 1);
  const R = rng(4242), st = new THREE.InstancedMesh(rockGeo(31), VC, NS), d = new THREE.Object3D();
  for (let i = 0; i < NS; i++) { const t = i / (NS - 1), x = lerp(S0.x, S1.x, t), z = lerp(S0.z, S1.z, t); d.position.set(x, groundH(x, z) + 0.01, z); d.rotation.set(0, R() * 6, 0); d.scale.set(0.45, 0.09, 0.4); d.updateMatrix(); st.setMatrixAt(i, d.matrix); st.setColorAt(i, C('#ffffff').lerp(C('#c9c0ad'), R())); }
  st.receiveShadow = true; scene.add(st);
  decor.push({ x: C0.x - fx * 3.3, z: C0.z - fz * 3.3, r: 12, collide: -1 });
  // the gateway at the front of the court, its plaque painted like the one at the garden's gate
  { const gw = new THREE.Group(), gx = C0.x + fx * 3.6, gz = C0.z + fz * 3.6; gw.position.set(gx, groundH(gx, gz), gz); gw.rotation.y = face; scene.add(gw);
    const dark = M('#3e2e22'), wood2 = M('#5e4634');
    for (const sx of [-2.1, 2.1]) { part(gw, GEO.cylB, wood2, [sx, 0, 0], [0.11, 3.5, 0.11]); part(gw, GEO.cylB, dark, [sx, 0, 0], [0.16, 0.25, 0.16]); }
    part(gw, GEO.box, wood2, [0, 3.45, 0], [5.0, 0.18, 0.24]); part(gw, GEO.box, dark, [0, 3.62, 0], [5.4, 0.12, 0.34]);
    part(gw, GEO.box, dark, [0, 2.62, -0.02], [2.5, 0.78, 0.09]);
    const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 400; const tex = new THREE.CanvasTexture(cv);
    const fm = new THREE.MeshLambertMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.15 });
    for (const dz of [0.05, -0.05]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(2.38, 0.68), fm); f.position.set(0, 2.62, dz); if (dz < 0) f.rotation.y = Math.PI; gw.add(f); }
    for (const sx of [-0.9, 0.9]) part(gw, GEO.cylB, dark, [sx, 3.0, 0], [0.02, 0.38, 0.02]);
    const vines = new Merge(), Rv = rng(88);
    for (let i = 0; i < 46; i++) { const p = new V3(-2.5 + Rv() * 5, 3.66 + Rv() * 0.08, (Rv() - .5) * 0.36); vines.add(GEO.ico, p, new V3(0.08, 0.06, 0.08), C(['#567a3a', '#668c45'][i % 2])); if (i % 2 === 0) vines.add(GEO.ico, p.clone().add(new V3(0, 0.05, 0.08)), new V3(0.05, 0.05, 0.05), C(['#f4b6c8', '#ffffff', '#f19bb8'][i % 3])); }
    gw.add(new THREE.Mesh(vines.build(), VC)); gw.traverse(o => { if (o.isMesh) o.castShadow = true; });
    const paint = () => {
      const g = cv.getContext('2d'), W2 = cv.width, H2 = cv.height, Rg = rng(31);
      g.fillStyle = '#4a3526'; g.fillRect(0, 0, W2, H2); g.strokeStyle = 'rgba(35,22,14,.25)'; g.lineWidth = 3;
      for (let i = 0; i < 22; i++) { const y = Rg() * H2; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(W2 * .3, y + (Rg() - .5) * 30, W2 * .7, y + (Rg() - .5) * 30, W2, y); g.stroke(); }
      g.strokeStyle = 'rgba(226,190,120,.8)'; g.lineWidth = 8; g.strokeRect(20, 20, W2 - 40, H2 - 40);
      g.fillStyle = '#f7ead2'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 10; g.shadowOffsetY = 4;
      g.font = '600 230px "Cormorant Garamond", Georgia, serif'; g.fillText('Swings', W2 / 2, H2 / 2 + 6); tex.needsUpdate = true;
    };
    paint(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(paint);
    for (const sx of [-2.1, 2.1]) { const w = gw.localToWorld(new V3(sx, 0, 0)); decor.push({ x: w.x, z: w.z, r: 0.4, collide: 0.2 }); }
  }
  regEnd();
})();
const swingSeat = sw => sw.pivot.localToWorld(new V3(0, -sw.L + 0.95, 0.05));

