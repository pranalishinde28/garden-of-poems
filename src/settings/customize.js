import { applyHorizon } from '../world/horizon.js';
import * as THREE from 'three';
import { $, C, V3, rng } from '../core/util.js';
import { groundH } from '../world/terrain.js';
import { cleanSettings, resolveSeason, SETTINGS, THEME } from './storage.js';
import { T, state } from '../core/state.js';
import { maxAniso, scene } from '../world/renderer.js';
import { blossomTex, canvasTex, mapleTex, wisTexP, wisTexW } from '../world/textures.js';
import { windify } from '../world/wind.js';
import { DS, GEO, M, Merge, VC, part } from '../world/geometry.js';
import { REG, decor, featOn } from '../world/paths.js';
import { stoneLantern } from '../world/decor.js';
import { createPlant, nightGlow, plants, removePlant, setShadowDirty } from '../plants/registry.js';
import { koi } from '../water/water.js';
import { wisMatP, wisMatW, wisGeoBase, arborLeaves, setArborSeason } from '../world/arbors.js';
import { SPAWN } from '../player/camera.js';
const SPAWN_Z = SPAWN.pos.z;
import { swingVeilMat, swingVeilTex } from '../world/swings.js';
import { animals } from '../animals/animals.js';
import { mist } from '../plants/flowerGardens.js';
import { rebuildConnections, rebuildPetals } from '../world/particles.js';
import { Music } from '../audio/music.js';
import { toast } from '../ui/helpers.js';
import { closePanel, openPanel } from '../ui/reading.js';
import { applyThemeMaterials, setTheme } from '../ui/themes.js';
import { Cloud, saveGardenSettings } from '../cloud/cloud.ts';
import { late, provide } from '../core/late.js';

// names other modules reach through late (see core/late.js)
provide({
  get settingsKey() { return settingsKey; },
  get localSettings() { return localSettings; },
  get persistSettings() { return persistSettings; },
  get applyAllSettings() { return applyAllSettings; },
  get updateVeils() { return updateVeils; },
  get applyVisibility() { return applyVisibility; },
  get board() { return board; },
  get openBoard() { return openBoard; },
  get openCustomize() { return openCustomize; },
});

