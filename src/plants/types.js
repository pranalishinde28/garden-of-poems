import * as THREE from 'three';
import { clamp, hashStr, lineCount } from '../core/util.js';
import { glowTex } from '../world/textures.js';
import { DS, GEO, M, VC, part, rockGeo } from '../world/geometry.js';
import { growSakura } from './sakura.js';
import { buildFlower, flowerColor } from './flowers.js';

/* ================= plant types ================= */
export const BUILD = {
  flower(g, R, p, season) {
    const joy = p.mood === 'joy';
    const c = flowerColor(p, R, season, joy ? ['#fff6df', '#f7e4a4', '#f4d47e'] : ['#f4c2d0', '#e889a8', '#f7e6ec', '#c9b8e6', '#bcd0e6']);
    const top = buildFlower(g, R, c, 2.6, 0, joy ? 13 : 8); const sway = [];
    const n = 3 + Math.floor(R() * 3);
    for (let i = 0; i < n; i++) {
      const sub = new THREE.Group(), a = R() * 6.28, d = 0.3 + R() * 0.38;
      sub.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); sub.rotation.y = R() * 6.28; g.add(sub);
      buildFlower(sub, R, c, 1.1 + R() * 0.5, 0, joy ? 13 : 8); sway.push({ o: sub, amp: 0.06, ph: R() * 6 });
    }
    return { h: top + 0.25, sway };
  },
  twin(g, R, p, season) {
    const a = new THREE.Group(), b = new THREE.Group(); a.position.x = -0.26; b.position.x = 0.26; g.add(a, b);
    const h1 = buildFlower(a, R, flowerColor(p, R, season, ['#e98ea9']), 2.8, 0.07, 9);
    const h2 = buildFlower(b, R, flowerColor(p, R, season, ['#f6c4d1']), 2.5, -0.07, 9);
    for (let i = 0; i < 9; i++) part(g, GEO.flatPetal, M('#f0b9c7', { side: DS }), [(R() - .5) * 1.3, 0.025, (R() - .5) * 1.3], 1.2, [0, R() * 6, 0]);
    return { h: Math.max(h1, h2) + 0.25, sway: [{ o: a, amp: 0.05, ph: 0 }, { o: b, amp: 0.05, ph: 0.5 }] };
  },
  willow(g, R, p, season) {
    const s = 0.95 + Math.min(lineCount(p), 24) / 50;
    const t = growSakura(g, R, { h: 2.5 * s, r: 0.24 * s, spread: 0.85, depth: 2, bloom: 0.95 * s, season, weeping: true });
    return { h: t.h, canopy: t.canopy, extraMats: t.extraMats };
  },
  orchard(g, R, p, season) {
    const t = growSakura(g, R, { h: 1.9, r: 0.17, spread: 1.25, depth: 3, bloom: 0.72, season });
    return { h: t.h, canopy: t.canopy, extraMats: t.extraMats };
  },
  bigtree(g, R, p, season) {
    const s = clamp(0.95 + lineCount(p) / 34, 1, 1.6);
    const t = growSakura(g, R, { h: 2.4 * s, r: 0.27 * s, spread: 1.35, depth: 3, bloom: 0.95 * s, season });
    return { h: t.h, canopy: t.canopy, extraMats: t.extraMats };
  },
  oldtree(g, R, p, season, ctx) {
    const t = growSakura(g, R, { h: 3.0, r: 0.52, spread: 1.55, depth: 3, bloom: 1.3, season, gnarl: 1 });
    // sacred rope with paper streamers
    const ry = 1.35, rr = 0.52 * 0.95;
    const rope = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.065, 6, 28), M('#e3d5b0')); rope.rotation.x = Math.PI / 2; rope.position.set(t.mid.x * ry / (3.0 * 0.5), ry, t.mid.z * ry / (3.0 * 0.5)); g.add(rope);
    for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28; part(g, GEO.box, M('#fbfaf6', { side: DS }), [rope.position.x + Math.cos(a) * (rr + 0.05), ry - 0.16, rope.position.z + Math.sin(a) * (rr + 0.05)], [0.07, 0.24, 0.006], [0.1, -a, 0.12]); }
    // paper lanterns hanging from branches
    const lm = new THREE.MeshLambertMaterial({ color: '#fbe7c6', emissive: '#f0a85a', emissiveIntensity: 0.2 });
    ctx.glows.push({ m: lm, day: 0.15, night: 1.2 });
    const tipsLow = t.tips.filter(q => q.p.y < 4.6 && Math.hypot(q.p.x, q.p.z) > 1.5).slice(0, 5);
    tipsLow.forEach(q => {
      const y = q.p.y - 0.75; part(g, GEO.cylB, M('#3a2d27'), [q.p.x, y + 0.24, q.p.z], [0.006, 0.55, 0.006]);
      part(g, GEO.sph, lm, [q.p.x, y, q.p.z], [0.12, 0.16, 0.12]);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffc77a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      sp.position.set(q.p.x, y, q.p.z); sp.scale.setScalar(0.9); g.add(sp); ctx.sprites.push({ s: sp, day: 0.05, night: 0.75 });
      ctx.extraMats.push(sp.material);
    });
    return { h: t.h, canopy: t.canopy, extraMats: t.extraMats.concat([lm]) };
  },
  treehouse(g, R, p, season, ctx) {
    const t = growSakura(g, R, { h: 3.0, r: 0.27, spread: 1.15, depth: 3, bloom: 0.9, season });
    const wood = M('#8a6b4f'), dark = M('#5e4535');
    part(g, GEO.box, wood, [0, 1.85, 0], [1.75, 0.1, 1.75]);
    part(g, GEO.box, M('#b08d68'), [0, 2.3, 0.12], [1.05, 0.8, 0.95]);
    part(g, GEO.pyr, dark, [0, 2.7, 0.12], [0.98, 0.6, 0.98], [0, Math.PI / 4, 0]);
    const wm = new THREE.MeshLambertMaterial({ color: '#f6d79c', emissive: '#f2b25c', emissiveIntensity: 0.3 });
    ctx.glows.push({ m: wm, day: 0.15, night: 1.1 });
    part(g, GEO.box, wm, [0.28, 2.36, 0.6], [0.24, 0.22, 0.02]);
    part(g, GEO.box, dark, [-0.22, 2.16, 0.6], [0.26, 0.44, 0.02]);
    for (const x of [-0.2, 0.2]) part(g, GEO.box, wood, [x, 0.93, 1.1], [0.05, 1.95, 0.05], [-0.24, 0, 0]);
    for (let i = 1; i < 6; i++) { const y = i * 0.32; part(g, GEO.box, wood, [0, y, 1.1 + (0.93 - y) * 0.245], [0.42, 0.04, 0.05]); }
    return { h: Math.max(t.h, 3.4), canopy: t.canopy, extraMats: t.extraMats.concat([wm]) };
  },
  thorn(g, R) {
    part(g, GEO.disc, M('#352c25'), [0, 0.03, 0], 1.5).userData.noShadow = true;
    for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(rockGeo(hashStr('r' + i) + Math.floor(R() * 999)), VC); m.position.set((R() - .5) * 1.9, 0.05, (R() - .5) * 1.9); m.scale.set(0.25 + R() * 0.3, 0.2 + R() * 0.22, 0.25 + R() * 0.3); m.rotation.y = R() * 6; m.userData.ownGeo = true; g.add(m); }
    const sway = [];
    for (let i = 0; i < 17; i++) {
      const piv = new THREE.Group(), a = R() * 6.28, d = R() * 0.55;
      piv.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); piv.rotation.set((R() - .5) * 1.2, 0, (R() - .5) * 1.2); g.add(piv);
      const L = 0.5 + R() * 0.85;
      part(piv, GEO.cone, M(R() < .5 ? '#2e2324' : '#46302c'), [0, 0, 0], [0.05, L, 0.05]);
      if (i < 7) {
        const head = new THREE.Group(); head.position.y = L; piv.add(head);
        const pc = M(i % 2 ? '#8c2430' : '#a8323e', { side: DS });
        for (let k = 0; k < 6; k++) { const pv = new THREE.Group(); pv.rotation.y = k / 6 * 6.28; head.add(pv); part(pv, GEO.petal, pc, [0, 0, 0], [0.12, 0.14, 0.12], [0, 0, 0.5]); }
        part(head, GEO.sph, M('#e2b74e'), [0, 0.02, 0], 0.025);
      }
      sway.push({ o: piv, amp: 0.025, ph: R() * 6 });
    }
    return { h: 1.4, sway };
  },
  mushrooms(g, R, p, season, ctx) {
    const bobs = [], n = 4 + Math.floor(R() * 4), caps = ['#b5a8cf', '#b9cbd8', '#d7c6ee', '#a9c4d6'];
    for (let i = 0; i < n; i++) {
      const a = R() * 6.28, d = i ? 0.2 + R() * 0.75 : 0, x = Math.cos(a) * d, z = Math.sin(a) * d;
      const h = (i ? 0.22 + R() * 0.4 : 0.75), sr = 0.035 + h * 0.08;
      part(g, GEO.cylB, M('#ece6d8'), [x, 0, z], [sr, h, sr]);
      const cm = new THREE.MeshLambertMaterial({ color: caps[i % 4], emissive: caps[i % 4], emissiveIntensity: 0.3 });
      ctx.glows.push({ m: cm, day: 0.22, night: 0.95 });
      const cr = 0.12 + h * 0.38; part(g, GEO.half, cm, [x, h - 0.03, z], [cr, cr * 0.6, cr]);
    }
    const om = new THREE.MeshBasicMaterial({ color: '#efeaff', transparent: true, opacity: 0.9 });
    for (let i = 0; i < 7; i++) { const m = part(g, GEO.sph, om, [(R() - .5) * 1.8, 0.7 + R() * 1.3, (R() - .5) * 1.8], 0.03 + R() * 0.03); m.userData.noShadow = true; bobs.push({ o: m, y: m.position.y, ph: R() * 6, amp: 0.18 }); }
    return { h: 1.5, bobs, extraMats: [om] };
  }
};

