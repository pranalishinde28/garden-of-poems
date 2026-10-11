import * as THREE from 'three';
import { C, V3, clamp, isTouch, lerp, rng } from '../core/util.js';
import { RIVER, WATER_Y, groundH, riverDist } from '../world/terrain.js';
import { T, state } from '../core/state.js';
import { camera, scene } from '../world/renderer.js';
import { canvasTex, softTex } from '../world/textures.js';
import { windify } from '../world/wind.js';
import { DS, GEO, M, Merge, VC, limb, part, rockGeo } from '../world/geometry.js';
import { decor, inTulip, regBegin, regEnd, stoneNear } from '../world/paths.js';
import { stoneLantern } from '../world/decor.js';
import { flowerSpots } from '../world/tulips.js';
import { SFX, okGround, randomSpot, regAnimal } from '../animals/animals.js';
import { late } from '../core/late.js';

/* ================= flower gardens: lilies, orchids, roses, hydrangeas ================= */
const floretTex = canvasTex(64, 64, (g) => {
  for (let i = 0; i < 4; i++) { g.save(); g.translate(32, 32); g.rotate(i * Math.PI / 2 + 0.3); const gr = g.createRadialGradient(0, -12, 2, 0, -12, 16); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#e6e9f4'); g.fillStyle = gr; g.beginPath(); g.ellipse(0, -13, 10, 14, 0, 0, 7); g.fill(); g.restore(); }
  g.fillStyle = '#f2f0d0'; g.beginPath(); g.arc(32, 32, 3, 0, 7); g.fill();
});
function placeOK(x, z, r) { return okGround(x, z) && !inTulip(x, z, r) && !decor.some(o => Math.hypot(o.x - x, o.z - z) < o.r + r) && !stoneNear(x, z, r + 0.4); }
function instPair(geoA, matA, geoB, matB, items) {
  const a = new THREE.InstancedMesh(geoA, matA, items.length), b = geoB ? new THREE.InstancedMesh(geoB, matB, items.length) : null, d = new THREE.Object3D();
  items.forEach((it, i) => { d.position.set(it.x, it.y, it.z); d.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0); d.scale.setScalar(it.s || 1); d.updateMatrix(); a.setMatrixAt(i, d.matrix); if (it.c) a.setColorAt(i, it.c); if (b) { b.setMatrixAt(i, d.matrix); if (it.c2) b.setColorAt(i, it.c2); } });
  [a, b].forEach(m => { if (!m) return; m.frustumCulled = false; scene.add(m); });
  return [a, b];
}
const flowerMat = () => windify(new THREE.MeshLambertMaterial({ vertexColors: true, side: DS, emissive: '#0d0b0b' }), 0.025, 'const');
(function buildFlowerGardens() {
  const R = rng(1201), q = new THREE.Quaternion(), e = new THREE.Euler(), white = C('#ffffff');
  regBegin('lilies');
  // ---- white lily: six recurved petals, orange stamens
  const lily = new Merge();
  for (let k = 0; k < 6; k++) { const a = k / 6 * 6.28; e.set(0, a, 0.75 + (k % 2) * 0.12, 'YXZ'); q.setFromEuler(e); lily.add(GEO.petal, new V3(0, 0.62, 0), new V3(0.16, 0.12, 0.07), white.clone().lerp(C('#e9f2d8'), k % 2 ? 0.15 : 0.05), q); }
  for (let k = 0; k < 6; k++) { const a = k / 6 * 6.28 + 0.3; lily.limb(new V3(0, 0.62, 0), new V3(Math.cos(a) * 0.06, 0.72, Math.sin(a) * 0.06), 0.003, 0.002, C('#d9e6b0')); lily.add(GEO.sph, new V3(Math.cos(a) * 0.065, 0.725, Math.sin(a) * 0.065), new V3(0.012, 0.006, 0.006), C('#d4691f')); }
  const lilyHead = lily.build();
  const ls = new Merge(); ls.limb(new V3(0, 0, 0), new V3(0, 0.63, 0), 0.008, 0.006, C('#5d7f3c'));
  for (let k = 0; k < 6; k++) { e.set(0, k * 2.4, 0.9, 'YXZ'); q.setFromEuler(e); ls.add(GEO.petal, new V3(0, 0.1 + k * 0.07, 0), new V3(0.16, 0.06, 0.03), C('#5f8443'), q); }
  const lilyStem = ls.build();
  const lilies = [];
  const lilySpots = [];
  for (let a = 0; a < 6.28; a += 0.38) lilySpots.push([Math.cos(a) * 12.6, Math.sin(a) * 12.6]);
  for (let i = 8; i < 90; i += 5) { const p = RIVER[i], n = RIVER[i + 1], tx = n.x - p.x, tz = n.z - p.z, L = Math.hypot(tx, tz); lilySpots.push([p.x - tz / L * 3.4, p.z + tx / L * 3.4]); }
  lilySpots.forEach(([cx, cz]) => {
    if (!placeOK(cx, cz, 0.5) || riverDist(cx, cz) < 2.8) return;
    decor.push({ x: cx, z: cz, r: 0.7, collide: -1 });
    for (let k = 0; k < 5; k++) { const x = cx + (R() - .5) * 0.9, z = cz + (R() - .5) * 0.9, y = groundH(x, z); lilies.push({ x, y, z, ry: R() * 6.28, rx: (R() - .5) * 0.15, s: 1.1 + R() * 0.4, c: R() < 0.85 ? C('#ffffff') : C('#f6d3dc') }); if (k === 0) flowerSpots.push({ x, y: y + 0.85, z }); }
  });
  instPair(lilyHead, flowerMat(), lilyStem, flowerMat(), lilies);

  regBegin('orchids');
  // ---- purple orchids: arching spray of flat flowers
  const orch = new Merge(), stem = new Merge(), curve = new THREE.QuadraticBezierCurve3(new V3(0, 0.05, 0), new V3(0, 0.75, 0.05), new V3(0, 0.62, 0.42));
  for (let i = 0; i < 6; i++) { stem.limb(curve.getPoint(i / 6), curve.getPoint((i + 1) / 6), 0.006, 0.005, C('#4f6a33')); }
  for (let k = 0; k < 3; k++) { e.set(0, k * 2.1, 1.3, 'YXZ'); q.setFromEuler(e); stem.add(GEO.petal, new V3(0, 0.03, 0), new V3(0.26, 0.12, 0.11), C('#3f6a33'), q); }
  for (let f = 0; f < 5; f++) {
    const pnt = curve.getPoint(0.45 + f * 0.12), s = 0.075 * (1 - f * 0.08);
    const petals = [[0.5, 1.0, 1.0], [2.64, 1.0, 1.0], [1.57, 0.8, 0.55], [3.9, 0.8, 0.5], [5.5, 0.8, 0.5]];
    petals.forEach(([ang, len, wid], j) => { e.set(-1.45, 0, ang, 'XYZ'); q.setFromEuler(e); orch.add(GEO.petal, pnt.clone(), new V3(s * len, s * 0.5, s * wid), j < 2 ? C('#ffffff') : C('#f4eaf4'), q); });
    orch.add(GEO.sph, pnt.clone().add(new V3(0, -0.012, 0.012)), new V3(s * 0.32, s * 0.25, s * 0.3), C('#c9a0c8'));
    orch.add(GEO.sph, pnt.clone().add(new V3(0, 0.002, 0.016)), new V3(s * 0.08, s * 0.08, s * 0.06), C('#f3d36a'));
  }
  const orchHead = orch.build(), orchStem = stem.build();
  const orchids = [], OC = ['#9b4fb5', '#a964c4', '#8a3fa3', '#c38be0', '#7d3592'].map(C);
  const orchSpots = [];
  decor.filter(o => o.collide > 0 && o.r < 0.35).forEach(o => orchSpots.push([o.x + 0.45, o.z + 0.3]));
  orchSpots.forEach(([x, z], i) => {
    if (i % 2 || !okGround(x, z) || inTulip(x, z, 0.2)) return;
    const c = OC[Math.floor(R() * OC.length)];
    for (let k = 0; k < 2; k++) { const xx = x + (R() - .5) * 0.4, zz = z + (R() - .5) * 0.4, y = groundH(xx, zz); orchids.push({ x: xx, y, z: zz, ry: R() * 6.28, s: 1.2 + R() * 0.4, c }); }
    flowerSpots.push({ x, y: groundH(x, z) + 0.9, z });
  });
  instPair(orchHead, flowerMat(), orchStem, flowerMat(), orchids);

  regBegin('roses');
  // ---- rose garden: bushes of layered blooms in a circle, with a rose arch
  const rose = new Merge();
  for (let k = 0; k < 14; k++) { const a = k * 2.4, tilt = 0.25 + k * 0.075, rr = 0.004 + k * 0.0016; e.set(0, a, tilt, 'YXZ'); q.setFromEuler(e); rose.add(GEO.petal, new V3(Math.cos(a) * rr, 0, Math.sin(a) * rr), new V3(0.05 + k * 0.0022, 0.06, 0.05 + k * 0.0018), white.clone().multiplyScalar(1 - (13 - k) * 0.025), q); }
  const roseHead = rose.build();
  const RCOL = ['#b3122b', '#e7799b', '#f7f1ea', '#f2c94c', '#ee6f5a', '#c2185b'].map(C);
  const RG = { x: 54, z: 14 }, roses = [], bushes = new Merge();
  const bushSpots = [];
  for (let i = 0; i < 14; i++) { const a = i / 14 * 6.28; bushSpots.push([RG.x + Math.cos(a) * 6, RG.z + Math.sin(a) * 6, RCOL[i % RCOL.length]]); }
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28 + 0.3; bushSpots.push([RG.x + Math.cos(a) * 3, RG.z + Math.sin(a) * 3, RCOL[(i + 2) % RCOL.length]]); }
  bushSpots.forEach(([x, z, col]) => {
    if (!okGround(x, z)) return;
    const y = groundH(x, z);
    for (let k = 0; k < 7; k++) bushes.add(GEO.ico, new V3(x + (R() - .5) * 0.7, y + 0.35 + R() * 0.35, z + (R() - .5) * 0.7), new V3(0.32 + R() * 0.12, 0.3, 0.32 + R() * 0.12), C(['#3c5e2e', '#47693a', '#355628'][k % 3]));
    for (let k = 0; k < 16; k++) { const a = R() * 6.28, r = 0.25 + R() * 0.38, yy = y + 0.5 + R() * 0.45; roses.push({ x: x + Math.cos(a) * r, y: yy + 0.18, z: z + Math.sin(a) * r, rx: (R() - .5) * 0.8, ry: R() * 6, rz: (R() - .5) * 0.8, s: 1.9 + R() * 0.6, c: col.clone().offsetHSL(0, 0, (R() - .5) * 0.06) }); }
    decor.push({ x, z, r: 0.8, collide: 0.5 });
    flowerSpots.push({ x, y: y + 0.9, z });
  });
  const bm = new THREE.Mesh(bushes.build(), VC); bm.castShadow = true; bm.receiveShadow = true; scene.add(bm);
  instPair(roseHead, flowerMat(), null, null, roses);
  stoneLantern(RG.x, RG.z, 1.15, 0.3);
  decor.push({ x: RG.x, z: RG.z, r: 7.5, collide: -1 });

  regBegin('hydrangeas');
  // ---- blue hydrangea shrubs with mophead clusters
  const mop = new Merge();
  for (let k = 0; k < 34; k++) { const u = new V3(R() - .5, R() * 0.9 + 0.1, R() - .5).normalize(); const qq = new THREE.Quaternion().setFromUnitVectors(new V3(0, 0, 1), u); mop.add(GEO.card, u.clone().multiplyScalar(0.16), new V3(0.13, 0.13, 0.13), white, qq); }
  const mopGeo = mop.build();
  const mopMat = windify(new THREE.MeshLambertMaterial({ map: floretTex, alphaTest: 0.4, side: DS, vertexColors: true, emissive: '#0c0f1a' }), 0.02, 'const');
  const HC = ['#5f86d6', '#7d9ae4', '#6c74cf', '#9ab2ee', '#8a7bd2', '#4f78c9'].map(C);
  const heads = [], shrub = new Merge(), hySpots = [];
  for (let i = 12; i < 84; i += 4) { const p = RIVER[i], n = RIVER[i + 1], tx = n.x - p.x, tz = n.z - p.z, L = Math.hypot(tx, tz); hySpots.push([p.x + tz / L * 6.6, p.z - tx / L * 6.6]); }
  for (let a = 1.8; a < 4.6; a += 0.22) hySpots.push([Math.cos(a) * 47.6, Math.sin(a) * 47.6]);
  for (let a = -0.9; a < 0.9; a += 0.3) hySpots.push([Math.cos(a) * 47.6, Math.sin(a) * 47.6]);
  hySpots.forEach(([x, z]) => {
    if (!placeOK(x, z, 0.9)) return;
    const y = groundH(x, z), col = HC[Math.floor(R() * HC.length)];
    for (let k = 0; k < 6; k++) shrub.add(GEO.ico, new V3(x + (R() - .5) * 1.0, y + 0.4 + R() * 0.3, z + (R() - .5) * 1.0), new V3(0.42 + R() * 0.15, 0.36, 0.42 + R() * 0.15), C(['#2f5a35', '#3a6a3d', '#2a4f30'][k % 3]));
    for (let k = 0; k < 7; k++) { const a = R() * 6.28, r = 0.15 + R() * 0.55; heads.push({ x: x + Math.cos(a) * r, y: y + 0.62 + R() * 0.35, z: z + Math.sin(a) * r, ry: R() * 6, rx: (R() - .5) * 0.5, s: 1.3 + R() * 0.6, c: col.clone().offsetHSL((R() - .5) * 0.03, 0, (R() - .5) * 0.08) }); }
    decor.push({ x, z, r: 1.1, collide: 0.7 });
    flowerSpots.push({ x, y: y + 1.1, z });
  });
  const sm = new THREE.Mesh(shrub.build(), VC); sm.castShadow = true; sm.receiveShadow = true; scene.add(sm);
  instPair(mopGeo, mopMat, null, null, heads);
})();

