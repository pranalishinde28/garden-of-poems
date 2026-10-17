import * as THREE from 'three';
import { C, V3, clamp, rng } from '../core/util.js';
import { BRIDGES, RIVER, WATER_Y, bridgeH, groundH, riverDist } from './terrain.js';
import { scene } from './renderer.js';
import { glowTex } from './textures.js';
import { GEO, M, Merge, VC, part, rockGeo } from './geometry.js';
import { BENCH, decor, stoneNear } from './paths.js';
import { clearArea } from './grass.js';
import { nightGlow, nightSprites } from '../plants/registry.js';
import { state } from '../core/state.js';

export const hedges = []; // the ring at the garden's edge; the sea view opens it (world/horizon.js)

/* ================= decor: bench & pergola, gate, lanterns, rocks, bridge, hedges ================= */
export const bench = new THREE.Group();
// scrollwork for the cast-iron panels: white curls on a transparent canvas, cut out with alphaTest
function scrollTex(kind) {
  const c = document.createElement('canvas'); c.width = 512; c.height = kind === 'back' ? 384 : 128; const g = c.getContext('2d'), W = c.width, H = c.height;
  g.strokeStyle = '#ffffff'; g.lineCap = 'round'; g.lineJoin = 'round';
  g.lineWidth = 10; g.strokeRect(6, 6, W - 12, H - 12);
  const curl = (x, y, r, dir, turns = 1.6) => { g.beginPath(); for (let t = 0; t <= turns * Math.PI * 2; t += 0.15) { const rr = r * (1 - t / (turns * Math.PI * 2 + 0.6)); const px = x + Math.cos(t * dir) * rr, py = y + Math.sin(t * dir) * rr; t ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); };
  if (kind === 'back') {
    g.lineWidth = 7;
    for (const cx of [W * 0.25, W * 0.75]) { // a medallion with four C-scrolls round it
      g.beginPath(); g.ellipse(cx, H / 2, 46, 64, 0, 0, 7); g.stroke(); g.beginPath(); g.ellipse(cx, H / 2, 16, 22, 0, 0, 7); g.stroke();
      for (const [dx, dy, d] of [[-1, -1, 1], [1, -1, -1], [-1, 1, -1], [1, 1, 1]]) curl(cx + dx * 72, H / 2 + dy * 92, 44, d);
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; g.beginPath(); g.moveTo(cx + Math.cos(a) * 20, H / 2 + Math.sin(a) * 26); g.lineTo(cx + Math.cos(a) * 44, H / 2 + Math.sin(a) * 62); g.stroke(); }
    }
    g.lineWidth = 9; g.beginPath(); g.moveTo(W / 2, 10); g.lineTo(W / 2, H - 10); g.stroke();
    for (let x = 30; x < W; x += 40) { g.lineWidth = 4; g.beginPath(); g.arc(x, 24, 12, Math.PI, 0); g.stroke(); g.beginPath(); g.arc(x, H - 24, 12, 0, Math.PI); g.stroke(); }
  } else { // the apron under the seat: a running band of scrolls
    g.lineWidth = 6; for (let x = 40; x < W; x += 80) { curl(x, H / 2, 34, 1, 1.2); curl(x + 40, H / 2, 34, -1, 1.2); }
  }
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8; return t;
}
const iron = new THREE.MeshLambertMaterial({ color: '#f4f2ec' });
// a broad leaf on a transparent card, for shrubs
const leafMat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, alphaTest: 0.5, map: (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#ffffff'; for (let k = 0; k < 5; k++) { g.save(); g.translate(64, 64); g.rotate(k * 1.26); g.beginPath(); g.ellipse(0, -30, 18, 30, 0, 0, 7); g.fill(); g.restore(); } g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2; for (let k = 0; k < 5; k++) { g.save(); g.translate(64, 64); g.rotate(k * 1.26); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -56); g.stroke(); g.restore(); } return new THREE.CanvasTexture(c); })() });
const ironLace = k => new THREE.MeshLambertMaterial({ color: '#f4f2ec', map: scrollTex(k), alphaTest: 0.5, side: THREE.DoubleSide });
(function buildBench() {
  // a white cast-iron bench, wide enough for two, in its own bed of mulch, brick and hydrangeas
  const y = groundH(BENCH.x, BENCH.z);
  bench.position.set(BENCH.x, y, BENCH.z);
  bench.rotation.y = Math.atan2(-BENCH.x, -BENCH.z);
  const W = 2.2, SY = 0.47, D = 0.62, dark = M('#3f3a34');
  const tube = (pts, r, mat = iron) => { const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new V3(...p))), 40, r, 8), mat); bench.add(m); return m; };
  // seat: a frame and a fine lattice of bars
  part(bench, GEO.box, iron, [0, SY, 0], [W, 0.05, D]);
  for (let k = -9; k <= 9; k++) part(bench, GEO.box, iron, [k * W / 20, SY + 0.03, 0], [0.02, 0.012, D - 0.04]);
  for (let k = -3; k <= 3; k++) part(bench, GEO.box, iron, [0, SY + 0.035, k * D / 8], [W - 0.04, 0.012, 0.02]);
  tube([[-W / 2, SY + 0.03, D / 2], [0, SY + 0.03, D / 2 + 0.01], [W / 2, SY + 0.03, D / 2]], 0.022); // a rounded front rail
  // the apron of scrolls along the front
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.1, 0.16), ironLace('apron')); apron.position.set(0, SY - 0.1, D / 2 - 0.02); bench.add(apron);
  // the back: two lace panels in a frame, a scalloped crest on top, leaning back a little
  const back = new THREE.Group(); back.position.set(0, SY + 0.04, -D / 2 + 0.02); back.rotation.x = -0.14; bench.add(back);
  const lace = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.12, 0.62), ironLace('back')); lace.position.y = 0.36; back.add(lace);
  for (const x of [-W / 2 + 0.04, 0, W / 2 - 0.04]) part(back, GEO.box, iron, [x, 0.38, 0], [0.05, 0.78, 0.05]);
  part(back, GEO.box, iron, [0, 0.05, 0], [W, 0.05, 0.04]);
  const crest = []; for (let k = 0; k <= 24; k++) { const u = k / 24, x = (u - 0.5) * (W - 0.05); crest.push([x, 0.69 + Math.sin(u * Math.PI) * 0.14 + Math.abs(Math.sin(u * Math.PI * 4)) * 0.03, 0]); }
  const cm = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(crest.map(p => new V3(...p))), 80, 0.025, 8), iron); back.add(cm);
  for (const x of [-0.55, 0.55]) { const f = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.014, 6, 16), iron); f.position.set(x, 0.86, 0); back.add(f); }
  // arms: a scroll from the back down over the arm-rest and curling under at the front, on each side
  for (const sx of [-1, 1]) {
    const x = sx * (W / 2 + 0.02);
    tube([[x, SY + 0.55, -D / 2 + 0.02], [x, SY + 0.3, -D / 2 + 0.12], [x, SY + 0.26, 0.05], [x, SY + 0.27, D / 2 - 0.02], [x, SY + 0.2, D / 2 + 0.06], [x, SY + 0.12, D / 2 - 0.02], [x, SY + 0.16, D / 2 - 0.08]], 0.028);
    // cabriole legs, front and back, curving out to their feet
    tube([[x, SY, D / 2 - 0.04], [x + sx * 0.02, SY * 0.55, D / 2 + 0.02], [x + sx * 0.05, 0.05, D / 2 + 0.07], [x + sx * 0.07, 0.01, D / 2 + 0.03]], 0.032);
    tube([[x, SY, -D / 2 + 0.04], [x + sx * 0.02, SY * 0.55, -D / 2 - 0.02], [x + sx * 0.05, 0.05, -D / 2 - 0.08], [x + sx * 0.07, 0.01, -D / 2 - 0.04]], 0.032);
    const side = new THREE.Mesh(new THREE.PlaneGeometry(D - 0.12, 0.14), ironLace('apron')); side.position.set(x, SY - 0.1, 0); side.rotation.y = Math.PI / 2; bench.add(side);
  }
  // the lantern on its post, at the right
  part(bench, GEO.cylB, dark, [1.55, 0, -0.05], [0.035, 1.35, 0.035]);
  part(bench, GEO.box, dark, [1.55, 1.36, -0.05], [0.24, 0.03, 0.24]);
  const lm = new THREE.MeshLambertMaterial({ color: '#f8e2b0', emissive: '#f4b860', emissiveIntensity: 0.5 });
  nightGlow.push({ m: lm, day: 0.35, night: 1.2 });
  part(bench, GEO.box, lm, [1.55, 1.5, -0.05], [0.17, 0.24, 0.17]);
  part(bench, GEO.pyr, dark, [1.55, 1.62, -0.05], [0.17, 0.14, 0.17], [0, Math.PI / 4, 0]);
  const lg = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffd59a', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
  lg.position.set(1.55, 1.5, -0.05); lg.scale.setScalar(1.6); bench.add(lg); nightSprites.push({ s: lg, day: 0.25, night: 0.85 });
  bench.userData.glowBase = new V3(1.55, 1.5, -0.05);
  // "Sit here": a white plaque on two slender posts behind the bench
  // a white arch over the bench (two square posts and a curved top) that carries the plaque
  for (const sx of [-1.45, 1.45]) { part(bench, GEO.box, iron, [sx, 1.25, -0.55], [0.12, 2.5, 0.12]); part(bench, GEO.box, iron, [sx, 0.06, -0.55], [0.2, 0.12, 0.2]); }
  { const pts = []; for (let k = 0; k <= 20; k++) { const u = k / 20; pts.push(new V3((u - 0.5) * 2.9, 2.5 + Math.sin(u * Math.PI) * 0.35, -0.55)); }
    for (const dy of [0, -0.12]) bench.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => p.clone().setY(p.y + dy))), 60, 0.045, 8), iron)); }
  const pc = document.createElement('canvas'); pc.width = 1024; pc.height = 300; const pg = pc.getContext('2d');
  const paintPlaque = () => {
    pg.fillStyle = '#f7f4ec'; pg.fillRect(0, 0, 1024, 300); pg.strokeStyle = '#b89a72'; pg.lineWidth = 8; pg.strokeRect(18, 18, 988, 264); pg.lineWidth = 3; pg.strokeRect(34, 34, 956, 232);
    pg.fillStyle = '#5a4634'; pg.textAlign = 'center'; pg.textBaseline = 'middle'; pg.font = 'italic 600 150px "Cormorant Garamond", Georgia, serif'; pg.fillText('Sit here', 512, 146);
    pg.fillStyle = '#e48aa8'; for (const x of [90, 934]) for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; pg.beginPath(); pg.ellipse(x + Math.cos(a) * 16, 150 + Math.sin(a) * 16, 14, 9, a, 0, 7); pg.fill(); }
    ptex.needsUpdate = true;
  };
  const ptex = new THREE.CanvasTexture(pc); ptex.anisotropy = 8; paintPlaque(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(paintPlaque);
  part(bench, GEO.box, iron, [0, 2.12, -0.55], [1.7, 0.52, 0.05]);
  for (const sx of [-0.6, 0.6]) part(bench, GEO.cylB, iron, [sx, 2.37, -0.55], [0.012, 0.32, 0.012]);
  for (const dz of [0.03, -0.03]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(1.64, 0.48), new THREE.MeshLambertMaterial({ map: ptex })); f.position.set(0, 2.12, -0.55 + dz); if (dz < 0) f.rotation.y = Math.PI; bench.add(f); }
  bench.traverse(o => { o.userData.bench = true; if (o.isMesh && !o.isInstancedMesh) o.castShadow = true; });
  scene.add(bench);
  // its bed: mulch inside a brick edge, with blue hydrangeas round the back
  const bed = new THREE.Group(); bed.position.copy(bench.position); bed.rotation.copy(bench.rotation); scene.add(bed);
  const mulch = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), M('#6b4a32')); mulch.scale.set(3.0, 1, 2.1); mulch.position.set(0, 0.03, -0.35); mulch.receiveShadow = true; bed.add(mulch);
  const brick = new Merge(), R = rng(612);
  // (the edge is open at the front, where you step in)
  for (let k = 0; k < 44; k++) { const a = k / 44 * Math.PI * 2, x = Math.cos(a) * 3.0, z = -0.35 + Math.sin(a) * 2.1; if (Math.sin(a) > 0.82) continue; brick.add(GEO.box, new V3(x, 0.05, z), new V3(0.26, 0.1, 0.12), C(['#a4553c', '#b5634a', '#94492f'][k % 3]), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a, 0))); }
  const shrubs = new Merge(), leafSpots = [];
  for (const [ax, az] of [[-2.3, -0.4], [-1.4, -1.1], [1.4, -1.1], [2.3, -0.4], [-2.7, 0.5], [2.7, 0.5]]) {
    for (let k = 0; k < 70; k++) { const u = new V3(R() - .5, R() * 0.9, R() - .5).normalize(), r = 0.25 + R() * 0.4; leafSpots.push(new V3(ax + u.x * r * 1.3, 0.2 + u.y * r * 1.1, az + u.z * r * 1.1)); }
    for (let k = 0; k < 6; k++) { const c = C(['#6f8fe0', '#8aa2ea', '#9a86d8', '#5b7fd6'][k % 4]), p = new V3(ax + (R() - .5) * 0.8, 0.7 + R() * 0.25, az + (R() - .5) * 0.7); for (let f = 0; f < 9; f++) shrubs.add(GEO.ico, p.clone().add(new V3((R() - .5) * 0.2, (R() - .5) * 0.16, (R() - .5) * 0.2)), new V3(0.07, 0.06, 0.07), c); }
  }
  const bm = new THREE.Mesh(brick.build(), VC); bm.receiveShadow = true; bed.add(bm);
  const sm = new THREE.Mesh(shrubs.build(), VC); sm.castShadow = true; bed.add(sm);
  // the hydrangea bushes are leaves, not balls: broad leaf cards in deep greens
  const leafGeo = GEO.card.clone(), lv = new THREE.InstancedMesh(leafGeo, leafMat, leafSpots.length), d = new THREE.Object3D(), greens = ['#2f5a35', '#3a6a3d', '#4a7a3c', '#355f33'].map(C);
  leafSpots.forEach((p, i) => { d.position.copy(p); d.rotation.set(R() * 6.28, R() * 6.28, R() * 6.28); d.scale.setScalar(0.24 + R() * 0.12); d.updateMatrix(); lv.setMatrixAt(i, d.matrix); lv.setColorAt(i, greens[i % 4]); });
  lv.castShadow = true; bed.add(lv);
  clearArea(BENCH.x, BENCH.z, 2.6);
})();
export const benchSeat = () => {
  // third person: over your figure's shoulder from behind the bench, toward the pond
  if (state.thirdPerson) return { pos: bench.localToWorld(new V3(0.75, 1.55, -1.7)), look: bench.localToWorld(new V3(-0.15, 0.75, 3)) };
  const f = new V3(-BENCH.x, 0, -BENCH.z).normalize();
  return { pos: new V3(BENCH.x + f.x * 0.15, groundH(BENCH.x, BENCH.z) + 1.18, BENCH.z + f.z * 0.15), look: new V3(0, WATER_Y + 0.9, 0) };
};
export const lanternWorld = () => bench.localToWorld(bench.userData.glowBase.clone());

