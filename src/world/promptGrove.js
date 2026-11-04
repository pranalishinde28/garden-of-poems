import * as THREE from 'three';
import { C, V3, hashStr, rng } from '../core/util.js';
import { groundH } from './terrain.js';
import { scene } from './renderer.js';
import { canvasTex, glowTex, groundTex } from './textures.js';
import { GEO, Merge } from './geometry.js';
import { decor } from './paths.js';
import { worlds } from '../core/worlds.js';
import { state } from '../core/state.js';
import { regThing, unregThing } from '../core/things.js';
import { late } from '../core/late.js';
import { BUILD } from '../plants/types.js';
import { THEME } from '../settings/storage.js';
import { dayWords, promptFor, todayKey } from '../ui/prompts.js';

/* ================= the Prompt Garden: a grove of the day's answers ================= */
// A round moon gate on the lawn, left of where you arrive, leads to a quiet grove (its own scene, state.world
// 'grove'). At its heart a stone stele carries the day's prompt; a spiral of stepping stones winds out from it,
// and beside the path every answer planted that day grows as a cherry tree. Walk up to one to read it. A stone by
// the way in lists earlier days, and choosing one regrows the grove as it was (the archive). The answers come from
// ui/promptGarden.js (the database, or this device's own answers when there is no account), which calls fillGrove.

const GO = new V3(3000, 0, -400), GR = 42, ENTRY = 33;
export const groveScene = new THREE.Scene();
groveScene.background = C('#cfe2ee'); groveScene.fog = new THREE.Fog('#dfe9e6', 40, 120);
const root = new THREE.Group(); root.position.copy(GO); groveScene.add(root);
groveScene.add(new THREE.HemisphereLight('#fff6e8', '#5a7a4a', 0.7));
{ const sun = new THREE.DirectionalLight('#fff0d8', 0.75); sun.position.set(30, 50, 20).add(GO); sun.target.position.copy(GO); groveScene.add(sun, sun.target); }

// the spiral path from the stele outward; trees stand just outside it
const spiralAt = t => { const r = 7.5 + t * 1.25, a = t * 1.0 + Math.PI / 2; return [Math.cos(a) * r, Math.sin(a) * r, r, a]; };
const SPOTS = []; { let t = 0, last = null; while (SPOTS.length < 64) { const [x, z, r] = spiralAt(t); if (r > 35) break; if (!last || Math.hypot(x - last[0], z - last[1]) > 5.6) { const k = (r + 2.2) / r; SPOTS.push([x * k, z * k]); last = [x, z]; } t += 0.02; } }

