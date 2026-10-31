import * as THREE from 'three';
import { C, V3, clamp, rng } from '../core/util.js';
import { WATER_Y, POND_R, groundH } from './terrain.js';
import { POINT_VS_HEAD, pointsMat, scene } from './renderer.js';
import { canvasTex } from './textures.js';
import { DS, GEO, M, Merge, VC, part } from './geometry.js';
import { decor } from './paths.js';
import { clearArea } from './grass.js';
import { poems } from '../settings/storage.js';
import { state, T } from '../core/state.js';
import { plants } from '../plants/registry.js';
import { addTick, regThing, unregThing } from '../core/things.js';
import { late, provide } from '../core/late.js';
import { cardMat } from '../plants/sakura.js';

/* ================= lanterns and parasols: the garden's festival of light ================= */
// After the owner's references: painted paper parasols and paper lanterns hung over the walk, a lantern
// wall where every lantern carries one of your poems, lanterns down the wisteria walk and floating on
// the pond, and a sky lantern that rises whenever a poem is planted. They glow softly by day, warmly at
// sunset and brightly at night, with a halo for the bloom to catch.
provide({ get releaseSkyLantern() { return releaseSkyLantern; }, get poemCount() { return () => poems.length; } });

// ---- shared pieces ----
const ribTex = canvasTex(64, 128, g => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 128); g.fillStyle = 'rgba(0,0,0,.13)'; for (let y = 4; y < 128; y += 9) g.fillRect(0, y, 64, 1.5); });
const LANTERN_COLS = { pink: '#ff9cbf', white: '#fff3dc', yellow: '#ffd26a', red: '#e8503a' };
const lanternMats = {}, glowing = [];
for (const [k, c] of Object.entries(LANTERN_COLS)) { const m = new THREE.MeshLambertMaterial({ color: c, map: ribTex, emissive: c, emissiveMap: ribTex, emissiveIntensity: 0.25 }); lanternMats[k] = m; glowing.push(m); }
// a chōchin: a bulging paper body between two black rims
const bodyGeo = new THREE.LatheGeometry([[0.08, -0.25], [0.15, -0.22], [0.19, -0.12], [0.2, 0], [0.19, 0.12], [0.15, 0.22], [0.08, 0.25]].map(([r, y]) => new THREE.Vector2(r, y)), 20);
const rimGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.05, 14);
const merged = {}; Object.keys(LANTERN_COLS).forEach(k => { merged[k] = new Merge(); }); const rims = new Merge(), cords = new Merge(), glowPts = [];
function lantern(x, y, z, s, col, cordTop) {
  merged[col].add(bodyGeo, new V3(x, y, z), new V3(s, s, s), C('#ffffff'));
  rims.add(rimGeo, new V3(x, y + 0.26 * s, z), new V3(s, s, s), C('#1f1b18')); rims.add(rimGeo, new V3(x, y - 0.26 * s, z), new V3(s, s, s), C('#1f1b18'));
  if (cordTop !== undefined) cords.limb(new V3(x, y + 0.28 * s, z), new V3(x, cordTop, z), 0.006, 0.006, C('#2a2420'));
  glowPts.push(x, y, z);
}

