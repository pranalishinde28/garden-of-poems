import * as THREE from 'three';
import { C, V3, rng, smooth } from '../core/util.js';
import { T, state } from '../core/state.js';
import { canvasTex } from './textures.js';
import { GEO, Merge } from './geometry.js';
import { worlds } from '../core/worlds.js';
import { addTick, regThing } from '../core/things.js';
import { late } from '../core/late.js';
import { player } from '../player/camera.js';
import { CASTLE, FAIR_RIDES, O, rides, sunH, sunScene } from './sunWorld.js';

/* ================= the Hall of Mirrors, inside the castle; and two rides out at the fair ================= */
// Walk through the castle's gate and you are inside a great gilded gallery after the Hall of Mirrors at
// Versailles: arched mirrors (west) face arched windows (east) between pilasters of red-veined marble with
// gilded capitals, each arch framed in gold under a gilded trophy; a gilded cornice carries a barrel vault
// painted as a baroque sky, golden light breaking through clouds and figures in rose, blue and gold drapery;
// crystal chandeliers hang down the middle round one great chandelier; gilded candelabra, marble busts and
// framed paintings stand along the walls over a parquet floor. Nothing to ride in here: it is a place to walk.
// The teacups and the drop tower stand outside at the fair (the end of this file).
// The hall is part of the secret world's scene, far below and away from the fair, shown only while you are
// inside; you walk in through the castle's gate and out through the gallery's door, no prompts.

const R = rng(9191);
export const HALL = { x: 420, z: -60, y: -90, hw: 22, hl: 88, wall: 17, vault: 22, rise: 0.62, bay: 8 };
const hall = new THREE.Group(); hall.position.set(O.x + HALL.x, O.y + HALL.y, O.z + HALL.z); hall.visible = false; sunScene.add(hall);
const W = (x, z) => new V3(O.x + HALL.x + x, O.y + HALL.y, O.z + HALL.z + z);
const gilt = new THREE.MeshPhongMaterial({ vertexColors: true, color: '#d8c49a', specular: '#8a6a2a', shininess: 40, emissive: '#2a1c08', emissiveIntensity: 0.6, fog: false });
const bulbs = [];
const bulb = (x, y, z, col) => { const c = new THREE.Color(col); bulbs.push(x, y, z, c.r, c.g, c.b); };
const GOLD = C('#d4a63a'), GOLD2 = C('#e8c25a'), IVORY = C('#efe6d2');