regEnd();
/* ground cover: clover and moss tufts close to the ground */
const cloverTex = canvasTex(128, 128, (g) => {
  const R = rng(55);
  for (let i = 0; i < 22; i++) {
    const x = 14 + R() * 100, y = 14 + R() * 100, r = 5 + R() * 5, sh = 170 + R() * 70;
    g.fillStyle = `rgb(${sh * 0.62 | 0},${sh | 0},${sh * 0.5 | 0})`;
    for (let k = 0; k < 3; k++) { const a = k * 2.09 + R(); g.beginPath(); g.ellipse(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8, r * 0.75, r * 0.65, a, 0, 7); g.fill(); }
  }
});
(function groundCover() {
  const N = isTouch ? 2500 : 7000, R = rng(1301);
  const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ map: cloverTex, alphaTest: 0.5, side: DS }), N), d = new THREE.Object3D();
  let n = 0;
  for (let i = 0; i < N * 2 && n < N; i++) {
    const a = R() * 6.28, r = 9 + Math.sqrt(R()) * 50, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (groundH(x, z) < WATER_Y + 0.1 || stoneNear(x, z, 0.4) || inTulip(x, z, 0.1)) continue;
    d.position.set(x, groundH(x, z) + 0.025, z); d.rotation.set(0, R() * 6.28, 0); d.scale.setScalar(0.35 + R() * 0.5); d.updateMatrix();
    m.setMatrixAt(n, d.matrix); m.setColorAt(n, C('#ffffff').lerp(C('#b8c48c'), R() * 0.5)); n++;
  }
  m.count = n; m.frustumCulled = false; m.receiveShadow = true; m.layers.set(2); scene.add(m);
})();