/* ================= customizing a garden: scenery, features, trees, music, and the sign ================= */
animals.forEach(a => { a.cat = (a.train || a.legs || (a.home && a.head && !a.wl)) ? 'land' : (a.l || a.wl) ? 'air' : 'water'; });
const SHOW_LABELS = [['wisteria', 'Wisteria arbors'], ['tulips', 'Tulip fields'], ['roses', 'Rose garden'], ['hydrangeas', 'Blue hydrangeas'], ['lilies', 'White lilies'], ['orchids', 'Purple orchids'], ['lamps', 'Garden lamps'], ['swings', 'Swing garden'], ['land', 'Deer, peacocks and rabbits'], ['air', 'Birds and butterflies'], ['water', 'Ducks and koi']];
const SCENE_LABELS = [['fuji', 'Mount Fuji, when the horizon is the mountains'], ['mist', 'Morning mist over the water'], ['drift', 'Pollen, leaves or snow in the air']];
const settingsKey = () => 'garden-of-poems:settings' + (Cloud.user ? ':u:' + Cloud.user.id : '');
function localSettings(key) { try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v ? cleanSettings(v) : null; } catch (e) { return null; } }
let settingsTimer = null;
export function persistSettings() {
  if (state.visiting) return;
  try { localStorage.setItem(settingsKey(), JSON.stringify(SETTINGS)); } catch (e) {}
  if (Cloud.user) { clearTimeout(settingsTimer); settingsTimer = setTimeout(() => saveGardenSettings({ settings: SETTINGS, theme: THEME === 'autumn' ? 'autumn' : 'spring' }), 900); }
}
export function applyVisibility() {
  // in winter the flower beds rest under the snow (the choices themselves are kept)
  const resting = THEME === 'winter' ? ['tulips', 'roses', 'hydrangeas', 'lilies', 'orchids'] : [];
  for (const k in REG) { const on = k === 'fuji' ? SETTINGS.fuji : featOn(k) && !resting.includes(k); REG[k].forEach(o => { o.visible = on; }); }
  applyHorizon(SETTINGS.view, SETTINGS.fuji);
  mist.forEach(s => { s.visible = SETTINGS.mist; });
  koi.forEach(k => { k.g.visible = featOn('water'); });
  setShadowDirty(true);
}
function applyWeather() { state.showerAt = T; late.setRainUI(); }
// day, sunset or night; 'auto' follows the clock (sunset from five to half past six, and at dawn)
export const lightByClock = () => { const h = new Date().getHours() + new Date().getMinutes() / 60; return h >= 18.5 || h < 5.5 ? 'night' : (h >= 17 || h < 7) ? 'sunset' : 'day'; };
export function setLightMode(mode) { state.lightMode = mode; state.nightTarget = mode === 'night' ? 1 : 0; state.duskTarget = mode === 'sunset' ? 1 : 0; late.setNightUI(); }
export function applyLight() { setLightMode(SETTINGS.light === 'auto' ? lightByClock() : SETTINGS.light); }
function rebuildAllPlants() {
  [...plants.values()].filter(p => !p.dying).forEach(pl => { const tg = pl.target; removePlant(pl); const np = createPlant(pl.poem, { visible: tg === 1 }); np.target = tg; });
  rebuildPetals(); rebuildConnections(); applyThemeMaterials();
}
function applyMusic(m) {
  if (m === 'off') { if (!Music.muted) Music.setMuted(true); }
  else if (m === 'own') { if (Music.mode !== 'own' || !Music.files.length) { late.fileInput.value = ''; late.fileInput.click(); } else if (Music.muted) Music.setMuted(false); }
  else { if (Music.muted) Music.setMuted(false); if (Music.mode === 'own') Music.backToPiano(); }
  late.setSoundUI();
}
function applyAllSettings(opts = {}) {
  if (resolveSeason(SETTINGS.season) !== THEME) setTheme(SETTINGS.season, true); else if (opts.trees) rebuildAllPlants();
  updateVeils(); applyVisibility(); applyLight(); applyWeather(); drawBoard(); if (customPanel.classList.contains('open')) renderCustom();
}
export function setSetting(k, v) {
  if (state.visiting) { toast('You are visiting. Return to your own garden to customize it.'); return; }
  if (k.startsWith('show.')) SETTINGS.show[k.slice(5)] = v; else SETTINGS[k] = v;
  if (k === 'season') setTheme(v);
  else if (k === 'tree' || k === 'blossom') { rebuildAllPlants(); updateVeils(); }
  else if (k === 'light') applyLight();
  else if (k === 'weather') applyWeather();
  else if (k === 'music') applyMusic(v);
  else if (k === 'links') drawBoard();
  else applyVisibility();
  persistSettings(); renderCustom(); if (late.setRainUI) late.setRainUI(); // the sky buttons show the change
}

/* veils: wisteria in spring, autumn leaves in autumn; pink veils over the swings */
function leafVeilTex(seed) {
  return canvasTex(128, 384, (g) => {
    const R = rng(seed), pal = ['#c8382a', '#d9472c', '#e2622f', '#f0b23c', '#f4cf52', '#e07a2e', '#b82f2a'];
    g.strokeStyle = '#6a4a32'; g.lineWidth = 2; g.beginPath(); g.moveTo(64, 0); g.quadraticCurveTo(58, 190, 66, 372); g.stroke();
    for (let k = 0; k < 120; k++) {
      const t = k / 120, y = 10 + t * 362, spread = (1 - t) * 34 + 8, x = 64 + (R() - .5) * spread * 2, r = (1 - t) * 6 + 4;
      g.save(); g.translate(x, y); g.rotate(R() * 6.28); g.fillStyle = pal[Math.floor(R() * pal.length)]; g.beginPath();
      for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + i / 10 * Math.PI * 2, rr = i % 2 === 0 ? r : r * 0.45; i ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      g.closePath(); g.fill(); g.restore();
    }
  });
}
const veilAutumnA = leafVeilTex(71), veilAutumnB = leafVeilTex(72);
export function updateVeils() {
  const a = THEME === 'autumn';
  wisMatP.map = a ? veilAutumnA : wisTexP; wisMatW.map = a ? veilAutumnB : wisTexW; swingVeilMat.map = a ? veilAutumnA : swingVeilTex;
  wisMatP.emissive.set(a ? '#2a1008' : '#1d1430'); wisMatW.emissive.set(a ? '#2a1408' : '#22201c'); swingVeilMat.emissive.set(a ? '#2a1008' : '#2a1018');
  // winter: the wisteria and the swing veils are bare
  [wisMatP, wisMatW, swingVeilMat].forEach(m => { m.needsUpdate = true; m.visible = THEME !== 'winter'; });
  arborLeaves.forEach(l => { l.visible = THEME !== 'winter'; });
  setArchSeason(THEME); setAzaleaSeason(THEME); setArborSeason(THEME);
}

