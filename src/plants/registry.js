import * as THREE from 'three';
import { hashStr, rng } from '../core/util.js';
import { groundH, riverDist } from '../world/terrain.js';
import { poems } from '../settings/storage.js';
import { COL, RAD, REGIONS, plantTypeFor, regionKeyFor, seasonOf } from './mapping.js';
import { scene } from '../world/renderer.js';
import { glowTex } from '../world/textures.js';
import { DS, GEO, M, SHARED, part } from '../world/geometry.js';
import { BENCH, decor, decorNear, inTulip, stoneNear } from '../world/paths.js';
import { clearGrass } from '../world/grass.js';
import { BUILD } from './types.js';
import { late } from '../core/late.js';

/* ================= plants registry ================= */
export const plants = new Map();
export const nightGlow = [], nightSprites = [];
export let shadowDirty = true;
function addSeasonPatch(g, R, season, rad) {
  const mark = m => { m.userData.noShadow = true; return m; };
  if (season === 'winter') for (let i = 0; i < 26; i++) { const a = R() * 6.28, r = Math.sqrt(R()) * rad * 0.8; mark(part(g, GEO.disc, M('#eef2f5'), [Math.cos(a) * r, 0.03, Math.sin(a) * r], [0.12 + R() * 0.2, 1, 0.1 + R() * 0.16], [0, R() * 6, 0])); }
  else if (season === 'autumn') for (let i = 0; i < 12; i++) mark(part(g, GEO.flatPetal, M(R() < .5 ? '#b5653a' : '#c99447', { side: DS }), [(R() - .5) * rad * 1.6, 0.03, (R() - .5) * rad * 1.6], 1.6, [0, R() * 6, 0]));
}
export function createPlant(p, { visible = true } = {}) {
  const type = p.plantType || plantTypeFor(p);
  const R = rng(hashStr(p.id + ':shape'));
  const root = new THREE.Group();
  root.position.set(p.position.x, groundH(p.position.x, p.position.z), p.position.z);
  const inner = new THREE.Group(); inner.rotation.y = R() * Math.PI * 2; root.add(inner);
  const season = seasonOf(p.createdAt), ctx = { glows: [], sprites: [], extraMats: [] };
  const info = BUILD[type](inner, R, p, season, ctx);
  addSeasonPatch(inner, R, season, RAD[type]);
  const gm = new THREE.SpriteMaterial({ map: glowTex, color: '#fff3cf', transparent: true, depthWrite: false, opacity: 0, blending: THREE.AdditiveBlending });
  const glow = new THREE.Sprite(gm); glow.position.y = info.h * 0.55; glow.scale.setScalar(Math.max(1.6, RAD[type] * 1.4 + info.h * 0.3)); inner.add(glow);
  const obj = { poem: p, type, root, inner, h: info.h, radius: RAD[type], collide: COL[type], vis: visible ? 1 : 0, target: visible ? 1 : 0, speed: 0.5, delay: 0,
    glow, glowV: 0, glowT: 0, hover: 0, pulse: 0, sway: (info.sway || []).filter(s => s.amp > 0), bobs: info.bobs || [], glows: ctx.glows, sprites: ctx.sprites,
    extraMats: (info.extraMats || []).concat(ctx.extraMats, [gm]), dying: false, canopy: info.canopy || null };
  obj.sway.forEach(s => { s.base = s.axis === 'x' ? s.o.rotation.x : s.o.rotation.z; });
  ctx.glows.forEach(gl => nightGlow.push(gl));
  ctx.sprites.forEach(sp => nightSprites.push(sp));
  root.traverse(o => { o.userData.plant = obj; if (o.isMesh && !o.isInstancedMesh && !o.userData.noShadow) o.castShadow = true; });
  root.visible = visible;
  inner.scale.setScalar(visible ? 1 : 0.0001);
  if (['flower', 'twin', 'mushrooms', 'thorn'].includes(type)) clearGrass(root.position.x, root.position.z, RAD[type] * 0.9 + 0.3);
  scene.add(root); plants.set(p.id, obj); shadowDirty = true;
  return obj;
}
export function removePlant(obj) {
  scene.remove(obj.root);
  obj.root.traverse(o => { if (o.geometry && !SHARED.has(o.geometry)) o.geometry.dispose(); });
  obj.extraMats.forEach(m => m && m.dispose && m.dispose());
  obj.glows.forEach(gl => { const i = nightGlow.indexOf(gl); if (i >= 0) nightGlow.splice(i, 1); gl.m.dispose(); });
  obj.sprites.forEach(sp => { const i = nightSprites.indexOf(sp); if (i >= 0) nightSprites.splice(i, 1); });
  if (plants.get(obj.poem.id) === obj) plants.delete(obj.poem.id);
  shadowDirty = true; late.rebuildPetals();
}
function assignPosition(p, type) {
  const reg = REGIONS[regionKeyFor(p)], R = rng(hashStr(p.id + ':place')), rad = RAD[type];
  const others = [];
  poems.forEach(q => { if (q !== p && q.position) others.push({ x: q.position.x, z: q.position.z, rad: RAD[q.plantType || plantTypeFor(q)] }); });
  let fallback = null;
  for (let i = 0; i < 120; i++) {
    const spread = 1 + i / 30;
    const a = reg.a + (R() * 2 - 1) * reg.sa * Math.min(spread, 2.2);
    const r = reg.r0 + Math.sqrt(R()) * (reg.r1 - reg.r0) * Math.min(spread, 1.35);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (r < 9.6 || r > 46) continue;
    if (riverDist(x, z) < rad * 0.6 + 2.6 || inTulip(x, z, rad * 0.7 + 0.6)) continue;
    if (stoneNear(x, z, rad * 0.5 + 0.6) || decorNear(x, z, rad * 0.6 + 0.4)) continue;
    if (Math.hypot(x - BENCH.x, z - BENCH.z) < rad + 3.4) continue;
    if (Math.abs(x) < rad + 1.4 && z > 9) continue;
    fallback = { x, z };
    if (others.every(o => Math.hypot(o.x - x, o.z - z) >= (rad + o.rad) * 0.85)) return { x, y: groundH(x, z), z };
  }
  const f = fallback || { x: Math.cos(reg.a) * reg.r1, z: Math.sin(reg.a) * reg.r1 };
  return { x: f.x, y: groundH(f.x, f.z), z: f.z };
}
export function preparePoem(p) {
  const t = plantTypeFor(p);
  // a poem that was a flower or a bush before every poem became a tree is re-placed once, with room for its tree
  if (p.plantType !== t && p.position) p.position = null;
  p.plantType = t;
  if (!p.position || riverDist(p.position.x, p.position.z) < 2.6 || decor.some(o => o.collide !== undefined && Math.hypot(o.x - p.position.x, o.z - p.position.z) < o.r + RAD[t] * 0.4)) p.position = assignPosition(p, t);
}

export function setShadowDirty(v) { return (shadowDirty = v); }