/* sika deer: graze, look at you, bow when you click, trot off if crowded */
const featherTex = canvasTex(64, 512, (g) => {
  const gr = g.createLinearGradient(0, 512, 0, 0); gr.addColorStop(0, 'rgba(120,100,50,0)'); gr.addColorStop(0.2, 'rgba(110,120,60,.9)'); gr.addColorStop(1, 'rgba(40,120,90,1)');
  g.strokeStyle = '#8a7a40'; g.lineWidth = 2; g.beginPath(); g.moveTo(32, 512); g.lineTo(32, 20); g.stroke();
  g.strokeStyle = gr; g.lineWidth = 1;
  for (let y = 500; y > 60; y -= 3) { const w = 6 + (500 - y) / 440 * 20; g.beginPath(); g.moveTo(32, y); g.lineTo(32 - w, y - 10); g.moveTo(32, y); g.lineTo(32 + w, y - 10); g.stroke(); }
  const rings = [['#5b4a1e', 30, 40], ['#c7a43a', 25, 34], ['#1f8a6a', 19, 26], ['#1c3f9e', 12, 17], ['#0a1230', 6, 9]];
  rings.forEach(([c, rx, ry]) => { g.fillStyle = c; g.beginPath(); g.ellipse(32, 58, rx, ry, 0, 0, 7); g.fill(); });
});
function buildDeer(x, z, male, seed) {
  const R = rng(seed), g = new THREE.Group(), coat = M(male ? '#8a5a36' : '#9e6c44'), belly = M('#eadfca'), dark = M('#261c16'), spot = M('#f3ecdf');
  part(g, GEO.sph, coat, [0, 0.84, 0], [0.19, 0.23, 0.5]);
  part(g, GEO.sph, belly, [0, 0.74, 0.02], [0.155, 0.14, 0.42]);
  for (let i = 0; i < 26; i++) { const a = 0.25 + R() * 1.1, zz = (R() - .5) * 0.75, s = R() < .5 ? -1 : 1; part(g, GEO.sph, spot, [s * Math.sin(a) * 0.192, 0.84 + Math.cos(a) * 0.232, zz], [0.014, 0.014, 0.02]); }
  part(g, GEO.sph, spot, [0, 0.9, -0.47], [0.11, 0.13, 0.06]);
  part(g, GEO.sph, dark, [0, 0.98, -0.5], [0.025, 0.05, 0.025]);
  const neck = new THREE.Group(); neck.position.set(0, 0.96, 0.36); neck.rotation.x = 0.55; g.add(neck);
  part(neck, GEO.cylB, coat, [0, 0, 0], [0.075, 0.4, 0.085]);
  const head = new THREE.Group(); head.position.set(0, 0.4, 0); head.rotation.x = -0.55 + 0.9; neck.add(head);
  const hg = new THREE.Group(); hg.rotation.x = -0.9; head.add(hg);
  part(hg, GEO.sph, coat, [0, 0, 0.05], [0.07, 0.072, 0.13]);
  part(hg, GEO.sph, M('#8a6044'), [0, -0.02, 0.17], [0.045, 0.042, 0.08]);
  part(hg, GEO.sph, dark, [0, -0.015, 0.245], 0.02);
  for (const s of [-1, 1]) {
    part(hg, GEO.sph, coat, [s * 0.07, 0.07, 0.0], [0.028, 0.06, 0.014], [0.2, 0, s * 0.95]);
    part(hg, GEO.sph, M('#d8b9a8'), [s * 0.072, 0.07, 0.006], [0.018, 0.045, 0.006], [0.2, 0, s * 0.95]);
    part(hg, GEO.sph, dark, [s * 0.058, 0.025, 0.1], 0.012);
    if (male) { const an = M('#d6c7a8'); limb(hg, new V3(s * 0.03, 0.07, 0.02), new V3(s * 0.1, 0.26, -0.03), 0.012, 0.009, an); limb(hg, new V3(s * 0.1, 0.26, -0.03), new V3(s * 0.13, 0.38, -0.1), 0.009, 0.004, an); limb(hg, new V3(s * 0.07, 0.18, -0.005), new V3(s * 0.09, 0.27, 0.08), 0.007, 0.003, an); limb(hg, new V3(s * 0.11, 0.3, -0.05), new V3(s * 0.17, 0.36, 0.0), 0.006, 0.003, an); }
  }
  const legs = [];
  [[-0.1, 0.32, 0], [0.1, 0.32, Math.PI], [-0.1, -0.32, Math.PI], [0.1, -0.32, 0]].forEach(([lx, lz, ph]) => {
    const hip = new THREE.Group(); hip.position.set(lx, 0.8, lz); g.add(hip);
    part(hip, GEO.cylB, coat, [0, -0.42, 0], [0.034, 0.42, 0.04]);
    const low = new THREE.Group(); low.position.set(0, -0.42, 0); hip.add(low);
    part(low, GEO.cylB, M('#7a5234'), [0, -0.37, 0], [0.021, 0.37, 0.023]); part(low, GEO.sph, dark, [0, -0.375, 0.01], [0.024, 0.02, 0.03]);
    legs.push({ hip, low, ph });
  });
  g.scale.setScalar(male ? 1.1 : 1.0);
  const b = { g, neck, head, legs, pos: new V3(x, groundH(x, z), z), home: { x, z }, heading: R() * 6.28, mode: 'graze', timer: 2 + R() * 4, dest: null, speed: 0, phase: 0, bow: 0, ph: R() * 6 };
  b.click = () => { b.bow = 2.4; b.mode = 'bow'; b.timer = 2.4; SFX.thump(); };
  b.update = dt => updateDeer(b, dt);
  return regAnimal(g, b);
}
function updateDeer(b, dt) {
  const toCam = new V3().subVectors(camera.position, b.pos), dc = Math.hypot(toCam.x, toCam.z);
  if (b.mode !== 'trot' && b.mode !== 'bow' && state.mode === 'walk' && dc < 2.2) { const away = toCam.clone().multiplyScalar(-1).setY(0).normalize(); const t = randomSpot(Math.random, b.pos.x + away.x * 9, b.pos.z + away.z * 9, 3); b.dest = new V3(t.x, 0, t.z); b.mode = 'trot'; }
  let neckX = 0.55, look = 0;
  if (b.mode === 'graze') { b.timer -= dt; neckX = 1.55 + Math.sin(T * 2 + b.ph) * 0.05; b.speed = 0; if (b.timer <= 0) { if (Math.random() < 0.5) { const t = randomSpot(Math.random, b.home.x, b.home.z, 8); b.dest = new V3(t.x, 0, t.z); b.mode = 'walk'; } else { b.mode = 'alert'; b.timer = 2 + Math.random() * 3; } } if (dc < 8) { b.mode = 'alert'; b.timer = 3; } }
  else if (b.mode === 'alert') { b.timer -= dt; b.speed = 0; look = 1; if (b.timer <= 0) { b.mode = 'graze'; b.timer = 3 + Math.random() * 5; } }
  else if (b.mode === 'bow') { b.timer -= dt; b.speed = 0; look = 0.6; neckX = 0.55 + Math.max(0, Math.sin((2.4 - b.timer) / 2.4 * Math.PI * 2)) * 0.75; if (b.timer <= 0) { b.mode = 'alert'; b.timer = 2; } }
  else {
    const dir = new V3().subVectors(b.dest, b.pos); dir.y = 0; const d = dir.length();
    const want = b.mode === 'trot' ? 2.4 : 0.7; b.speed += (want - b.speed) * (1 - Math.exp(-dt * 2));
    if (d < 0.4) { b.mode = 'graze'; b.timer = 3 + Math.random() * 5; }
    else {
      let dh = Math.atan2(dir.x, dir.z) - b.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); b.heading += dh * (1 - Math.exp(-dt * 3));
      const nx = b.pos.x + Math.sin(b.heading) * b.speed * dt, nz = b.pos.z + Math.cos(b.heading) * b.speed * dt;
      if (okGround(nx, nz)) { b.pos.x = nx; b.pos.z = nz; } else { b.mode = 'graze'; b.timer = 2; }
    }
  }
  b.phase += dt * b.speed * 4.2;
  b.legs.forEach(l => { const s = Math.sin(b.phase + l.ph) * Math.min(1, b.speed); l.hip.rotation.x = s * 0.45; l.low.rotation.x = Math.max(0, -Math.cos(b.phase + l.ph)) * 0.5 * Math.min(1, b.speed); });
  b.neck.rotation.x += (neckX - b.neck.rotation.x) * (1 - Math.exp(-dt * 3));
  const yawTo = Math.atan2(toCam.x, toCam.z) - b.heading, ly = clamp(Math.atan2(Math.sin(yawTo), Math.cos(yawTo)), -1.1, 1.1) * look;
  b.neck.rotation.y += (ly - b.neck.rotation.y) * (1 - Math.exp(-dt * 3));
  b.pos.y = groundH(b.pos.x, b.pos.z) + Math.abs(Math.sin(b.phase)) * 0.03 * Math.min(1, b.speed);
  b.g.position.copy(b.pos); b.g.rotation.y = b.heading;
}
[[28, -8, true], [31, -4, false], [26, -2, false], [-36, -20, true], [-33, -24, false], [12, 52, false], [-46, 8, false]].forEach(([x, z, m], i) => { if (okGround(x, z)) buildDeer(x, z, m, 900 + i); });

