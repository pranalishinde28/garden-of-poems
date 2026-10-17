import * as THREE from 'three';
import { C, V3 } from '../core/util.js';
import { SETTINGS, THEME } from '../settings/storage.js';
import { blossomTex } from '../world/textures.js';
import { windify } from '../world/wind.js';
import { BARK, DS, GEO, Merge, UP, VCP } from '../world/geometry.js';
import { AUTUMN_PALS, GREEN_PALS, SAKURA_WHITE, mapleMat } from './autumnLeaves.js';

/* ================= sakura ================= */
const cardMat = windify(new THREE.MeshLambertMaterial({ map: blossomTex, alphaTest: 0.45, side: DS, emissive: '#2a1219' }), 0.035, 'const');
const SAKURA = {
  spring: ['#f7c3d2', '#f3b0c4', '#fad6e0', '#eea0b8'],
  monsoon: ['#f4bccc', '#f0aac0', '#f8d0dc', '#e899b2'],
  autumn: ['#ee9fb5', '#e88aa6', '#f4b9c9', '#dc7d9c'],
  winter: ['#f6dbe3', '#f1cad6', '#fbe8ee', '#ecbccb']
};
export function growSakura(g, R, o) {
  const mg = new Merge(), pg = new Merge();
  const barkA = C('#64504a'), barkB = C('#7a6460');
  const bark = () => barkA.clone().lerp(barkB, R());
  const lean = new V3((R() - .5) * 0.6 * (1 + (o.gnarl || 0)), 0, (R() - .5) * 0.6 * (1 + (o.gnarl || 0)));
  const mid = new V3(lean.x * 0.45 + (R() - .5) * 0.2, o.h * 0.5, lean.z * 0.45 + (R() - .5) * 0.2), top = new V3(lean.x, o.h, lean.z);
  mg.limb(new V3(0, 0, 0), mid, o.r, o.r * 0.82, bark()); mg.limb(mid, top, o.r * 0.82, o.r * 0.62, bark());
  for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28 + R(); mg.limb(new V3(0, 0.3 * o.r * 3, 0), new V3(Math.cos(a) * o.r * 2.4, -0.08, Math.sin(a) * o.r * 2.4), o.r * 0.55, o.r * 0.12, bark()); }
  const tips = [];
  function branch(from, dir, len, rad, d) {
    const bend = new V3((R() - .5) * 0.6, o.weeping ? -0.35 * R() : 0.18 * R(), (R() - .5) * 0.6);
    const m1 = from.clone().addScaledVector(dir, len * 0.5), d2 = dir.clone().add(bend).normalize(), to = m1.clone().addScaledVector(d2, len * 0.5);
    mg.limb(from, m1, rad, rad * 0.8, bark()); mg.limb(m1, to, rad * 0.8, rad * 0.6, bark());
    if (d <= 0) { tips.push({ p: to, dir: d2 }); return; }
    if (d === 1 && R() < 0.5) tips.push({ p: m1.clone(), dir: d2 });
    const n = 2 + (R() < 0.4 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const nd = d2.clone().add(new V3((R() - .5) * 1.1, (R() - .35) * 0.5, (R() - .5) * 1.1));
      if (!o.weeping && nd.y < 0.05) nd.y = 0.05;
      branch(to, nd.normalize(), len * 0.7, rad * 0.62, d - 1);
    }
  }
  const nb = 4 + Math.floor(R() * 3);
  for (let i = 0; i < nb; i++) {
    const a = i / nb * Math.PI * 2 + R() * 0.5;
    const dir = new V3(Math.cos(a) * o.spread, (o.weeping ? 0.55 : 0.4) + R() * 0.35, Math.sin(a) * o.spread).normalize();
    branch(top.clone().lerp(mid, R() * 0.45), dir, o.h * 0.55, o.r * 0.55, o.depth - 1);
  }
  tips.push({ p: top.clone(), dir: UP });

  // the garden's season dresses every tree: blossom in spring, full leaf in summer, red and gold in autumn, bare and snowy in winter
  const aut = THEME === 'autumn', green = THEME === 'monsoon', bare = THEME === 'winter', pi3 = Math.floor(R() * 3);
  const pal = (aut ? AUTUMN_PALS[pi3] : green ? GREEN_PALS[pi3] : SETTINGS.blossom === 'white' ? SAKURA_WHITE : SAKURA.spring).map(C);
  const cards = [];
  let maxR = 0, maxY = 0, sumY = 0;
  tips.forEach(t => {
    const s = o.bloom * (0.75 + R() * 0.5);
    maxR = Math.max(maxR, Math.hypot(t.p.x, t.p.z) + s); maxY = Math.max(maxY, t.p.y + s * 0.7); sumY += t.p.y;
    if (bare) { // snow along the tips instead of leaves
      mg.add(GEO.sph, new V3(t.p.x, t.p.y + 0.05, t.p.z), new V3(0.14 + R() * 0.08, 0.05, 0.14 + R() * 0.08), C('#f3f6f9'));
      if (R() < 0.6) mg.add(GEO.sph, new V3(t.p.x - t.dir.x * 0.4, t.p.y - t.dir.y * 0.4 + 0.04, t.p.z - t.dir.z * 0.4), new V3(0.1, 0.04, 0.1), C('#eef2f6'));
    } else if (!o.weeping) {
      // a full cloud of blossom (or leaves) round every tip; no solid filler balls (they read as circles)
      for (let k = 0; k < 46; k++) {
        const u = new V3(R() - .5, R() - .5, R() - .5).normalize(), rr = s * Math.cbrt(R()) * 1.05;
        cards.push({ p: new V3(t.p.x + u.x * rr * 1.25, t.p.y + 0.15 + u.y * rr * 0.8, t.p.z + u.z * rr * 1.25), s: 0.62 + R() * 0.5 });
      }
    } else {
      const L = (1.6 + R() * 2.2) * o.bloom, n = Math.ceil(L / 0.26);
      for (let k = 0; k <= n; k++) { const sw = (k / n) * 0.25; cards.push({ p: new V3(t.p.x + (R() - .5) * 0.3 + t.dir.x * sw, t.p.y - k * 0.26, t.p.z + (R() - .5) * 0.3 + t.dir.z * sw), s: 0.42 + R() * 0.22 }); }
    }
  });
  const bm = mg.build(); const barkMesh = new THREE.Mesh(bm, BARK); g.add(barkMesh);
  const pm = pg.build(); if (pm) g.add(new THREE.Mesh(pm, VCP));
  // blossom along the inner branches too, so the crown is full from inside, not a ring of clumps
  if (!bare) for (let i = 0; i < tips.length * 6; i++) {
    const t = tips[Math.floor(R() * tips.length)], f = 0.35 + R() * 0.5, p = top.clone().lerp(t.p, f).add(new V3((R() - .5) * 0.8, (R() - .2) * 0.5, (R() - .5) * 0.8) .multiplyScalar(o.bloom));
    if (!o.weeping) cards.push({ p, s: 0.55 + R() * 0.45 });
  }
  // generous bounds: a crown that reaches past them blinks out at the edge of the view
  const cg = GEO.card.clone(); cg.boundingSphere = new THREE.Sphere(new V3(0, o.h, 0), o.h * 1.6 + o.bloom * 8);
  const dd = new THREE.Object3D();
  if (cards.length) {
    const im = new THREE.InstancedMesh(cg, (aut || green) ? mapleMat : cardMat, cards.length), tints = (aut || green) ? pal : (SETTINGS.blossom === 'white' ? ['#ffffff', '#fff6f8', '#fdeef2', '#fff0f4'] : ['#ffd2df', '#ffc0d3', '#ffdbe6', '#ffb4ca']).map(C); // clearly pink
    cards.forEach((c, i) => { dd.position.copy(c.p); dd.rotation.set(R() * 6.28, R() * 6.28, R() * 6.28); dd.scale.setScalar(c.s); dd.updateMatrix(); im.setMatrixAt(i, dd.matrix); im.setColorAt(i, tints[Math.floor(R() * 4)]); });
    im.userData.noShadow = true; g.add(im);
  }
  // fallen petals (spring) and leaves (autumn); none on summer grass or winter snow
  let fallen = [];
  if (!green && !bare) {
    const PN = 70, pim = new THREE.InstancedMesh(GEO.flatPetal, new THREE.MeshLambertMaterial({ color: 0xffffff, side: DS }), PN);
    for (let i = 0; i < PN; i++) { const a = R() * 6.28, r = Math.sqrt(R()) * maxR * 1.05; dd.position.set(Math.cos(a) * r, 0.025, Math.sin(a) * r); dd.rotation.set(0, R() * 6.28, 0); dd.scale.setScalar((0.8 + R() * 0.6) * (aut ? 2.2 : 1)); dd.updateMatrix(); pim.setMatrixAt(i, dd.matrix); pim.setColorAt(i, pal[Math.floor(R() * 4)]); }
    pim.userData.noShadow = true; pim.frustumCulled = false; g.add(pim);
    fallen = [pim.material];
  }
  return { tips, canopy: { r: maxR * 0.85, top: sumY / tips.length + 0.2 }, h: maxY + 0.2, trunkTop: top, mid, extraMats: fallen };
}

