import * as THREE from 'three';
import { groundH } from './terrain.js';
import { scene } from './renderer.js';
import { canvasTex, glowTex } from './textures.js';
import { GEO, M, part } from './geometry.js';
import { decor } from './paths.js';
import { clearArea } from './grass.js';
import { setShadowDirty } from '../plants/registry.js';
import { state, T } from '../core/state.js';
import { addTick, regThing, unregThing } from '../core/things.js';

/* ================= the lantern path: the gardens you tend ================= */
// The stepping-stone ring that crosses in front of the gate (r 44) is lined, westward from the way in, with a stone
// lantern for every garden you tend (up to eight, those with news first), each with a small wooden tag carrying the
// garden's name. A lantern is lit when something new has grown in that garden since you last walked it, and
// dark otherwise; touch one (or E) to visit. Only in your own garden: hidden while you visit someone else's.
// The path's ground is kept for it from the start, so no poem tree grows there.

const MAX = 8;
// the spots: on the inner edge of the ring path, about 2.6 m apart, from just west of the way in; each keeps its
// ground from the start (no tree grows there) and only blocks walking while a lantern stands on it
const RING = 42.85, SPOTS = [];
for (let i = 0; i < MAX; i++) {
  const a = Math.PI / 2 + 0.13 + i * 0.061, x = Math.cos(a) * RING, z = Math.sin(a) * RING;
  const d = { x, z, r: 1.3, collide: -1 }; decor.push(d); SPOTS.push({ x, z, a, d });
}

const root = new THREE.Group(); root.name = 'lantern-path'; scene.add(root);
let built = [];
const stone = M('#8f8c84'), dark = M('#6f6c66'), wood = M('#6b4a2e');

// a name painted dark on pale cedar (dark lettering on light wood: the sign rule)
function tagTex(name) {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#d9b98a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { g.strokeStyle = `rgba(120,80,40,${0.06 + Math.random() * 0.08})`; g.lineWidth = 1 + Math.random() * 3; g.beginPath(); const y = Math.random() * h; g.moveTo(0, y); g.bezierCurveTo(w / 3, y + 6, w * 2 / 3, y - 6, w, y + 2); g.stroke(); }
    g.strokeStyle = '#7a5532'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = '#3a2412'; g.textAlign = 'center'; g.textBaseline = 'middle';
    let s = 118; const font = () => `700 ${s}px "Cormorant Garamond", Georgia, serif`;
    g.font = font(); while (g.measureText(name).width > w - 50 && s > 40) { s -= 4; g.font = font(); }
    if (g.measureText(name).width > w - 50) { const words = name.split(' '), half = Math.ceil(words.length / 2); g.fillText(words.slice(0, half).join(' '), w / 2, h / 2 - s * 0.55); g.fillText(words.slice(half).join(' '), w / 2, h / 2 + s * 0.55); }
    else g.fillText(name, w / 2, h / 2 + 4);
  });
}

function lantern(g, face) {
  const L = new THREE.Group(); L.rotation.y = face; g.add(L);
  part(L, GEO.hexB, dark, [0, 0, 0], [0.34, 0.14, 0.34]);
  part(L, GEO.cylB, stone, [0, 0.14, 0], [0.1, 0.72, 0.1]);
  part(L, GEO.hexB, stone, [0, 0.86, 0], [0.28, 0.1, 0.28]);
  const paper = new THREE.MeshLambertMaterial({ color: '#efe4cc', emissive: '#ffb45a', emissiveIntensity: 0 });
  part(L, GEO.box, stone, [0, 1.1, 0], [0.3, 0.28, 0.3]);
  part(L, GEO.box, paper, [0, 1.1, 0], [0.2, 0.18, 0.31]); part(L, GEO.box, paper, [0, 1.1, 0], [0.31, 0.18, 0.2]);
  part(L, GEO.pyr6, dark, [0, 1.24, 0], [0.46, 0.28, 0.46]);
  part(L, GEO.sph, stone, [0, 1.58, 0], 0.06);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffc27a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.position.set(0, 1.1, 0); glow.scale.setScalar(1.5); L.add(glow);
  // no real light: adding lights at run time would recompile every material in the garden
  return { paper, glow };
}