// ---- 1. the parasol canopy over the wisteria walk and its tulip beds ----
const CAN = { x0: -8.8, x1: 8.8, z0: 16.4, z1: 31.6, h: 5.2 };
const parasolTex = canvasTex(512, 512, g => {
  const c = 256; g.fillStyle = '#fbeee2'; g.beginPath(); g.arc(c, c, 254, 0, 7); g.fill();
  const R = rng(5);
  // a cherry branch painted across the paper
  g.strokeStyle = '#5a3a30'; g.lineCap = 'round';
  const branch = (x, y, a, len, w) => { if (w < 1.2) return; const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke(); for (let k = 0; k < 4; k++) { g.fillStyle = ['#f19bb8', '#e8789e', '#fbc6d6'][k % 3]; g.beginPath(); g.arc(x2 + (R() - .5) * 26, y2 + (R() - .5) * 26, 5 + R() * 6, 0, 7); g.fill(); } branch(x2, y2, a + (R() - .5) * 1.1, len * 0.72, w * 0.66); branch(x2, y2, a + (R() - .5) * 1.4, len * 0.6, w * 0.6); };
  branch(70, 420, -0.8, 120, 9);
  // the ribs and the centre ring, seen from below
  g.strokeStyle = 'rgba(150,100,60,.55)'; g.lineWidth = 2; for (let k = 0; k < 36; k++) { const a = k / 36 * Math.PI * 2; g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.cos(a) * 254, c + Math.sin(a) * 254); g.stroke(); }
  g.fillStyle = '#b8452e'; g.beginPath(); g.arc(c, c, 16, 0, 7); g.fill(); g.strokeStyle = 'rgba(184,69,46,.6)'; g.lineWidth = 6; g.beginPath(); g.arc(c, c, 46, 0, 7); g.stroke();
});
const parasolMat = new THREE.MeshLambertMaterial({ map: parasolTex, side: DS, emissive: '#ffd9c0', emissiveMap: parasolTex, emissiveIntensity: 0.18 }); glowing.push(parasolMat);
const parasolGeo = (() => { const g = new THREE.ConeGeometry(1, 0.32, 36, 1, true); g.translate(0, -0.16, 0); const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < p.count; i++) uv.setXY(i, 0.5 + p.getX(i) * 0.5, 0.5 + p.getZ(i) * 0.5); return g; })();
(function buildCanopy() {
  const wood = new Merge(), w = C('#7a5234'), R = rng(77);
  for (const x of [CAN.x0, 0, CAN.x1]) for (const z of [CAN.z0, (CAN.z0 + CAN.z1) / 2, CAN.z1]) {
    if (x === 0 && z !== CAN.z0 && z !== CAN.z1) continue; // keep the walk clear in the middle
    if (x === 0) continue;
    const y0 = groundH(x, z); wood.add(GEO.box, new V3(x, y0 + CAN.h / 2, z), new V3(0.26, CAN.h, 0.26), w); decor.push({ x, z, r: 0.5, collide: 0.25 });
  }
  const y = groundH(0, 24) + CAN.h;
  for (const z of [CAN.z0, CAN.z1]) wood.add(GEO.box, new V3(0, y, z), new V3(CAN.x1 - CAN.x0 + 0.4, 0.22, 0.22), w);
  for (const x of [CAN.x0, CAN.x1]) wood.add(GEO.box, new V3(x, y, (CAN.z0 + CAN.z1) / 2), new V3(0.22, 0.22, CAN.z1 - CAN.z0 + 0.4), w);
  // a fine grid of wires overhead, from which everything hangs
  const wires = new Merge(); for (let x = CAN.x0; x <= CAN.x1 + 0.01; x += 2.2) wires.limb(new V3(x, y, CAN.z0), new V3(x, y, CAN.z1), 0.012, 0.012, C('#3a3330')); for (let z = CAN.z0; z <= CAN.z1 + 0.01; z += 2.2) wires.limb(new V3(CAN.x0, y, z), new V3(CAN.x1, y, z), 0.012, 0.012, C('#3a3330'));
  // painted parasols, open and gently tilted, at different heights
  const pm = new THREE.InstancedMesh(parasolGeo, parasolMat, 80), d = new THREE.Object3D(); let n = 0;
  // each keeps clear of the others as seen from below (no two overlap), with a little sky between them: first
  // the large ones, then smaller ones settled into the gaps between them, so the canopy is full but never piled up
  const placed = [];
  const hang = (smin, smax, want, tries) => {
    for (let i = 0, got = 0; i < tries && got < want && n < 80; i++) {
      const s = smin + R() * (smax - smin), x = CAN.x0 + 0.3 + s + R() * (CAN.x1 - CAN.x0 - 0.6 - 2 * s), z = CAN.z0 + 0.3 + s + R() * (CAN.z1 - CAN.z0 - 0.6 - 2 * s);
      if (placed.some(p => Math.hypot(p.x - x, p.z - z) < (p.s + s) * 1.1)) continue;
      placed.push({ x, z, s }); got++; const hy = y - 0.5 - R() * 1.1;
      d.position.set(x, hy, z); d.rotation.set((R() - .5) * 0.35, R() * 6.28, (R() - .5) * 0.35); d.scale.set(s, s, s); d.updateMatrix(); pm.setMatrixAt(n++, d.matrix);
      cords.limb(new V3(x, hy, z), new V3(x, y, z), 0.006, 0.006, C('#2a2420'));
    }
  };
  hang(0.95, 1.5, 26, 2000);
  hang(0.6, 0.9, 30, 4000);
  hang(0.45, 0.6, 20, 4000);
  pm.count = n; scene.add(pm);
  // lanterns among them: pink, white and yellow
  const cols = ['pink', 'white', 'yellow', 'white', 'pink'];
  for (let i = 0; i < 30; i++) { const x = CAN.x0 + 0.8 + R() * (CAN.x1 - CAN.x0 - 1.6), z = CAN.z0 + 0.8 + R() * (CAN.z1 - CAN.z0 - 1.6), s = 1.1 + R() * 0.6; lantern(x, y - 1.3 - R() * 1.2, z, s, cols[i % 5], y); }
  [wood, wires].forEach(m => { const mesh = new THREE.Mesh(m.build(), VC); mesh.castShadow = true; scene.add(mesh); });
})();