/* the gate: a deep double arch heavy with blossom, the garden's name hanging from its crown */
export const GATE = { z: 39.2, w: 3.0, post: 3.0, rise: 1.5 };
const archBloom = []; // { cards, snow, base } changed with the season (setArchSeason)
const archCardMat = windify(new THREE.MeshLambertMaterial({ map: blossomTex, alphaTest: 0.45, side: DS, emissive: '#2a1219' }), 0.03, 'const');
export const archPlaque = new THREE.Group();
(function buildArch() {
  const g = new THREE.Group(), { z, w, post, rise } = GATE; g.position.set(0, groundH(0, z), z); scene.add(g);
  const wood = M('#5e4634'), dark = M('#3e2e22'), R = rng(41);
  // the frame: two hoops, a hand apart, joined by slats over the crown
  const curve = t => { const a = Math.PI * (1 - t); return new V3(Math.cos(a) * w, post + Math.sin(a) * rise, 0); };
  for (const dz of [-0.42, 0.42]) {
    for (const sx of [-1, 1]) part(g, GEO.cylB, wood, [sx * w, 0, dz], [0.13, post, 0.13]);
    const pts = []; for (let i = 0; i <= 24; i++) pts.push(curve(i / 24).setZ(dz));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.1, 8), wood));
  }
  for (let i = 1; i < 14; i++) { const p = curve(i / 14); part(g, GEO.box, dark, [p.x, p.y + 0.06, 0], [0.09, 0.08, 1.1]); }
  for (const sx of [-1, 1]) for (const y of [0.9, 2.1]) part(g, GEO.box, dark, [sx * w, y, 0], [0.09, 0.08, 1.0]);
  // the bloom: a few leaves underneath and blossom cards over every face, thickest over the crown and shoulders
  const leaf = new Merge(), snow = new Merge(), cards = [];
  const leafC = ['#5d7d45', '#6c8c4e', '#7c9a58', '#55743f'];
  const puff = (m, p, s, c) => m.add(GEO.ico, p, new V3(s, s * (0.8 + R() * 0.3), s), C(c));
  for (let i = 0; i < 460; i++) {
    let p, n; const onPost = R() < 0.26;
    if (onPost) { const sx = R() < 0.5 ? -1 : 1, y = Math.pow(R(), 0.7) * post; p = new V3(sx * w, y, (R() - 0.5) * 1.0); n = new V3(sx, 0, 0); if (y < 0.5 && R() < 0.6) continue; }
    else { const t = R(), c = curve(t); p = c.clone().setZ((R() - 0.5) * 1.2); n = new V3(c.x / (w * w), (c.y - post) / (rise * rise), 0).normalize(); }
    p.addScaledVector(n, (R() - 0.3) * 0.26);
    // (no leaf balls: the blossom cards cover the frame, and green balls stayed green in autumn)
    const nb = onPost ? 2 + Math.floor(R() * 2) : 5 + Math.floor(R() * 3);
    for (let k = 0; k < nb; k++) {
      const q = p.clone().addScaledVector(n, 0.05 + R() * 0.22); q.z = (R() - 0.5) * 1.5; q.x += (R() - .5) * 0.3; q.y += (R() - .5) * 0.25;
      cards.push({ p: q, s: (onPost ? 0.32 : 0.38) + R() * 0.26 });
    }
    // winter lays snow along the top of the frame instead
    if (!onPost && n.y > 0.35 && R() < 0.5) { const k = 0.1 + R() * 0.1; snow.add(GEO.ico, p.clone().addScaledVector(n, 0.06).setZ((R() - 0.5) * 1.0), new V3(k * 1.6, k * 0.5, k * 1.3), C(R() < 0.5 ? '#f4f7fa' : '#e3eaf0')); }
  }
  const lg = leaf.build(); if (lg) { const lm = new THREE.Mesh(lg, VC); g.add(lm); arborLeaves.push(lm); }
  const sm = new THREE.Mesh(snow.build(), VC); sm.visible = false; g.add(sm);
  const cg = GEO.card.clone(); cg.boundingSphere = new THREE.Sphere(new V3(0, post, 0), w + 2);
  const cm = new THREE.InstancedMesh(cg, archCardMat, cards.length), dd = new THREE.Object3D(), tints = ['#ffffff', '#fff0f4', '#fbe3ea', '#ffe8ee', '#f6d2de'].map(C);
  cards.forEach((c, i) => { dd.position.copy(c.p); dd.rotation.set(R() * 6.28, R() * 6.28, R() * 6.28); dd.scale.setScalar(c.s); dd.updateMatrix(); cm.setMatrixAt(i, dd.matrix); cm.setColorAt(i, tints[Math.floor(R() * tints.length)]); });
  g.add(cm); archBloom.push({ cards: cm, snow: sm, base: cm.instanceColor.array.slice() });
  // wisteria hanging from the shoulders, short over the middle so the way stays open
  const list = { P: [], W: [] };
  for (let i = 0; i < 150; i++) {
    const t = 0.04 + R() * 0.92, c = curve(t), mid = 1 - Math.abs(c.x) / w;
    const h = mid > 0.55 ? 0.3 + R() * 0.25 : 0.6 + R() * 0.8 * (1 - mid);
    (R() < 0.3 ? list.W : list.P).push({ x: c.x + (R() - .5) * 0.2, y: c.y - 0.05, z: (R() - 0.5) * 1.0, h });
  }
  const d = new THREE.Object3D();
  [['P', wisMatP], ['W', wisMatW]].forEach(([k, mat]) => {
    const arr = list[k], geo = wisGeoBase.clone(); geo.boundingSphere = new THREE.Sphere(new V3(0, post, 0), w + 2);
    const im = new THREE.InstancedMesh(geo, mat, arr.length * 2);
    arr.forEach((r, i) => { for (let c = 0; c < 2; c++) { d.position.set(r.x, r.y, r.z); d.rotation.set(0, R() * 3.14 + c * Math.PI / 2, 0); d.scale.set(r.h * 0.38, r.h, 1); d.updateMatrix(); im.setMatrixAt(i * 2 + c, d.matrix); im.setColorAt(i * 2 + c, C('#ffffff').lerp(C(k === 'P' ? '#e8dcff' : '#fff1f6'), R() * 0.6)); } });
    g.add(im);
  });
  // the name plaque, hung from the crown and readable from both sides
  archPlaque.position.set(0, post + 0.62, 0); g.add(archPlaque);
  const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 440; archPlaque.userData.cv = cv;
  const tex = new THREE.CanvasTexture(cv); tex.anisotropy = Math.min(8, maxAniso); archPlaque.userData.tex = tex;
  const fm = new THREE.MeshLambertMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.15 }); nightGlow.push({ m: fm, day: 0.14, night: 0.6 });
  part(archPlaque, GEO.box, dark, [0, -0.43, 0], [4.15, 1.0, 0.1]);
  for (const dz of [0.052, -0.052]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 0.86), fm); f.position.z = dz; if (dz < 0) f.rotation.y = Math.PI; f.position.y = 0.07 - 0.5; archPlaque.add(f); }
  for (const sx of [-1.6, 1.6]) part(archPlaque, GEO.cylB, dark, [sx, 0.05, 0], [0.025, 0.42, 0.025]);
  archPlaque.traverse(o => { o.userData.board = true; });
  g.traverse(o => { if (o.isMesh && !o.isInstancedMesh) o.castShadow = true; });
  for (const sx of [-1, 1]) decor.push({ x: sx * w, z, r: 0.7, collide: 0.32 });
})();
// the arch through the year: blossom in spring and summer, maple red and gold in autumn, snow in winter
export function setArchSeason(theme) {
  const aut = theme === 'autumn', pal = ['#d8452c', '#e9772f', '#f2b03a', '#c43a2a'].map(C), R = rng(5);
  archCardMat.map = aut ? mapleTex : blossomTex; archCardMat.emissive.set(aut ? '#160d08' : '#2a1219'); archCardMat.needsUpdate = true;
  archBloom.forEach(({ cards, snow, base }) => {
    cards.visible = theme !== 'winter'; snow.visible = theme === 'winter';
    const a = cards.instanceColor;
    for (let i = 0; i < cards.count; i++) { if (aut) { const c = pal[Math.floor(R() * 4)]; a.setXYZ(i, c.r, c.g, c.b); } else a.setXYZ(i, base[i * 3], base[i * 3 + 1], base[i * 3 + 2]); }
    a.needsUpdate = true;
  });
}

