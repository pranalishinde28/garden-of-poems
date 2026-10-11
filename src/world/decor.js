import * as THREE from 'three';
import { C, V3, clamp, rng } from '../core/util.js';
import { BRIDGES, RIVER, WATER_Y, bridgeH, groundH, riverDist } from './terrain.js';
import { scene } from './renderer.js';
import { glowTex } from './textures.js';
import { GEO, M, Merge, VC, part, rockGeo } from './geometry.js';
import { BENCH, decor, stoneNear } from './paths.js';
import { nightGlow, nightSprites } from '../plants/registry.js';
import { state } from '../core/state.js';

/* ================= decor: bench & pergola, gate, lanterns, rocks, bridge, hedges ================= */
export const bench = new THREE.Group();
(function buildBench() {
  const y = groundH(BENCH.x, BENCH.z);
  bench.position.set(BENCH.x, y, BENCH.z);
  bench.rotation.y = Math.atan2(-BENCH.x, -BENCH.z);
  const wood = M('#7b5c43'), dark = M('#4d3a2c'), post = M('#5e4a3a');
  for (let i = 0; i < 3; i++) part(bench, GEO.box, wood, [0, 0.46, -0.12 + i * 0.14], [1.7, 0.05, 0.12]);
  for (let i = 0; i < 2; i++) part(bench, GEO.box, wood, [0, 0.72 + i * 0.17, -0.24], [1.7, 0.1, 0.04], [-0.15, 0, 0]);
  for (const x of [-0.72, 0.72]) { part(bench, GEO.box, dark, [x, 0.22, 0.12], [0.07, 0.46, 0.07]); part(bench, GEO.box, dark, [x, 0.5, -0.24], [0.07, 1.0, 0.07]); }
  // lantern on a post
  part(bench, GEO.cylB, dark, [1.25, 0, -0.05], [0.035, 1.35, 0.035]);
  part(bench, GEO.box, dark, [1.25, 1.36, -0.05], [0.24, 0.03, 0.24]);
  const lm = new THREE.MeshLambertMaterial({ color: '#f8e2b0', emissive: '#f4b860', emissiveIntensity: 0.5 });
  nightGlow.push({ m: lm, day: 0.35, night: 1.2 });
  part(bench, GEO.box, lm, [1.25, 1.5, -0.05], [0.17, 0.24, 0.17]);
  part(bench, GEO.pyr, dark, [1.25, 1.62, -0.05], [0.17, 0.14, 0.17], [0, Math.PI / 4, 0]);
  const lg = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffd59a', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
  lg.position.set(1.25, 1.5, -0.05); lg.scale.setScalar(1.6); bench.add(lg); nightSprites.push({ s: lg, day: 0.25, night: 0.85 });
  bench.userData.glowBase = new V3(1.25, 1.5, -0.05);
  bench.traverse(o => { o.userData.bench = true; if (o.isMesh && !o.isInstancedMesh) o.castShadow = true; });
  scene.add(bench);
})();
export const benchSeat = () => {
  // third person: over your figure's shoulder from behind the bench, toward the pond
  if (state.thirdPerson) return { pos: bench.localToWorld(new V3(0.75, 1.55, -1.7)), look: bench.localToWorld(new V3(-0.15, 0.75, 3)) };
  const f = new V3(-BENCH.x, 0, -BENCH.z).normalize();
  return { pos: new V3(BENCH.x + f.x * 0.15, groundH(BENCH.x, BENCH.z) + 1.18, BENCH.z + f.z * 0.15), look: new V3(0, WATER_Y + 0.9, 0) };
};
export const lanternWorld = () => bench.localToWorld(bench.userData.glowBase.clone());

(function buildGate() {
  const g = new THREE.Group(), z = 39.2; g.position.set(0, groundH(0, z), z); scene.add(g);
  const wood = M('#6b5440');
  for (const x of [-1.7, 1.7]) part(g, GEO.cylB, wood, [x, 0, 0], [0.09, 2.5, 0.09]);
  const arch = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.08, 6, 24, Math.PI), wood); arch.position.y = 2.5; g.add(arch);
  const R = rng(5), vc = ['#4f6a3e', '#5c7a47', '#6d8a52'], vm = new Merge();
  for (let i = 0; i < 60; i++) {
    let p; if (R() < 0.6) { const a = R() * Math.PI; p = [Math.cos(a) * 1.7, 2.5 + Math.sin(a) * 1.7]; } else p = [R() < .5 ? -1.7 : 1.7, R() * 2.5];
    const s = 0.09 + R() * 0.08; vm.add(GEO.ico, new V3(p[0] + (R() - .5) * 0.2, p[1], (R() - .5) * 0.2), new V3(s, s, s), C(vc[i % 3]));
    if (i % 5 === 0) vm.add(GEO.ico, new V3(p[0], p[1] + 0.06, 0.13), new V3(0.05, 0.05, 0.05), C(i % 2 ? '#f6c9d5' : '#fbf6ef'));
  }
  g.add(new THREE.Mesh(vm.build(), VC));
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
})();

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
  stoneLantern(-2.9, 37.2, 0.95, 0.2);
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
  hm.count = hi; hm.frustumCulled = false; hm.receiveShadow = true; scene.add(hm);
})();

export const sign = new THREE.Group();
(function buildSign() {
  const x = 2.7, z = 33.6; sign.position.set(x, groundH(x, z), z); sign.rotation.y = -0.45;
  const wood = M('#6b5440'); part(sign, GEO.cylB, wood, [-0.7, 0, 0], [0.05, 1.2, 0.05]); part(sign, GEO.cylB, wood, [0.7, 0, 0], [0.05, 1.2, 0.05]);
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 220; sign.userData.canvas = cv;
  const tex = new THREE.CanvasTexture(cv); sign.userData.tex = tex;
  part(sign, GEO.box, M('#5d4838'), [0, 1.05, -0.01], [1.72, 0.76, 0.06]);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.64, 0.7), new THREE.MeshLambertMaterial({ map: tex })); face.position.set(0, 1.05, 0.025); sign.add(face);
  sign.traverse(o => { o.userData.sign = true; if (o.isMesh) o.castShadow = true; });
  scene.add(sign); drawSign();
})();
function drawSign() {
  const cv = sign.userData.canvas, g = cv.getContext('2d');
  g.fillStyle = '#7b6049'; g.fillRect(0, 0, cv.width, cv.height);
  const R = rng(9); g.strokeStyle = 'rgba(40,26,16,.25)'; g.lineWidth = 2;
  for (let i = 0; i < 14; i++) { g.beginPath(); const y = R() * cv.height; g.moveTo(0, y); g.bezierCurveTo(170, y + (R() - .5) * 20, 340, y + (R() - .5) * 20, 512, y + (R() - .5) * 10); g.stroke(); }
  g.fillStyle = '#f1e8d4'; g.textAlign = 'center';
  g.font = '500 40px "Cormorant Garamond", Georgia, serif'; g.fillText('There is nothing growing here yet.', 256, 95);
  g.font = 'italic 400 44px "Cormorant Garamond", Georgia, serif'; g.fillText('Write something.', 256, 160);
  sign.userData.tex.needsUpdate = true;
}
if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawSign);