// the gate itself is the great arch in settings/customize.js, next to the sign board that shares its name

export function stoneLantern(x, z, s, ry) {
  const g = new THREE.Group(); g.position.set(x, groundH(x, z), z); g.rotation.y = ry; g.scale.setScalar(s);
  const st = M('#8f8c84'), dk = M('#76736c');
  part(g, GEO.hexB, dk, [0, 0, 0], [0.36, 0.16, 0.36]);
  part(g, GEO.cylB, st, [0, 0.16, 0], [0.11, 0.75, 0.11]);
  part(g, GEO.hexB, st, [0, 0.9, 0], [0.3, 0.12, 0.3]);
  part(g, GEO.box, st, [0, 1.17, 0], [0.32, 0.3, 0.32]);
  const wm = new THREE.MeshLambertMaterial({ color: '#f7e2b4', emissive: '#f0b060', emissiveIntensity: 0.2 });
  nightGlow.push({ m: wm, day: 0.1, night: 1.3 });
  part(g, GEO.box, wm, [0, 1.17, 0], [0.2, 0.17, 0.34]); part(g, GEO.box, wm, [0, 1.17, 0], [0.34, 0.17, 0.2]);
  part(g, GEO.pyr6, dk, [0, 1.32, 0], [0.5, 0.3, 0.5]);
  part(g, GEO.sph, st, [0, 1.68, 0], 0.065);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffc983', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  sp.position.set(0, 1.17, 0); sp.scale.setScalar(1.3); g.add(sp); nightSprites.push({ s: sp, day: 0, night: 0.7 });
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(g); decor.push({ x, z, r: 0.5 * s, collide: 0.4 * s });
}
function boulder(x, z, s, seed) {
  const m = new THREE.Mesh(rockGeo(seed), VC); m.position.set(x, groundH(x, z) - 0.1 * s, z); m.scale.set(s * (0.9 + (seed % 5) * 0.1), s * 0.65, s); m.rotation.y = seed;
  m.castShadow = true; m.receiveShadow = true; scene.add(m); decor.push({ x, z, r: s, collide: s * 0.85 });
}
(function buildDecor() {
  stoneLantern(4.6, 11.8, 1, 0.4);
  stoneLantern(11.3, -3.6, 1.1, 1.2);
  stoneLantern(-2.9, 36.4, 0.95, 0.2);
  BRIDGES.forEach((B, i) => stoneLantern(B.x + B.D.x * 4.8 + 1.2, B.z + B.D.z * 4.8, 0.9, 0.7 + i));
  const R = rng(73);
  [[0.4, 8.4], [1.5, 8.3], [2.3, 8.0], [3.6, 8.5], [-0.6, 8.2], [-2.6, 8.6]].forEach(([a, r], i) => { const x = Math.cos(a) * r, z = Math.sin(a) * r; if (riverDist(x, z) > 2.2 && !stoneNear(x, z, 1)) boulder(x, z, 0.45 + R() * 0.4, 100 + i); });
  [14, 26, 38, 52].forEach((k, i) => { const p = RIVER[k], side = i % 2 ? 1 : -1, nx = RIVER[k + 1]; let tx = nx.x - p.x, tz = nx.z - p.z; const L = Math.hypot(tx, tz); const x = p.x - tz / L * 2.9 * side, z = p.z + tx / L * 2.9 * side; boulder(x, z, 0.5 + R() * 0.5, 200 + i); });
  BRIDGES.forEach(B => {
  const b = new THREE.Group(), wood = M('#7b5a40'), dark = M('#5b4130'); b.position.set(B.x, 0, B.z); b.rotation.y = Math.atan2(B.D.x, B.D.z); scene.add(b);
  const H = B.half + 0.3, N = 18;
  for (let i = 0; i <= N; i++) { const u = -H + i / N * 2 * H, y = bridgeH(B.x + B.D.x * u, B.z + B.D.z * u) ?? B.y0; part(b, GEO.box, wood, [0, y - 0.08, u], [1.7, 0.07, 2 * H / N * 0.92], [Math.atan2(0.6 * Math.PI / 2 / B.half * -Math.sin(clamp(u / B.half, -1, 1) * Math.PI / 2), 1) * -1, 0, 0]); }
  for (const sx of [-0.82, 0.82]) {
    const pts = []; for (let i = 0; i <= 12; i++) { const u = -H + i / 12 * 2 * H, y = (bridgeH(B.x + B.D.x * u, B.z + B.D.z * u) ?? B.y0) + 0.75; pts.push(new V3(sx, y, u)); }
    b.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.04, 6), dark));
    for (let i = 0; i <= 6; i++) { const u = -H + i / 6 * 2 * H, y = bridgeH(B.x + B.D.x * u, B.z + B.D.z * u) ?? B.y0; part(b, GEO.box, dark, [sx, y + 0.3, u], [0.07, 0.85, 0.07]); }
    for (const u of [-H, H]) part(b, GEO.box, dark, [sx, B.y0 - 0.6, u], [0.12, 1.5, 0.12]);
  }
  b.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  });
  // hedge boundary
  const HN = 240, hm = new THREE.InstancedMesh(GEO.ico, new THREE.MeshLambertMaterial({ color: 0xffffff }), HN), d = new THREE.Object3D(), hc = ['#3f5a34', '#47633a', '#38522f', '#4f6b40'].map(C);
  let hi = 0;
  for (let i = 0; i < HN; i++) {
    const a = i / HN * 6.28 + R() * 0.02, r = 75 + R() * 2.5, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if ((Math.abs(x) < 3.5 && z > 0) || riverDist(x, z) < 4.5) continue;
    d.position.set(x, groundH(x, z) + 0.15, z); d.scale.set(2.2 + R() * 0.9, 0.85 + R() * 0.35, 1.9 + R() * 0.8); d.rotation.set(0, R() * 6, 0); d.updateMatrix();
    hm.setMatrixAt(hi, d.matrix); hm.setColorAt(hi, hc[Math.floor(R() * 4)]); hi++;
  }
  hm.count = hi; hm.frustumCulled = false; hm.receiveShadow = true; scene.add(hm); hedges.push(hm);
})();