/* peacocks: strut and peck; click one and it fans its train */
const featherMat = new THREE.MeshLambertMaterial({ map: featherTex, alphaTest: 0.35, side: DS, emissive: '#0a1410' });
function buildPeacock(x, z, seed) {
  const R = rng(seed), g = new THREE.Group(), blue = M('#1d4fae'), dkb = M('#163d86'), brown = M('#7a5a36'), grey = M('#8a8378');
  part(g, GEO.sph, blue, [0, 0.42, 0], [0.11, 0.13, 0.21]);
  for (const s of [-1, 1]) part(g, GEO.sph, brown, [s * 0.075, 0.43, -0.04], [0.05, 0.08, 0.15]);
  const neck = new THREE.Group(); neck.position.set(0, 0.5, 0.13); neck.rotation.x = 0.25; g.add(neck);
  part(neck, GEO.cylB, blue, [0, 0, 0], [0.035, 0.3, 0.035]);
  const head = new THREE.Group(); head.position.set(0, 0.3, 0); neck.add(head);
  part(head, GEO.sph, dkb, [0, 0, 0.01], [0.04, 0.042, 0.05]);
  part(head, GEO.cone, grey, [0, -0.005, 0.05], [0.012, 0.04, 0.012], [Math.PI / 2, 0, 0]);
  for (const s of [-1, 1]) { part(head, GEO.sph, M('#ffffff'), [s * 0.034, 0.008, 0.015], [0.006, 0.012, 0.016]); part(head, GEO.sph, M('#0c0c0c'), [s * 0.037, 0.01, 0.022], 0.006); }
  for (let k = 0; k < 6; k++) { const a = (k - 2.5) * 0.18; limb(head, new V3(0, 0.03, 0), new V3(Math.sin(a) * 0.04, 0.11, -0.02), 0.002, 0.002, dkb); part(head, GEO.sph, M('#1f6f9e'), [Math.sin(a) * 0.04, 0.115, -0.02], 0.01); }
  for (const s of [-1, 1]) part(g, GEO.cylB, grey, [s * 0.04, 0, 0.02], [0.012, 0.32, 0.012]);
  const train = new THREE.Group(); train.position.set(0, 0.42, -0.15); g.add(train);
  const NF = 38, feathers = [];
  for (let i = 0; i < NF; i++) {
    const fg = new THREE.Group(); train.add(fg);
    const len = 0.95 + R() * 0.35, m = new THREE.Mesh(GEO.card, featherMat); m.scale.set(0.14, len, 1); m.position.y = len / 2; fg.add(m);
    feathers.push({ fg, ang: (i / (NF - 1) - 0.5) * 2.7 + (R() - .5) * 0.04, tilt: (R() - .5) * 0.08 });
  }
  const b = { g, neck, head, train, feathers, pos: new V3(x, groundH(x, z), z), home: { x, z }, heading: R() * 6.28, mode: 'peck', timer: 2, dest: null, open: 0, fanT: 0, ph: R() * 6 };
  b.click = () => { b.fanT = 7; SFX.peacock(); };
  b.update = dt => updatePeacock(b, dt);
  return regAnimal(g, b);
}
function updatePeacock(b, dt) {
  b.fanT = Math.max(0, b.fanT - dt);
  const target = b.fanT > 0 ? 1 : 0; b.open += (target - b.open) * (1 - Math.exp(-dt * 2.2));
  if (b.fanT > 0) { const toCam = new V3().subVectors(camera.position, b.pos); let dh = Math.atan2(toCam.x, toCam.z) - b.heading + Math.PI; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); b.heading += dh * (1 - Math.exp(-dt * 1.5)); }
  else if (b.mode === 'peck') { b.timer -= dt; b.neck.rotation.x = 0.25 + Math.max(0, Math.sin(T * 5 + b.ph)) * 0.9 * (Math.sin(T * 0.6 + b.ph) > 0 ? 1 : 0); if (b.timer <= 0) { const t = randomSpot(Math.random, b.home.x, b.home.z, 6); b.dest = new V3(t.x, 0, t.z); b.mode = 'walk'; } }
  else {
    b.neck.rotation.x = 0.25 + Math.sin(T * 6) * 0.08;
    const dir = new V3().subVectors(b.dest, b.pos); dir.y = 0; const d = dir.length();
    if (d < 0.3) { b.mode = 'peck'; b.timer = 3 + Math.random() * 5; }
    else { let dh = Math.atan2(dir.x, dir.z) - b.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); b.heading += dh * (1 - Math.exp(-dt * 2.5)); const nx = b.pos.x + Math.sin(b.heading) * 0.45 * dt, nz = b.pos.z + Math.cos(b.heading) * 0.45 * dt; if (okGround(nx, nz)) { b.pos.x = nx; b.pos.z = nz; } else b.mode = 'peck'; }
  }
  const o = b.open;
  b.train.rotation.x = lerp(-1.42, -0.18, o);
  b.feathers.forEach(f => { f.fg.rotation.set(f.tilt, 0, f.ang * lerp(0.08, 1, o) + (o > 0.8 ? Math.sin(T * 30 + f.ang * 3) * 0.015 : 0)); });
  b.pos.y = groundH(b.pos.x, b.pos.z) + (b.mode === 'walk' ? Math.abs(Math.sin(T * 6)) * 0.01 : 0);
  b.g.position.copy(b.pos); b.g.rotation.y = b.heading;
}
SFX.peacock = function () { const o = this.out(); if (!o) return; const ctx = late.Music.ctx, t0 = ctx.currentTime + 0.02; for (let k = 0; k < 2; k++) { const t = t0 + k * 0.45, os = ctx.createOscillator(), bp = ctx.createBiquadFilter(), g = ctx.createGain(); os.type = 'sawtooth'; os.frequency.setValueAtTime(560, t); os.frequency.exponentialRampToValueAtTime(980, t + 0.12); os.frequency.exponentialRampToValueAtTime(700, t + 0.32); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 2; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.36); os.connect(bp); bp.connect(g); g.connect(o); os.start(t); os.stop(t + 0.4); } };
[[44, 24], [46, 4], [-20, 44], [8, -46], [20, 50], [-48, -30], [44, -30]].forEach(([x, z], i) => { if (okGround(x, z)) buildPeacock(x, z, 1500 + i); });