// ---- 2. lanterns down the wisteria walk, under its roof ----
for (let z = 21; z <= 32.5; z += 1.6) lantern(0, groundH(0, z) + 2.45, z, 0.95, ['red', 'yellow', 'white'][Math.round(z) % 3], groundH(0, z) + 2.85);

// ---- 3. floating lanterns drifting on the pond ----
const floaters = [];
(function buildFloaters() {
  const R = rng(19), box = new THREE.BoxGeometry(0.26, 0.26, 0.26), base = new THREE.BoxGeometry(0.34, 0.05, 0.34);
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group(), col = ['white', 'yellow', 'pink'][i % 3];
    const b = new THREE.Mesh(box, lanternMats[col]); b.position.y = 0.16; g.add(b); g.add(new THREE.Mesh(base, M('#5a3a26')));
    const a = R() * 6.28, r = 2 + R() * (POND_R - 3.5); g.position.set(Math.cos(a) * r, WATER_Y + 0.02, Math.sin(a) * r); scene.add(g);
    floaters.push({ g, a, r, sp: (0.02 + R() * 0.03) * (R() < .5 ? 1 : -1), ph: R() * 6 });
  }
})();

// ---- 4. the lantern wall: one lantern for each of your newest poems; touch one to read it ----
const WALL = { x: 11.6, z: 20.2, cols: 5, rows: 3 }; // between two canopy posts, in clear view of the walk
const wall = new THREE.Group(); wall.position.set(WALL.x, groundH(WALL.x, WALL.z), WALL.z); wall.rotation.y = Math.atan2(0 - WALL.x, 0); scene.add(wall);
clearArea(WALL.x, WALL.z, 2.4); decor.push({ x: WALL.x, z: WALL.z, r: 2.4, collide: 0.6 });
(function buildWall() {
  const fr = new Merge(), w = C('#6e4a2c');
  for (const x of [-2.15, 2.15]) fr.add(GEO.box, new V3(x, 1.55, 0), new V3(0.14, 3.1, 0.14), w);
  for (const y of [0.55, 1.45, 2.35, 3.05]) fr.add(GEO.box, new V3(0, y, 0), new V3(4.5, 0.08, 0.1), w);
  // cherry sprigs tied along the bars
  const R = rng(4);
  for (let i = 0; i < 70; i++) { const y = [1.45, 2.35][i % 2], x = -2 + R() * 4; fr.add(GEO.ico, new V3(x, y + (R() - .3) * 0.12, 0.08), new V3(0.05, 0.045, 0.05), C(['#f2a3bf', '#f7c4d4', '#e57fa3'][i % 3])); }
  wall.add(new THREE.Mesh(fr.build(), VC));
  const plaque = canvasTex(512, 96, g => { g.fillStyle = '#4a3526'; g.fillRect(0, 0, 512, 96); g.fillStyle = '#f7ead2'; g.font = '600 52px "Cormorant Garamond", Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('The lantern wall', 256, 50); });
  const pq = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.36), new THREE.MeshLambertMaterial({ map: plaque })); pq.position.set(0, 3.3, 0.06); wall.add(pq);
})();
const wallSlots = [], wallMats = [];
// the canvas wraps all the way round the lantern, which is 2.5 times wider than tall: draw in proportion
const TW = 640, TH = 256, TC = TW / 2;
const titleCanvas = () => { const c = document.createElement('canvas'); c.width = TW; c.height = TH; return c; };
for (let r = 0; r < WALL.rows; r++) for (let c = 0; c < WALL.cols; c++) {
  const cv = titleCanvas(), tex = new THREE.CanvasTexture(cv);
  const mat = new THREE.MeshLambertMaterial({ map: tex, emissive: '#ffcf8a', emissiveMap: tex, emissiveIntensity: 0.25, color: '#ffffff' }); wallMats.push(mat);
  const g = new THREE.Group(); g.position.set(-1.7 + c * 0.85, 2.75 - r * 0.9, 0.0); wall.add(g);
  const body = new THREE.Mesh(bodyGeo, mat); body.scale.setScalar(1.45); body.rotation.y = Math.PI; g.add(body); // u = 0.5 faces the path
  for (const dy of [0.38, -0.38]) { const rim = new THREE.Mesh(rimGeo, M('#1f1b18')); rim.scale.setScalar(1.45); rim.position.y = dy; g.add(rim); }
  wallSlots.push({ g, cv, tex, mat, thing: null, id: null });
}
function paintSlot(slot, p) {
  const g = slot.cv.getContext('2d'); g.fillStyle = '#fbf3e3'; g.fillRect(0, 0, TW, TH);
  g.fillStyle = 'rgba(0,0,0,.08)'; for (let y = 8; y < TH; y += 18) g.fillRect(0, y, TW, 2);
  if (p) {
    // on the front (the middle of the canvas): a blossom, the title sized to fit in up to three lines, the month
    g.fillStyle = '#e57fa3'; for (let k = 0; k < 5; k++) { const a = k / 5 * 6.28; g.beginPath(); g.ellipse(TC + Math.cos(a) * 9, 44 + Math.sin(a) * 9, 8, 5, a, 0, 7); g.fill(); }
    g.fillStyle = '#2b2420'; g.textAlign = 'center'; g.textBaseline = 'middle';
    let size = 38, lines;
    for (; size >= 20; size -= 2) {
      g.font = `700 ${size}px "Cormorant Garamond", Georgia, serif`; lines = []; let cur = '';
      p.title.split(/\s+/).forEach(w => { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > 150 && cur) { lines.push(cur); cur = w; } else cur = t; }); if (cur) lines.push(cur);
      if (lines.length <= 3 && lines.every(l => g.measureText(l).width <= 160)) break;
    }
    lines.slice(0, 3).forEach((l, i) => g.fillText(l, TC, 120 + i * size * 1.05 - (Math.min(lines.length, 3) - 1) * size * 0.52));
    g.font = 'italic 600 22px "Cormorant Garamond", Georgia, serif'; g.fillStyle = '#7a5a40'; g.fillText(new Date(p.createdAt).toLocaleDateString('en', { month: 'short', year: 'numeric' }), TC, 206);
  }
  slot.tex.needsUpdate = true;
}
let wallKey = '';
function fillWall() {
  const list = poems.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, wallSlots.length);
  const key = list.map(p => p.id + p.title).join('|'); if (key === wallKey) return; wallKey = key;
  wallSlots.forEach((slot, i) => {
    const p = list[i]; paintSlot(slot, p); slot.g.visible = true;
    if (slot.thing) { unregThing(slot.thing); slot.thing = null; }
    if (p) slot.thing = regThing(slot.g, `Read “${p.title}”`, () => { const pl = plants.get(p.id); if (pl) late.openPoem(pl); });
    slot.mat.color.set(p ? '#ffffff' : '#d8cfc0');
  });
}
fillWall(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { wallKey = ''; fillWall(); });
regThing(wall, 'Read the lantern wall', () => { const p = poems.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]; const pl = p && plants.get(p.id); if (pl) late.openPoem(pl); else late.toast && late.toast('The lanterns are waiting for your first poem.'); }, { x: WALL.x, z: WALL.z, r: 3.2 });
// keep the wall in step with the garden: poems written, removed, or a garden visited
let wallClock = 0; addTick(dt => { wallClock += dt; if (wallClock > 1.5) { wallClock = 0; fillWall(); } return true; }, true);