/* ---------- the grove's ground, its edge, the stele, the way in ---------- */
let stele = null, steleThing = null;
{
  const t = groundTex.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(26, 26);
  const g = new THREE.Mesh(new THREE.CircleGeometry(GR + 30, 96).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: t, color: '#a9c486' })); root.add(g);
  // the stepping stones of the spiral, and a straight stretch in from the gate
  const m = new Merge(), R = rng(31), stone = () => C(['#a8a090', '#9a9282', '#b4ac9c'][Math.floor(R() * 3)]);
  for (let t2 = 0; ; t2 += 0.035) { const [x, z, r] = spiralAt(t2); if (r > 35.5) break; m.add(GEO.sph, new V3(x, 0.02, z), new V3(0.55 + R() * 0.2, 0.06, 0.45 + R() * 0.15), stone()); }
  for (let z = 8; z < ENTRY; z += 1.2) m.add(GEO.sph, new V3((R() - 0.5) * 0.4, 0.02, z), new V3(0.6, 0.06, 0.48), stone());
  // a hedge of round bushes all round, cut for the gate, and taller trees beyond it (dark, not poems)
  for (let k = 0; k < 110; k++) { const a = k / 110 * Math.PI * 2; if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.07) continue; const r = GR + (R() - 0.5); m.add(GEO.sph, new V3(Math.cos(a) * r, 0.9, Math.sin(a) * r), new V3(1.5 + R() * 0.4, 1.3 + R() * 0.5, 1.5), C(k % 2 ? '#4f7a3a' : '#5e8a44')); }
  for (let k = 0; k < 70; k++) { const a = R() * Math.PI * 2, r = GR + 6 + R() * 16; m.add(GEO.cone, new V3(Math.cos(a) * r, 0, Math.sin(a) * r), new V3(2.6 + R() * 1.4, 9 + R() * 6, 2.6 + R() * 1.4), C(R() < 0.5 ? '#2f5a32' : '#3a6a3a')); }
  // stone lanterns round the stele, lit softly
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + 0.3, x = Math.cos(a) * 4.4, z = Math.sin(a) * 4.4; m.add(GEO.box, new V3(x, 0.4, z), new V3(0.4, 0.8, 0.4), C('#a8a090')); m.add(GEO.box, new V3(x, 0.95, z), new V3(0.5, 0.35, 0.5), C('#ece2c4')); m.add(GEO.pyr, new V3(x, 1.25, z), new V3(0.5, 0.3, 0.5), C('#8a8478')); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffd890', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })); s.position.set(x, 0.95, z); s.scale.setScalar(1.6); root.add(s); }
  // the moon gate you came in by, and a stone for earlier days beside it
  m.add(new THREE.TorusGeometry(2.6, 0.45, 12, 40), new V3(0, 2.6, ENTRY + 1), new V3(1, 1, 1.4), C('#d8d0c0'));
  m.add(GEO.box, new V3(0, 0.15, ENTRY + 1), new V3(5.4, 0.3, 1.4), C('#bfb6a4'));
  m.add(GEO.ico, new V3(5.2, 0.55, ENTRY - 3.5), new V3(1.4, 0.9, 1.1), C('#a8a090'));
  root.add(new THREE.Mesh(m.build(), new THREE.MeshLambertMaterial({ vertexColors: true })));
  // the stele: a tall slab of grey stone on a plinth, the prompt cut into both faces
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.6, 1.6), new THREE.MeshLambertMaterial({ color: '#a8a090' })); plinth.position.y = 0.3; root.add(plinth);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(2.8, 3.8, 0.5), new THREE.MeshLambertMaterial({ color: '#8f897e' })); slab.position.y = 2.5; root.add(slab);
  const cv = document.createElement('canvas'); cv.width = 560; cv.height = 760; const tex = new THREE.CanvasTexture(cv);
  for (const s of [1, -1]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.53), new THREE.MeshLambertMaterial({ map: tex })); f.position.set(0, 2.5, s * 0.26); if (s < 0) f.rotation.y = Math.PI; root.add(f); }
  stele = { cv, tex, slab };
  // the archive stone's plaque
  const pl = canvasTex(256, 96, (g, w, h) => { g.fillStyle = '#6a5a44'; g.fillRect(0, 0, w, h); g.fillStyle = '#f2e6c8'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'italic 600 34px "Cormorant Garamond", Georgia, serif'; g.fillText('Earlier groves', w / 2, h / 2); });
  const pm = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.68), new THREE.MeshLambertMaterial({ map: pl })); pm.position.set(5.2, 1.1, ENTRY - 2.45); root.add(pm);
  regThing(pm, 'See earlier groves', () => late.openGroveDays && late.openGroveDays(), { x: GO.x + 5.2, z: GO.z + ENTRY - 1.6, r: 2.2 });
  const gateIn = new THREE.Group(); gateIn.position.set(0, 2.6, ENTRY + 1); root.add(gateIn);
  regThing(gateIn, 'Back to my garden', () => late.leaveTemple && late.leaveTemple(), { x: GO.x, z: GO.z + ENTRY - 0.6, r: 2.0 });
  const atStele = new THREE.Group(); atStele.position.y = 2.5; root.add(atStele);
  steleThing = regThing(atStele, 'Answer this prompt', () => answerFromGrove(), { x: GO.x, z: GO.z + 2.6, r: 2.2 });
}
function paintStele(day) {
  const g = stele.cv.getContext('2d'), w = stele.cv.width, h = stele.cv.height;
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#a49e92'); gr.addColorStop(1, '#8a8478'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(40,34,26,.5)'; g.lineWidth = 6; g.strokeRect(26, 26, w - 52, h - 52);
  g.textAlign = 'center'; g.fillStyle = '#2e281e';
  g.font = 'italic 600 34px "Cormorant Garamond", Georgia, serif'; g.fillText(day === todayKey() ? 'Today’s prompt' : 'The prompt of ' + dayWords(day), w / 2, 110);
  // the prompt, carved large, broken to fit
  const words = promptFor(day).split(' '), lines = []; let px = 64, line = '';
  do { g.font = `700 ${px}px "Cormorant Garamond", Georgia, serif`; lines.length = 0; line = ''; for (const wd of words) { const tr = line ? line + ' ' + wd : wd; if (g.measureText(tr).width > w - 110) { lines.push(line); line = wd; } else line = tr; } lines.push(line); px -= 4; } while (lines.length * px * 1.25 > h - 300 && px > 30);
  lines.forEach((l, i) => g.fillText(l, w / 2, h / 2 - (lines.length - 1) * px * 0.62 + i * px * 1.25));
  g.font = 'italic 500 28px "Cormorant Garamond", Georgia, serif'; g.fillText(dayWords(day), w / 2, h - 80);
  stele.tex.needsUpdate = true;
}

