import * as THREE from 'three';
import { C, V3, rng } from '../core/util.js';
import { gorgeLocal, groundH, riverDist } from '../world/terrain.js';
import { scene } from '../world/renderer.js';
import { DS, GEO } from '../world/geometry.js';
import { decor, inTulip, stoneNear } from '../world/paths.js';
import { poems } from '../settings/storage.js';
import { canvasTex } from '../world/textures.js';
import { windify } from '../world/wind.js';

/* ================= hydrangeas all along the garden's edge ================= */
// A deep border of mophead hydrangeas in front of the hedge, in every colour they come in, so the ring of
// bare ground at the edge is never seen. Leaves and flower heads are cards (no solid balls); each head is a
// dome of floret cards. Gaps are left for the gate, the stream, the buildings and the paths.
const floretTex = canvasTex(128, 128, g => {
  const R = rng(91);
  for (let k = 0; k < 22; k++) {
    const x = 18 + R() * 92, y = 18 + R() * 92; if (Math.hypot(x - 64, y - 64) > 52) continue;
    g.fillStyle = '#ffffff'; for (let p = 0; p < 4; p++) { const a = p * Math.PI / 2 + R(); g.beginPath(); g.ellipse(x + Math.cos(a) * 6, y + Math.sin(a) * 6, 7, 5, a, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(120,120,160,.5)'; g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill();
  }
});
const leafTex = canvasTex(128, 128, g => {
  g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(64, 6); g.bezierCurveTo(118, 40, 108, 100, 64, 122); g.bezierCurveTo(20, 100, 10, 40, 64, 6); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(64, 10); g.lineTo(64, 118); g.stroke();
  for (let k = 0; k < 6; k++) { g.lineWidth = 1.2; g.beginPath(); g.moveTo(64, 26 + k * 15); g.lineTo(30, 14 + k * 15); g.moveTo(64, 26 + k * 15); g.lineTo(98, 14 + k * 15); g.stroke(); }
});
const floretMat = windify(new THREE.MeshLambertMaterial({ map: floretTex, alphaTest: 0.45, side: DS }), 0.02, 'const');
const leafMat = windify(new THREE.MeshLambertMaterial({ map: leafTex, alphaTest: 0.45, side: DS }), 0.025, 'const');
const HUES = [['#5b7fd6', '#7d9be6', '#4e6ec4'], ['#f08fb5', '#f6a9c6', '#e477a2'], ['#b07fd8', '#c9a0e6', '#9a6cc4'], ['#f7f6f2', '#ece8f2', '#fbf8ee'], ['#d9468c', '#e86aa4', '#c23a7a'], ['#8fb0ea', '#b4c9f2', '#a8b4ee']];

(function plantBorder() {
  const R = rng(7070), spots = [];
  for (const [r0, step, chance] of [[62.4, 2.6, 0.45], [64.6, 2.2, 0.7], [66.8, 1.9, 0.9], [69.0, 1.6, 1], [71.3, 1.6, 1]]) {
    const n = Math.round(Math.PI * 2 * r0 / step);
    for (let i = 0; i < n; i++) {
      if (R() > chance) continue;
      const a = (i + (R() - 0.5) * 0.6) / n * Math.PI * 2, r = r0 + (R() - 0.5) * 1.0, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.abs(x) < 5.5 && z > 0) continue; // the way in at the gate
      if (x > 50 && Math.abs(gorgeLocal(x, z).across) < 9) continue; // the way out to the gorge lookout, and a clear view down to its water
      if (riverDist(x, z) < 4.6 || stoneNear(x, z, 1.0)) continue;
      if (decor.some(o => o.collide > 0 && Math.hypot(o.x - x, o.z - z) < o.collide + 1.2)) continue;
      spots.push({ x, z, s: 1.25 + R() * 0.55, hue: Math.floor(R() * HUES.length) }); // fuller bushes, about a metre high
    }
  }
  // drifts further in, over the bare ground between the border and the garden's buildings. They stay
  // beyond 44 m, past every poem region (which end by 40 m), and clear of any poem planted further out,
  // so no poem is ever moved for them; they are not obstacles, only flowers.
  const near = (x, z, d) => spots.some(s => Math.abs(s.x - x) < d && Math.abs(s.z - z) < d && Math.hypot(s.x - x, s.z - z) < d);
  const poemAt = poems.filter(p => p.position).map(p => p.position);
  for (let i = 0; i < 16000; i++) {
    const a = R() * Math.PI * 2, r = 44 + R() * 17.5, x = Math.cos(a) * r, z = Math.sin(a) * r;
    // in drifts, not a carpet: where a slow wave of noise is high
    const n = Math.sin(x * 0.11 + 1.7) * Math.cos(z * 0.09 - 0.4) + 0.55 * Math.sin(x * 0.23 - z * 0.19 + 2);
    if (n < -0.15 + (62 - r) * 0.03) continue;
    if (Math.abs(x) < 7 && z > 0) continue; // the way in at the gate
    if (x > 40 && Math.abs(gorgeLocal(x, z).across) < 10) continue; // the way out to the gorge lookout
    if (riverDist(x, z) < 5 || stoneNear(x, z, 1.4) || inTulip(x, z, 1.5)) continue;
    if (decor.some(o => Math.hypot(o.x - x, o.z - z) < (o.collide > 0 ? o.collide + 1.8 : (o.r || 0) + 0.6))) continue;
    if (poemAt.some(p => Math.hypot(p.x - x, p.z - z) < 3)) continue;
    if (near(x, z, 1.25)) continue;
    spots.push({ x, z, s: 1.05 + R() * 0.5, hue: Math.floor(R() * HUES.length) });
  }
  const leaves = [], heads = [];
  spots.forEach(sp => {
    const y = groundH(sp.x, sp.z), s = sp.s;
    for (let k = 0; k < 30; k++) { const u = new V3(R() - 0.5, R() * 0.9 + 0.1, R() - 0.5).normalize(), r = (0.25 + R() * 0.5) * s; leaves.push({ p: new V3(sp.x + u.x * r * 1.4, y + 0.15 + u.y * r * 1.1, sp.z + u.z * r * 1.4), s: (0.26 + R() * 0.12) * s }); }
    const pal = HUES[sp.hue];
    for (let h = 0; h < 7; h++) {
      const a = R() * 6.28, r = R() * 0.45 * s, c = new V3(sp.x + Math.cos(a) * r, y + (0.62 + R() * 0.3) * s, sp.z + Math.sin(a) * r), col = C(pal[h % 3]);
      for (let f = 0; f < 14; f++) { const u = new V3(R() - 0.5, R() * 0.8 + 0.2, R() - 0.5).normalize(); heads.push({ p: c.clone().addScaledVector(u, 0.15 * s), n: u, s: (0.16 + R() * 0.06) * s, c: col }); }
    }
  });
  const d = new THREE.Object3D(), z = new V3(0, 0, 1);
  const lg = GEO.card.clone(); lg.boundingSphere = new THREE.Sphere(new V3(), 80);
  const lm = new THREE.InstancedMesh(lg, leafMat, leaves.length), greens = ['#3a6a3d', '#2f5a35', '#4a7a3c', '#456f39'].map(C);
  leaves.forEach((l, i) => { d.position.copy(l.p); d.rotation.set(R() * 6.28, R() * 6.28, R() * 6.28); d.scale.setScalar(l.s); d.updateMatrix(); lm.setMatrixAt(i, d.matrix); lm.setColorAt(i, greens[i % 4]); });
  const fg = GEO.card.clone(); fg.boundingSphere = new THREE.Sphere(new V3(), 80);
  const fm = new THREE.InstancedMesh(fg, floretMat, heads.length);
  heads.forEach((h, i) => { d.position.copy(h.p); d.quaternion.setFromUnitVectors(z, h.n); d.rotateZ(R() * 6.28); d.scale.setScalar(h.s); d.updateMatrix(); fm.setMatrixAt(i, d.matrix); fm.setColorAt(i, h.c); });
  lm.castShadow = true; lm.receiveShadow = true; scene.add(lm, fm);
})();
