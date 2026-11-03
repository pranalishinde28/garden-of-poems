import * as THREE from 'three';
import { C, V3 } from '../core/util.js';
import { groundH } from './terrain.js';
import { renderer, scene } from './renderer.js';
import { canvasTex, glowTex } from './textures.js';
import { DS } from './geometry.js';
import { worlds } from '../core/worlds.js';
import { state } from '../core/state.js';
import { addTick, regThing } from '../core/things.js';
import { late } from '../core/late.js';
import { SFX } from '../animals/animals.js';
import { LANDMARKS } from './shrines.js';
import { BIG_PAGODAS, templeGroup } from './temples.js';
import { seatedBuddha, standingDisciple } from './buddha.js';

/* ================= inside the pagodas: the temple of the golden Buddha ================= */
// The two pagodas on the hills open onto this temple (the garden's own pagoda opens onto a Japanese shrine,
// world/shrineInterior.js); its own scene far from the garden (state.world 'temple').
// From the door: a hall of carved white marble pillars under a stepped, carved dome over an inlaid floor
// (after Akshardham and the old stone temples of India), then through a carved arch into a Thai ubosot
// (after Wat Arun, Bangkok): cream walls scattered with flowers, tiled pillars, crystal chandeliers on red
// cords, and the gold Buddha (world/buddha.js) on a tiered gilded throne before a flame-edged arch, with two
// standing disciples, small Buddhas, flowers and tall yellow candles. Light a candle at the altar.
// Built on first entry (the sculpture takes about a second, under the fade).

const TO = new V3(3000, 0, 0);
export const templeScene = new THREE.Scene();
templeScene.background = C('#1a0f0a');
const root = new THREE.Group(); root.position.copy(TO); templeScene.add(root);
const W = 13.5, HALL_Z = 26, SAN_Z = -30, HALL_H = 11, SAN_H = 16, ARCH = 6, RC = 12; // RC: the dome's centre (z)
const HALL_PILLARS = [], SAN_PILLARS = [];
for (let k = 0; k < 8; k++) { const a = (k + 0.5) * Math.PI / 4; HALL_PILLARS.push([Math.cos(a) * 7, RC + Math.sin(a) * 7]); }
for (const x of [-10.5, 10.5]) for (const z of [3, 12, 21]) HALL_PILLARS.push([x, z]);
for (const x of [-9.8, 9.8]) for (const z of [-5, -12, -19, -26]) SAN_PILLARS.push([x, z]);
const THRONE = { z: -24.6, top: 3.9, S: 5.6 }, ALTAR = { z: -18.4, hw: 3.6, hd: 0.8 };
const CANDLES = [-5.2, -3.2, 3.2, 5.2].map(x => [x, -17.0]);

/* ---------- painted surfaces ---------- */
// carving: drawn as heights (light = raised) and used both as the colour (cream times the height, so the
// recesses are shadowed) and as the bump map
function carving(w, h, draw, tint, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, w, h); draw(g, w, h);
  const bump = new THREE.CanvasTexture(c);
  const map = canvasTex(w, h, m => { m.drawImage(c, 0, 0); m.globalCompositeOperation = 'multiply'; m.fillStyle = tint; m.fillRect(0, 0, w, h); m.globalCompositeOperation = 'screen'; m.fillStyle = 'rgba(70,60,45,.35)'; m.fillRect(0, 0, w, h); });
  for (const t of [bump, map]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; if (rep) t.repeat.set(rep[0], rep[1]); }
  return { map, bump };
}
const band = (g, w, y, h, lo = '#6a6a6a', hi = '#f4f4f4') => { const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, lo); gr.addColorStop(0.45, hi); gr.addColorStop(1, lo); g.fillStyle = gr; g.fillRect(0, y, w, h); };
function beads(g, w, y, r) { for (let x = r; x < w; x += r * 2.2) { const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#707070'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } }
function petals(g, w, y, h, n, up) {
  g.fillStyle = '#5a5a5a'; g.fillRect(0, y, w, h);
  const pw = w / n;
  for (let i = 0; i < n; i++) {
    const x = i * pw, b = up ? y + h : y, t = up ? y : y + h;
    const gr = g.createLinearGradient(x, 0, x + pw, 0); gr.addColorStop(0, '#9a9a9a'); gr.addColorStop(0.5, '#ffffff'); gr.addColorStop(1, '#8a8a8a'); g.fillStyle = gr;
    g.beginPath(); g.moveTo(x + pw * 0.04, b); g.quadraticCurveTo(x + pw * 0.02, (b + t) / 2, x + pw / 2, t); g.quadraticCurveTo(x + pw * 0.98, (b + t) / 2, x + pw * 0.96, b); g.fill();
    g.strokeStyle = '#7a7a7a'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + pw / 2, b); g.lineTo(x + pw / 2, t + (b - t) * 0.25); g.stroke();
  }
}
// a figure in a niche: a dancer, a musician or a seated sage, raised from a dark arched recess
function figure(g, cx, by, s, kind) {
  const lit = g.createLinearGradient(cx - s * 0.4, 0, cx + s * 0.4, 0); lit.addColorStop(0, '#9c9c9c'); lit.addColorStop(0.4, '#ffffff'); lit.addColorStop(1, '#a4a4a4');
  g.fillStyle = lit; g.strokeStyle = lit; g.lineCap = 'round';
  if (kind === 2) { // seated
    g.beginPath(); g.ellipse(cx, by - s * 0.12, s * 0.36, s * 0.12, 0, 0, 7); g.fill();
    g.beginPath(); g.moveTo(cx - s * 0.17, by - s * 0.2); g.lineTo(cx - s * 0.13, by - s * 0.62); g.lineTo(cx + s * 0.13, by - s * 0.62); g.lineTo(cx + s * 0.17, by - s * 0.2); g.fill();
    g.beginPath(); g.arc(cx, by - s * 0.74, s * 0.11, 0, 7); g.fill(); g.beginPath(); g.arc(cx, by - s * 0.88, s * 0.06, 0, 7); g.fill();
    g.lineWidth = s * 0.07; g.beginPath(); g.moveTo(cx - s * 0.14, by - s * 0.56); g.lineTo(cx - s * 0.24, by - s * 0.34); g.lineTo(cx - s * 0.05, by - s * 0.24); g.moveTo(cx + s * 0.14, by - s * 0.56); g.lineTo(cx + s * 0.24, by - s * 0.34); g.lineTo(cx + s * 0.05, by - s * 0.24); g.stroke();
    return;
  }
  const lean = kind === 1 ? -0.12 : 0.1;
  g.lineWidth = s * 0.08;
  g.beginPath(); g.moveTo(cx - s * 0.05, by - s * 0.48); g.lineTo(cx - s * 0.14 + lean * s, by - s * 0.02); g.moveTo(cx + s * 0.05, by - s * 0.48); g.lineTo(cx + s * 0.2, by - s * 0.26); g.lineTo(cx + s * 0.1, by - s * 0.02); g.stroke();
  g.beginPath(); g.moveTo(cx - s * 0.12, by - s * 0.46); g.quadraticCurveTo(cx - s * 0.2, by - s * 0.3, cx - s * 0.26, by - s * 0.22); g.lineTo(cx + s * 0.26, by - s * 0.22); g.quadraticCurveTo(cx + s * 0.2, by - s * 0.3, cx + s * 0.12, by - s * 0.46); g.fill(); // a flared skirt
  g.beginPath(); g.moveTo(cx - s * 0.1, by - s * 0.46); g.lineTo(cx - s * 0.11, by - s * 0.72); g.lineTo(cx + s * 0.11, by - s * 0.72); g.lineTo(cx + s * 0.1, by - s * 0.46); g.fill();
  g.beginPath(); g.arc(cx + lean * s * 0.4, by - s * 0.82, s * 0.09, 0, 7); g.fill();
  g.beginPath(); g.arc(cx + lean * s * 0.4, by - s * 0.95, s * 0.05, 0, 7); g.fill(); // a crown
  g.lineWidth = s * 0.06; g.beginPath();
  if (kind === 1) { g.moveTo(cx - s * 0.1, by - s * 0.7); g.lineTo(cx - s * 0.3, by - s * 0.86); g.lineTo(cx - s * 0.22, by - s * 1.02); g.moveTo(cx + s * 0.1, by - s * 0.7); g.lineTo(cx + s * 0.28, by - s * 0.6); g.lineTo(cx + s * 0.18, by - s * 0.5); }
  else { g.moveTo(cx - s * 0.1, by - s * 0.7); g.lineTo(cx - s * 0.32, by - s * 0.62); g.lineTo(cx - s * 0.38, by - s * 0.8); g.moveTo(cx + s * 0.1, by - s * 0.7); g.lineTo(cx + s * 0.3, by - s * 0.78); g.lineTo(cx + s * 0.4, by - s * 0.66); }
  g.stroke();
}
function niches(g, w, y, h, n, kinds) {
  g.fillStyle = '#9a9a9a'; g.fillRect(0, y, w, h);
  const nw = w / n;
  for (let i = 0; i < n; i++) {
    const x = i * nw, cx = x + nw / 2;
    for (const px of [x + nw * 0.08, x + nw * 0.92]) { const gr = g.createLinearGradient(px - nw * 0.06, 0, px + nw * 0.06, 0); gr.addColorStop(0, '#8a8a8a'); gr.addColorStop(0.5, '#f8f8f8'); gr.addColorStop(1, '#7a7a7a'); g.fillStyle = gr; g.fillRect(px - nw * 0.06, y + h * 0.06, nw * 0.12, h * 0.9); }
    const rg = g.createRadialGradient(cx, y + h * 0.55, nw * 0.05, cx, y + h * 0.55, nw * 0.5); rg.addColorStop(0, '#4a4a4a'); rg.addColorStop(1, '#2a2a2a'); g.fillStyle = rg;
    g.beginPath(); g.moveTo(x + nw * 0.15, y + h * 0.96); g.lineTo(x + nw * 0.15, y + h * 0.3); g.quadraticCurveTo(x + nw * 0.15, y + h * 0.08, cx, y + h * 0.05); g.quadraticCurveTo(x + nw * 0.85, y + h * 0.08, x + nw * 0.85, y + h * 0.3); g.lineTo(x + nw * 0.85, y + h * 0.96); g.fill();
    figure(g, cx, y + h * 0.94, Math.min(h * 0.85, nw * 1.2), kinds[i % kinds.length]);
  }
}
function lattice(g, w, y, h, s) {
  g.fillStyle = '#3a3a3a'; g.fillRect(0, y, w, h);
  g.save(); g.beginPath(); g.rect(0, y, w, h); g.clip(); g.strokeStyle = '#e8e8e8'; g.lineWidth = s * 0.22;
  for (let x = -h; x < w + h; x += s) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + h, y + h); g.moveTo(x, y + h); g.lineTo(x + h, y); g.stroke(); }
  g.fillStyle = '#ffffff'; for (let x = 0; x < w + s; x += s) for (let yy = y; yy < y + h + s; yy += s) { g.beginPath(); g.arc(x, yy, s * 0.14, 0, 7); g.fill(); }
  g.restore();
}
function scroll(g, w, y, h) {
  g.fillStyle = '#8a8a8a'; g.fillRect(0, y, w, h); g.strokeStyle = '#f2f2f2'; g.lineWidth = h * 0.12; g.beginPath();
  for (let x = 0; x <= w; x += 4) g.lineTo(x, y + h / 2 + Math.sin(x / w * Math.PI * 16) * h * 0.3); g.stroke();
  g.fillStyle = '#ffffff'; for (let i = 0; i < 16; i++) { const x = (i + 0.25) / 16 * w; g.beginPath(); g.arc(x, y + h / 2 - h * 0.26 * (i % 2 ? -1 : 1), h * 0.14, 0, 7); g.fill(); }
}