/* ---------- the trees: one for each answer ---------- */
let trees = [], groveDay = null;
const blockers = [];
export function fillGrove(day, answers) {
  groveDay = day; paintStele(day);
  if (steleThing) steleThing.label = day === todayKey() ? 'Answer this prompt' : 'Back to today’s grove';
  trees.forEach(t => { root.remove(t.g); unregThing(t.thing); }); trees = []; blockers.length = 0;
  answers.slice(0, SPOTS.length).forEach((a, i) => {
    const [x, z] = SPOTS[i], g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rng(hashStr(a.key))() * 6.28; root.add(g);
    BUILD.orchard(g, rng(hashStr(a.key + ':shape')), { mood: a.mood }, THEME);
    // a small wooden tag at the tree's foot with the poem's name
    const tag = canvasTex(256, 64, (c, w, h) => { c.fillStyle = '#8a6440'; c.fillRect(0, 0, w, h); c.fillStyle = '#fbf2dc'; c.textAlign = 'center'; c.textBaseline = 'middle'; let fs = 30; do { c.font = `600 ${fs}px "Cormorant Garamond", Georgia, serif`; fs -= 2; } while (c.measureText(a.title).width > w - 16 && fs > 14); c.fillText(a.title, w / 2, h / 2 + 1); });
    // two boards back to back, so the name reads the right way round from the path and from outside the ring
    const tagG = new THREE.Group(); tagG.position.set(0, 0.55, 0); tagG.rotation.y = -g.rotation.y + Math.atan2(-x, -z); g.add(tagG);
    for (const k of [0, 1]) { const tm = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.35), new THREE.MeshLambertMaterial({ map: tag })); tm.position.z = 1.1 + (k ? -0.02 : 0); if (k) tm.rotation.y = Math.PI; tagG.add(tm); }
    const thing = regThing(g, `Read “${a.title}”`, () => late.readGrove && late.readGrove(i), { x: GO.x + x, z: GO.z + z, r: 3 });
    trees.push({ g, thing }); blockers.push([x, z]);
  });
}
export const groveDayNow = () => groveDay;
function answerFromGrove() {
  if (groveDay !== todayKey()) { late.loadGroveDay && late.loadGroveDay(todayKey()); return; }
  // home to the bench, the page open on today's prompt
  late.leaveTemple && late.leaveTemple(() => { state.answering = true; late.openEditor && late.openEditor(); });
}

/* ---------- walking in the grove ---------- */
worlds.grove = {
  scene: groveScene,
  get name() { return groveDay && groveDay !== todayKey() ? 'The Prompt Garden of ' + dayWords(groveDay) : 'Today’s Prompt Garden'; },
  get sub() { return promptFor(groveDay || todayKey()) + ' Every tree here is someone’s answer; walk up to one to read it.'; },
  arrive: { pos: GO.clone().add(new V3(0, 0, ENTRY - 3)), yaw: 0 },
  floorH() { return 0; },
  blocked(x, z) {
    const lx = x - GO.x, lz = z - GO.z, r = Math.hypot(lx, lz);
    if (r > GR - 2 || lz > ENTRY - 0.4) return true;
    if (Math.abs(lx) < 1.9 && Math.abs(lz) < 1.1) return true;
    if (Math.hypot(lx - 5.2, lz - ENTRY + 3.5) < 1.5) return true;
    for (const [bx, bz] of blockers) if (Math.hypot(lx - bx, lz - bz) < 0.7) return true;
    return false;
  },
  enter() { const d = groveDay || todayKey(); paintStele(d); late.loadGroveDay && late.loadGroveDay(d); },
  leave() {},
};

