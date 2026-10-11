import * as THREE from 'three';
import { C, V3, isTouch, rng } from '../core/util.js';
import { groundH } from './terrain.js';
import { scene } from './renderer.js';
import { windify } from './wind.js';
import { DS, M, Merge } from './geometry.js';
import { TULIPS, regBegin, regEnd } from './paths.js';

/* ================= tulips ================= */
export const flowerSpots = [];
regEnd();
regBegin('tulips');
(function buildTulips() {
  const pg = new THREE.PlaneGeometry(1, 1, 2, 3), p = pg.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i) + 0.5, w = 0.5 * Math.sin(Math.PI * Math.pow(y, 0.75)) * (1 - 0.15 * y); p.setXYZ(i, x * 2 * w, y, -0.35 * (x * 2 * w) * (x * 2 * w) + 0.05 * y); }
  pg.computeVertexNormals();
  const head = new Merge(), white = C('#ffffff'), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let k = 0; k < 6; k++) {
    const a = k / 6 * Math.PI * 2 + (k % 2) * 0.2, rr = k % 2 ? 0.012 : 0.02;
    e.set(-0.12, a, 0, 'YXZ'); q.setFromEuler(e);
    head.add(pg, new V3(Math.sin(a) * rr, 0.42, Math.cos(a) * rr), new V3(0.05, 0.075, 0.05), white.clone().multiplyScalar(k % 2 ? 0.86 : 1), q);
  }
  const headGeo = head.build();
  const st = new Merge(), gr = C('#5c7c3c');
  st.limb(new V3(0, 0, 0), new V3(0, 0.43, 0), 0.006, 0.005, gr);
  for (const s of [-1, 1]) { e.set(0, s > 0 ? 0 : Math.PI, 0.32 * s, 'YXZ'); q.setFromEuler(e); st.add(pg, new V3(0, 0, 0), new V3(0.06, 0.26, 0.06), C('#668845'), q); }
  const stemGeo = st.build();
  const sp = isTouch ? 0.55 : 0.4;
  const cols = ['#d61f2c', '#f4c22e', '#f287b0', '#f6f1ea', '#7c3d9f', '#f27726', '#c8102e', '#ffd9e2'].map(C);
  const items = [];
  TULIPS.forEach((t, ti) => {
    const R = rng(300 + ti), rowW = t.field ? 4 : 2;
    for (let x = t.x0 + 0.2; x <= t.x1 - 0.2; x += sp) for (let z = t.z0 + 0.2; z <= t.z1 - 0.2; z += sp) {
      const row = Math.floor((t.field ? x - t.x0 : z - t.z0) / (sp * rowW));
      const c = cols[(row + ti * 3) % cols.length].clone().offsetHSL(0, 0, (R() - .5) * 0.06);
      items.push({ x: x + (R() - .5) * sp * 0.5, z: z + (R() - .5) * sp * 0.5, c, s: 0.85 + R() * 0.35, ry: R() * 6.28 });
    }
  });
  const mh = new THREE.InstancedMesh(headGeo, windify(new THREE.MeshLambertMaterial({ vertexColors: true, side: DS, emissive: '#100808' }), 0.03, 'const'), items.length);
  const ms = new THREE.InstancedMesh(stemGeo, windify(new THREE.MeshLambertMaterial({ vertexColors: true, side: DS }), 0.03, 'const'), items.length);
  const d = new THREE.Object3D();
  items.forEach((it, i) => {
    d.position.set(it.x, groundH(it.x, it.z) - 0.02, it.z); d.rotation.set((Math.random() - .5) * 0.12, it.ry, (Math.random() - .5) * 0.12); d.scale.setScalar(it.s * 1.3); d.updateMatrix();
    mh.setMatrixAt(i, d.matrix); ms.setMatrixAt(i, d.matrix); mh.setColorAt(i, it.c);
    if (i % 12 === 0) flowerSpots.push({ x: it.x, y: d.position.y + 0.62 * it.s, z: it.z });
  });
  [mh, ms].forEach(m => { m.frustumCulled = false; m.layers.set(2); scene.add(m); });
  // soil edging for the beds
  TULIPS.forEach(t => { const m = new THREE.Mesh(new THREE.PlaneGeometry(t.x1 - t.x0 + 0.4, t.z1 - t.z0 + 0.4).rotateX(-Math.PI / 2), M('#5a4936')); m.position.set((t.x0 + t.x1) / 2, groundH((t.x0 + t.x1) / 2, (t.z0 + t.z1) / 2) + 0.015, (t.z0 + t.z1) / 2); m.receiveShadow = true; scene.add(m); });
})();

regEnd();