export const sign = new THREE.Group();
(function buildSign() {
  // beside the path just outside the gate, turned toward where you arrive (0, 49)
  const x = 6.1, z = 38.8; sign.position.set(x, groundH(x, z), z); sign.rotation.y = Math.atan2(0 - x, 49 - z);
  const wood = M('#6b5440'); part(sign, GEO.cylB, wood, [-1.1, 0, 0], [0.07, 1.75, 0.07]); part(sign, GEO.cylB, wood, [1.1, 0, 0], [0.07, 1.75, 0.07]);
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 430; sign.userData.canvas = cv;
  const tex = new THREE.CanvasTexture(cv); sign.userData.tex = tex;
  part(sign, GEO.box, M('#5d4838'), [0, 1.45, -0.02], [2.5, 1.1, 0.08]);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.0078), new THREE.MeshLambertMaterial({ map: tex })); face.position.set(0, 1.45, 0.03); sign.add(face);
  sign.traverse(o => { o.userData.sign = true; if (o.isMesh) o.castShadow = true; });
  scene.add(sign); drawSign();
})();
function drawSign() {
  const cv = sign.userData.canvas, g = cv.getContext('2d');
  g.fillStyle = '#7b6049'; g.fillRect(0, 0, cv.width, cv.height);
  const R = rng(9); g.strokeStyle = 'rgba(40,26,16,.25)'; g.lineWidth = 2;
  for (let i = 0; i < 18; i++) { g.beginPath(); const y = R() * cv.height; g.moveTo(0, y); g.bezierCurveTo(340, y + (R() - .5) * 40, 680, y + (R() - .5) * 40, 1024, y + (R() - .5) * 20); g.stroke(); }
  g.strokeStyle = 'rgba(241,232,212,.5)'; g.lineWidth = 4; g.strokeRect(20, 20, 984, 390);
  g.fillStyle = '#f1e8d4'; g.textAlign = 'center';
  g.font = '500 76px "Cormorant Garamond", Georgia, serif'; g.fillText('Nothing is growing here yet.', 512, 175);
  g.font = 'italic 400 92px "Cormorant Garamond", Georgia, serif'; g.fillText('Write something.', 512, 315);
  sign.userData.tex.needsUpdate = true;
}
if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawSign);