// ---- the build: one mesh per lantern colour, rims and cords together, and a halo at every lantern ----
for (const k of Object.keys(merged)) { const geo = merged[k].build(); if (geo) scene.add(new THREE.Mesh(geo, lanternMats[k])); }
[rims, cords].forEach(m => { const geo = m.build(); if (geo) scene.add(new THREE.Mesh(geo, VC)); });
export const lanternGlowU = { uOpacity: { value: 0 } };
const haloMat = pointsMat(lanternGlowU, `${POINT_VS_HEAD}void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=min(2.2*uScale/-mv.z,260.);}`,
  'uniform float uOpacity;void main(){float d=length(gl_PointCoord-.5);float a=pow(smoothstep(.5,0.,d),2.4);gl_FragColor=vec4(1.,.8,.55,a*uOpacity);}', true);
{ const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(glowPts, 3)); const pts = new THREE.Points(g, haloMat); pts.frustumCulled = false; pts.layers.set(2); scene.add(pts); }

// ---- 5. a sky lantern rises from every newly planted poem ----
const skyMat = new THREE.MeshLambertMaterial({ color: '#ffd27a', emissive: '#ffb04a', emissiveIntensity: 1.4, transparent: true });
const skyGeo = new THREE.CylinderGeometry(0.2, 0.15, 0.42, 14, 1, true);
export function releaseSkyLantern(at) {
  const m = new THREE.Mesh(skyGeo, skyMat.clone()); m.position.set(at.x, at.y + 1.2, at.z); scene.add(m);
  let t = 0; const ph = Math.random() * 6;
  addTick(dt => {
    t += dt; m.position.y += dt * (0.5 + t * 0.06); m.position.x += Math.sin(t * 0.7 + ph) * dt * 0.35; m.position.z += Math.cos(t * 0.5 + ph) * dt * 0.25; m.rotation.y += dt * 0.3;
    m.material.opacity = clamp(1.4 - t / 16, 0, 1);
    if (t > 22) { scene.remove(m); m.material.dispose(); return false; }
    return true;
  });
}