/* ---------- painting: a baroque sky with figures, drawn on a canvas ---------- */
// golden light breaking through the middle, banks of cloud round it, and figures borne on the clouds in
// rose, blue, crimson, green and gold drapery, some winged, some with trumpets or staffs; softly painted
function baroque(g, x0, y0, w, h, seed) {
  const RS = rng(seed), cx = x0 + w / 2, cy = y0 + h / 2, M = Math.min(w, h), rr = Math.max(w, h) * 0.62;
  g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
  // the sky: golden light at the heart, deepening to blue, darker at the rim
  const sky = g.createRadialGradient(cx, cy, 0, cx, cy, rr);
  sky.addColorStop(0, '#fff8e0'); sky.addColorStop(0.16, '#f8e2a8'); sky.addColorStop(0.38, '#b9d0e8'); sky.addColorStop(0.7, '#7d9cc8'); sky.addColorStop(1, '#5a5266');
  g.fillStyle = sky; g.fillRect(x0, y0, w, h);
  // rays of light from the heart
  g.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 18; k++) { const a = k / 18 * Math.PI * 2 + RS() * 0.2; g.fillStyle = 'rgba(255,235,180,.05)'; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, rr, a, a + 0.08); g.closePath(); g.fill(); }
  g.globalCompositeOperation = 'source-over';
  // a cloud: many soft puffs, lit warm from the heart, shadowed blue-grey away from it
  const cloud = (x, y, r, n) => {
    for (let k = 0; k < n; k++) {
      const px = x + (RS() - 0.5) * r * 1.8, py = y + (RS() - 0.5) * r * 0.8, pr = r * (0.35 + RS() * 0.45), toward = Math.atan2(cy - py, cx - px);
      const gr = g.createRadialGradient(px + Math.cos(toward) * pr * 0.35, py + Math.sin(toward) * pr * 0.35, pr * 0.1, px, py, pr);
      gr.addColorStop(0, 'rgba(255,246,228,.95)'); gr.addColorStop(0.55, 'rgba(226,214,206,.8)'); gr.addColorStop(1, 'rgba(120,118,140,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(px, py, pr, 0, 7); g.fill();
    }
  };
  // a figure: a shaded swirl of drapery, skin with light and shade, hair, an arm reaching; sometimes wings,
  // a trumpet or a staff. s is its size in pixels
  const DRAPE = [['#e7a0b4', '#a8506a'], ['#7fa6dc', '#2e4c88'], ['#d8443e', '#7a1a22'], ['#f2d27a', '#a87a22'], ['#86b07a', '#3e623a'], ['#c09ad8', '#5a3a7a']];
  const figure = (x, y, s, rot) => {
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(s / 60, s / 60);
    if (RS() < 0.35) for (const sd of [-1, 1]) { const wg = g.createLinearGradient(0, -10, sd * 46, -30); wg.addColorStop(0, '#fffaf0'); wg.addColorStop(1, RS() < 0.5 ? '#d8d0c8' : '#8a7a7a'); g.fillStyle = wg; g.beginPath(); g.moveTo(0, -12); g.bezierCurveTo(sd * 20, -48, sd * 52, -40, sd * 54, -10); g.bezierCurveTo(sd * 36, -18, sd * 18, -8, 0, -2); g.fill(); }
    const [lite, dark] = DRAPE[(RS() * DRAPE.length) | 0], dg = g.createLinearGradient(-24, -10, 26, 40); dg.addColorStop(0, lite); dg.addColorStop(1, dark);
    g.fillStyle = dg; g.beginPath(); g.moveTo(-14, -8); g.bezierCurveTo(-40, 6, -30, 44, 2, 50); g.bezierCurveTo(30, 52, 44, 22, 18, -6); g.bezierCurveTo(10, -14, -6, -14, -14, -8); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-8, 0); g.bezierCurveTo(-20, 16, -14, 34, 0, 40); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.moveTo(10, 4); g.bezierCurveTo(20, 18, 16, 34, 6, 42); g.stroke();
    const sk = g.createLinearGradient(-8, -30, 8, -2); sk.addColorStop(0, '#fbe2cc'); sk.addColorStop(1, '#d8a888');
    g.fillStyle = sk; g.beginPath(); g.ellipse(0, -10, 9, 12, 0.1, 0, 7); g.fill(); g.beginPath(); g.arc(1, -27, 7.5, 0, 7); g.fill();
    g.fillStyle = ['#5a3a1e', '#a8783a', '#e0c070'][(RS() * 3) | 0]; g.beginPath(); g.arc(0, -29.5, 7.8, Math.PI * 1.05, Math.PI * 1.95); g.fill();
    g.strokeStyle = '#e8bc9c'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(6, -14); g.quadraticCurveTo(18, -24, 26 + RS() * 8, -34 - RS() * 8); g.stroke();
    if (RS() < 0.3) { g.strokeStyle = '#e8c25a'; g.lineWidth = 3.5; g.beginPath(); g.moveTo(26, -34); g.lineTo(46, -56); g.stroke(); g.fillStyle = '#e8c25a'; g.beginPath(); g.arc(47, -57, 5, 0, 7); g.fill(); }
    g.restore();
  };
  // great banks of cloud round the light, with figures gathered on them in groups
  const groups = 5 + ((RS() * 3) | 0);
  for (let k = 0; k < groups; k++) {
    const a = k / groups * Math.PI * 2 + RS() * 0.6, d = M * (0.24 + RS() * 0.12), gx = cx + Math.cos(a) * d * (w > h ? w / h * 0.85 : 1), gy = cy + Math.sin(a) * d * (h > w ? h / w * 0.85 : 1);
    cloud(gx, gy + M * 0.04, M * 0.11, 22);
    const n = 3 + ((RS() * 3) | 0);
    for (let f = 0; f < n; f++) figure(gx + (RS() - 0.5) * M * 0.16, gy + (RS() - 0.5) * M * 0.08 - M * 0.02, M * (0.07 + RS() * 0.04), a + Math.PI / 2 + (RS() - 0.5) * 0.8);
    cloud(gx + (RS() - 0.5) * M * 0.1, gy + M * 0.08, M * 0.07, 10);
  }
  // a radiant figure in gold at the heart of the light
  g.save(); g.globalAlpha = 0.9; figure(cx, cy, M * 0.09, RS() * 0.4 - 0.2); g.restore();
  const glow = g.createRadialGradient(cx, cy, 0, cx, cy, M * 0.12); glow.addColorStop(0, 'rgba(255,240,190,.55)'); glow.addColorStop(1, 'rgba(255,240,190,0)'); g.fillStyle = glow; g.fillRect(cx - M * 0.12, cy - M * 0.12, M * 0.24, M * 0.24);
  // a warm varnish
  const vg = g.createRadialGradient(cx, cy, rr * 0.25, cx, cy, rr); vg.addColorStop(0, 'rgba(255,230,180,0)'); vg.addColorStop(1, 'rgba(80,50,30,.4)'); g.fillStyle = vg; g.fillRect(x0, y0, w, h);
  g.restore();
}
// a gilded frame drawn round a painting
function frame(g, x, y, w, h, t) {
  for (let k = 0; k < t; k += 2) { const c = 0.65 + 0.35 * Math.sin(k / t * Math.PI); g.strokeStyle = `rgb(${215 * c | 0},${168 * c | 0},${62 * c | 0})`; g.lineWidth = 2; g.strokeRect(x - k, y - k, w + 2 * k, h + 2 * k); }
}