let T_ = null; // the textures, made on first entry
function textures() {
  if (T_) return T_;
  // the marble pillars: v runs up the shaft (canvas top = the capital)
  const pillar = carving(512, 1024, (g, w) => {
    petals(g, w, 0, 70, 8, false); beads(g, w, 82, 9); band(g, w, 92, 22);
    niches(g, w, 114, 190, 4, [0, 1, 0, 1]); band(g, w, 304, 18); scroll(g, w, 322, 40); band(g, w, 362, 18);
    lattice(g, w, 380, 150, 32); band(g, w, 530, 20); beads(g, w, 560, 9);
    niches(g, w, 572, 200, 4, [2, 2, 2, 2]); band(g, w, 772, 22); petals(g, w, 794, 80, 10, true); beads(g, w, 886, 10);
    band(g, w, 898, 40); band(g, w, 940, 30); band(g, w, 972, 52);
  }, '#f3ece0');
  const wall = carving(1024, 1024, (g, w, h) => {
    band(g, w, 0, 26); niches(g, w, 26, 300, 4, [0, 2, 1, 2]); band(g, w, 326, 20); scroll(g, w, 346, 50); band(g, w, 396, 20);
    lattice(g, w, 416, 260, 40); band(g, w, 676, 20); petals(g, w, 696, 90, 12, true); band(g, w, 786, 24);
    niches(g, w, 810, 190, 6, [2, 0, 1]); band(g, w, 1000, 24);
  }, '#efe6d6', [1, 1]);
  const dome = carving(1024, 256, (g, w, h) => { band(g, w, 0, 30); beads(g, w, 42, 9); niches(g, w, 54, 150, 12, [0, 1, 2, 1]); petals(g, w, 204, 52, 24, true); }, '#f5efe4', [1, 1]);
  const coffer = carving(512, 512, (g, w) => {
    band(g, w, 0, 40); band(g, w, 472, 40); g.save(); g.translate(w, 0); g.rotate(Math.PI / 2); band(g, w, 0, 40); band(g, w, 472, 40); g.restore();
    const cx = w / 2; for (let r = 190; r > 20; r -= 34) { const gr = g.createRadialGradient(cx, cx, r - 30, cx, cx, r); gr.addColorStop(0, '#6a6a6a'); gr.addColorStop(0.7, '#f4f4f4'); gr.addColorStop(1, '#5a5a5a'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cx, r, 0, 7); g.fill(); }
    g.fillStyle = '#ffffff'; for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; g.beginPath(); g.ellipse(cx + Math.cos(a) * 120, cx + Math.sin(a) * 120, 34, 13, a, 0, 7); g.fill(); }
  }, '#f1eadf', [1, 1]);
  // the inlaid floor under the dome: a mandala of petals in black, rust, gold and white marble
  const mandala = canvasTex(1024, 1024, (g, S) => {
    const c = S / 2; g.fillStyle = '#d9d3c7'; g.fillRect(0, 0, S, S);
    const rings = [[500, '#2b2a2a'], [470, '#c9b48a'], [455, '#2b2a2a'], [380, '#e9e4da'], [300, '#7d2e1f'], [285, '#e9e4da'], [180, '#2b2a2a'], [165, '#c9a04a'], [90, '#e9e4da']];
    for (const [r, col] of rings) { g.fillStyle = col; g.beginPath(); g.arc(c, c, r, 0, 7); g.fill(); }
    const petalRing = (n, r0, r1, wd, col, off = 0) => { g.fillStyle = col; for (let i = 0; i < n; i++) { const a = (i + off) / n * 6.283; g.save(); g.translate(c, c); g.rotate(a); g.beginPath(); g.moveTo(r0, 0); g.quadraticCurveTo((r0 + r1) / 2, wd, r1, 0); g.quadraticCurveTo((r0 + r1) / 2, -wd, r0, 0); g.fill(); g.restore(); } };
    petalRing(32, 300, 452, 30, '#2b2a2a'); petalRing(32, 310, 440, 18, '#c9a04a'); petalRing(32, 300, 430, 22, '#7d2e1f', 0.5); petalRing(32, 320, 410, 10, '#e9d9a8', 0.5);
    petalRing(16, 180, 282, 34, '#7d2e1f'); petalRing(16, 190, 270, 16, '#e9e4da'); petalRing(16, 175, 260, 18, '#2b2a2a', 0.5);
    petalRing(12, 20, 160, 26, '#7d2e1f'); petalRing(12, 30, 150, 12, '#c9a04a'); petalRing(12, 20, 120, 14, '#2b2a2a', 0.5);
    g.fillStyle = '#c9a04a'; g.beginPath(); g.arc(c, c, 26, 0, 7); g.fill();
    for (let i = 0; i < 96; i++) { const a = i / 96 * 6.283; g.fillStyle = i % 2 ? '#c9a04a' : '#7d2e1f'; g.beginPath(); g.arc(c + Math.cos(a) * 486, c + Math.sin(a) * 486, 9, 0, 7); g.fill(); }
    g.globalAlpha = 0.08; for (let i = 0; i < 60; i++) { g.strokeStyle = '#555'; g.lineWidth = 1; g.beginPath(); let x = Math.random() * S, y = Math.random() * S; g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (Math.random() - 0.4) * 60; y += (Math.random() - 0.5) * 60; g.lineTo(x, y); } g.stroke(); }
  });
  // the hall's floor: star tiles in ochre and rust on cream, framed in green (one tile per 1.2 m)
  const tiles = canvasTex(256, 256, (g, S) => {
    g.fillStyle = '#e9dfc8'; g.fillRect(0, 0, S, S); g.strokeStyle = '#5d6b4a'; g.lineWidth = 10; g.strokeRect(5, 5, S - 10, S - 10);
    const star = (r0, r1, col) => { g.fillStyle = col; g.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283, r = i % 2 ? r0 : r1; g.lineTo(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r); } g.fill(); };
    star(52, 112, '#d9a23a'); star(40, 84, '#e8c56a'); star(26, 52, '#b4472a'); g.fillStyle = '#e9dfc8'; g.beginPath(); g.arc(S / 2, S / 2, 12, 0, 7); g.fill();
    for (const [x, y] of [[0, 0], [S, 0], [0, S], [S, S]]) { g.fillStyle = '#b4472a'; g.beginPath(); g.arc(x, y, 30, 0, 7); g.fill(); g.fillStyle = '#e8c56a'; g.beginPath(); g.arc(x, y, 16, 0, 7); g.fill(); }
  }, true);
  tiles.repeat.set(2 * W / 1.2, HALL_Z / 1.2);
  // the sanctum's polished teak
  const teak = canvasTex(512, 512, (g, S) => {
    for (let i = 0; i < 8; i++) { const y = i * S / 8, l = 30 + Math.random() * 10; g.fillStyle = `hsl(24,${48 + Math.random() * 10}%,${l}%)`; g.fillRect(0, y, S, S / 8); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, y, S, 2); const off = Math.random() * S; g.fillRect(off, y, 2, S / 8); }
    g.globalAlpha = 0.18; for (let i = 0; i < 260; i++) { g.strokeStyle = Math.random() < 0.5 ? '#1e0e06' : '#a0684a'; g.beginPath(); const y = Math.random() * S; g.moveTo(0, y); g.bezierCurveTo(S / 3, y + Math.random() * 6 - 3, S * 2 / 3, y + Math.random() * 6 - 3, S, y); g.stroke(); }
  }, true);
  teak.repeat.set(2 * W / 4, -SAN_Z / 4);
  // the ubosot's walls: cream scattered with small dark-red flowers (Wat Arun)
  const flowers = canvasTex(256, 256, (g, S) => {
    g.fillStyle = '#efe6d2'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(150,120,80,${Math.random() * 0.05})`; g.fillRect(Math.random() * S, Math.random() * S, 3 + Math.random() * 14, 3 + Math.random() * 14); }
    const fl = (x, y, r, a) => { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = '#7a2a1c'; for (let k = 0; k < 4; k++) { g.rotate(Math.PI / 2); g.beginPath(); g.ellipse(r * 0.55, 0, r * 0.55, r * 0.34, 0, 0, 7); g.fill(); } g.fillStyle = '#4a1a12'; g.beginPath(); g.arc(0, 0, r * 0.22, 0, 7); g.fill(); g.strokeStyle = '#4a3a1a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, r * 0.4); g.quadraticCurveTo(r * 0.5, r * 1.1, r * 1.1, r * 0.9); g.stroke(); g.restore(); };
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) fl((i + (j % 2) * 0.5) * S / 4 + 20, j * S / 4 + 32, 15, (i * 7 + j * 3) % 5);
  }, true);
  flowers.repeat.set(1, 1);
  // tiled pillars: white tiles in a diamond lattice, each holding a red-orange flower, with gold borders
  const tile = canvasTex(256, 256, (g, S) => {
    g.fillStyle = '#f2ece0'; g.fillRect(0, 0, S, S); g.strokeStyle = '#8a3a22'; g.lineWidth = 3;
    for (let i = -2; i < 4; i++) { g.beginPath(); g.moveTo(i * S / 2, 0); g.lineTo(i * S / 2 + S, S); g.moveTo(i * S / 2 + S, 0); g.lineTo(i * S / 2, S); g.stroke(); }
    const fl = (x, y) => { g.fillStyle = '#c4492a'; for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283; g.beginPath(); g.ellipse(x + Math.cos(a) * 11, y + Math.sin(a) * 11, 9, 6, a, 0, 7); g.fill(); } g.fillStyle = '#e8b44a'; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); };
    for (const [x, y] of [[S / 2, 0], [0, S / 2], [S, S / 2], [S / 2, S], [S / 2, S / 2], [0, 0], [S, 0], [0, S], [S, S]]) if ((x + y) % S === S / 2 || x === S / 2 && y === S / 2) fl(x, y);
  }, true);
  // the sanctum ceiling: deep red with gilt rosettes
  const ceil = canvasTex(256, 256, (g, S) => {
    g.fillStyle = '#5a1810'; g.fillRect(0, 0, S, S); g.strokeStyle = '#b8862e'; g.lineWidth = 4; g.strokeRect(2, 2, S - 4, S - 4);
    const ro = (x, y, r) => { g.fillStyle = '#d6a440'; for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283; g.beginPath(); g.ellipse(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5, r * 0.5, r * 0.2, a, 0, 7); g.fill(); } g.fillStyle = '#8a2a18'; g.beginPath(); g.arc(x, y, r * 0.22, 0, 7); g.fill(); };
    ro(S / 2, S / 2, 70); for (const [x, y] of [[0, 0], [S, 0], [0, S], [S, S]]) ro(x, y, 30);
  }, true);
  ceil.repeat.set(2 * W / 3, -SAN_Z / 3);
  // gilt bands with red and green glass, for the throne's tiers
  const jewel = canvasTex(512, 64, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#7a5216'); gr.addColorStop(0.5, '#f0cc6a'); gr.addColorStop(1, '#7a5216'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) { const x = (i + 0.5) * w / 16; g.fillStyle = i % 2 ? '#a3201a' : '#1f6a3a'; g.beginPath(); g.moveTo(x, 10); g.lineTo(x + 12, h / 2); g.lineTo(x, h - 10); g.lineTo(x - 12, h / 2); g.fill(); g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(x - 3, h / 2 - 5, 3, 0, 7); g.fill(); }
    g.fillStyle = '#fff2c0'; for (let i = 0; i < 64; i++) { g.beginPath(); g.arc((i + 0.5) * w / 64, 5, 2.2, 0, 7); g.arc((i + 0.5) * w / 64, h - 5, 2.2, 0, 7); g.fill(); }
  }, true);
  // the flame-edged arch behind the Buddha: a pointed frame in red and gold, open in the middle
  const arch = canvasTex(1024, 1280, (g, w, h) => {
    const outline = (inset) => { g.beginPath(); g.moveTo(inset, h); g.lineTo(inset, h * 0.42); g.bezierCurveTo(inset, h * 0.2, w * 0.38, h * 0.12, w / 2, inset * 0.6); g.bezierCurveTo(w * 0.62, h * 0.12, w - inset, h * 0.2, w - inset, h * 0.42); g.lineTo(w - inset, h); g.closePath(); };
    // the flames: gold tongues all round the outer edge
    g.save(); outline(70); g.clip(); g.restore();
    for (let i = 0; i < 70; i++) {
      const t = i / 69, a = t; const x = a < 0.5 ? w * (0.06 + (0.44) * Math.pow(a * 2, 0.9)) : w * (0.94 - 0.44 * Math.pow((1 - a) * 2, 0.9));
      const y = h * (0.42 - 0.4 * Math.sin(Math.PI * a)) + 10;
      if (y > h * 0.98) continue;
      g.fillStyle = '#e2b24a'; g.beginPath(); g.moveTo(x - 18, y + 40); g.quadraticCurveTo(x - 20, y, x + (a < 0.5 ? -12 : 12), y - 50); g.quadraticCurveTo(x + 18, y + 4, x + 18, y + 40); g.fill();
    }
    for (let y = h * 0.42; y < h; y += 46) for (const x of [44, w - 44]) { g.fillStyle = '#e2b24a'; g.beginPath(); g.moveTo(x - 18, y + 40); g.quadraticCurveTo(x - 30, y, x + (x < w / 2 ? -26 : 26), y - 18); g.quadraticCurveTo(x + 18, y + 4, x + 18, y + 40); g.fill(); }
    outline(60); g.fillStyle = '#c99434'; g.fill();
    outline(78); g.fillStyle = '#6a1a12'; g.fill();
    g.save(); outline(78); g.clip(); g.fillStyle = '#d6a440';
    for (let y = 0; y < h; y += 26) for (let x = (y / 26 % 2) * 13; x < w; x += 26) { g.beginPath(); g.moveTo(x, y - 5); g.lineTo(x + 5, y); g.lineTo(x, y + 5); g.lineTo(x - 5, y); g.fill(); }
    g.restore();
    outline(150); g.fillStyle = '#c99434'; g.fill(); outline(166); g.globalCompositeOperation = 'destination-out'; g.fill(); g.globalCompositeOperation = 'source-over';
  });
  // the gold cloth hanging from the throne: brocade diamonds, a pointed hem
  const drape = canvasTex(256, 512, (g, w, h) => {
    g.beginPath(); g.moveTo(0, 0); g.lineTo(w, 0); g.lineTo(w, h * 0.82); g.lineTo(w / 2, h); g.lineTo(0, h * 0.82); g.closePath(); g.clip();
    g.fillStyle = '#b8862e'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) for (let x = (y / 32 % 2) * 16; x < w; x += 32) { g.fillStyle = '#f0cc6a'; g.beginPath(); g.moveTo(x, y - 12); g.lineTo(x + 12, y); g.lineTo(x, y + 12); g.lineTo(x - 12, y); g.fill(); g.fillStyle = (x + y) % 64 ? '#9a2a1a' : '#2a6a4a'; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
    g.strokeStyle = '#7a1e12'; g.lineWidth = 14; g.strokeRect(0, 0, w, h);
  });
  // a soft gilt-and-warm room for the gold to reflect
  const env = canvasTex(512, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2a0c06'); gr.addColorStop(0.35, '#a06a3a'); gr.addColorStop(0.55, '#f2d6a6'); gr.addColorStop(0.75, '#6a4024'); gr.addColorStop(1, '#2a160c'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 10; i++) { const x = (i + 0.5) / 10 * w, y = h * 0.28, rg = g.createRadialGradient(x, y, 0, x, y, 26); rg.addColorStop(0, 'rgba(255,250,230,1)'); rg.addColorStop(1, 'rgba(255,220,160,0)'); g.fillStyle = rg; g.fillRect(x - 30, y - 30, 60, 60); }
  });
  T_ = { pillar, wall, dome, coffer, mandala, tiles, teak, flowers, tile, ceil, jewel, arch, drape, env };
  return T_;
}

/* ---------- the building ---------- */
let built = false, gold = null;
const candles = []; let litCount = 0;
function plane(w, h, mat, x, y, z, ry = 0, rx = 0) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0, 'YXZ'); root.add(m); return m; }
function uvScale(geo, su, sv) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); return geo; }
function glow(x, y, z, s, col, op = 0.9) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false })); sp.position.set(x, y, z); sp.scale.set(s, s, s); root.add(sp); return sp; }

function build() {
  if (built) return; built = true;
  const X = textures();
  const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene();
  es.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.MeshBasicMaterial({ map: X.env, side: THREE.BackSide })));
  const envMap = pm.fromScene(es, 0.02).texture; pm.dispose();
  gold = new THREE.MeshStandardMaterial({ color: '#f0b856', metalness: 1, roughness: 0.34, envMap, envMapIntensity: 1.1, vertexColors: true });
  const giltFlat = new THREE.MeshStandardMaterial({ color: '#f2c66a', metalness: 0.85, roughness: 0.38, envMap, envMapIntensity: 1.1 });
  const giltBand = new THREE.MeshStandardMaterial({ map: X.jewel, metalness: 0.6, roughness: 0.4, envMap, envMapIntensity: 0.9 });
  const marble = (t, sh = 18) => new THREE.MeshPhongMaterial({ map: t.map, bumpMap: t.bump, bumpScale: 0.06, shininess: sh, specular: '#3a3630' });

  // lights: warm and low in the hall, chandeliers and a light on the Buddha in the sanctum
  templeScene.add(new THREE.HemisphereLight('#fff0d8', '#5a3420', 0.52));
  templeScene.add(new THREE.AmbientLight('#ffe6c8', 0.12));
  const pl = (x, y, z, i, d, col = '#ffd8a0') => { const l = new THREE.PointLight(col, i, d, 1.6); l.position.set(x, y, z).add(TO); templeScene.add(l); };
  pl(0, 8.5, RC, 0.9, 26); pl(0, 6, 22, 0.55, 18); pl(-9, 3, 12, 0.35, 12, '#ffb46a'); pl(9, 3, 12, 0.35, 12, '#ffb46a');
  for (const x of [-4.5, 4.5]) for (const z of [-8, -16]) pl(x, 10, z, 0.55, 22, '#ffe6c0');
  const spot = new THREE.SpotLight('#ffe2b0', 1.1, 40, 0.3, 0.7, 1.2); spot.position.set(0, 15, -13).add(TO); spot.target.position.set(0, 7.2, THRONE.z).add(TO); templeScene.add(spot, spot.target);

  /* the hall of carved pillars */
  const floorM = new THREE.MeshPhongMaterial({ map: X.tiles, shininess: 60, specular: '#4a4438' });
  plane(2 * W, HALL_Z, floorM, 0, 0, HALL_Z / 2, 0, -Math.PI / 2);
  const mand = new THREE.Mesh(new THREE.CircleGeometry(6.6, 64), new THREE.MeshPhongMaterial({ map: X.mandala, shininess: 80, specular: '#5a5448' })); mand.rotation.x = -Math.PI / 2; mand.position.set(0, 0.012, RC); root.add(mand);
  const wallT = X.wall; const wallM = (rx) => { const m = marble({ map: wallT.map.clone(), bump: wallT.bump.clone() }, 8); m.map.repeat.set(rx, 1.4); m.bumpMap.repeat.set(rx, 1.4); m.map.needsUpdate = m.bumpMap.needsUpdate = true; return m; };
  for (const s of [-1, 1]) plane(HALL_Z, HALL_H, wallM(HALL_Z / 8), s * W, HALL_H / 2, HALL_Z / 2, -s * Math.PI / 2);
  // the entrance wall with its door: daylight beyond
  const endM = wallM(2.2);
  plane(W - 2.2, HALL_H, endM, -(W + 2.2) / 2, HALL_H / 2, HALL_Z, Math.PI); plane(W - 2.2, HALL_H, endM, (W + 2.2) / 2, HALL_H / 2, HALL_Z, Math.PI);
  plane(4.4, HALL_H - 5.2, endM, 0, 5.2 + (HALL_H - 5.2) / 2, HALL_Z, Math.PI);
  const day = plane(4.4, 5.2, new THREE.MeshBasicMaterial({ color: '#fff4dc' }), 0, 2.6, HALL_Z + 0.05, Math.PI);
  glow(0, 2.6, HALL_Z - 0.4, 7, '#ffe8c0', 0.35);
  const doorFrame = new THREE.Group(); root.add(doorFrame);
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5.6, 0.5), marble(X.pillar)); p.position.set(s * 2.5, 2.8, HALL_Z - 0.2); doorFrame.add(p); }
  { const l = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.7, 0.5), marble(X.pillar)); l.position.set(0, 5.55, HALL_Z - 0.2); doorFrame.add(l); }
  regThing(day, 'Step back outside', () => late.leaveTemple && late.leaveTemple(), { x: TO.x, z: TO.z + HALL_Z - 1.6, r: 2.6 });
  // the carved pillars: a lathe of plinth, shaft and capital, carved all over
  const prof = []; const N = 48;
  for (let i = 0; i <= N; i++) {
    const t = i / N, y = t * HALL_H;
    let r = 0.62;
    if (t < 0.06) r = 0.95; else if (t < 0.1) r = 0.85; else if (t < 0.13) r = 0.74;
    else if (t > 0.94) r = 1.0; else if (t > 0.9) r = 0.86; else if (t > 0.86) r = 0.74;
    r += 0.05 * Math.max(0, Math.cos((t - 0.48) * 40)) * (t > 0.3 && t < 0.66 ? 1 : 0);
    prof.push(new THREE.Vector2(r, y));
  }
  const pGeo = new THREE.LatheGeometry(prof, 24);
  { const uv = pGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i)); }
  const pMat = marble(X.pillar, 22);
  const pIm = new THREE.InstancedMesh(pGeo, pMat, HALL_PILLARS.length); const m4 = new THREE.Matrix4();
  HALL_PILLARS.forEach(([x, z], i) => pIm.setMatrixAt(i, m4.makeTranslation(x, 0, z))); root.add(pIm);
  // brass lamp stands beside the ring of pillars, each with a small flame
  for (let k = 0; k < 8; k++) {
    const a = (k + 0.5) * Math.PI / 4, x = Math.cos(a) * 5.6, z = RC + Math.sin(a) * 5.6;
    const st = new THREE.Mesh(new THREE.LatheGeometry([[0.32, 0], [0.3, 0.06], [0.07, 0.14], [0.05, 1.1], [0.1, 1.15], [0.24, 1.22], [0.26, 1.28], [0.0, 1.28]].map(([r, y]) => new THREE.Vector2(r, y)), 14), giltFlat);
    st.position.set(x, 0, z); root.add(st); glow(x, 1.42, z, 0.5, '#ffb24a', 1); glow(x, 1.42, z, 2.6, '#ff9a3a', 0.25);
  }
  // the ceiling, with a round opening for the dome
  const cs = new THREE.Shape(); cs.moveTo(-W, 0); cs.lineTo(W, 0); cs.lineTo(W, HALL_Z); cs.lineTo(-W, HALL_Z); cs.lineTo(-W, 0);
  const hole = new THREE.Path(); hole.absarc(0, RC, 8.4, 0, Math.PI * 2, true); cs.holes.push(hole);
  const cGeo = new THREE.ShapeGeometry(cs, 48); cGeo.rotateX(Math.PI / 2); uvScale(cGeo, 1 / 4, 1 / 4);
  const cof = marble(X.coffer, 6); const ceil = new THREE.Mesh(cGeo, cof); ceil.position.y = HALL_H; root.add(ceil);
  // the dome: carved rings stepping up and in, and a lotus pendant hanging from its crown
  const domeM = marble(X.dome, 10); domeM.side = DS;
  let r = 8.4, y = HALL_H;
  for (let i = 0; i < 8; i++) {
    const h = 1.25, wall = new THREE.Mesh(uvScale(new THREE.CylinderGeometry(r, r, h, 64, 1, true), Math.max(2, Math.round(r * 1.2)), 1), domeM); wall.position.set(0, y + h / 2, RC); root.add(wall);
    const r2 = r * 0.84; const step = new THREE.Mesh(new THREE.RingGeometry(r2, r, 64, 1), new THREE.MeshPhongMaterial({ color: '#efe6d6', side: DS, shininess: 6 })); step.rotation.x = Math.PI / 2; step.position.set(0, y + h, RC); root.add(step);
    y += h; r = r2;
  }
  { const cap = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshPhongMaterial({ map: X.mandala, side: DS })); cap.rotation.x = Math.PI / 2; cap.position.set(0, y + 0.01, RC); root.add(cap); }
  const pend = new THREE.Mesh(new THREE.LatheGeometry([[0.01, -2.4], [0.25, -2.2], [0.6, -1.7], [0.95, -1.0], [1.1, -0.5], [1.0, 0]].map(([a, b]) => new THREE.Vector2(a, b)), 24), marble(X.dome, 10)); pend.position.set(0, y, RC); root.add(pend);
  for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283, p = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshPhongMaterial({ color: '#f2ebdf', shininess: 10 })); p.scale.set(0.2, 0.62, 0.12); p.position.set(Math.cos(a) * 0.85, y - 1.0, RC + Math.sin(a) * 0.85); p.rotation.set(0, -a, 0.5); p.rotation.order = 'YXZ'; root.add(p); }
  // a ring beam over the pillars
  { const rb = new THREE.Mesh(uvScale(new THREE.CylinderGeometry(7.9, 7.9, 1.1, 64, 1, true), 8, 1), domeM); rb.position.set(0, HALL_H - 0.55, RC); root.add(rb); }
  // a crimson runner with a gold border, door to sanctum, round the inlay
  const runner = canvasTex(64, 256, (g, w, h) => { g.fillStyle = '#7a1a16'; g.fillRect(0, 0, w, h); g.fillStyle = '#c99434'; g.fillRect(0, 0, 6, h); g.fillRect(w - 6, 0, 6, h); g.fillStyle = '#5a1010'; g.fillRect(10, 0, 3, h); g.fillRect(w - 13, 0, 3, h); }, true);
  const runM = new THREE.MeshLambertMaterial({ map: runner });
  for (const [z0, z1] of [[RC + 6.7, HALL_Z - 0.3], [-15.5, RC - 6.7]]) { const m = new THREE.Mesh(uvScale(new THREE.PlaneGeometry(3, z1 - z0), 1, (z1 - z0) / 6), runM); m.rotation.x = -Math.PI / 2; m.position.set(0, 0.02, (z0 + z1) / 2); root.add(m); }

  /* the carved arch between hall and sanctum */
  const as = new THREE.Shape(); as.moveTo(-W, 0); as.lineTo(W, 0); as.lineTo(W, SAN_H); as.lineTo(-W, SAN_H); as.lineTo(-W, 0);
  const ah = new THREE.Path(); ah.moveTo(-ARCH, 0); ah.lineTo(-ARCH, 6.5); ah.quadraticCurveTo(-ARCH, 9.6, 0, 10.6); ah.quadraticCurveTo(ARCH, 9.6, ARCH, 6.5); ah.lineTo(ARCH, 0); ah.lineTo(-ARCH, 0); as.holes.push(ah);
  const aGeo = new THREE.ShapeGeometry(as, 24); uvScale(aGeo, 1 / 7, 1 / 7.6);
  const front = new THREE.Mesh(aGeo, wallM(1)); front.material.map.repeat.set(1, 1); front.material.bumpMap.repeat.set(1, 1); front.position.z = 0.3; root.add(front);
  const flowerM = new THREE.MeshLambertMaterial({ map: X.flowers });
  const back = new THREE.Mesh(uvScale(aGeo.clone(), 7 / 1.4, 7.6 / 1.4), flowerM); back.rotation.y = Math.PI; back.position.z = -0.3; root.add(back);
  // the arch's gilt edge
  { const pts = []; for (let i = 0; i <= 40; i++) { const t = i / 40; let p; if (t < 0.25) p = [-ARCH, t / 0.25 * 6.5]; else if (t < 0.5) { const u = (t - 0.25) / 0.25; p = [(1 - u) * (1 - u) * -ARCH + 2 * (1 - u) * u * -ARCH, (1 - u) * (1 - u) * 6.5 + 2 * (1 - u) * u * 9.6 + u * u * 10.6]; } else if (t < 0.75) { const u = (t - 0.5) / 0.25; p = [2 * (1 - u) * u * ARCH + u * u * ARCH, (1 - u) * (1 - u) * 10.6 + 2 * (1 - u) * u * 9.6 + u * u * 6.5]; } else p = [ARCH, (1 - (t - 0.75) / 0.25) * 6.5]; pts.push(new V3(p[0], p[1], 0)); }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.22, 8), giltFlat); root.add(tube); const t2 = tube.clone(); t2.scale.set(1.04, 1.03, 1); root.add(t2); }
  for (const s of [-1, 1]) { const p = new THREE.Mesh(pGeo, pMat); p.scale.set(0.8, 1, 0.8); p.position.set(s * (ARCH + 0.9), 0, 0.9); root.add(p); }

  /* the sanctum */
  const teakM = new THREE.MeshPhongMaterial({ map: X.teak, shininess: 90, specular: '#5a4030' });
  plane(2 * W, -SAN_Z, teakM, 0, 0, SAN_Z / 2, 0, -Math.PI / 2);
  for (const s of [-1, 1]) plane(-SAN_Z, SAN_H, new THREE.MeshLambertMaterial({ map: (() => { const t = X.flowers.clone(); t.repeat.set(-SAN_Z / 1.4, SAN_H / 1.4); t.needsUpdate = true; return t; })() }), s * W, SAN_H / 2, SAN_Z / 2, -s * Math.PI / 2);
  { const t = X.flowers.clone(); t.repeat.set(2 * W / 1.4, SAN_H / 1.4); t.needsUpdate = true; plane(2 * W, SAN_H, new THREE.MeshLambertMaterial({ map: t }), 0, SAN_H / 2, SAN_Z, 0); }
  plane(2 * W, -SAN_Z, new THREE.MeshLambertMaterial({ map: X.ceil }), 0, SAN_H, SAN_Z / 2, 0, Math.PI / 2);
  // dado and frieze: dark red bands edged in gold round the walls
  const red = new THREE.MeshLambertMaterial({ color: '#6a1a12' });
  for (const [y, h] of [[0.7, 1.4], [SAN_H - 0.6, 1.2]]) {
    for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, h, -SAN_Z), red); b.position.set(s * (W - 0.06), y, SAN_Z / 2); root.add(b); const gb = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, -SAN_Z), giltFlat); gb.position.set(s * (W - 0.08), y + h / 2, SAN_Z / 2); root.add(gb); }
    const b = new THREE.Mesh(new THREE.BoxGeometry(2 * W, h, 0.12), red); b.position.set(0, y, SAN_Z + 0.06); root.add(b);
  }
  // the stepped gold frame round the Buddha's alcove
  for (const [w, h, d] of [[15.6, 15.2, 0.1], [14.6, 14.6, 0.16]]) for (const s of [-1, 1]) { const v = new THREE.Mesh(new THREE.BoxGeometry(0.34, h, d), giltFlat); v.position.set(s * w / 2, h / 2, SAN_Z + d); root.add(v); }
  { const t = new THREE.Mesh(new THREE.BoxGeometry(15.9, 0.4, 0.12), giltFlat); t.position.set(0, 15.2, SAN_Z + 0.1); root.add(t); }
  // tiled pillars with gilt lotus capitals
  const tileT = X.tile; tileT.repeat.set(1, 1);
  const sq = uvScale(new THREE.BoxGeometry(1.3, SAN_H, 1.3), 1, SAN_H / 1.3);
  const sqM = new THREE.MeshPhongMaterial({ map: tileT, shininess: 50, specular: '#2a2a2a' });
  for (const [x, z] of SAN_PILLARS) {
    const p = new THREE.Mesh(sq, sqM); p.position.set(x, SAN_H / 2, z); root.add(p);
    for (const [yy, s, h] of [[0.4, 1.6, 0.8], [SAN_H - 1.2, 1.55, 0.3], [SAN_H - 0.6, 1.7, 0.9]]) { const c = new THREE.Mesh(new THREE.BoxGeometry(s, h, s), giltFlat); c.position.set(x, yy, z); root.add(c); }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.09, SAN_H - 2.6, 0.09), giltFlat); e.position.set(x + sx * 0.66, SAN_H / 2 - 0.3, z + sz * 0.66); root.add(e); }
  }
  // crystal chandeliers hanging from red cords
  const crys = []; const crysCol = [];
  for (const cx of [-4.5, 4.5]) for (const cz of [-8, -16]) {
    const cy = 10.2, cord = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, SAN_H - cy - 1.2, 6), new THREE.MeshLambertMaterial({ color: '#b01c14' })); cord.position.set(cx, (SAN_H + cy + 1.2) / 2, cz); root.add(cord);
    for (const [rr, yy] of [[0.55, 1.2], [1.05, 0.7], [1.2, 0.15], [0.95, -0.45], [0.6, -0.95], [0.25, -1.35]]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.018, 6, 40), giltFlat); ring.rotation.x = Math.PI / 2; ring.position.set(cx, cy + yy, cz); root.add(ring);
      const n = Math.round(rr * 44); for (let i = 0; i < n; i++) { const a = i / n * 6.283; for (let k = 0; k < 5; k++) { crys.push(cx + Math.cos(a) * rr * (1 - k * 0.03), cy + yy - 0.06 - k * 0.09 - (i % 2) * 0.045, cz + Math.sin(a) * rr * (1 - k * 0.03)); const b = 0.75 + Math.random() * 0.25; crysCol.push(b, b * 0.97, b * 0.9); } }
    }
    glow(cx, cy, cz, 3.2, '#fff0d0', 0.55); glow(cx, cy, cz, 7, '#ffd9a0', 0.18);
  }
  const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(crys, 3)); cg.setAttribute('color', new THREE.Float32BufferAttribute(crysCol, 3));
  const crystals = new THREE.Points(cg, new THREE.PointsMaterial({ size: 0.1, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  root.add(crystals);
  addTick(() => { if (state.world !== 'temple') return; crystals.material.size = 0.095 + 0.015 * Math.sin(performance.now() * 0.003); }, true);

  /* the throne: three gilt tiers banded with glass, a lotus seat, and the gold cloth falling from it */
  const tier = (w, h, d, y) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), giltFlat); b.position.set(0, y + h / 2, THRONE.z + 0.4); root.add(b);
    const f = new THREE.Mesh(uvScale(new THREE.PlaneGeometry(w - 0.1, h * 0.55), w / 2.4, 1), giltBand); f.position.set(0, y + h / 2, THRONE.z + 0.4 + d / 2 + 0.01); root.add(f);
    for (const s of [-1, 1]) { const sf = new THREE.Mesh(uvScale(new THREE.PlaneGeometry(d - 0.1, h * 0.55), d / 2.4, 1), giltBand); sf.rotation.y = s * Math.PI / 2; sf.position.set(s * (w / 2 + 0.01), y + h / 2, THRONE.z + 0.4); root.add(sf); }
    const lip = new THREE.Mesh(new THREE.BoxGeometry(w + 0.25, 0.14, d + 0.25), giltFlat); lip.position.set(0, y + h, THRONE.z + 0.4); root.add(lip);
  };
  tier(13, 1.1, 8, 0); tier(10.6, 1.0, 6.4, 1.1); tier(8.6, 0.9, 5.2, 2.1);
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.05, 0.9, 48), giltFlat); seat.scale.set(3.5, 1, 2.1); seat.position.set(0, 3.45, THRONE.z); root.add(seat);
  for (const [ring, n, rx, rz, yy, tilt, s] of [[0, 30, 3.55, 2.15, 3.35, 0.5, 0.42], [1, 30, 3.3, 1.95, 3.55, 0.75, 0.36]]) {
    for (let i = 0; i < n; i++) {
      const a = (i + ring * 0.5) / n * 6.283, p = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), giltFlat);
      p.scale.set(s * 0.6, s * 1.25, s * 0.22); p.position.set(Math.cos(a) * rx, yy, THRONE.z + Math.sin(a) * rz);
      p.rotation.order = 'YXZ'; p.rotation.set(-tilt, -a + Math.PI / 2, 0); root.add(p);
    }
  }
  // the cloth falls over the front of each tier, its pointed hem on the lowest
  const drapeM = new THREE.MeshStandardMaterial({ map: X.drape, transparent: true, alphaTest: 0.5, metalness: 0.3, roughness: 0.6, envMap, envMapIntensity: 0.6, side: DS });
  for (const [y0, y1, front, hem] of [[2.1, 3.9, 2.6, 0], [1.1, 2.1, 3.2, 0], [0, 1.1, 4.0, 1]]) {
    const g = new THREE.PlaneGeometry(2.4, y1 - y0); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, hem ? 0.05 + uv.getY(i) * 0.4 : 0.45 + uv.getY(i) * 0.37);
    const d = new THREE.Mesh(g, drapeM); d.position.set(0, (y0 + y1) / 2 + 0.02, THRONE.z + 0.4 + front + 0.04); root.add(d);
  }
  // the flame-edged arch behind
  { const a = new THREE.Mesh(new THREE.PlaneGeometry(11.7, 14.6), new THREE.MeshStandardMaterial({ map: X.arch, transparent: true, alphaTest: 0.4, metalness: 0.35, roughness: 0.5, envMap, envMapIntensity: 0.8 })); a.position.set(0, 1.1 + 7.3, SAN_Z + 0.35); root.add(a); }

  /* the Buddha, his disciples and the small Buddhas on the tiers */
  const bg = seatedBuddha(); paintBuddha(bg);
  const buddha = new THREE.Mesh(bg, gold); buddha.scale.setScalar(THRONE.S); buddha.position.set(0, THRONE.top - 0.03, THRONE.z - 0.15); root.add(buddha);
  const flame = new THREE.Mesh(new THREE.LatheGeometry([[0.04, 0], [0.055, 0.02], [0.05, 0.05], [0.032, 0.09], [0.016, 0.13], [0.002, 0.17]].map(([a, b]) => new THREE.Vector2(a, b)), 16), gold); paintPlain(flame.geometry);
  flame.scale.setScalar(THRONE.S); flame.position.set(0, THRONE.top + 0.885 * THRONE.S, THRONE.z - 0.15); root.add(flame);
  const small = (x, y, z, s) => { const m = new THREE.Mesh(bg, gold); m.scale.setScalar(s); m.position.set(x, y, z); root.add(m); const f = flame.clone(); f.scale.setScalar(s); f.position.set(x, y + 0.885 * s, z); root.add(f); };
  small(-3.9, 2.1, THRONE.z + 2.75, 0.9); small(3.9, 2.1, THRONE.z + 2.75, 0.9);
  small(-2.4, 1.1, THRONE.z + 4.05, 0.7); small(2.4, 1.1, THRONE.z + 4.05, 0.7);
  const sd = standingDisciple(); paintPlain(sd);
  for (const s of [-1, 1]) { const m = new THREE.Mesh(sd, gold); m.scale.setScalar(2.5); m.position.set(s * 5.95, 1.1, THRONE.z + 2.6); m.rotation.y = -s * 0.25; root.add(m); }
  // small gilded spires (chedi) between them
  for (const x of [-4.1, 4.1]) {
    const c = new THREE.Mesh(new THREE.LatheGeometry([[0.36, 0], [0.36, 0.1], [0.28, 0.2], [0.33, 0.45], [0.3, 0.7], [0.12, 0.85], [0.08, 1.2], [0.02, 1.6]].map(([a, b]) => new THREE.Vector2(a, b)), 16), giltFlat);
    c.position.set(x, 1.1, THRONE.z + 3.95); root.add(c);
  }

  /* the altar: a white cloth, marigolds, jasmine, and room for candles; tall yellow candles either side */
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(ALTAR.hw * 2, 0.95, ALTAR.hd * 2), new THREE.MeshLambertMaterial({ color: '#f6f2ea' })); cloth.position.set(0, 0.475, ALTAR.z); root.add(cloth);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(ALTAR.hw * 2 + 0.04, 0.12, ALTAR.hd * 2 + 0.04), giltFlat); trim.position.set(0, 0.9, ALTAR.z); root.add(trim);
  const fl = []; const flc = [];
  for (const x of [-3.0, -1.4, 1.4, 3.0]) {
    const vase = new THREE.Mesh(new THREE.LatheGeometry([[0.1, 0], [0.16, 0.08], [0.18, 0.25], [0.1, 0.42], [0.14, 0.5]].map(([a, b]) => new THREE.Vector2(a, b)), 14), giltFlat); vase.position.set(x, 0.95, ALTAR.z); root.add(vase);
    for (let i = 0; i < 150; i++) { const a = Math.random() * 6.283, rr = Math.sqrt(Math.random()) * 0.4, hh = Math.random(); fl.push(x + Math.cos(a) * rr, 1.5 + hh * 0.5 - rr * 0.5, ALTAR.z + Math.sin(a) * rr * 0.8); const c = i % 5 === 0 ? C('#fffaf0') : C(Math.random() < 0.5 ? '#f2a516' : '#f7c51e'); flc.push(c.r, c.g, c.b); }
  }
  const flG = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.048, 1), new THREE.MeshLambertMaterial({ color: '#ffffff' }), fl.length / 3);
  for (let i = 0; i < fl.length / 3; i++) { flG.setMatrixAt(i, m4.makeTranslation(fl[i * 3], fl[i * 3 + 1], fl[i * 3 + 2])); flG.setColorAt(i, new THREE.Color(flc[i * 3], flc[i * 3 + 1], flc[i * 3 + 2])); }
  root.add(flG);
  const candleM = new THREE.MeshPhongMaterial({ color: '#e6c232', emissive: '#2a1e04', shininess: 30, specular: '#3a3220' });
  for (const [x, z] of CANDLES) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.3, 16), giltFlat); base.position.set(x, 0.15, z); root.add(base);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 2.2, 16), candleM); c.position.set(x, 1.4, z); root.add(c);
    glow(x, 2.62, z, 0.35, '#ffd070', 1); glow(x, 2.6, z, 1.6, '#ff9a3a', 0.35);
  }
  // the candles people light: they appear in rows along the altar
  regThing(cloth, 'Light a candle', lightCandle, { x: TO.x, z: TO.z + ALTAR.z + 2.4, r: 3.2 });
  regThing(buddha, 'Light a candle', lightCandle, { x: TO.x, z: TO.z + ALTAR.z + 2.4, r: 0.01 });
}

// the Buddha's surface: gold, a little darker in the curls and eyes, the sash a paler, jewelled gold
function paintBuddha(g) {
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i); let r = 1, gg = 1, b = 1;
    const hair = y > 0.785 - Math.max(0, -z) * 0.9 + Math.max(0, z - 0.05) * 0.4 && y > 0.66 && Math.abs(x) < 0.11;
    if (hair) { r = 0.78; gg = 0.72; b = 0.62; }
    for (const s of [-1, 1]) { const ex = (x - s * 0.034) / 0.03, ey = (y - 0.736) / 0.008; if (z > 0.08 && ex * ex + ey * ey < 1) { r = 0.32; gg = 0.24; b = 0.18; } }
    if (z > 0.08 && Math.abs(x) < 0.02 && Math.abs(y - 0.684) < 0.004) { r = 0.6; gg = 0.4; b = 0.3; }
    // the sash: near the line from the left shoulder to the waist
    const ax = 0.1, ay = 0.535, bx = 0.035, by = 0.27, t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
    if (Math.hypot(x - (ax + (bx - ax) * t), y - (ay + (by - ay) * t)) < 0.03 && z > 0.04) { const sp = (Math.sin(y * 260) * Math.sin(x * 260) > 0.3) ? 1.25 : 0.92; r = 0.95 * sp; gg = 0.93 * sp; b = 0.86 * sp; }
    col[i * 3] = r; col[i * 3 + 1] = gg; col[i * 3 + 2] = b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
}
function paintPlain(g) { if (!g.attributes.color) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3)); }

/* ---------- lighting a candle ---------- */
// lines from the Dhammapada in F. Max Müller's translation (1881), public domain
const VERSES = [
  'All that we are is the result of what we have thought.',
  'Hatred does not cease by hatred at any time: hatred ceases by love.',
  'As rain does not break through a well-thatched house, passion will not break through a well-reflecting mind.',
  'Better than a thousand hollow words is one word that brings peace.',
  'Even as a solid rock is unshaken by the wind, so are the wise unshaken by praise or blame.',
  'Let us live happily then, not hating those who hate us.',
  'Like a beautiful flower, full of colour but without scent, are the fine but fruitless words of him who does not act accordingly.',
];
let verse = 0;
function lightCandle() {
  if (litCount >= 28) { late.toast && late.toast('The altar is full of light.', 3000); return; }
  const i = litCount++, row = Math.floor(i / 14), k = i % 14, x = -ALTAR.hw + 0.3 + k * (ALTAR.hw * 2 - 0.6) / 13, z = ALTAR.z + 0.45 - row * 0.4;
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 8), new THREE.MeshLambertMaterial({ color: '#fbf3dc', emissive: '#3a2a10' })); c.position.set(x, 1.07, z); root.add(c);
  const f = glow(x, 1.22, z, 0.12, '#ffd070', 1), h = glow(x, 1.22, z, 0.7, '#ff9a3a', 0.3);
  candles.push({ f, h, ph: Math.random() * 6 });
  SFX.rin && SFX.rin();
  late.toast && late.toast(VERSES[verse++ % VERSES.length] + ' (the Dhammapada)', 6000);
}
addTick(dt => { if (state.world !== 'temple' || !candles.length) return; const t = performance.now() * 0.001; for (const c of candles) { const k = 1 + 0.12 * Math.sin(t * 9 + c.ph) + 0.06 * Math.sin(t * 23 + c.ph * 2); c.f.scale.set(0.1 * k, 0.15 * k, 1); c.h.material.opacity = 0.26 * k; } }, true);

// a singing bowl: a few inharmonic partials, slowly beating
SFX.rin = function () {
  const o = this.out(); if (!o) return; const ctx = late.Music.ctx, t = ctx.currentTime + 0.02;
  [[392, 0.5, 7], [394.5, 0.35, 7], [1083, 0.22, 4.5], [2091, 0.1, 2.6], [3326, 0.05, 1.6]].forEach(([f, a, d]) => {
    const os = ctx.createOscillator(), g = ctx.createGain(); os.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0008, t + d);
    os.connect(g); g.connect(o); os.start(t); os.stop(t + d + 0.1);
  });
};

/* ---------- walking inside ---------- */
const loc = (x, z) => [x - TO.x, z - TO.z];
worlds.temple = {
  scene: templeScene,
  name: 'The Temple of the Golden Buddha', sub: 'Walk through the carved hall to the Buddha. Light a candle at the altar. The door behind you leads back out.',
  arrive: { pos: TO.clone().add(new V3(0, 0, HALL_Z - 4.6)), yaw: 0 },
  floorH() { return 0; },
  blocked(x, z) {
    const [lx, lz] = loc(x, z);
    if (Math.abs(lx) > W - 0.5 || lz > HALL_Z - 0.6 || lz < SAN_Z + 0.6) return true;
    if (Math.abs(lz) < 0.7 && Math.abs(lx) > ARCH - 0.3) return true;
    if (lz < THRONE.z + 4.7 && Math.abs(lx) < 7) return true;
    if (Math.abs(lx) < ALTAR.hw + 0.35 && Math.abs(lz - ALTAR.z) < ALTAR.hd + 0.35) return true;
    for (const [px, pz] of HALL_PILLARS) if (Math.hypot(lx - px, lz - pz) < 1.25) return true;
    for (const [px, pz] of SAN_PILLARS) if (Math.abs(lx - px) < 1.15 && Math.abs(lz - pz) < 1.15) return true;
    for (const [px, pz] of CANDLES) if (Math.hypot(lx - px, lz - pz) < 0.6) return true;
    for (const s of [-1, 1]) if (Math.hypot(lx - s * (ARCH + 0.9), lz - 0.9) < 1.1) return true;
    return false;
  },
  enter() { build(); },
  leave() {},
};

/* ---------- the doors: the garden's pagoda opens onto the Japanese shrine (world/shrineInterior.js), the two on the hills (a bird can reach those) onto this temple ---------- */
// each door is an invisible panel over the pagoda's real door; its cue is in front of the steps
const doorM = new THREE.MeshBasicMaterial({ visible: false });
export const pagodaDoors = [];
function door(parent, cx, cz, yaw, s, y0, w, h, front, outside, world = 'temple') {
  const d = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.3), doorM);
  const c = Math.cos(yaw), sn = Math.sin(yaw), at = (lx, lz) => ({ x: cx + lx * c + lz * sn, z: cz - lx * sn + lz * c });
  const p = at(0, front * 0.62); d.position.set(p.x, y0 + h / 2, p.z); d.rotation.y = yaw; parent.add(d);
  const n = at(0, outside), out = at(0, outside + 0.6), face = Math.atan2(-(out.x - n.x), -(out.z - n.z));
  const info = { door: d, out: { pos: new V3(n.x, 0, n.z), yaw: face }, far: parent === templeGroup, world };
  regThing(d, 'Step inside the pagoda', () => late.enterTemple && late.enterTemple(info), { x: n.x, z: n.z, r: 2.6 * Math.max(0.8, s) });
  pagodaDoors.push(info);
}
{ const P = LANDMARKS.pagoda, yaw = Math.atan2(-P.x, -P.z); door(scene, P.x, P.z, yaw, 1, groundH(P.x, P.z) - 0.12 + 1.14, 1.7, 2.4, 3.6, 5.6, 'shrine'); }
addTick(() => { for (const d of pagodaDoors) if (d.far) d.door.visible = templeGroup.visible; }, true);
for (const B of BIG_PAGODAS) { const yaw = Math.atan2(-B.x, -B.z); door(templeGroup, B.x, B.z, yaw, B.s, groundH(B.x, B.z) - 0.3 + 1.2 * B.s, 1.9 * B.s, 2.9 * B.s, 4.1 * B.s, 7.2 * B.s); }
worlds.temple.doors = pagodaDoors;