function tag(g, name, face) {
  const T0 = new THREE.Group(); T0.rotation.y = face; g.add(T0);
  part(T0, GEO.box, wood, [0, 0.5, 0], [0.07, 1.0, 0.07]);
  // a little light of its own after dusk, so the name still reads by its lantern
  const tex = tagTex(name), mat = new THREE.MeshLambertMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0 });
  // two single-sided faces back to back, so the name reads true from either side
  for (const k of [0, 1]) { const m = part(T0, GEO.card, mat, [0, 1.06, k ? -0.03 : 0.03], [0.96, 0.48, 1], [0, k * Math.PI, 0]); m.castShadow = false; }
  part(T0, GEO.box, wood, [0, 1.06, 0], [1.02, 0.54, 0.05]);
  return { tex, mat };
}

function clear() {
  built.forEach(b => { unregThing(b.thing); b.paper.dispose(); b.glow.material.dispose(); b.tag.tex.dispose(); b.tag.mat.dispose(); root.remove(b.g); });
  built = []; SPOTS.forEach(sp => { sp.d.collide = -1; });
}

// gardens: [{ owner, name, display_name, fresh, newest, … }]; visit(g) is called when one is chosen
export function setTendedLanterns(gardens, visit) {
  clear();
  const list = (gardens || []).slice(0, MAX); if (!list.length) { setShadowDirty(true); return; }
  list.forEach((gd, i) => {
    const sp = SPOTS[i], { x, z } = sp;
    const g = new THREE.Group(); g.position.set(x, groundH(x, z), z); g.scale.setScalar(1.2); root.add(g);
    // the lantern's window and the tag face the path (outward, the way you walk past), the tag beside it
    const face = Math.atan2(Math.cos(sp.a), Math.sin(sp.a));
    const lt = lantern(g, face);
    const tg = new THREE.Group(); tg.position.set(0.72 * Math.cos(face), 0, -0.72 * Math.sin(face)); g.add(tg);
    const tagged = tag(tg, gd.name || 'A quiet garden', face);
    sp.d.collide = 0.3;
    g.traverse(m => { if (m.isMesh && !m.isInstancedMesh) { m.castShadow = true; m.receiveShadow = true; } });
    clearArea(x, z, 0.6);
    const fresh = Number(gd.fresh) || 0;
    const label = fresh ? `Visit ${gd.name || 'this garden'}: ${fresh === 1 ? 'a new poem' : fresh + ' new poems'}` : `Visit ${gd.name || 'this garden'}`;
    const thing = regThing(g, label, () => visit(gd), { x: Math.cos(sp.a) * 44, z: Math.sin(sp.a) * 44, r: 1.5 });
    built.push({ g, thing, fresh, paper: lt.paper, glow: lt.glow, tag: tagged, phase: i * 1.37 });
  });
  setShadowDirty(true);
}
export const tendedLanterns = () => built.map(b => ({ fresh: b.fresh, label: b.thing.label, x: b.g.position.x, z: b.g.position.z }));

// lit lanterns flicker softly, brighter after dusk; dark ones stay dark
addTick(() => {
  root.visible = !state.visiting;
  if (!built.length || !root.visible) return;
  const k = Math.max(state.night || 0, (state.dusk || 0) * 0.75);
  built.forEach(b => {
    b.tag.mat.emissiveIntensity = 0.32 * k;
    if (!b.fresh) { b.paper.emissiveIntensity = 0; b.glow.material.opacity = 0; return; }
    const f = 0.9 + 0.1 * Math.sin(T * 7.1 + b.phase) * Math.sin(T * 2.3 + b.phase * 2);
    b.paper.emissiveIntensity = (1.1 + 0.5 * k) * f; b.glow.material.opacity = (0.6 + 0.35 * k) * f;
  });
}, true);