/* ---------- the walls: painted arches behind 3D pilasters, arch frames, trophies and cornice ---------- */
// one bay painted: a cream marble field round a tall arch; in the arch, mirror panes (west) or a window (east)
function bayTex(mirror) {
  return canvasTex(512, 1024, (g, w, h) => {
    const RS = rng(mirror ? 11 : 12);
    g.fillStyle = '#ece2cc'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(160,140,110,.18)'; g.lineWidth = 1.5; for (let k = 0; k < 30; k++) { g.beginPath(); let x = RS() * w, y = RS() * h; g.moveTo(x, y); for (let s = 0; s < 5; s++) { x += (RS() - 0.5) * 60; y += 20 + RS() * 40; g.lineTo(x, y); } g.stroke(); }
    // green marble panels low down
    g.fillStyle = '#5a7a62'; g.fillRect(70, h - 150, w - 140, 90); g.strokeStyle = '#d4a63a'; g.lineWidth = 6; g.strokeRect(70, h - 150, w - 140, 90);
    const ax = 96, aw = w - 192, top = 150, bot = h - 170, r = aw / 2;
    g.save(); g.beginPath(); g.moveTo(ax, bot); g.lineTo(ax, top + r); g.arc(ax + r, top + r, r, Math.PI, 0); g.lineTo(ax + aw, bot); g.closePath(); g.clip();
    if (mirror) {
      // old mirror glass: a dim silvered field reflecting the gallery's gold and candlelight, in 21 bevelled panes
      const gr = g.createLinearGradient(0, top, 0, bot); gr.addColorStop(0, '#8a8478'); gr.addColorStop(0.45, '#6e6a62'); gr.addColorStop(1, '#8a8070'); g.fillStyle = gr; g.fillRect(ax, top, aw, bot - top);
      for (let k = 0; k < 14; k++) { const x = ax + RS() * aw, y = top + RS() * (bot - top) * 0.7, rad = 18 + RS() * 30; const rg = g.createRadialGradient(x, y, 0, x, y, rad); rg.addColorStop(0, 'rgba(255,225,160,.9)'); rg.addColorStop(1, 'rgba(255,225,160,0)'); g.fillStyle = rg; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
      g.fillStyle = 'rgba(212,166,58,.35)'; g.fillRect(ax, top + (bot - top) * 0.55, aw, (bot - top) * 0.12);
      const cols = 3, rows = 7, pw = aw / cols, ph = (bot - top) / rows;
      for (let i = 0; i <= cols; i++) { g.fillStyle = '#c99a32'; g.fillRect(ax + i * pw - 3, top, 6, bot - top); }
      for (let j = 0; j <= rows; j++) { g.fillStyle = '#c99a32'; g.fillRect(ax, top + j * ph - 3, aw, 6); }
      g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 2; for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) g.strokeRect(ax + i * pw + 6, top + j * ph + 6, pw - 12, ph - 12);
    } else {
      // a tall window onto the garden: sky, a line of trees, the light pouring in
      const gr = g.createLinearGradient(0, top, 0, bot); gr.addColorStop(0, '#dfeaf4'); gr.addColorStop(0.62, '#c9dcea'); gr.addColorStop(0.7, '#8aa880'); gr.addColorStop(1, '#6a8a5a'); g.fillStyle = gr; g.fillRect(ax, top, aw, bot - top);
      for (let k = 0; k < 8; k++) { g.fillStyle = 'rgba(70,100,60,.7)'; g.beginPath(); g.ellipse(ax + RS() * aw, top + (bot - top) * 0.66, 20 + RS() * 20, 30 + RS() * 20, 0, 0, 7); g.fill(); }
      g.fillStyle = '#e8dcc0'; const cols = 3, rows = 8, pw = aw / cols, ph = (bot - top) / rows;
      for (let i = 0; i <= cols; i++) g.fillRect(ax + i * pw - 4, top, 8, bot - top); for (let j = 0; j <= rows; j++) g.fillRect(ax, top + j * ph - 3, aw, 6);
    }
    g.restore();
  }, true);
}
// red-veined marble for the pilasters
const marbleTex = canvasTex(128, 512, (g, w, h) => {
  const RS = rng(77), gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#6e2c2a'); gr.addColorStop(0.5, '#93413c'); gr.addColorStop(1, '#6a2a28'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let k = 0; k < 26; k++) { g.strokeStyle = `rgba(${230 + RS() * 25 | 0},${200 + RS() * 30 | 0},190,${0.25 + RS() * 0.35})`; g.lineWidth = 0.8 + RS() * 2; g.beginPath(); let x = RS() * w, y = RS() * h; g.moveTo(x, y); for (let s = 0; s < 8; s++) { x += (RS() - 0.5) * 40; y += 10 + RS() * 30; g.lineTo(x, y); } g.stroke(); }
}, true);
{
  const bays = Math.round(HALL.hl * 2 / HALL.bay), m = new Merge(), pil = new Merge();
  for (const [side, mirror] of [[-1, true], [1, false]]) {
    const t = bayTex(mirror); t.repeat.set(bays, 1);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(HALL.hl * 2, HALL.wall), new THREE.MeshLambertMaterial({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: mirror ? 0.28 : 0.42, color: '#d8ccb4', fog: false }));
    wall.position.set(side * HALL.hw, HALL.wall / 2, 0); wall.rotation.y = -side * Math.PI / 2; hall.add(wall);
    const x = side * HALL.hw;
    for (let i = 0; i <= bays; i++) {
      const z = -HALL.hl + i * HALL.bay;
      // a pilaster of red marble standing out from the wall: white marble base, gilded capital with volutes
      pil.add(GEO.box, new V3(x - side * 0.28, HALL.wall / 2 - 0.3, z), new V3(0.56, HALL.wall - 2.4, 1.5), C('#ffffff'));
      m.add(GEO.box, new V3(x - side * 0.34, 0.75, z), new V3(0.7, 1.5, 1.8), IVORY);
      m.add(GEO.box, new V3(x - side * 0.36, HALL.wall - 1.7, z), new V3(0.72, 0.9, 1.9), GOLD);
      for (const o of [-0.8, 0.8]) m.add(GEO.sph, new V3(x - side * 0.6, HALL.wall - 1.5, z + o), new V3(0.22, 0.28, 0.22), GOLD2);
      if (i === bays) continue;
      // the arch's gilded frame, a trophy of arms above it, and gilded leaves either side
      const zc = z + HALL.bay / 2, ar = 2.7 * HALL.bay / 8, spring = HALL.wall * 0.62;
      m.add(new THREE.TorusGeometry(ar, 0.16, 6, 28, Math.PI).rotateY(Math.PI / 2), new V3(x - side * 0.08, spring, zc), new V3(1, 1, 1), GOLD);
      for (const o of [-ar, ar]) m.add(GEO.box, new V3(x - side * 0.08, (spring + 1.6) / 2, zc + o), new V3(0.16, spring - 1.6, 0.3), GOLD);
      m.add(GEO.sph, new V3(x - side * 0.25, spring + ar + 1.0, zc), new V3(0.25, 0.75, 0.6), GOLD2);
      for (const o of [-1, 1]) { m.add(GEO.box, new V3(x - side * 0.2, spring + ar + 0.9, zc + o * 0.9), new V3(0.18, 0.12, 1.1), GOLD, new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), o * 0.5)); for (let k = 0; k < 5; k++) m.add(GEO.sph, new V3(x - side * 0.2, spring + ar + 0.3 - k * 0.12, zc + o * (0.6 + k * 0.32)), new V3(0.12, 0.12, 0.12), GOLD2); }
    }
    // the gilded entablature and cornice the vault rests on, and a skirting of white marble
    m.add(GEO.box, new V3(x - side * 0.45, HALL.wall - 0.8, 0), new V3(0.9, 0.9, HALL.hl * 2), GOLD);
    m.add(GEO.box, new V3(x - side * 0.7, HALL.wall - 0.15, 0), new V3(1.4, 0.4, HALL.hl * 2), GOLD2);
    m.add(GEO.box, new V3(x - side * 0.12, 0.3, 0), new V3(0.24, 0.6, HALL.hl * 2), IVORY);
  }
  hall.add(new THREE.Mesh(m.build(), gilt));
  hall.add(new THREE.Mesh(pil.build(), new THREE.MeshPhongMaterial({ map: marbleTex, shininess: 70, specular: '#3a2a2a', emissive: '#2a0e0c', emissiveIntensity: 0.6, fog: false })));
}

