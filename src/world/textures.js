import * as THREE from 'three';
import { C, rng } from '../core/util.js';
import { maxAniso } from './renderer.js';

/* ---------- procedural textures ---------- */
export function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.anisotropy = Math.min(8, maxAniso);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function radialTex(stops, size = 128) {
  return canvasTex(size, size, (g, s) => { const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); stops.forEach(([o, col]) => gr.addColorStop(o, col)); g.fillStyle = gr; g.fillRect(0, 0, s, s); });
}
export const glowTex = radialTex([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']], 64);
export const softTex = radialTex([[0, 'rgba(255,255,255,.9)'], [0.5, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']], 128);
export const groundTex = canvasTex(1024, 1024, (g, S) => {
  g.fillStyle = 'rgb(206,210,190)'; g.fillRect(0, 0, S, S);
  const R = rng(41);
  const wrap = (x, y, r, fn) => { fn(x, y); if (x < r) fn(x + S, y); if (x > S - r) fn(x - S, y); if (y < r) fn(x, y + S); if (y > S - r) fn(x, y - S); };
  for (let i = 0; i < 300; i++) { const x = R() * S, y = R() * S, r = 25 + R() * 80, sh = 165 + R() * 80; wrap(x, y, r, (xx, yy) => { const gr = g.createRadialGradient(xx, yy, 0, xx, yy, r); gr.addColorStop(0, `rgba(${sh * 0.93 | 0},${sh | 0},${sh * 0.78 | 0},0.32)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(xx - r, yy - r, 2 * r, 2 * r); }); }
  for (let i = 0; i < 1800; i++) { const x = R() * S, y = R() * S; g.fillStyle = `rgba(${115 + R() * 60 | 0},${105 + R() * 50 | 0},${85 + R() * 40 | 0},0.45)`; g.beginPath(); g.arc(x, y, 0.6 + R() * 1.6, 0, 7); g.fill(); }
  for (let i = 0; i < 46000; i++) {
    const x = R() * S, y = R() * S, l = 3 + R() * 10, a = -Math.PI / 2 + (R() - 0.5) * 1.5, sh = 135 + R() * 115;
    g.strokeStyle = `rgba(${sh - 28 | 0},${sh | 0},${sh - 55 | 0},${0.22 + R() * 0.45})`; g.lineWidth = 0.7 + R() * 1.3;
    wrap(x, y, 12, (xx, yy) => { g.beginPath(); g.moveTo(xx, yy); g.quadraticCurveTo(xx + Math.cos(a) * l * 0.5 + (R() - .5) * 2, yy + Math.sin(a) * l * 0.5, xx + Math.cos(a) * l, yy + Math.sin(a) * l); g.stroke(); });
  }
  for (let i = 0; i < 700; i++) { const x = R() * S, y = R() * S, r = 2 + R() * 2.5, sh = 120 + R() * 60; g.fillStyle = `rgba(${sh * 0.6 | 0},${sh | 0},${sh * 0.5 | 0},.7)`; for (let k = 0; k < 3; k++) { const a = k * 2.09; g.beginPath(); g.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.8, 0, 7); g.fill(); } }
}, true);
function drawBlossom(g, R, x, y, r, rot, edge) {
  for (let i = 0; i < 5; i++) {
    g.save(); g.translate(x, y); g.rotate(rot + i * Math.PI * 2 / 5);
    const gr = g.createLinearGradient(0, 0, 0, -r); gr.addColorStop(0, '#fff3f6'); gr.addColorStop(0.5, '#fbd3df'); gr.addColorStop(1, edge);
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0);
    g.bezierCurveTo(-r * 0.62, -r * 0.3, -r * 0.56, -r * 0.95, -r * 0.15, -r); g.lineTo(0, -r * 0.84); g.lineTo(r * 0.15, -r);
    g.bezierCurveTo(r * 0.56, -r * 0.95, r * 0.62, -r * 0.3, 0, 0); g.fill();
    g.strokeStyle = 'rgba(220,140,160,.25)'; g.lineWidth = 0.6; g.stroke();
    g.restore();
  }
  g.fillStyle = 'rgba(205,80,112,.85)'; g.beginPath(); g.arc(x, y, r * 0.17, 0, 7); g.fill();
  g.strokeStyle = 'rgba(214,120,140,.9)'; g.lineWidth = 0.8;
  for (let k = 0; k < 8; k++) { const a = R() * 6.28, l = r * (0.32 + R() * 0.18); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); g.fillStyle = '#f2cf73'; g.beginPath(); g.arc(x + Math.cos(a) * l, y + Math.sin(a) * l, 1.3, 0, 7); g.fill(); }
}
export const blossomTex = canvasTex(256, 256, (g) => {
  const R = rng(31);
  g.strokeStyle = 'rgba(78,52,48,.85)'; g.lineCap = 'round';
  for (let i = 0; i < 3; i++) { g.lineWidth = 2.5 - i * 0.6; g.beginPath(); const x = 60 + R() * 140; g.moveTo(x, 250); g.quadraticCurveTo(x + (R() - .5) * 120, 140, 40 + R() * 180, 20 + R() * 60); g.stroke(); }
  for (let i = 0; i < 64; i++) { // denser clusters
    const x = 34 + R() * 188, y = 34 + R() * 188; if (Math.hypot(x - 128, y - 128) > 108) continue;
    const pick = R(), edge = pick < .33 ? '#ee8fae' : pick < .66 ? '#f4a9c1' : '#e6789e';
    drawBlossom(g, R, x, y, 12 + R() * 12, R() * 6.28, edge);
  }
  for (let k = 0; k < 10; k++) { const x = 30 + R() * 196, y = 30 + R() * 196; if (Math.hypot(x - 128, y - 128) > 110) continue; g.fillStyle = '#e57f9f'; g.beginPath(); g.ellipse(x, y, 4, 6, R() * 3, 0, 7); g.fill(); }
});
export function racemeTex(top, low, seed) {
  return canvasTex(128, 384, (g) => {
    const R = rng(seed), a = C(top), b = C(low), c = new THREE.Color();
    g.strokeStyle = '#5f6f3c'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(64, 0); g.quadraticCurveTo(60, 180, 66, 372); g.stroke();
    for (let k = 0; k < 200; k++) {
      const t = Math.pow(k / 200, 0.9), y = 14 + t * 360, spread = (1 - t) * 40 + 4, x = 64 + (R() - .5) * spread * 2 * (0.6 + 0.4 * R()), r = (1 - t) * 6.5 + 2.2;
      c.copy(a).lerp(b, Math.pow(t, 1.2)); c.offsetHSL((R() - .5) * 0.02, 0, (R() - .5) * 0.1);
      g.fillStyle = '#' + c.getHexString(); g.beginPath(); g.ellipse(x, y, r * 1.25, r * 0.95, (R() - .5) * 0.8, 0, 7); g.fill();
      c.offsetHSL(0, 0, 0.12); g.fillStyle = '#' + c.getHexString(); g.beginPath(); g.ellipse(x + (R() - .5) * r * 0.5, y - r * 0.35, r * 0.6, r * 0.45, 0, 0, 7); g.fill();
      if (t < 0.7 && R() < 0.5) { g.fillStyle = 'rgba(250,240,190,.8)'; g.beginPath(); g.arc(x, y - r * 0.2, r * 0.18, 0, 7); g.fill(); }
    }
  });
}
export const wisTexP = racemeTex('#d8c8f2', '#6a4fa8', 57);
export const wisTexW = racemeTex('#fdfbf6', '#ddd2ea', 58);
export const mapleTex = canvasTex(256, 256, (g) => {
  const R = rng(83);
  g.strokeStyle = 'rgba(70,50,40,.8)'; g.lineCap = 'round';
  for (let i = 0; i < 3; i++) { g.lineWidth = 2 - i * 0.4; g.beginPath(); const x = 60 + R() * 140; g.moveTo(x, 250); g.quadraticCurveTo(x + (R() - .5) * 120, 140, 40 + R() * 180, 20 + R() * 60); g.stroke(); }
  for (let i = 0; i < 44; i++) {
    const x = 30 + R() * 196, y = 30 + R() * 196; if (Math.hypot(x - 128, y - 128) > 110) continue;
    const r = 12 + R() * 12, sh = 205 + R() * 50;
    g.save(); g.translate(x, y); g.rotate(R() * 6.28); g.fillStyle = `rgb(${sh | 0},${sh * 0.97 | 0},${sh * 0.93 | 0})`; g.beginPath();
    for (let k = 0; k <= 14; k++) { const a = -Math.PI / 2 + k / 14 * Math.PI * 2, rr = k % 2 === 0 ? r : r * 0.42, px = Math.cos(a) * rr, py = Math.sin(a) * rr; k ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(110,90,80,.35)'; g.lineWidth = 0.8; for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + k / 7 * Math.PI * 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85); g.stroke(); }
    g.restore();
  }
});
export const barkTex = canvasTex(128, 256, (g, w, h) => {
  g.fillStyle = 'rgb(214,208,202)'; g.fillRect(0, 0, w, h); const R = rng(97);
  for (let i = 0; i < 280; i++) { const x = R() * w, y = R() * h, l = 10 + R() * 40, sh = 120 + R() * 90; g.strokeStyle = `rgba(${sh | 0},${sh * 0.95 | 0},${sh * 0.9 | 0},${0.4 + R() * 0.4})`; g.lineWidth = 1 + R() * 2.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - .5) * 4, y + l); g.stroke(); }
  for (let i = 0; i < 130; i++) { g.fillStyle = 'rgba(90,80,75,.5)'; g.fillRect(R() * w, R() * h, 4 + R() * 8, 1.3); }
}, true);