/* clipped azalea mounds and a tall lantern to the right of the gate, so the first view is balanced */
const azalea = { leafMat: new THREE.MeshLambertMaterial({ vertexColors: true }), flowers: null, snow: null };
(function buildAzaleas() {
  const R = rng(57), leaf = new Merge(), fl = new Merge(), sn = new Merge();
  const spots = [[5.2, 37.6, 0.85], [6.6, 36.6, 1.15], [8.3, 36.2, 1.3], [10.0, 35.4, 1.1], [7.4, 38.4, 0.75], [9.4, 37.6, 0.95], [11.4, 34.2, 1.2]];
  spots.forEach(([x, z, s]) => {
    const y = groundH(x, z);
    // each mound: overlapping clipped domes, flattened like a pruned karikomi
    for (let k = 0; k < 18; k++) {
      const a = R() * 6.28, r = Math.sqrt(R()) * 0.6 * s, h = (0.5 + R() * 0.25) * s * (1 - r / (1.4 * s));
      const p = new V3(x + Math.cos(a) * r, y + h * 0.45, z + Math.sin(a) * r), w = (0.32 + R() * 0.18) * s;
      leaf.add(GEO.dode, p, new V3(w, h * 0.6, w), C(['#3f6a35', '#4a7a3c', '#365e30', '#557f40'][k % 4]));
      for (let f = 0; f < 12; f++) { const u = new V3(R() - .5, R() * 0.8 + 0.2, R() - .5).normalize(); fl.add(GEO.ico, p.clone().add(new V3(u.x * w * 0.95, u.y * h * 0.6, u.z * w * 0.95)), new V3(0.07, 0.05, 0.07), C(['#f07aa6', '#f59ac0', '#e9628f', '#fbd3e2'][f % 4])); }
      sn.add(GEO.ico, p.clone().add(new V3(0, h * 0.42, 0)), new V3(w * 0.85, h * 0.22, w * 0.85), C('#f2f6f9'));
    }
    decor.push({ x, z, r: 0.9 * s, collide: 0.75 * s });
  });
  const lm = new THREE.Mesh(leaf.build(), azalea.leafMat); lm.castShadow = true; lm.receiveShadow = true; scene.add(lm);
  azalea.flowers = new THREE.Mesh(fl.build(), VC); scene.add(azalea.flowers);
  azalea.snow = new THREE.Mesh(sn.build(), VC); azalea.snow.visible = false; scene.add(azalea.snow);
  stoneLantern(10.9, 37.9, 1.45, -0.7);
})();
export function setAzaleaSeason(theme) {
  azalea.flowers.visible = theme === 'spring'; azalea.snow.visible = theme === 'winter';
  azalea.leafMat.color.set(theme === 'winter' ? '#c4cdcd' : '#ffffff'); // evergreen: only winter's frost dulls them
}