// ---- light: soft by day, warm at sunset, bright at night; the floating lanterns drift ----
addTick(() => {
  const k = Math.max(state.night, (state.dusk || 0) * 0.7 * (1 - state.night));
  glowing.forEach(m => { m.emissiveIntensity = m === parasolMat ? 0.16 + k * 0.32 : 0.22 + k * 0.75; }); // parasols are lit from below, softly; the lanterns keep their colour
  // the wall's lanterns glow gently, warm rather than white, so the titles stay easy to read at night
  wallMats.forEach(m => { m.emissiveIntensity = 0.14 + k * 0.34; }); // the titles stay readable when lit
  cardMat.emissiveIntensity = 1 + k * 3.2; // the cherry blossom glows pink in the lantern light, as in the night photographs
  lanternGlowU.uOpacity.value = 0.04 + k * 0.6;
  floaters.forEach(f => { const a = f.a + T * f.sp; f.g.position.set(Math.cos(a) * f.r, WATER_Y + 0.02 + Math.sin(T * 1.2 + f.ph) * 0.015, Math.sin(a) * f.r); f.g.rotation.y = a; });
  return true;
}, true);
export const LANTERN_WALL = WALL;

// ---- 6. fairy lights in every poem tree: warm strands hanging through the crown, twinkling ----
const fairyU = { uTime: { value: 0 }, uOpacity: { value: 0 } };
const fairyMat = pointsMat(fairyU, `${POINT_VS_HEAD}uniform float uTime;attribute float aPh;varying float vTw;
  void main(){vec3 p=position;p.x+=sin(uTime*.8+aPh*6.)*.02;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
    vTw=.55+.45*sin(uTime*(1.5+fract(aPh*7.)*2.)+aPh*30.);gl_PointSize=min(1.1*uScale/-mv.z,64.);}`,
  `uniform float uOpacity;varying float vTw;void main(){vec2 q=gl_PointCoord-.5;float d=length(q);
    float core=smoothstep(.16,0.,d),halo=pow(smoothstep(.5,0.,d),3.)*.5,rays=(smoothstep(.04,0.,abs(q.x))+smoothstep(.04,0.,abs(q.y)))*smoothstep(.5,.05,d)*.45;
    gl_FragColor=vec4(vec3(1.,.86,.6)+core*.3,(core+halo+rays)*uOpacity*vTw);}`, true);