/* ---------- the vault: a painted baroque sky in gilded frames ---------- */
const vaultTex = canvasTex(1024, 2048, (g, w, h) => {
  // gilded stucco ground, then one great painting framed down the middle, a second below, medallions beside
  const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#b88a2a'); gr.addColorStop(0.5, '#d9b04a'); gr.addColorStop(1, '#b88a2a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  const RS = rng(5); g.strokeStyle = 'rgba(255,230,150,.6)'; g.lineWidth = 4; for (let k = 0; k < 60; k++) { const x = RS() * w, y = RS() * h; g.beginPath(); g.arc(x, y, 8 + RS() * 18, RS() * 6, RS() * 6 + 3.5); g.stroke(); }
  baroque(g, 150, 120, w - 300, 1180, 21); frame(g, 150, 120, w - 300, 1180, 26);
  baroque(g, 230, 1420, 560, 520, 22); frame(g, 230, 1420, 560, 520, 20);
  for (const x of [20, w - 120]) { g.save(); g.beginPath(); g.ellipse(x + 50, 1680, 50, 120, 0, 0, 7); g.clip(); baroque(g, x, 1560, 100, 240, 23 + x); g.restore(); g.strokeStyle = '#e8c25a'; g.lineWidth = 8; g.beginPath(); g.ellipse(x + 50, 1680, 50, 120, 0, 0, 7); g.stroke(); }
}, true);
{
  const reps = 4;
  vaultTex.repeat.set(1, reps);
  const vg = new THREE.CylinderGeometry(HALL.vault, HALL.vault, HALL.hl * 2, 48, 1, true, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2);
  const vmat = new THREE.MeshLambertMaterial({ map: vaultTex, emissive: '#ffffff', emissiveMap: vaultTex, emissiveIntensity: 0.42, color: '#d8ccb4', side: THREE.DoubleSide, fog: false });
  const vault = new THREE.Mesh(vg, vmat); vault.position.y = HALL.wall; vault.scale.set(HALL.hw / HALL.vault, HALL.rise, 1); hall.add(vault);
  // gilded ribs across the vault between the paintings
  const ribs = new Merge();
  for (let k = 0; k <= reps; k++) ribs.add(new THREE.TorusGeometry(HALL.vault - 0.3, 0.45, 6, 40, Math.PI), new V3(0, 0, -HALL.hl + k * HALL.hl * 2 / reps), new V3(1, 1, 1), GOLD);
  const rm = new THREE.Mesh(ribs.build(), gilt); rm.position.y = HALL.wall; rm.scale.set(HALL.hw / HALL.vault, HALL.rise, 1); hall.add(rm);
  // the lunettes at either end, each a painting of its own
  for (const e of [-1, 1]) {
    const lt = canvasTex(1024, 512, g => { g.fillStyle = '#c99a32'; g.fillRect(0, 0, 1024, 512); baroque(g, 60, 40, 904, 480, 40 + e); frame(g, 60, 40, 904, 480, 18); });
    const lun = new THREE.Mesh(new THREE.CircleGeometry(HALL.vault, 48, 0, Math.PI), new THREE.MeshLambertMaterial({ map: lt, emissive: '#ffffff', emissiveMap: lt, emissiveIntensity: 0.42, color: '#d8ccb4', side: THREE.DoubleSide, fog: false }));
    lun.position.set(0, HALL.wall, e * (HALL.hl - 0.05)); lun.scale.set(HALL.hw / HALL.vault, HALL.rise, 1); hall.add(lun);
  }
}

/* ---------- the end walls: great paintings in gilded frames; the door out at the south end ---------- */
{
  const art = (seed, w, h) => canvasTex(1024, Math.round(1024 * h / w), (g, cw, ch) => { baroque(g, 0, 0, cw, ch, seed); frame(g, 14, 14, cw - 28, ch - 28, 14); });
  const end = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#ece2cc'; g.fillRect(0, 0, w, h); g.fillStyle = '#5a7a62'; g.fillRect(40, h - 90, w - 80, 60); }, true);
  end.repeat.set(4, 1);
  const m = new Merge();
  for (const e of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(HALL.hw * 2, HALL.wall), new THREE.MeshLambertMaterial({ map: end, emissive: '#ffffff', emissiveMap: end, emissiveIntensity: 0.3, color: '#d8ccb4', fog: false }));
    wall.position.set(0, HALL.wall / 2, e * HALL.hl); wall.rotation.y = e > 0 ? Math.PI : 0; hall.add(wall);
    const put = (x, y, w, h, seed) => {
      const t = art(seed, w, h), p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.35, color: '#e0d4bc', fog: false }));
      p.position.set(x, y, e * (HALL.hl - 0.12)); p.rotation.y = e > 0 ? Math.PI : 0; hall.add(p);
      // a deep gilded frame round it
      for (const [fx, fy, fw, fh] of [[x, y + h / 2 + 0.25, w + 1, 0.5], [x, y - h / 2 - 0.25, w + 1, 0.5], [x - w / 2 - 0.25, y, 0.5, h], [x + w / 2 + 0.25, y, 0.5, h]]) m.add(GEO.box, new V3(fx, fy, e * (HALL.hl - 0.2)), new V3(fw, fh, 0.3), GOLD);
    };
    if (e < 0) put(0, 8.5, 22, 12, 61);
    else { put(-12, 9, 9, 11, 62); put(12, 9, 9, 11, 63); }
  }
  // the door at the south end: tall, white and gold under a gilded arch
  m.add(GEO.box, new V3(0, 3.6, HALL.hl - 0.2), new V3(6, 7.2, 0.3), IVORY);
  m.add(GEO.box, new V3(0, 3.3, HALL.hl - 0.38), new V3(4.4, 6.4, 0.15), C('#e8dcc4'));
  for (const o of [-1.1, 1.1]) for (const y of [1.8, 4.6]) m.add(GEO.box, new V3(o, y, HALL.hl - 0.46), new V3(1.6, 2.2, 0.06), GOLD);
  m.add(new THREE.TorusGeometry(3.0, 0.35, 8, 28, Math.PI), new V3(0, 7.2, HALL.hl - 0.3), new V3(1, 1, 1), GOLD);
  hall.add(new THREE.Mesh(m.build(), gilt));
  for (let k = 0; k <= 14; k++) { const a = Math.PI * k / 14; bulb(Math.cos(a) * 3.4, 7.2 + Math.sin(a) * 3.4, HALL.hl - 0.6, '#ffe08a'); }
}

