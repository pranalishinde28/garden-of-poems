import { rng } from '../core/util.js';

/* ================= painting the signs at the gate ================= */
// Two looks, after the owner's references: the garden's sign is a board of warm honey planks with deep
// brown, carved-looking lettering (dark on light, so it reads from the path); the QR board is a garden-centre
// chalkboard in a green painted frame, with chalk-white lettering. Both are drawn on canvases here.

export const serif = (w, px, it = '') => `${it}${w} ${px}px "Cormorant Garamond", Georgia, serif`;
// the largest size (down to min) at which text fits maxW
export function fit(g, text, maxW, w, px, min, it = '') { g.font = serif(w, px, it); while (g.measureText(text).width > maxW && px > min) { px -= 4; g.font = serif(w, px, it); } return px; }
export function wrap(g, text, maxW) { const words = String(text).split(/\s+/), lines = []; let line = ''; words.forEach(w => { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }); if (line) lines.push(line); return lines; }

// honey-coloured planks laid across, each with its own grain, knots, seams and softly darkened edges
export function planks(g, W, H, n = 4, seed = 5) {
  const R = rng(seed), ph = H / n;
  for (let i = 0; i < n; i++) {
    const y0 = i * ph, base = [['#a8693a', '#94592e'], ['#b07240', '#9a5f32'], ['#a26538', '#8c542b']][i % 3];
    const gr = g.createLinearGradient(0, y0, 0, y0 + ph); gr.addColorStop(0, base[0]); gr.addColorStop(1, base[1]); g.fillStyle = gr; g.fillRect(0, y0, W, ph);
    g.lineWidth = 2;
    for (let k = 0; k < 16; k++) { const y = y0 + 6 + R() * (ph - 12); g.strokeStyle = `rgba(110,62,24,${0.12 + R() * 0.18})`; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= W; x += W / 8) g.lineTo(x, y + Math.sin(x * 0.004 + k + i) * (3 + R() * 5)); g.stroke(); }
    for (let k = 0; k < 2; k++) { const x = 60 + R() * (W - 120), y = y0 + ph * (0.3 + R() * 0.4); g.fillStyle = 'rgba(95,52,20,.35)'; g.beginPath(); g.ellipse(x, y, 16 + R() * 10, 7 + R() * 4, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(95,52,20,.25)'; g.beginPath(); g.ellipse(x, y, 28 + R() * 10, 13, 0, 0, 7); g.stroke(); }
    // the seam and a highlight along each plank's top
    g.fillStyle = 'rgba(70,36,14,.55)'; g.fillRect(0, y0, W, 5); g.fillStyle = 'rgba(255,220,170,.35)'; g.fillRect(0, y0 + 5, W, 3);
  }
  const e = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  e.addColorStop(0, 'rgba(0,0,0,0)'); e.addColorStop(1, 'rgba(70,34,10,.38)'); g.fillStyle = e; g.fillRect(0, 0, W, H);
}
// deep brown lettering with a pale lower edge, as if carved into the wood
export function carved(g, text, x, y) {
  const fill = g.fillStyle;
  g.fillStyle = 'rgba(255,226,180,.6)'; g.fillText(text, x, y + 5);
  g.fillStyle = fill; g.fillText(text, x, y);
}

// a slate chalkboard inside a green painted wooden frame, with a haze of old chalk
export function chalkboard(g, W, H, frame = 54, seed = 7) {
  const R = rng(seed);
  g.fillStyle = '#2f6a45'; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(15,45,25,.35)'; g.lineWidth = 2; for (let i = 0; i < 40; i++) { const vert = i % 2, p = R() * (vert ? W : H); g.beginPath(); if (vert) { g.moveTo(p, 0); g.lineTo(p + (R() - 0.5) * 6, H); } else { g.moveTo(0, p); g.lineTo(W, p + (R() - 0.5) * 6); } g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, 0, W, 6); g.fillRect(0, 0, 6, H);
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(frame - 8, frame - 8, W - 2 * frame + 16, H - 2 * frame + 16);
  const x0 = frame, y0 = frame, w = W - 2 * frame, h = H - 2 * frame;
  const s = g.createLinearGradient(0, y0, 0, y0 + h); s.addColorStop(0, '#2b3532'); s.addColorStop(1, '#232b29'); g.fillStyle = s; g.fillRect(x0, y0, w, h);
  for (let i = 0; i < 26; i++) { const x = x0 + R() * w, y = y0 + R() * h, r = 40 + R() * 120, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(230,235,230,.05)'); gr.addColorStop(1, 'rgba(230,235,230,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  return { x0, y0, w, h };
}
// chalk lettering: solid strokes with the grain of the board showing through
export function chalk(g, text, x, y, col = '#f6f3ea') {
  g.fillStyle = col; g.fillText(text, x, y);
  const m = g.measureText(text), w = m.width, a = (m.actualBoundingBoxAscent || 40) + 4, d = (m.actualBoundingBoxDescent || 10) + 4;
  const left = g.textAlign === 'center' ? x - w / 2 : g.textAlign === 'right' ? x - w : x, R = rng(text.length * 31 + (x | 0));
  g.save(); g.globalCompositeOperation = 'destination-out'; g.fillStyle = 'rgba(0,0,0,.35)';
  // the grain only nicks the lettering here and there; it stays solid enough to read
  for (let i = 0; i < w * (a + d) / 260; i++) g.fillRect(left + R() * w, y - a + R() * (a + d), 1.5 + R() * 2, 1 + R());
  g.restore();
}
// a little chalk sprig of leaves and a flower, for the corners
export function chalkSprig(g, x, y, s, flip, col = 'rgba(246,243,234,.85)', flower = '#f7b9cd') {
  g.save(); g.translate(x, y); g.scale(flip ? -s : s, s); g.strokeStyle = col; g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(60, -10, 110, -50); g.stroke();
  for (const [t, side] of [[0.3, 1], [0.5, -1], [0.7, 1], [0.85, -1]]) { const px = 110 * t, py = -50 * t * t - 8 * t; g.beginPath(); g.ellipse(px + 8, py + side * 12, 16, 6, side * 0.6 - 0.4, 0, 7); g.stroke(); }
  g.fillStyle = flower; for (let k = 0; k < 5; k++) { const a = k / 5 * 6.283; g.beginPath(); g.ellipse(116 + Math.cos(a) * 9, -54 + Math.sin(a) * 9, 8, 5, a, 0, 7); g.fill(); }
  g.fillStyle = '#f2d36b'; g.beginPath(); g.arc(116, -54, 4, 0, 7); g.fill();
  g.restore();
}
export function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

/* ---------- a garland of leaves and blossom along a sign's top (cards; no round blobs) ---------- */
import * as THREE from 'three';
const leafCanvas = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), R = rng(61);
  // a spray of long glossy leaves with pale midribs, radiating from the lower middle
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i - 4) * 0.33 + (R() - 0.5) * 0.15, L = 95 + R() * 25;
    g.save(); g.translate(128, 210); g.rotate(a + Math.PI / 2);
    const col = ['#3f7d32', '#4d8f3a', '#356b2b', '#5a9c42'][i % 4];
    g.fillStyle = col; g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(L * 0.28, -L * 0.25, L * 0.24, -L * 0.8, 0, -L); g.bezierCurveTo(-L * 0.24, -L * 0.8, -L * 0.28, -L * 0.25, 0, 0); g.fill();
    g.strokeStyle = 'rgba(210,240,180,.6)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, -4); g.lineTo(0, -L * 0.94); g.stroke();
    g.strokeStyle = 'rgba(210,240,180,.3)'; g.lineWidth = 1.5; for (let k = 1; k < 6; k++) { const y = -L * k / 6.5; g.beginPath(); g.moveTo(0, y); g.lineTo(L * 0.17, y - L * 0.08); g.moveTo(0, y); g.lineTo(-L * 0.17, y - L * 0.08); g.stroke(); }
    g.restore();
  }
  return c;
})();
const blossomCanvas = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), R = rng(62);
  for (let i = 0; i < 7; i++) { const x = 30 + R() * 68, y = 30 + R() * 68, col = ['#f7b9cd', '#fbe4ec', '#f39cb8'][i % 3]; g.fillStyle = col; for (let k = 0; k < 5; k++) { const a = k / 5 * 6.283 + R(); g.beginPath(); g.ellipse(x + Math.cos(a) * 9, y + Math.sin(a) * 9, 10, 7, a, 0, 7); g.fill(); } g.fillStyle = '#e9b04a'; g.beginPath(); g.arc(x, y, 3.5, 0, 7); g.fill(); }
  return c;
})();
let garlandMats = null;
export function garland(width, height, seed = 9) {
  if (!garlandMats) {
    const mk = cv => { const t = new THREE.CanvasTexture(cv); return new THREE.MeshLambertMaterial({ map: t, alphaTest: 0.45, side: THREE.DoubleSide }); };
    garlandMats = [mk(leafCanvas), mk(blossomCanvas)];
  }
  const R = rng(seed), grp = new THREE.Group(), card = new THREE.PlaneGeometry(1, 1);
  const add = (mat, x, y, z, s, rz, ry = 0) => { const m = new THREE.Mesh(card, mat); m.position.set(x, y, z); m.scale.setScalar(s); m.rotation.set(0, ry, rz); grp.add(m); };
  // sprays along the top, fuller at the two corners, tumbling a little down the sides
  const n = Math.round(width / 0.3);
  for (let i = 0; i <= n; i++) { const x = -width / 2 + width * i / n + (R() - 0.5) * 0.1; add(garlandMats[0], x, height + 0.08 + R() * 0.08, 0.06 + (R() - 0.5) * 0.06, 0.42 + R() * 0.18, (R() - 0.5) * 0.9, (R() - 0.5) * 0.5); }
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 5; k++) add(garlandMats[0], sx * (width / 2 - 0.05 + R() * 0.12), height - k * 0.17, 0.07, 0.4 + R() * 0.15, sx * (0.9 + R() * 0.8), (R() - 0.5) * 0.4);
    for (let k = 0; k < 4; k++) add(garlandMats[1], sx * (width / 2 - 0.12 - R() * 0.3), height + 0.05 - R() * 0.3, 0.12, 0.2 + R() * 0.08, R() * 6);
  }
  for (let i = 0; i < Math.round(width * 2.2); i++) add(garlandMats[1], -width / 2 + R() * width, height + 0.12 + R() * 0.1, 0.13, 0.17 + R() * 0.07, R() * 6);
  return grp;
}
