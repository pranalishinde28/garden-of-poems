import * as THREE from 'three';
import { C, V3, rng } from '../core/util.js';
import { groundH } from './terrain.js';
import { scene } from './renderer.js';
import { wisTexP, wisTexW } from './textures.js';
import { windify } from './wind.js';
import { BARK, DS, GEO, M, Merge, VC, part } from './geometry.js';
import { BENCH, decor, regBegin } from './paths.js';

/* ================= wisteria arbors ================= */
export const wisGeoBase = (() => { const g = GEO.card.clone(); g.translate(0, -0.5, 0); return g; })();
export const wisMatP = windify(new THREE.MeshLambertMaterial({ map: wisTexP, alphaTest: 0.42, side: DS, emissive: '#1d1430' }), 0.03, 'const');
export const wisMatW = windify(new THREE.MeshLambertMaterial({ map: wisTexW, alphaTest: 0.42, side: DS, emissive: '#22201c' }), 0.031, 'const');
function wisteriaArbor(o) {
  const g = new THREE.Group(); g.position.set(o.x, groundH(o.x, o.z), o.z); g.rotation.y = o.ry; scene.add(g);
  const post = M('#5a4636'), H = o.h || 2.7, L = o.len, W = o.wid, R = rng(o.seed || 1);
  const np = Math.max(2, Math.round(L / 2.3) + 1), posts = [];
  for (let i = 0; i < np; i++) { const x = -L / 2 + i * (L / (np - 1)); for (const z of [-W / 2, W / 2]) { part(g, GEO.box, post, [x, H / 2, z], [0.13, H, 0.13]); posts.push(new V3(x, 0, z)); } }
  for (const z of [-W / 2, W / 2]) part(g, GEO.box, post, [0, H, z], [L + 0.5, 0.14, 0.11]);
  const nr = Math.max(3, Math.round(L / 0.45));
  for (let i = 0; i <= nr; i++) part(g, GEO.box, post, [-L / 2 + i * (L / nr), H + 0.11, 0], [0.07, 0.08, W + 0.5]);
  // twisting trunks climbing two of the posts
  const tr = new Merge();
  [posts[0], posts[posts.length - 1]].forEach((p, k) => {
    let prev = new V3(p.x + 0.12, 0, p.z); for (let s = 1; s <= 8; s++) { const y = s / 8 * H, a = s * 1.3 + k; const nx = new V3(p.x + Math.cos(a) * 0.14, y, p.z + Math.sin(a) * 0.14); tr.limb(prev, nx, 0.07 - s * 0.005, 0.065 - s * 0.005, C('#6a5648')); prev = nx; }
  });
  const tm = tr.build(); if (tm) { const m = new THREE.Mesh(tm, BARK); m.castShadow = true; g.add(m); }
  // leaf canopy
  const lv = new Merge(), nLeaf = Math.round(L * W * 3.4);
  for (let i = 0; i < nLeaf; i++) lv.add(GEO.ico, new V3(-L / 2 - 0.25 + R() * (L + 0.5), H + 0.16 + R() * 0.22, -W / 2 - 0.25 + R() * (W + 0.5)), new V3(0.34 + R() * 0.3, 0.12 + R() * 0.07, 0.34 + R() * 0.3), C(['#5f7f3e', '#6f8c48', '#86a35a', '#7a9850'][Math.floor(R() * 4)]));
  const lm = new THREE.Mesh(lv.build(), VC); lm.castShadow = true; g.add(lm);
  // racemes: two crossed cards each, denser at the edges where they hang free
  const n = Math.round(L * W * (o.density || 17)), white = o.white ?? 0.22;
  const list = { P: [], W: [] };
  for (let i = 0; i < n; i++) {
    const edge = R() < 0.45;
    const x = -L / 2 - 0.2 + R() * (L + 0.4);
    const z = edge ? (R() < .5 ? -1 : 1) * (W / 2 + (R() - 0.3) * 0.35) : -W / 2 + R() * W;
    const hh = (edge ? 0.7 + R() * 0.75 : 0.45 + R() * 0.55) * (o.long || 1);
    (R() < white ? list.W : list.P).push({ x, z, h: hh, ry: R() * 3.14, y: H + 0.04 + R() * 0.08 });
  }
  const d = new THREE.Object3D();
  [['P', wisMatP], ['W', wisMatW]].forEach(([k, mat]) => {
    const arr = list[k]; if (!arr.length) return;
    const geo = wisGeoBase.clone(); geo.boundingSphere = new THREE.Sphere(new V3(0, H, 0), Math.max(L, W) + 2);
    const im = new THREE.InstancedMesh(geo, mat, arr.length * 2);
    arr.forEach((r, i) => {
      for (let c = 0; c < 2; c++) {
        d.position.set(r.x, r.y, r.z); d.rotation.set((R() - .5) * 0.08, r.ry + c * Math.PI / 2, 0); d.scale.set(r.h * 0.36, r.h, 1); d.updateMatrix();
        im.setMatrixAt(i * 2 + c, d.matrix); im.setColorAt(i * 2 + c, C('#ffffff').lerp(C(k === 'P' ? '#e8dcff' : '#fff1f6'), R() * 0.6));
      }
    });
    g.add(im);
  });
  g.updateMatrixWorld(true);
  posts.forEach(p => { const w = g.localToWorld(p.clone()); decor.push({ x: w.x, z: w.z, r: 0.3, collide: 0.16 }); });
  decor.push({ x: o.x, z: o.z, r: Math.max(L, W) / 2 + 0.6, collide: -1 });
  g.traverse(m => { if (m.isMesh && !m.isInstancedMesh) m.castShadow = true; });
  return g;
}
regBegin('wisteria');
// Only two arbors: the one over the writing bench and the entrance tunnel. Free-standing ones read as confusing poles.
(function buildArbors() {
  wisteriaArbor({ x: BENCH.x, z: BENCH.z, ry: Math.atan2(-BENCH.x, -BENCH.z), len: 3.6, wid: 2.5, h: 2.6, seed: 3, density: 22, white: 0.15 });
  wisteriaArbor({ x: 0, z: 26.6, ry: Math.PI / 2, len: 13, wid: 3.6, h: 2.9, seed: 5, density: 19, white: 0.25, long: 1.15 });
})();

