import * as THREE from 'three';
import { C, V3, lerp, rng } from '../core/util.js';
import { groundH } from './terrain.js';
import { scene } from './renderer.js';
import { racemeTex } from './textures.js';
import { windify } from './wind.js';
import { DS, GEO, M, Merge, VC, limb, part, rockGeo } from './geometry.js';
import { BENCH, decor, regBegin, regEnd } from './paths.js';
import { wisGeoBase } from './arbors.js';

/* ================= swings ================= */
export const swings = [];
export const swingVeilTex = racemeTex('#ffe6ee', '#e5739c', 59);
export const swingVeilMat = windify(new THREE.MeshLambertMaterial({ map: swingVeilTex, alphaTest: 0.42, side: DS, emissive: '#2a1018' }), 0.03, 'const');
export const SWING_GARDEN = { x: -19, z: 21 }; // beside the writing bench, facing the pond
function buildSwing(x, z, ry, seed, sc = 1.35) {
  const g = new THREE.Group(); g.position.set(x, groundH(x, z), z); g.rotation.y = ry; g.scale.setScalar(sc); scene.add(g);
  const wood = M('#6e5440'), H = 2.75, W = 0.95;
  for (const sx of [-W, W]) for (const sz of [-0.95, 0.95]) limb(g, new V3(sx, 0, sz), new V3(sx, H, 0), 0.065, 0.055, wood);
  part(g, GEO.box, wood, [0, H, 0], [2 * W + 0.35, 0.13, 0.13]);
  const pivot = new THREE.Group(); pivot.position.set(0, H - 0.07, 0); g.add(pivot);
  const L = 2.05, rope = M('#cdb998');
  for (const sx of [-0.33, 0.33]) part(pivot, GEO.cylB, rope, [sx, -L, 0], [0.012, L, 0.012]);
  part(pivot, GEO.box, M('#8a6a4c'), [0, -L, 0], [0.78, 0.05, 0.32]);
  const vm = new Merge(), R = rng(seed);
  for (let i = 0; i < 70; i++) {
    const onBeam = R() < 0.5, t = R();
    const p = onBeam ? new V3(-W - 0.1 + t * (2 * W + 0.2), H + 0.05, (R() - .5) * 0.15) : new V3((R() < .5 ? -W : W), t * H, (R() < .5 ? -1 : 1) * 0.95 * (1 - t));
    const s = 0.06 + R() * 0.07; vm.add(GEO.ico, p, new V3(s, s, s), C(['#567a3a', '#668c45', '#4f7034'][i % 3]));
    if (i % 4 === 0) vm.add(GEO.ico, p.clone().add(new V3(0, 0.05, 0.05)), new V3(0.035, 0.035, 0.035), C(['#f4b6c8', '#ffffff', '#c9a6e6'][i % 3]));
  }
  g.add(new THREE.Mesh(vm.build(), VC));
  { const vg = wisGeoBase.clone(); vg.boundingSphere = new THREE.Sphere(new V3(0, H, 0), 4); const NV = 44, vi = new THREE.InstancedMesh(vg, swingVeilMat, NV * 2), d = new THREE.Object3D();
    for (let i = 0; i < NV; i++) { const x = -W - 0.15 + R() * (2 * W + 0.3), z = (R() < .5 ? -1 : 1) * (0.07 + R() * 0.12), hh = 0.45 + R() * 0.55; for (let c = 0; c < 2; c++) { d.position.set(x, H, z); d.rotation.set(0, R() * 3.14 + c * Math.PI / 2, 0); d.scale.set(hh * 0.36, hh, 1); d.updateMatrix(); vi.setMatrixAt(i * 2 + c, d.matrix); } }
    g.add(vi); }
  const sw = { g, pivot, L, Lw: L * sc, theta: 0, omega: 0, yaw: 0, pitch: -0.05 };
  g.traverse(o => { if (o.isMesh) o.castShadow = true; o.userData.swing = sw; });
  g.updateMatrixWorld(true);
  for (const sx of [-W, W]) for (const sz of [-0.95, 0.95]) { const w = g.localToWorld(new V3(sx, 0, sz)); decor.push({ x: w.x, z: w.z, r: 0.4, collide: 0.15 }); }
  decor.push({ x, z, r: 2.2 * sc, collide: -1 });
  swings.push(sw); return sw;
}
(function swingGarden() {
  regBegin('swings');
  const C0 = SWING_GARDEN, face = Math.atan2(0 - C0.x, 0 - C0.z), fx = Math.sin(face), fz = Math.cos(face), rx = Math.cos(face), rz = -Math.sin(face);
  let seed = 1;
  for (let row = 0; row < 2; row++) for (let col = -1; col <= 1; col++) buildSwing(C0.x + rx * col * 4.8 - fx * row * 5.2, C0.z + rz * col * 4.8 - fz * row * 5.2, face, seed++, 1.35);
  const court = new THREE.Mesh(new THREE.PlaneGeometry(17, 13).rotateX(-Math.PI / 2), M('#8a7a5e')); court.position.set(C0.x - fx * 2.6, groundH(C0.x, C0.z) + 0.02, C0.z - fz * 2.6); court.rotation.y = face; court.receiveShadow = true; scene.add(court);
  // stepping stones from the front of the swings to the bench path
  const S0 = { x: C0.x + fx * 4.5, z: C0.z + fz * 4.5 }, S1 = { x: BENCH.x - 1.8, z: BENCH.z + 2.4 };
  const NS = Math.max(2, Math.round(Math.hypot(S1.x - S0.x, S1.z - S0.z) / 1.05) + 1);
  const R = rng(4242), st = new THREE.InstancedMesh(rockGeo(31), VC, NS), d = new THREE.Object3D();
  for (let i = 0; i < NS; i++) { const t = i / (NS - 1), x = lerp(S0.x, S1.x, t), z = lerp(S0.z, S1.z, t); d.position.set(x, groundH(x, z) + 0.01, z); d.rotation.set(0, R() * 6, 0); d.scale.set(0.45, 0.09, 0.4); d.updateMatrix(); st.setMatrixAt(i, d.matrix); st.setColorAt(i, C('#ffffff').lerp(C('#c9c0ad'), R())); }
  st.receiveShadow = true; scene.add(st);
  decor.push({ x: C0.x - fx * 2.6, z: C0.z - fz * 2.6, r: 9.5, collide: -1 });
  regEnd();
})();
const swingSeat = sw => sw.pivot.localToWorld(new V3(0, -sw.L + 0.95, 0.05));