/* ---------- the floor: parquet de Versailles, squares of oak woven on the diagonal ---------- */
{
  const pt = canvasTex(512, 512, (g, w, h) => {
    const RS = rng(5); g.fillStyle = '#4a3220'; g.fillRect(0, 0, w, h);
    const plank = (x, y, a, l) => { const v = 110 + RS() * 45 | 0; g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = `rgb(${v},${v * 0.7 | 0},${v * 0.45 | 0})`; g.fillRect(-l / 2, -9, l, 18); g.strokeStyle = 'rgba(30,18,10,.6)'; g.lineWidth = 1.5; g.strokeRect(-l / 2, -9, l, 18); g.restore(); };
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      const cx = x * 256 + 128, cy = y * 256 + 128;
      g.save(); g.beginPath(); g.rect(x * 256, y * 256, 256, 256); g.clip();
      for (let k = -6; k <= 6; k++) { plank(cx + k * 19, cy + k * 19, -Math.PI / 4, 90); plank(cx + k * 19 + 30, cy - k * 19 + 30, Math.PI / 4, 90); }
      g.restore();
      g.strokeStyle = '#2a1a10'; g.lineWidth = 6; g.strokeRect(x * 256 + 3, y * 256 + 3, 250, 250);
    }
    const sh = g.createLinearGradient(0, 0, w, h); sh.addColorStop(0, 'rgba(255,230,190,.14)'); sh.addColorStop(1, 'rgba(255,230,190,0)'); g.fillStyle = sh; g.fillRect(0, 0, w, h);
  }, true);
  pt.repeat.set(HALL.hw / 4, HALL.hl / 4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALL.hw * 2, HALL.hl * 2).rotateX(-Math.PI / 2), new THREE.MeshPhongMaterial({ map: pt, color: '#c8a888', shininess: 80, specular: '#4a3a28', emissive: '#100a04', fog: false }));
  hall.add(floor);
  for (let z = -72; z <= 72; z += 24) { const l = new THREE.PointLight('#ffe6c0', 0.5, 60, 1.5); l.position.set(0, 14, z); hall.add(l); }
}

