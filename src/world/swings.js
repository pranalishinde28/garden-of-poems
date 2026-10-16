import * as THREE from 'three';
import { C, V3, lerp, rng } from '../core/util.js';
import { groundH } from './terrain.js';
import { scene } from './renderer.js';
import { racemeTex } from './textures.js';
import { windify } from './wind.js';
import { DS, GEO, M, Merge, VC, limb, part, rockGeo } from './geometry.js';
import { BENCH, decor, regBegin, regEnd } from './paths.js';
import { arborLeaves, wisGeoBase } from './arbors.js';
import { GREEN_PALS, mapleMat } from '../plants/autumnLeaves.js';

/* ================= swings ================= */
export const swings = [];
export const swingVeilTex = racemeTex('#ffe6ee', '#e5739c', 59);
export const swingVeilMat = windify(new THREE.MeshLambertMaterial({ map: swingVeilTex, alphaTest: 0.42, side: DS, emissive: '#2a1018' }), 0.03, 'const');
export const SWING_GARDEN = { x: -19, z: 21 }; // beside the writing bench, facing the pond
function buildSwing(x, z, ry, seed, sc = 1.35) {
  const g = new THREE.Group(); g.position.set(x, groundH(x, z), z); g.rotation.y = ry; g.scale.setScalar(sc); scene.add(g);
  const wood = M('#6e5440'), H = 2.75, W = 1.2; // wider frame, so the longer seat swings clear
  for (const sx of [-W, W]) for (const sz of [-0.95, 0.95]) limb(g, new V3(sx, 0, sz), new V3(sx, H, 0), 0.065, 0.055, wood);
  part(g, GEO.box, wood, [0, H, 0], [2 * W + 0.35, 0.13, 0.13]);
  const pivot = new THREE.Group(); pivot.position.set(0, H - 0.07, 0); g.add(pivot);
  const L = 2.05, rope = M('#cdb998');
  for (const sx of [-0.5, 0.5]) part(pivot, GEO.cylB, rope, [sx, -L, 0], [0.014, L, 0.014]);
  // a long seat board, wide enough to sit comfortably, with a darker edge
  part(pivot, GEO.box, M('#8a6a4c'), [0, -L, 0], [1.15, 0.06, 0.42]);
  part(pivot, GEO.box, M('#6b4f37'), [0, -L - 0.035, 0], [1.17, 0.02, 0.44]);
  // a climbing vine: leaf cards along the beam and up the posts (they turn with the season, like the
  // arbors), with a few small flowers; it used to be green beads, which looked unfinished
  const R = rng(seed), NL = 150, lg = GEO.card.clone(); lg.boundingSphere = new THREE.Sphere(new V3(0, H / 2, 0), H + 1);
  const leaves = new THREE.InstancedMesh(lg, mapleMat, NL), dv = new THREE.Object3D(), fm = new Merge();
  for (let i = 0; i < NL; i++) {
    const onBeam = R() < 0.6, t = R();
    const p = onBeam ? new V3(-W - 0.15 + t * (2 * W + 0.3), H + 0.04 + (R() - .3) * 0.16, (R() - .5) * 0.22) : new V3((R() < .5 ? -W : W) + (R() - .5) * 0.12, Math.pow(t, 0.6) * H, (R() < .5 ? -1 : 1) * 0.95 * (1 - Math.pow(t, 0.6)) + (R() - .5) * 0.12);
    dv.position.copy(p); dv.rotation.set(R() * 6.28, R() * 6.28, R() * 6.28); dv.scale.setScalar(0.2 + R() * 0.14); dv.updateMatrix();
    leaves.setMatrixAt(i, dv.matrix); leaves.setColorAt(i, C(GREEN_PALS[1][i % 4]));
    if (i % 5 === 0) fm.add(GEO.ico, p.clone().add(new V3(0, 0.04, 0.05)), new V3(0.04, 0.035, 0.04), C(['#f4b6c8', '#ffffff', '#f19bb8'][i % 3]));
  }
  g.add(leaves); arborLeaves.push(leaves); g.add(new THREE.Mesh(fm.build(), VC));
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
  // more room between swings: 6.4 m apart in a row, 6.6 m between the rows
  for (let row = 0; row < 2; row++) for (let col = -1; col <= 1; col++) buildSwing(C0.x + rx * col * 6.4 - fx * row * 6.6, C0.z + rz * col * 6.4 - fz * row * 6.6, face, seed++, 1.35);
  const court = new THREE.Mesh(new THREE.PlaneGeometry(22, 16).rotateX(-Math.PI / 2), M('#8a7a5e')); court.position.set(C0.x - fx * 3.3, groundH(C0.x, C0.z) + 0.02, C0.z - fz * 3.3); court.rotation.y = face; court.receiveShadow = true; scene.add(court);
  // stepping stones from the front of the swings to the bench path
  const S0 = { x: C0.x + fx * 4.5, z: C0.z + fz * 4.5 }, S1 = { x: BENCH.x - 1.8, z: BENCH.z + 2.4 };
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