/* the sign at the gate: big enough to read from where you arrive */
export const board = new THREE.Group();
(function buildBoard() {
  const x = -6.3, z = 38.6; board.position.set(x, groundH(x, z), z); board.rotation.y = Math.atan2(0 - x, SPAWN_Z - z);
  const wood = M('#5a4535'), dark = M('#3f2f24');
  for (const sx of [-1.72, 1.72]) part(board, GEO.cylB, wood, [sx, 0, 0], [0.1, 3.35, 0.1]);
  part(board, GEO.box, dark, [0, 2.05, -0.05], [3.62, 2.3, 0.1]);
  part(board, GEO.box, wood, [0, 3.28, 0], [3.95, 0.12, 0.4]);
  const cv = document.createElement('canvas'); cv.width = 1536; cv.height = 960; board.userData.cv = cv;
  const tex = new THREE.CanvasTexture(cv); tex.anisotropy = Math.min(8, maxAniso); board.userData.tex = tex;
  const fm = new THREE.MeshLambertMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.15 }); nightGlow.push({ m: fm, day: 0.02, night: 0.5 });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 2.1875), fm); face.position.set(0, 2.05, 0.006); board.add(face);
  const vm = new Merge(), R = rng(808);
  for (let i = 0; i < 70; i++) { const p = new V3(-1.9 + R() * 3.8, 3.36 + R() * 0.08, (R() - .5) * 0.36); vm.add(GEO.ico, p, new V3(0.09, 0.075, 0.09), C(['#567a3a', '#668c45'][i % 2])); if (i % 3 === 0) vm.add(GEO.ico, p.clone().add(new V3(0, 0.06, 0.07)), new V3(0.055, 0.055, 0.055), C(['#f4b6c8', '#ffffff'][i % 2])); }
  board.add(new THREE.Mesh(vm.build(), VC));
  board.traverse(o => { o.userData.board = true; if (o.isMesh) o.castShadow = true; });
  scene.add(board); decor.push({ x, z, r: 2.0, collide: 0.6 });
})();
const safeUrl = u => typeof u === 'string' && /^https?:\/\/[^\s<>"]+$/i.test(u) ? u : null;
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } };
function boardInfo() {
  if (state.visiting) return state.visiting.sign;
  const own = Cloud.user && Cloud.garden;
  return { name: (own ? Cloud.garden.name : SETTINGS.name) || 'The Garden of Poems', desc: (own ? Cloud.garden.description : SETTINGS.desc) || '', by: own && Cloud.profile ? (Cloud.profile.display_name || '') : '', links: SETTINGS.links || [], own: true };
}
function wrapText(g, text, maxW) { const words = String(text).split(/\s+/), lines = []; let line = ''; words.forEach(w => { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }); if (line) lines.push(line); return lines; }
const serif = (w, px, it = '') => `${it}${w} ${px}px "Cormorant Garamond", Georgia, serif`;
function fitFont(g, text, maxW, w, px, min) { g.font = serif(w, px); while (g.measureText(text).width > maxW && px > min) { px -= 6; g.font = serif(w, px); } return px; }
function woodGrain(g, W, H, seed, base) {
  const R = rng(seed); g.fillStyle = base; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(35,22,14,.22)'; g.lineWidth = 3;
  for (let i = 0; i < 30; i++) { const y = R() * H; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(W * 0.3, y + (R() - .5) * 40, W * 0.7, y + (R() - .5) * 40, W, y + (R() - .5) * 18); g.stroke(); }
}
// five petals, for the plaque's corners
function blossom(g, x, y, r, col) { g.fillStyle = col; for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 - Math.PI / 2; g.beginPath(); g.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.5, r * 0.36, a, 0, Math.PI * 2); g.fill(); } g.fillStyle = '#e9b04a'; g.beginPath(); g.arc(x, y, r * 0.18, 0, Math.PI * 2); g.fill(); }
export function drawBoard() {
  const info = boardInfo(), cv = board.userData.cv, g = cv.getContext('2d'), W = cv.width, H = cv.height;
  // the owner's choice: the plain wooden board, its grain and inset frame, with no lettering
  // (the garden's name is on the arch's plaque; the links are on the chalkboard opposite)
  woodGrain(g, W, H, 19, '#6f553f');
  g.strokeStyle = 'rgba(240,226,200,.55)'; g.lineWidth = 5; g.strokeRect(32, 32, W - 64, H - 64);
  board.userData.tex.needsUpdate = true;
  drawPlaque(info.name);
  // the QR boards follow the same links
  if (late.drawLinkBoards) late.drawLinkBoards();
}
function drawPlaque(name) {
  const cv = archPlaque.userData.cv, g = cv.getContext('2d'), W = cv.width, H = cv.height;
  woodGrain(g, W, H, 23, '#4a3526');
  g.strokeStyle = 'rgba(226,190,120,.8)'; g.lineWidth = 8; g.strokeRect(22, 22, W - 44, H - 44);
  g.strokeStyle = 'rgba(226,190,120,.45)'; g.lineWidth = 3; g.strokeRect(44, 44, W - 88, H - 88);
  [[110, 110], [W - 110, 110], [110, H - 110], [W - 110, H - 110]].forEach(([x, y], i) => blossom(g, x, y, 46, i % 2 ? '#fbe4ec' : '#f7b9cd'));
  g.fillStyle = '#f7ead2'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 10; g.shadowOffsetY = 4;
  fitFont(g, name, W - 420, 600, 230, 110); g.fillText(name, W / 2, H / 2 + 8);
  g.shadowColor = 'transparent';
  archPlaque.userData.tex.needsUpdate = true;
}
if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawBoard);
const signPanel = $('#signpanel');
function openBoard() {
  const info = boardInfo(); late.closePops();
  $('#s-name').textContent = info.name; $('#s-by').textContent = info.by ? 'A garden by ' + info.by : ''; $('#s-desc').textContent = info.desc || '';
  const box = $('#s-links'); box.innerHTML = '';
  (info.links || []).forEach(l => { const u = safeUrl(l.url); if (!u) return; const a = document.createElement('a'); a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer nofollow'; a.textContent = (l.label || hostOf(u)) + ' · ' + hostOf(u); box.appendChild(a); });
  if (!box.children.length) { const p = document.createElement('p'); p.className = 'n-empty'; p.textContent = info.own ? 'No links yet. Add your socials or portfolio in Customize.' : 'No links on this sign.'; box.appendChild(p); }
  $('#s-edit').hidden = !info.own;
  openPanel(signPanel);
}
$('#s-close').onclick = () => closePanel(signPanel);
$('#s-edit').onclick = () => { closePanel(signPanel); openCustomize(); };

/* the Customize panel */
const customPanel = $('#custom');
(function buildCustomChecks() {
  const mk = (wrap, list, prefix) => list.forEach(([k, label]) => { const l = document.createElement('label'); l.className = 'matters'; const i = document.createElement('input'); i.type = 'checkbox'; i.dataset.k = prefix + k; i.onchange = () => setSetting(i.dataset.k, i.checked); l.append(i, document.createTextNode(' ' + label)); wrap.appendChild(l); });
  mk($('#c-scene'), SCENE_LABELS, ''); mk($('#c-show'), SHOW_LABELS, 'show.');
  customPanel.querySelectorAll('.seg[data-k] button').forEach(b => { b.onclick = () => setSetting(b.parentElement.dataset.k, b.dataset.v); });
})();
// four well-known places come ready: you type only your name there, and the address is made for you
const BADGE = { Instagram: ['IG', '#c13584'], Facebook: ['f', '#1877f2'], Substack: ['S', '#ff6719'], Goodreads: ['g', '#5c4122'] };
export const PRESETS = [
  { name: 'Instagram', host: /(^|\.)instagram\.com$/, make: h => `https://instagram.com/${h}`, read: u => u.pathname.split('/')[1], hint: 'yourname' },
  { name: 'Facebook', host: /(^|\.)facebook\.com$/, make: h => `https://facebook.com/${h}`, read: u => u.pathname.split('/')[1], hint: 'yourname' },
  { name: 'Substack', host: /\.substack\.com$/, make: h => `https://${h}.substack.com`, read: u => u.hostname.split('.')[0], hint: 'yourname' },
  { name: 'Goodreads', host: /(^|\.)goodreads\.com$/, make: h => `https://www.goodreads.com/${h}`, read: u => u.pathname.replace(/^\//, ''), hint: 'yourname' },
];
const handleClean = v => v.trim().replace(/^@/, '').replace(/^https?:\/\/\S*?\//, '').replace(/[^A-Za-z0-9._\-\/]/g, '').slice(0, 60);
function linkRows() {
  const pre = [...$('#c-presets').querySelectorAll('.c-pre')].map(r => { const h = handleClean(r.querySelector('input').value), P = PRESETS[+r.dataset.i]; return h ? { label: P.name, url: P.make(h) } : null; }).filter(Boolean);
  const own = [...$('#c-links').querySelectorAll('.c-link')].map(r => ({ label: r.querySelector('.c-l').value.trim().slice(0, 40), url: r.querySelector('.c-u').value.trim().slice(0, 200) }));
  return pre.concat(own);
}
function saveLinks() {
  const rows = linkRows(), bad = rows.filter(r => r.url && !safeUrl(r.url));
  $('#c-linkerr').textContent = bad.length ? 'Other links need to start with https:// (for example https://yourname.com).' : '';
  SETTINGS.links = rows.filter(r => safeUrl(r.url)).slice(0, 6); persistSettings(); drawBoard();
}
function renderPresets(links) {
  const box = $('#c-presets'); box.innerHTML = '';
  PRESETS.forEach((P, i) => {
    let h = ''; for (const l of links) { try { const u = new URL(l.url); if (P.host.test(u.hostname.replace(/^www\./, ''))) { h = P.read(u) || ''; l._used = true; break; } } catch (e) { /* skip */ } }
    // a row: the place's badge and name, then one field holding its address with your name in it
    const row = document.createElement('label'); row.className = 'c-pre'; row.dataset.i = i; row.style.setProperty('--b', BADGE[P.name][1]);
    const name = document.createElement('span'); name.className = 'c-pre-n'; name.innerHTML = `<b class="c-badge">${BADGE[P.name][0]}</b>`; name.append(P.name);
    const field = document.createElement('span'); field.className = 'c-field';
    const inp = document.createElement('input'); inp.type = 'text'; inp.placeholder = 'yourname'; inp.value = h; inp.maxLength = 60; inp.autocomplete = 'off'; inp.spellcheck = false; inp.setAttribute('aria-label', `Your ${P.name} name`);
    inp.addEventListener('change', saveLinks);
    const pre = document.createElement('span'); pre.className = 'c-pre-u';
    if (P.name === 'Substack') { pre.textContent = '.substack.com'; field.append(inp, pre); } else { pre.textContent = P.make('').replace(/^https:\/\/(www\.)?/, ''); field.append(pre, inp); }
    if (h) { const ok = document.createElement('span'); ok.className = 'c-ok'; ok.textContent = '✓'; ok.title = 'On the board at the gate'; field.append(ok); }
    row.append(name, field);
    box.appendChild(row);
  });
}
function addLinkRow(l) {
  const wrap = $('#c-links'); if (wrap.children.length >= 6) return;
  const row = document.createElement('div'); row.className = 'c-link';
  const a = document.createElement('input'); a.className = 'c-l'; a.placeholder = 'Name, e.g. My portfolio'; a.maxLength = 40; a.value = l ? l.label : ''; a.setAttribute('aria-label', 'Link name');
  const u = document.createElement('input'); u.className = 'c-u'; u.placeholder = 'https://'; u.maxLength = 200; u.type = 'url'; u.value = l ? l.url : ''; u.setAttribute('aria-label', 'Link address');
  const x = document.createElement('button'); x.className = 'g-link'; x.textContent = 'Remove'; x.onclick = () => { row.remove(); saveLinks(); };
  [a, u].forEach(i => i.addEventListener('change', saveLinks));
  row.append(a, u, x); wrap.appendChild(row);
}
function renderCustom() {
  const vis = !!state.visiting;
  $('#c-note').textContent = vis ? 'You are visiting someone else\u2019s garden. Return home to customize your own.' : (Cloud.user ? 'Changes save to your account, and visitors see them too.' : 'Changes save on this device. Sign in to keep them with your garden everywhere.');
  // your own figure (#c-you) stays editable while visiting; the garden's settings don't
  customPanel.querySelectorAll('input, .seg button, #c-addlink').forEach(i => { if (i.id !== 'c-close' && !i.closest('#c-you')) i.disabled = vis; });
  const own = Cloud.user && Cloud.garden;
  $('#c-name').value = (own ? Cloud.garden.name : SETTINGS.name) || ''; $('#c-desc').value = (own ? Cloud.garden.description : SETTINGS.desc) || '';
  customPanel.querySelectorAll('.seg[data-k]').forEach(s => s.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', SETTINGS[s.dataset.k] === b.dataset.v ? 'true' : 'false')));
  $('#c-blossom').hidden = SETTINGS.tree !== 'sakura';
  customPanel.querySelectorAll('input[type=checkbox][data-k]').forEach(i => { const k = i.dataset.k; i.checked = k.startsWith('show.') ? SETTINGS.show[k.slice(5)] !== false : !!SETTINGS[k]; });
  { const ls = (SETTINGS.links || []).map(l => ({ ...l })); renderPresets(ls); $('#c-links').innerHTML = ''; ls.filter(l => !l._used).forEach(addLinkRow); } $('#c-linkerr').textContent = '';
}
function openCustomize() { late.closePops(); renderCustom(); openPanel(customPanel); }
$('#h-custom').onclick = () => customPanel.classList.contains('open') ? closePanel(customPanel) : openCustomize();
$('#c-close').onclick = () => closePanel(customPanel);
$('#c-addlink').onclick = () => { if (state.visiting) return; addLinkRow(null); };
$('#c-name').addEventListener('change', () => { if (state.visiting) return; const v = $('#c-name').value.trim().slice(0, 60); if (Cloud.user && Cloud.garden) saveGardenSettings({ name: v || 'A quiet garden' }).then(drawBoard); else { SETTINGS.name = v; persistSettings(); drawBoard(); } });
$('#c-desc').addEventListener('change', () => { if (state.visiting) return; const v = $('#c-desc').value.trim().slice(0, 280); if (Cloud.user && Cloud.garden) saveGardenSettings({ description: v }).then(drawBoard); else { SETTINGS.desc = v; persistSettings(); drawBoard(); } });