/* ---------- chandeliers: one great one in the middle, a row of lesser ones; candelabra, busts, benches ---------- */
{
  const m = new Merge(), top = HALL.wall + HALL.vault * HALL.rise - 0.4;
  const chandelier = (z, S) => {
    const y = 12.5 + (S > 2 ? -1 : 0);
    m.limb(new V3(0, top, z), new V3(0, y + 3.4 * S, z), 0.05, 0.05, GOLD);
    m.add(GEO.sph, new V3(0, y + 3.3 * S, z), new V3(0.35 * S, 0.35 * S, 0.35 * S), GOLD2);
    for (const [ty, tr] of [[3.0, 0.45], [2.2, 0.85], [1.4, 1.2], [0.6, 1.0], [0, 0.55]]) {
      const yy = y + ty * S, r = tr * S;
      m.add(new THREE.TorusGeometry(r, 0.06 * S, 6, 32).rotateX(Math.PI / 2), new V3(0, yy, z), new V3(1, 1, 1), GOLD);
      const n = Math.round(r * 16);
      for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; for (let d = 0; d < 4; d++) bulb(Math.cos(a) * r, yy - 0.15 - d * 0.22 * S, z + Math.sin(a) * r, d ? '#eef4ff' : '#fff2d0'); }
      // candles on the widest tier
      if (tr >= 1.2) for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; m.limb(new V3(Math.cos(a) * r, yy, z + Math.sin(a) * r), new V3(Math.cos(a) * r, yy + 0.35 * S, z + Math.sin(a) * r), 0.05 * S, 0.05 * S, C('#fffaf0')); bulb(Math.cos(a) * r, yy + 0.5 * S, z + Math.sin(a) * r, '#ffd890'); }
    }
    // strings of crystal looping between the tiers, and a crystal drop at the bottom
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; for (let t = 0; t <= 8; t++) { const f = t / 8, rr = (0.85 + 0.35 * Math.sin(f * Math.PI)) * S; bulb(Math.cos(a) * rr, y + (2.2 - f * 1.6) * S, z + Math.sin(a) * rr, '#f4f8ff'); } }
    m.add(GEO.cone, new V3(0, y - 0.7 * S, z), new V3(0.35 * S, 1.2 * S, 0.35 * S), C('#eef4ff'), new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), Math.PI));
  };
  chandelier(0, 2.6);
  for (let z = -80; z <= 80; z += 10) if (Math.abs(z) > 12) chandelier(z, 1.2);
  // gilded candelabra on pedestals, between every bay on both sides, and white marble busts between them
  const bays = Math.round(HALL.hl * 2 / HALL.bay);
  for (let i = 0; i <= bays; i++) for (const s of [-1, 1]) {
    const z = -HALL.hl + i * HALL.bay, x = s * (HALL.hw - 1.6);
    m.add(GEO.box, new V3(x, 0.7, z), new V3(1.0, 1.4, 1.0), C('#5a7a62'));
    m.add(GEO.box, new V3(x, 1.45, z), new V3(1.2, 0.12, 1.2), GOLD);
    // a gilded figure, arms raised, holding a branch of eight candles
    m.limb(new V3(x, 1.5, z), new V3(x, 3.3, z), 0.32, 0.22, GOLD); m.add(GEO.sph, new V3(x, 3.6, z), new V3(0.24, 0.3, 0.24), GOLD2);
    for (const o of [-1, 1]) m.limb(new V3(x, 3.1, z + o * 0.18), new V3(x, 4.3, z + o * 0.55), 0.08, 0.06, GOLD);
    m.limb(new V3(x, 4.2, z), new V3(x, 5.0, z), 0.08, 0.08, GOLD);
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, r = k % 2 ? 0.7 : 0.45, cy = 5.0 + (k % 2 ? 0 : 0.35); m.limb(new V3(x, 5.0, z), new V3(x + Math.cos(a) * r, cy, z + Math.sin(a) * r), 0.04, 0.04, GOLD); m.limb(new V3(x + Math.cos(a) * r, cy, z + Math.sin(a) * r), new V3(x + Math.cos(a) * r, cy + 0.35, z + Math.sin(a) * r), 0.05, 0.05, C('#fffaf0')); bulb(x + Math.cos(a) * r, cy + 0.5, z + Math.sin(a) * r, '#ffcf80'); }
    // busts of white marble on columns between the candelabra, and a crimson bench by every other one
    if (i < bays) {
      const zb = z + HALL.bay / 2, xb = s * (HALL.hw - 2.2);
      m.add(new THREE.CylinderGeometry(0.4, 0.45, 1.6, 12), new V3(xb, 0.8, zb), new V3(1, 1, 1), C('#e8e2d8'));
      m.add(GEO.sph, new V3(xb, 1.95, zb), new V3(0.42, 0.32, 0.3), C('#f2eee6'));
      m.add(GEO.sph, new V3(xb, 2.45, zb), new V3(0.22, 0.28, 0.24), C('#f2eee6'));
      if (i % 2) m.add(GEO.box, new V3(s * (HALL.hw - 4.2), 0.45, zb), new V3(0.8, 0.35, 2.2), C('#a8232e'));
    }
  }
  hall.add(new THREE.Mesh(m.build(), gilt));
}

// every light in the gallery: crystals and candles, gently flickering
{
  const n = bulbs.length / 6, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), ph = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos.set(bulbs.slice(i * 6, i * 6 + 3), i * 3); col.set(bulbs.slice(i * 6 + 3, i * 6 + 6), i * 3); ph[i] = R() * 100; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
  const pts = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true, fog: false,
    vertexShader: 'uniform float uTime;attribute float aPh;varying vec3 vC;void main(){vC=color*(.75+.25*sin(uTime*3.+aPh));vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(200./-mv.z,1.5,14.);gl_Position=projectionMatrix*mv;}',
    fragmentShader: 'varying vec3 vC;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,.0,d)*.5+smoothstep(.15,.0,d);gl_FragColor=vec4(vC*a,a);}' }));
  hall.add(pts); hall.userData.pts = pts;
}
addTick(() => { if (hall.visible) hall.userData.pts.material.uniforms.uTime.value = T; }, true);