const fairy = new THREE.Points(new THREE.BufferGeometry(), fairyMat); fairy.frustumCulled = false; fairy.layers.set(2); scene.add(fairy);
let fairyKey = '';
function stringFairyLights() {
  const list = [...plants.values()].filter(p => !p.dying && p.target !== 0);
  const key = list.map(p => p.poem.id).join('|'); if (key === fairyKey) return; fairyKey = key;
  const pos = [], ph = [];
  list.forEach(pl => {
    const R = rng([...String(pl.poem.id)].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0), c = pl.root.position, h = pl.h || 3, rad = Math.max(1.2, (pl.radius || 2.5) * 0.7);
    for (let s = 0; s < 14; s++) { // strands hanging from the branches, longer toward the outside of the crown
      const a = R() * 6.28, r = Math.sqrt(R()) * rad, x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r, top = c.y + h * (0.72 + R() * 0.15), len = 0.9 + (r / rad) * 1.4 + R() * 0.5;
      const n = 8 + Math.floor(len * 6);
      for (let k = 0; k < n; k++) { const t = k / n; pos.push(x + (R() - .5) * 0.12, top - t * len, z + (R() - .5) * 0.12); ph.push(R()); }
    }
    for (let k = 0; k < 40; k++) { const a = R() * 6.28, u = R(), r = rad * (0.4 + 0.6 * Math.sqrt(u)); pos.push(c.x + Math.cos(a) * r, c.y + h * (0.55 + R() * 0.4), c.z + Math.sin(a) * r); ph.push(R()); } // and some wound through the crown
  });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aPh', new THREE.Float32BufferAttribute(ph, 1));
  fairy.geometry.dispose(); fairy.geometry = g;
}
let fairyClock = 99;
addTick(dt => {
  fairyClock += dt; if (fairyClock > 2) { fairyClock = 0; stringFairyLights(); }
  const k = Math.max(state.night, (state.dusk || 0) * 0.75 * (1 - state.night));
  fairyU.uTime.value = T; fairyU.uOpacity.value = 0.08 + k * 0.92; fairy.visible = fairyU.uOpacity.value > 0.02;
  return true;
}, true);