/* riverbed pebbles and rocks in the stream */
(function riverbed() {
  const R = rng(777), N = isTouch ? 260 : 650, pm = new THREE.InstancedMesh(rockGeo(9), VC, N), d = new THREE.Object3D(); let pi = 0;
  for (let i = 0; i < N * 3 && pi < N; i++) {
    const p = RIVER[4 + Math.floor(R() * 110)], a = R() * 6.28, o = R() * 2.4, x = p.x + Math.cos(a) * o, z = p.z + Math.sin(a) * o, y = groundH(x, z);
    if (y > WATER_Y - 0.04) continue;
    const s = 0.05 + R() * 0.16; d.position.set(x, y + 0.01, z); d.rotation.set(0, R() * 6, 0); d.scale.set(s * (0.8 + R() * 0.5), s * 0.45, s); d.updateMatrix(); pm.setMatrixAt(pi++, d.matrix);
    pm.setColorAt(pi - 1, C('#ffffff').lerp(C('#bdb39c'), R()));
  }
  pm.count = pi; pm.frustumCulled = false; pm.receiveShadow = true; scene.add(pm);
  [20, 33, 47, 61, 74].forEach((k, i) => { const p = RIVER[k]; const m = new THREE.Mesh(rockGeo(900 + i), VC); m.position.set(p.x + (R() - .5) * 1.4, WATER_Y - 0.35, p.z + (R() - .5) * 1.4); m.scale.set(0.45, 0.5, 0.5); m.castShadow = true; scene.add(m); });
})();


/* morning mist over the water */
export const mist = [];
(function buildMist() {
  const R = rng(13);
  for (let i = 0; i < 12; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: '#ffffff', transparent: true, opacity: 0.12, depthWrite: false }));
    let x, z; if (i < 5) { const a = R() * 6.28, r = R() * 6; x = Math.cos(a) * r; z = Math.sin(a) * r; } else { const p = RIVER[8 + Math.floor(R() * 60)]; x = p.x; z = p.z; }
    s.position.set(x, WATER_Y + 0.5 + R() * 0.4, z); s.scale.set(9 + R() * 8, 1.6 + R() * 1.2, 1); s.userData = { x, z, ph: R() * 6 }; scene.add(s); mist.push(s);
  }
})();