/* ---------- going in and out: just walk ---------- */
// a soft golden shimmer fills the castle's gate; walking into it takes you inside, and walking to the
// gallery's door at the south end takes you back out to the fair
{
  const gate = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 5.6), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float uTime;varying vec2 vUv;void main(){vec2 q=vUv-vec2(.5,.35);float d=length(q*vec2(1.,.8));
      float a=smoothstep(.62,.0,d)*(.65+.2*sin(uTime*1.6+d*14.));vec3 c=mix(vec3(1.,.9,.7),vec3(1.,.97,.88),vUv.y);gl_FragColor=vec4(c,a*.9);}` }));
  const y = worlds.sun.floorH(O.x + CASTLE.x, O.z + CASTLE.z + 12);
  gate.position.set(O.x + CASTLE.x, y + 2.8, O.z + CASTLE.z + 10.6); sunScene.add(gate);
  addTick(() => { gate.material.uniforms.uTime.value = T; }, true);
}
addTick(() => {
  if (state.world !== 'sun' || state.mode !== 'walk') return;
  const lx = player.pos.x - O.x, lz = player.pos.z - O.z;
  if (!hall.visible) { if (Math.abs(lx - CASTLE.x) < 2.6 && lz < CASTLE.z + 13.2 && lz > CASTLE.z + 8) late.enterHall && late.enterHall(); }
  else if (Math.abs(lx - HALL.x) < 3 && lz - HALL.z > HALL.hl - 4) late.leaveHall && late.leaveHall();
}, true);
export const hallArrive = { pos: W(0, HALL.hl - 9), yaw: 0 };
export const castleFront = { pos: O.clone().add(new V3(CASTLE.x, 0, CASTLE.z + 17)), yaw: 0 };
export function showHall(on) { hall.visible = on; }
export const inHall = (x, z) => Math.abs(x - (O.x + HALL.x)) < HALL.hw + 4 && Math.abs(z - (O.z + HALL.z)) < HALL.hl + 4;

/* ================= out at the fair: the teacups and a great drop tower ================= */
const fair = new THREE.Group(); fair.position.copy(O); sunScene.add(fair);
const toy = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#3a3028', emissiveIntensity: 0.3 });
const fb = [];
const fbulb = (x, y, z, col) => { const c = new THREE.Color(col); fb.push(x, y, z, c.r, c.g, c.b); };
const exitAt = (x, z) => O.clone().add(new V3(x, 0, z));
function ride(def, root, near) { rides.push(def); regThing(root, def.label, () => late.startRide && late.startRide(def), near); }

// the teacups: a turning floor, three smaller turntables, two cups on each spinning on its own, under a canopy
const TEA = FAIR_RIDES.tea, teaTop = new THREE.Group(), teaSubs = [], cups = [];
{
  const gy = sunH(TEA.x, TEA.z);
  teaTop.position.set(TEA.x, gy, TEA.z); fair.add(teaTop);
  const base = new Merge(); base.add(new THREE.CylinderGeometry(TEA.r, TEA.r + 0.3, 0.5, 48), new V3(0, 0.25, 0), new V3(1, 1, 1), C('#f4ecd8'));
  for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; base.add(GEO.box, new V3(Math.cos(a) * (TEA.r - 0.1), 0.52, Math.sin(a) * (TEA.r - 0.1)), new V3(2.2, 0.05, 0.4), C(k % 2 ? '#d4a63a' : '#3b78d0'), new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), -a + Math.PI / 2)); }
  teaTop.add(new THREE.Mesh(base.build(), toy));
  const CUP = ['#f7b9cd', '#3b78d0', '#e8463a', '#fde59a', '#4fb35a', '#b48ae0'];
  for (let i = 0; i < 3; i++) {
    const sub = new THREE.Group(), a = i / 3 * Math.PI * 2; sub.position.set(Math.cos(a) * 4.8, 0.5, Math.sin(a) * 4.8); teaTop.add(sub); teaSubs.push(sub);
    const pm = new Merge(); pm.add(new THREE.CylinderGeometry(3.1, 3.1, 0.2, 32), new V3(0, 0.1, 0), new V3(1, 1, 1), C('#d4a63a')); sub.add(new THREE.Mesh(pm.build(), toy));
    for (let j = 0; j < 2; j++) {
      const cup = new THREE.Group(); cup.position.set(j ? 1.55 : -1.55, 0.2, 0); sub.add(cup);
      const cm = new Merge(), c = C(CUP[(i * 2 + j) % 6]);
      cm.add(new THREE.CylinderGeometry(1.2, 0.8, 1.3, 20, 1, true), new V3(0, 0.75, 0), new V3(1, 1, 1), c);
      cm.add(new THREE.CylinderGeometry(0.8, 0.8, 0.1, 20), new V3(0, 0.12, 0), new V3(1, 1, 1), c);
      cm.add(new THREE.TorusGeometry(1.2, 0.09, 6, 24).rotateX(Math.PI / 2), new V3(0, 1.4, 0), new V3(1, 1, 1), C('#ffffff'));
      cm.add(new THREE.TorusGeometry(0.4, 0.1, 6, 12), new V3(1.3, 0.85, 0), new V3(1, 1, 1), c);
      cup.add(new THREE.Mesh(cm.build(), toy)); cups.push(cup);
    }
  }
  // a striped canopy over it on four gilded posts, with lights round its rim
  const can = new Merge();
  for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + Math.PI / 4; can.limb(new V3(TEA.x + Math.cos(a) * (TEA.r + 0.6), gy, TEA.z + Math.sin(a) * (TEA.r + 0.6)), new V3(TEA.x + Math.cos(a) * (TEA.r + 0.6), gy + 6.5, TEA.z + Math.sin(a) * (TEA.r + 0.6)), 0.16, 0.14, C('#d4a63a')); }
  const stripes = canvasTex(512, 64, (g, w, h) => { for (let i = 0; i < 24; i++) { g.fillStyle = i % 2 ? '#f8f1e0' : '#e8508a'; g.fillRect(i * w / 24, 0, w / 24, h); } });
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(TEA.r + 1.4, 3, 24, 1, true), new THREE.MeshLambertMaterial({ map: stripes, side: THREE.DoubleSide, emissive: '#3a2a2a', emissiveIntensity: 0.4 }));
  canopy.position.set(TEA.x, gy + 8, TEA.z); fair.add(canopy, new THREE.Mesh(can.build(), toy));
  for (let k = 0; k < 48; k++) { const a = k / 48 * Math.PI * 2; fbulb(TEA.x + Math.cos(a) * (TEA.r + 1.3), gy + 6.55, TEA.z + Math.sin(a) * (TEA.r + 1.3), k % 2 ? '#ffd0e0' : '#ffe8a0'); }
  ride({ key: 'teacups', label: 'Ride the teacups', name: 'In a spinning teacup', follow: true, exit: exitAt(TEA.x + TEA.r + 2.2, TEA.z),
    seat(v) { cups[0].getWorldPosition(v); v.y += 2.0; } }, teaTop, { x: O.x + TEA.x, z: O.z + TEA.z, r: TEA.r + 2.6 });
}

// the drop tower: 56 metres, the tallest thing at the fair. The ring of seats creeps up for fifteen seconds,
// hangs at the top over the whole secret garden, then falls freely for nearly three seconds before the brakes catch it
const TOW = FAIR_RIDES.drop, H = 56, ringSeat = new THREE.Group();
let dropY = 3;
{
  const gy = sunH(TOW.x, TOW.z), m = new Merge();
  m.add(new THREE.CylinderGeometry(4.2, 4.8, 1, 32), new V3(TOW.x, gy + 0.5, TOW.z), new V3(1, 1, 1), C('#efe6d2'));
  for (let y = 0; y < H; y += 3) m.add(new THREE.CylinderGeometry(1.25, 1.25, 3, 16), new V3(TOW.x, gy + y + 1.5, TOW.z), new V3(1, 1, 1), C((y / 3) % 2 ? '#e8463a' : '#f4ecd8'));
  // four rails up its sides, and a crown at the top with a beacon
  for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2; m.limb(new V3(TOW.x + Math.cos(a) * 1.45, gy, TOW.z + Math.sin(a) * 1.45), new V3(TOW.x + Math.cos(a) * 1.45, gy + H, TOW.z + Math.sin(a) * 1.45), 0.12, 0.12, C('#c9c3b5')); }
  m.add(new THREE.CylinderGeometry(3, 2, 2.4, 24), new V3(TOW.x, gy + H + 1.2, TOW.z), new V3(1, 1, 1), C('#3b78d0'));
  m.add(GEO.cone, new V3(TOW.x, gy + H + 2.4, TOW.z), new V3(2.2, 4, 2.2), C('#d4a63a'));
  m.add(GEO.sph, new V3(TOW.x, gy + H + 6.6, TOW.z), new V3(0.6, 0.6, 0.6), C('#ff5a4a'));
  fair.add(new THREE.Mesh(m.build(), toy));
  for (let y = 3; y < H; y += 1.5) for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + 0.785; fbulb(TOW.x + Math.cos(a) * 1.35, gy + y, TOW.z + Math.sin(a) * 1.35, y % 6 < 3 ? '#ffe8a0' : '#ff8a6a'); }
  for (let k = 0; k < 36; k++) { const a = k / 36 * Math.PI * 2; fbulb(TOW.x + Math.cos(a) * 3.05, gy + H + 2.3, TOW.z + Math.sin(a) * 3.05, '#fff2c0'); }
  fbulb(TOW.x, gy + H + 6.6, TOW.z, '#ff3a2a');
  ringSeat.position.set(TOW.x, gy + dropY, TOW.z); fair.add(ringSeat);
  const r = new Merge(); r.add(new THREE.TorusGeometry(2.6, 0.4, 8, 32).rotateX(Math.PI / 2), new V3(0, 0, 0), new V3(1, 1, 1), C('#d4a63a'));
  for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; r.add(GEO.box, new V3(Math.cos(a) * 3.2, -0.25, Math.sin(a) * 3.2), new V3(0.9, 0.2, 0.8), C('#3b78d0'), new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), -a)); r.add(GEO.box, new V3(Math.cos(a) * 2.8, 0.45, Math.sin(a) * 2.8), new V3(0.9, 1.3, 0.15), C('#3b78d0'), new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), -a + Math.PI / 2)); r.limb(new V3(Math.cos(a) * 2.75, 1.1, Math.sin(a) * 2.75), new V3(Math.cos(a) * 3.35, 0.2, Math.sin(a) * 3.35), 0.05, 0.05, C('#f2c12e')); }
  ringSeat.add(new THREE.Mesh(r.build(), toy));
  ride({ key: 'drop', label: 'Ride the drop tower', name: 'On the drop tower: hold on!', exit: exitAt(TOW.x - 6.5, TOW.z + 2),
    seat(v) { ringSeat.localToWorld(v.set(3.4, 1.05, 0)); }, fwd(v) { const a = ringSeat.rotation.y; v.set(Math.cos(a), dropY > 40 ? -0.55 : -0.25, -Math.sin(a)); } }, ringSeat, { x: O.x + TOW.x, z: O.z + TOW.z, r: 7 });
}
// all the rides' bulbs: dim by day, bright after dark
const fairGlow = { value: 0.15 };
{
  const n = fb.length / 6, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos.set(fb.slice(i * 6, i * 6 + 3), i * 3); col.set(fb.slice(i * 6 + 3, i * 6 + 6), i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  fair.add(new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: { uGlow: fairGlow }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    vertexShader: 'varying vec3 vC;void main(){vC=color;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(320./-mv.z,2.,20.);gl_Position=projectionMatrix*mv;}',
    fragmentShader: 'uniform float uGlow;varying vec3 vC;void main(){float d=length(gl_PointCoord-.5);float a=(smoothstep(.5,.0,d)*.6+smoothstep(.18,.0,d))*uGlow;gl_FragColor=vec4(vC*a,a);}' })));
}
addTick(() => {
  if (state.world !== 'sun') return;
  fairGlow.value = Math.max(state.night, (state.dusk || 0) * 0.6, 0.18);
  teaTop.rotation.y = T * 0.35; teaSubs.forEach((s, i) => { s.rotation.y = -T * 0.9 + i; }); cups.forEach((c, i) => { c.rotation.y = T * (1.4 + (i % 3) * 0.3); });
  // a 26-second cycle: creep up to the top (15 s), hang there (4 s), free fall (2.6 s), brake and bounce, rest
  const t = T % 26, top = H - 6;
  if (t < 15) dropY = 3 + smooth(0, 15, t) * (top - 3);
  else if (t < 19) dropY = top + Math.sin((t - 15) * 3) * 0.05;
  else if (t < 21.6) { const f = t - 19; dropY = Math.max(10, top - 0.5 * 9.8 * f * f); }
  else if (t < 23) { const f = (t - 21.6) / 1.4; dropY = 10 - 7 * smooth(0, 1, f) + Math.sin(f * 9) * (1 - f) * 0.6; }
  else dropY = 3;
  ringSeat.position.y = sunH(TOW.x, TOW.z) + dropY; if (t < 19) ringSeat.rotation.y = T * 0.12;
});

// standing and walking: the hall's floor is level and its walls stop you; at the fair, the two rides do
{
  const f = worlds.sun.floorH, b = worlds.sun.blocked;
  worlds.sun.floorH = (x, z) => inHall(x, z) ? O.y + HALL.y : f(x, z);
  worlds.sun.blocked = (x, z) => {
    if (!inHall(x, z)) {
      const lx = x - O.x, lz = z - O.z;
      if (Math.hypot(lx - TEA.x, lz - TEA.z) < TEA.r + 1.2 || Math.hypot(lx - TOW.x, lz - TOW.z) < 5.2) return true;
      return b(x, z);
    }
    const lx = x - O.x - HALL.x, lz = z - O.z - HALL.z;
    return Math.abs(lx) > HALL.hw - 2.9 || Math.abs(lz) > HALL.hl - 1.4;
  };
}