/* ---------- the moon gate in the garden ---------- */
// on the lawn left of where you arrive, between the path and the red tulips, a round stone gate with today's
// prompt on a plaque above it and a glimpse of blossom through it
export const MOON_GATE = { x: -15, z: 44 };
let enterGroveInfo = null;
export const enterGrove = () => late.enterTemple && late.enterTemple(enterGroveInfo);
{
  const { x, z } = MOON_GATE, face = Math.atan2(0 - x, 49 - z), g = new THREE.Group(); g.position.set(x, groundH(x, z) - 0.05, z); g.rotation.y = face; scene.add(g);
  const m = new Merge();
  m.add(new THREE.TorusGeometry(2.2, 0.42, 14, 48), new V3(0, 2.6, 0), new V3(1, 1, 1.5), C('#a39a88'));
  for (const sx of [-1, 1]) m.add(GEO.box, new V3(sx * 2.9, 1.2, 0), new V3(1.4, 2.4, 1.2), C('#978e7c'));
  m.add(GEO.box, new V3(0, 0.12, 0), new V3(7.2, 0.24, 1.6), C('#8a8272'));
  m.add(GEO.box, new V3(0, 5.25, 0), new V3(3.4, 0.9, 0.3), C('#6a5a44'));
  const mesh = new THREE.Mesh(m.build(), new THREE.MeshLambertMaterial({ vertexColors: true })); mesh.castShadow = true; g.add(mesh);
  // the glimpse: blossom trees and a stone path in soft light, painted inside the ring
  const peek = canvasTex(256, 256, (c, w, h) => { const sky = c.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#dcecf4'); sky.addColorStop(0.6, '#f4ecf0'); sky.addColorStop(1, '#a9c486'); c.fillStyle = sky; c.fillRect(0, 0, w, h); const R = rng(9); for (let k = 0; k < 14; k++) { const tx = R() * w, ty = h * (0.45 + R() * 0.2), r = 20 + R() * 26; c.fillStyle = '#6a5048'; c.fillRect(tx - 3, ty, 6, h * 0.25); c.fillStyle = ['#f6c6d6', '#f2b2c8', '#fbdde6'][k % 3]; c.beginPath(); c.arc(tx, ty, r, 0, 7); c.fill(); } c.fillStyle = '#d8d0c0'; c.beginPath(); c.moveTo(w * 0.4, h); c.lineTo(w * 0.48, h * 0.7); c.lineTo(w * 0.52, h * 0.7); c.lineTo(w * 0.6, h); c.fill(); });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(2.0, 40), new THREE.MeshBasicMaterial({ map: peek, side: THREE.DoubleSide })); disc.position.y = 2.6; g.add(disc);
  // the plaque: the day's prompt, so you can read it before going in
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 136; const tex = new THREE.CanvasTexture(cv);
  const paint = () => { const c = cv.getContext('2d'); c.fillStyle = '#6a5a44'; c.fillRect(0, 0, 512, 136); c.fillStyle = '#f6ead0'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '700 40px "Cormorant Garamond", Georgia, serif'; c.fillText('Today’s Prompt Garden', 256, 44); let fs = 30; const t = promptFor(todayKey()); do { c.font = `italic 600 ${fs}px "Cormorant Garamond", Georgia, serif`; fs -= 2; } while (c.measureText(t).width > 480 && fs > 16); c.fillText(t, 256, 98); tex.needsUpdate = true; };
  paint(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(paint);
  for (const s of [1, -1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 0.88), new THREE.MeshLambertMaterial({ map: tex })); p.position.set(0, 5.25, s * 0.16); if (s < 0) p.rotation.y = Math.PI; g.add(p); }
  const c = Math.cos(face), sn = Math.sin(face), front = { x: x + sn * 3, z: z + c * 3 };
  const info = { world: 'grove', out: { pos: new V3(front.x, 0, front.z), yaw: Math.atan2(-sn, -c) }, far: false };
  enterGroveInfo = info;
  regThing(mesh, 'Walk today’s Prompt Garden', () => late.enterTemple && late.enterTemple(info), { x: front.x, z: front.z, r: 2.8 });
  regThing(disc, 'Walk today’s Prompt Garden', () => late.enterTemple && late.enterTemple(info), { x: front.x, z: front.z, r: 0.01 });
  // it stands in the way of trees and of walking, except through the ring
  for (const sx of [-1, 1]) decor.push({ x: x + c * sx * 2.9, z: z - sn * sx * 2.9, r: 1.2, collide: 0.9 });
  decor.push({ x, z, r: 4.2, collide: -1 });
}
