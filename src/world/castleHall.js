import * as THREE from 'three';
import { C, V3, clamp, rng, smooth } from '../core/util.js';
import { T, state } from '../core/state.js';
import { canvasTex } from './textures.js';
import { GEO, Merge } from './geometry.js';
import { worlds } from '../core/worlds.js';
import { addTick, regThing } from '../core/things.js';
import { late } from '../core/late.js';
import { player } from '../player/camera.js';
import { CASTLE, O, rides, sunScene } from './sunWorld.js';

/* ================= the Hall of Mirrors, inside the castle ================= */
// Walk through the castle's gate and you are inside: a long gilded gallery after the Hall of Mirrors at
// Versailles. Arched mirrors face arched windows between rose-marble pilasters, a gold cornice carries a
// painted barrel vault framed in gold, crystal chandeliers hang down the middle and golden candelabra stand
// along the walls, over a parquet floor. Down the gallery are rides you can take, in gold, ivory, crimson and
// royal blue: teacups, a drop tower, a balloon carousel, a royal train round the hall, and bumper cars you
// drive. It is part of the secret world's scene, far below and away from the fair, shown only while you are
// inside; you walk in through the castle's gate and out through the gallery's door, no prompts.

const R = rng(9191);
export const HALL = { x: 420, z: -60, y: -90, hw: 16, hl: 60, wall: 13, vault: 16 };
const hall = new THREE.Group(); hall.position.set(O.x + HALL.x, O.y + HALL.y, O.z + HALL.z); hall.visible = false; sunScene.add(hall);
const W = (x, z) => new V3(O.x + HALL.x + x, O.y + HALL.y, O.z + HALL.z + z);
const gold = new THREE.MeshLambertMaterial({ vertexColors: true, color: '#d8c8a8', emissive: '#2a1e0c', emissiveIntensity: 0.5 });
const toy = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#3a3028', emissiveIntensity: 0.4 });
const bulbs = [];
const bulb = (x, y, z, col) => { const c = new THREE.Color(col); bulbs.push(x, y, z, c.r, c.g, c.b); };

/* ---------- the gallery: walls of mirrors and windows, a painted vault, a parquet floor ---------- */
// one bay of wall, painted: a tall arch (a mirror of small panes on one side, a bright window on the other)
// between rose-marble pilasters with gilded capitals, a gold trophy above, a gilded cornice
function bayTex(mirror) {
  return canvasTex(512, 1024, (g, w, h) => {
    const RS = rng(mirror ? 11 : 12);
    g.fillStyle = '#efe4cc'; g.fillRect(0, 0, w, h);
    for (const x0 of [0, w - 70]) {
      const gr = g.createLinearGradient(x0, 0, x0 + 70, 0); gr.addColorStop(0, '#b77a78'); gr.addColorStop(0.5, '#d9a3a0'); gr.addColorStop(1, '#a8706e'); g.fillStyle = gr; g.fillRect(x0, 120, 70, h - 200);
      g.strokeStyle = 'rgba(255,240,235,.35)'; g.lineWidth = 2; for (let k = 0; k < 8; k++) { g.beginPath(); let y = 140 + RS() * (h - 260); g.moveTo(x0 + RS() * 70, y); for (let s = 0; s < 6; s++) { y += 20 + RS() * 30; g.lineTo(x0 + RS() * 70, y); } g.stroke(); }
      g.fillStyle = '#d6aa3e'; g.fillRect(x0 - 6, 90, 82, 40); g.fillRect(x0 - 6, h - 90, 82, 50);
      for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x0 + 12 + k * 16, 96, 9, Math.PI, 0); g.fill(); }
    }
    const ax = 100, aw = w - 200, top = 200, bot = h - 110, r = aw / 2;
    const arch = () => { g.beginPath(); g.moveTo(ax, bot); g.lineTo(ax, top + r); g.arc(ax + r, top + r, r, Math.PI, 0); g.lineTo(ax + aw, bot); g.closePath(); };
    g.save(); arch(); g.lineWidth = 26; g.strokeStyle = '#c99a32'; g.stroke(); g.lineWidth = 8; g.strokeStyle = '#f2d37a'; g.stroke(); g.clip();
    if (mirror) {
      // aged mirror glass in small panes, faintly catching the chandeliers' light
      const gr = g.createLinearGradient(0, top, 0, bot); gr.addColorStop(0, '#b9b8ae'); gr.addColorStop(0.5, '#8a8a82'); gr.addColorStop(1, '#a8a498'); g.fillStyle = gr; g.fillRect(ax, top, aw, bot - top);
      for (let k = 0; k < 9; k++) { const x = ax + RS() * aw, y = top + RS() * (bot - top) * 0.6; const rg = g.createRadialGradient(x, y, 0, x, y, 40); rg.addColorStop(0, 'rgba(255,220,150,.85)'); rg.addColorStop(1, 'rgba(255,220,150,0)'); g.fillStyle = rg; g.fillRect(x - 40, y - 40, 80, 80); }
      g.strokeStyle = 'rgba(200,160,70,.85)'; g.lineWidth = 4; for (let x = ax; x <= ax + aw; x += aw / 3) { g.beginPath(); g.moveTo(x, top); g.lineTo(x, bot); g.stroke(); } for (let y = top + r; y < bot; y += 80) { g.beginPath(); g.moveTo(ax, y); g.lineTo(ax + aw, y); g.stroke(); }
    } else {
      // a tall window onto a bright garden sky
      const gr = g.createLinearGradient(0, top, 0, bot); gr.addColorStop(0, '#e9f2fa'); gr.addColorStop(0.7, '#cfe2ee'); gr.addColorStop(1, '#a9c49a'); g.fillStyle = gr; g.fillRect(ax, top, aw, bot - top);
      g.strokeStyle = '#d9c28a'; g.lineWidth = 5; for (let x = ax; x <= ax + aw; x += aw / 3) { g.beginPath(); g.moveTo(x, top); g.lineTo(x, bot); g.stroke(); } for (let y = top + r; y < bot; y += 70) { g.beginPath(); g.moveTo(ax, y); g.lineTo(ax + aw, y); g.stroke(); }
    }
    g.restore();
    g.fillStyle = '#d6aa3e'; g.beginPath(); g.ellipse(w / 2, 120, 60, 40, 0, 0, 7); g.fill(); g.fillStyle = '#f2d37a'; g.beginPath(); g.ellipse(w / 2, 120, 34, 22, 0, 0, 7); g.fill();
    for (const s of [-1, 1]) { g.fillStyle = '#c99a32'; g.beginPath(); g.moveTo(w / 2 + s * 50, 120); g.quadraticCurveTo(w / 2 + s * 130, 70, w / 2 + s * 160, 130); g.quadraticCurveTo(w / 2 + s * 110, 110, w / 2 + s * 50, 140); g.fill(); }
    const cg = g.createLinearGradient(0, 0, 0, 60); cg.addColorStop(0, '#f2d37a'); cg.addColorStop(1, '#a87a22'); g.fillStyle = cg; g.fillRect(0, 0, w, 60);
    g.fillStyle = '#8a6a2a'; for (let x = 0; x < w; x += 20) g.fillRect(x, 56, 10, 10);
    g.fillStyle = '#e8dcc0'; g.fillRect(0, h - 40, w, 40); g.fillStyle = '#c99a32'; g.fillRect(0, h - 44, w, 6);
  }, true);
}
// the vault: painted panels in gold frames, sky and figures in rich reds, blues and gold
const vaultTex = canvasTex(1024, 1024, (g, w, h) => {
  const RS = rng(31);
  g.fillStyle = '#c99a32'; g.fillRect(0, 0, w, h);
  const panel = (x, y, pw, ph, oval) => {
    const shape = () => { g.beginPath(); if (oval) g.ellipse(x + pw / 2, y + ph / 2, pw / 2, ph / 2, 0, 0, 7); else g.rect(x, y, pw, ph); };
    g.save(); shape(); g.clip();
    const gr = g.createLinearGradient(x, y, x, y + ph); gr.addColorStop(0, '#9cb8d6'); gr.addColorStop(0.6, '#e8d8b8'); gr.addColorStop(1, '#c9a07a'); g.fillStyle = gr; g.fillRect(x, y, pw, ph);
    for (let k = 0; k < 10; k++) { const cx = x + RS() * pw, cy = y + RS() * ph, rr = 20 + RS() * 50; g.fillStyle = 'rgba(255,250,240,.55)'; g.beginPath(); g.ellipse(cx, cy, rr * 1.6, rr, 0, 0, 7); g.fill(); }
    for (let k = 0; k < 7; k++) { const cx = x + 20 + RS() * (pw - 40), cy = y + 20 + RS() * (ph - 40); g.fillStyle = ['#a8232e', '#1f3f8a', '#e0bc5a', '#f0c8b0', '#6a2a5a'][k % 5]; g.beginPath(); g.ellipse(cx, cy, 18 + RS() * 26, 10 + RS() * 14, RS() * 3, 0, 7); g.fill(); g.fillStyle = '#f0c8b0'; g.beginPath(); g.arc(cx + 8, cy - 14, 7, 0, 7); g.fill(); }
    g.restore();
    shape(); g.lineWidth = 14; g.strokeStyle = '#f2d37a'; g.stroke(); g.lineWidth = 4; g.strokeStyle = '#8a6420'; g.stroke();
  };
  panel(60, 60, w - 120, 520, false); panel(120, 640, 340, 320, true); panel(w - 460, 640, 340, 320, true);
  g.strokeStyle = '#f2d37a'; g.lineWidth = 6; for (let k = 0; k < 12; k++) { const x = RS() * w, y = 600 + RS() * 400; g.beginPath(); g.arc(x, y, 14 + RS() * 14, RS() * 3, RS() * 3 + 4); g.stroke(); }
}, true);
{
  const bays = Math.round(HALL.hl * 2 / 6);
  // the two long walls: mirrors on the west, windows on the east
  for (const [side, mirror] of [[-1, true], [1, false]]) {
    const t = bayTex(mirror); t.repeat.set(bays, 1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(HALL.hl * 2, HALL.wall), new THREE.MeshLambertMaterial({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.2, color: '#e0d6c4', fog: false }));
    m.position.set(side * HALL.hw, HALL.wall / 2, 0); m.rotation.y = -side * Math.PI / 2; hall.add(m);
  }
  // the end walls
  for (const s of [-1, 1]) {
    const t = bayTex(s < 0); t.repeat.set(5, 1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(HALL.hw * 2, HALL.wall), new THREE.MeshLambertMaterial({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.2, color: '#e0d6c4', fog: false }));
    m.position.set(0, HALL.wall / 2, s * HALL.hl); m.rotation.y = s > 0 ? Math.PI : 0; hall.add(m);
  }
  // the barrel vault (a half cylinder along the gallery, flattened a little), and gilded ribs across it
  vaultTex.repeat.set(1, bays / 2);
  const vg = new THREE.CylinderGeometry(HALL.vault, HALL.vault, HALL.hl * 2, 40, 1, true, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2);
  const vault = new THREE.Mesh(vg, new THREE.MeshLambertMaterial({ map: vaultTex, emissive: '#ffffff', emissiveMap: vaultTex, emissiveIntensity: 0.24, color: '#e0d6c4', side: THREE.DoubleSide, fog: false }));
  vault.position.y = HALL.wall; vault.scale.set(HALL.hw / HALL.vault, 0.75, 1); hall.add(vault);
  hall.userData.vault = vault;
  // the vault's two ends: painted lunettes, so no sky shows through
  for (const e of [-1, 1]) {
    const lun = new THREE.Mesh(new THREE.CircleGeometry(HALL.vault, 40, 0, Math.PI), new THREE.MeshLambertMaterial({ map: vaultTex, emissive: '#ffffff', emissiveMap: vaultTex, emissiveIntensity: 0.24, color: '#e0d6c4', side: THREE.DoubleSide, fog: false }));
    lun.position.set(0, HALL.wall, e * (HALL.hl - 0.05)); lun.scale.set(HALL.hw / HALL.vault, 0.75, 1); hall.add(lun);
  }
  const ribs = new Merge();
  for (let z = -HALL.hl; z <= HALL.hl; z += 12) ribs.add(new THREE.TorusGeometry(HALL.vault - 0.3, 0.35, 6, 32, Math.PI), new V3(0, 0, z), new V3(1, 1, 1), C('#d6aa3e'));
  const rm = new THREE.Mesh(ribs.build(), gold); rm.position.y = HALL.wall; rm.scale.set(HALL.hw / HALL.vault, 0.75, 1); hall.add(rm);
  // the gilded cornice along the top of both walls, a marble skirting below
  const cor = new Merge();
  for (const s of [-1, 1]) { cor.add(GEO.box, new V3(s * (HALL.hw - 0.3), HALL.wall, 0), new V3(0.8, 0.7, HALL.hl * 2), C('#d6aa3e')); cor.add(GEO.box, new V3(s * (HALL.hw - 0.15), 0.25, 0), new V3(0.4, 0.5, HALL.hl * 2), C('#e8dcc0')); }
  hall.add(new THREE.Mesh(cor.build(), gold));
  // the parquet: squares of oak laid in a lattice, polished
  const pt = canvasTex(256, 256, (g, w, h) => {
    const RS = rng(5); g.fillStyle = '#8a5a30'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      const x0 = x * 128, y0 = y * 128;
      for (let k = 0; k < 6; k++) { const v = 150 + RS() * 40 | 0; g.fillStyle = `rgb(${v},${v * 0.66 | 0},${v * 0.38 | 0})`; if ((x + y) % 2) g.fillRect(x0 + 4, y0 + 4 + k * 20, 120, 18); else g.fillRect(x0 + 4 + k * 20, y0 + 4, 18, 120); }
      g.strokeStyle = '#5a3a1e'; g.lineWidth = 3; g.strokeRect(x0 + 2, y0 + 2, 124, 124);
    }
    const sh = g.createLinearGradient(0, 0, w, h); sh.addColorStop(0, 'rgba(255,240,210,.18)'); sh.addColorStop(1, 'rgba(255,240,210,0)'); g.fillStyle = sh; g.fillRect(0, 0, w, h);
  }, true);
  pt.repeat.set(HALL.hw / 2.5, HALL.hl / 2.5);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALL.hw * 2, HALL.hl * 2).rotateX(-Math.PI / 2), new THREE.MeshPhongMaterial({ map: pt, color: '#b89a80', shininess: 60, specular: '#3a2a18', emissive: '#100a04', fog: false }));
  hall.add(floor);
  // warm light from the chandeliers
  for (let z = -48; z <= 48; z += 24) { const l = new THREE.PointLight('#ffe8c0', 0.55, 50, 1.5); l.position.set(0, 11, z); hall.add(l); }
}

/* ---------- crystal chandeliers down the middle, golden candelabra along the walls ---------- */
{
  const m = new Merge(), G = C('#d6aa3e');
  for (let z = -54; z <= 54; z += 9) {
    // clear of the drop tower and the balloons
    if (Math.abs(z - 14) < 6 || Math.abs(z + 12) < 7) continue;
    const top = HALL.wall + HALL.vault * 0.75 - 0.5, y = 13.5;
    m.limb(new V3(0, top, z), new V3(0, y + 2.6, z), 0.04, 0.04, G);
    for (const [ty, tr] of [[y + 2.4, 0.5], [y + 1.6, 1.0], [y + 0.8, 1.35], [y, 0.9]]) {
      m.add(new THREE.TorusGeometry(tr, 0.06, 6, 24).rotateX(Math.PI / 2), new V3(0, ty, z), new V3(1, 1, 1), G);
      const n = Math.round(tr * 14); for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; for (let d = 0; d < 3; d++) bulb(Math.cos(a) * tr, ty - 0.2 - d * 0.25, z + Math.sin(a) * tr, d ? '#e8f0ff' : '#fff2d0'); }
    }
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; m.limb(new V3(Math.cos(a) * 1.35, y + 0.8, z + Math.sin(a) * 1.35), new V3(Math.cos(a) * 1.35, y + 1.15, z + Math.sin(a) * 1.35), 0.05, 0.05, C('#fffaf0')); bulb(Math.cos(a) * 1.35, y + 1.3, z + Math.sin(a) * 1.35, '#ffd890'); }
    m.add(GEO.cone, new V3(0, y - 0.6, z), new V3(0.4, 1.2, 0.4), C('#e8f0ff'), new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), Math.PI));
  }
  // candelabra: a gilded column on a pedestal holding a branch of candles, between every bay
  for (let z = -57; z <= 57; z += 6) for (const s of [-1, 1]) {
    const x = s * (HALL.hw - 1.4);
    m.add(GEO.box, new V3(x, 0.6, z), new V3(0.8, 1.2, 0.8), C('#c99a32'));
    m.limb(new V3(x, 1.2, z), new V3(x, 3.2, z), 0.22, 0.16, G);
    m.add(GEO.sph, new V3(x, 3.4, z), new V3(0.25, 0.3, 0.25), G);
    for (const o of [-0.6, 0, 0.6]) { m.limb(new V3(x, 3.4, z), new V3(x - s * 0.1, 4.2, z + o), 0.04, 0.04, G); m.limb(new V3(x - s * 0.1, 4.2, z + o), new V3(x - s * 0.1, 4.6, z + o), 0.05, 0.05, C('#fffaf0')); bulb(x - s * 0.1, 4.75, z + o, '#ffcf80'); }
  }
  // crimson benches along the walls
  for (let z = -51; z <= 51; z += 12) for (const s of [-1, 1]) { m.add(GEO.box, new V3(s * (HALL.hw - 2.6), 0.45, z), new V3(0.7, 0.3, 1.8), C('#a8232e')); for (const o of [-0.7, 0.7]) m.limb(new V3(s * (HALL.hw - 2.6), 0, z + o), new V3(s * (HALL.hw - 2.6), 0.3, z + o), 0.05, 0.05, G); }
  hall.add(new THREE.Mesh(m.build(), gold));
  // the door at the south end, back out to the fair
  const d = new Merge();
  d.add(GEO.box, new V3(0, 3, HALL.hl - 0.15), new V3(5, 6, 0.3), C('#f4ecd8'));
  d.add(GEO.box, new V3(0, 2.6, HALL.hl - 0.32), new V3(3.6, 5.2, 0.15), C('#5a2a1e'));
  d.add(new THREE.TorusGeometry(2.4, 0.3, 8, 24, Math.PI), new V3(0, 5.6, HALL.hl - 0.3), new V3(1, 1, 1), C('#d6aa3e'));
  hall.add(new THREE.Mesh(d.build(), gold));
  for (let k = 0; k <= 12; k++) { const a = Math.PI * k / 12; bulb(Math.cos(a) * 2.8, 5.6 + Math.sin(a) * 2.8, HALL.hl - 0.6, '#ffe08a'); }
}

/* ---------- the rides ---------- */
const hallRides = [];
const exitAt = (x, z) => W(x, z);
function ride(def, root, near) { hallRides.push(def); rides.push(def); regThing(root, def.label, () => late.startRide && late.startRide(def), near); }

// the royal teacups: a turning floor, three smaller turntables, two gilded cups on each spinning on its own
const TEA = { x: 0, z: -38, r: 8.5 }, teaTop = new THREE.Group(), teaSubs = [], cups = [];
{
  teaTop.position.set(TEA.x, 0, TEA.z); hall.add(teaTop);
  const base = new Merge(); base.add(new THREE.CylinderGeometry(TEA.r, TEA.r + 0.3, 0.5, 48), new V3(0, 0.25, 0), new V3(1, 1, 1), C('#f4ecd8'));
  for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; base.add(GEO.box, new V3(Math.cos(a) * (TEA.r - 0.1), 0.52, Math.sin(a) * (TEA.r - 0.1)), new V3(2.2, 0.05, 0.4), C(k % 2 ? '#c9a23a' : '#1f3f8a'), new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), -a + Math.PI / 2)); }
  teaTop.add(new THREE.Mesh(base.build(), toy));
  const CUP = ['#f4ecd8', '#1f3f8a', '#a8232e', '#f4ecd8', '#1f3f8a', '#a8232e'];
  for (let i = 0; i < 3; i++) {
    const sub = new THREE.Group(), a = i / 3 * Math.PI * 2; sub.position.set(Math.cos(a) * 4.8, 0.5, Math.sin(a) * 4.8); teaTop.add(sub); teaSubs.push(sub);
    const pm = new Merge(); pm.add(new THREE.CylinderGeometry(3.1, 3.1, 0.2, 32), new V3(0, 0.1, 0), new V3(1, 1, 1), C('#c9a23a')); sub.add(new THREE.Mesh(pm.build(), gold));
    for (let j = 0; j < 2; j++) {
      const cup = new THREE.Group(); cup.position.set(j ? 1.55 : -1.55, 0.2, 0); sub.add(cup);
      const cm = new Merge(), c = C(CUP[(i * 2 + j) % 6]);
      cm.add(new THREE.CylinderGeometry(1.2, 0.8, 1.3, 20, 1, true), new V3(0, 0.75, 0), new V3(1, 1, 1), c);
      cm.add(new THREE.CylinderGeometry(0.8, 0.8, 0.1, 20), new V3(0, 0.12, 0), new V3(1, 1, 1), c);
      cm.add(new THREE.TorusGeometry(1.2, 0.09, 6, 24).rotateX(Math.PI / 2), new V3(0, 1.4, 0), new V3(1, 1, 1), C('#d6aa3e'));
      cm.add(new THREE.TorusGeometry(0.4, 0.1, 6, 12), new V3(1.3, 0.85, 0), new V3(1, 1, 1), C('#d6aa3e'));
      cup.add(new THREE.Mesh(cm.build(), toy)); cups.push(cup);
    }
  }
  for (let k = 0; k < 40; k++) { const a = k / 40 * Math.PI * 2; bulb(TEA.x + Math.cos(a) * (TEA.r + 0.2), 0.7, TEA.z + Math.sin(a) * (TEA.r + 0.2), k % 2 ? '#fff2d0' : '#ffd890'); }
  ride({ key: 'teacups', label: 'Ride the teacups', name: 'In a spinning teacup', follow: true, exit: exitAt(TEA.x + TEA.r + 1.8, TEA.z),
    seat(v) { cups[0].getWorldPosition(v); v.y += 2.0; } }, teaTop, { x: W(TEA.x, TEA.z).x, z: W(TEA.x, TEA.z).z, r: TEA.r + 2.5 });
}

// the drop tower: an ivory-and-gold column; the ring of seats climbs slowly, waits, and drops
const TOWER = { x: 0, z: 14, h: 22 }, ringSeat = new THREE.Group();
let dropY = 2;
{
  const m = new Merge();
  m.add(new THREE.CylinderGeometry(3.4, 3.8, 0.8, 32), new V3(TOWER.x, 0.4, TOWER.z), new V3(1, 1, 1), C('#f4ecd8'));
  for (let y = 0; y < TOWER.h; y += 2) m.add(new THREE.CylinderGeometry(0.9, 0.9, 2, 16), new V3(TOWER.x, y + 1, TOWER.z), new V3(1, 1, 1), C((y / 2) % 2 ? '#f4ecd8' : '#d6aa3e'));
  m.add(GEO.cone, new V3(TOWER.x, TOWER.h, TOWER.z), new V3(1.6, 2.6, 1.6), C('#1f3f8a'));
  m.add(GEO.sph, new V3(TOWER.x, TOWER.h + 2.8, TOWER.z), new V3(0.45, 0.45, 0.45), C('#d6aa3e'));
  hall.add(new THREE.Mesh(m.build(), gold));
  for (let y = 2; y < TOWER.h; y += 1.4) for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + y; bulb(TOWER.x + Math.cos(a) * 1, y, TOWER.z + Math.sin(a) * 1, '#fff2d0'); }
  ringSeat.position.set(TOWER.x, dropY, TOWER.z); hall.add(ringSeat);
  const r = new Merge(); r.add(new THREE.TorusGeometry(2.4, 0.35, 8, 32).rotateX(Math.PI / 2), new V3(0, 0, 0), new V3(1, 1, 1), C('#a8232e'));
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; r.add(GEO.box, new V3(Math.cos(a) * 2.9, -0.2, Math.sin(a) * 2.9), new V3(0.9, 0.2, 0.8), C('#d6aa3e'), new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), -a)); r.add(GEO.box, new V3(Math.cos(a) * 2.5, 0.4, Math.sin(a) * 2.5), new V3(0.9, 1.1, 0.15), C('#a8232e'), new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), -a + Math.PI / 2)); }
  ringSeat.add(new THREE.Mesh(r.build(), toy));
  ride({ key: 'drop', label: 'Ride the drop tower', name: 'On the drop tower', exit: exitAt(TOWER.x - 5.5, TOWER.z + 2),
    seat(v) { ringSeat.localToWorld(v.set(3.1, 0.95, 0)); }, fwd(v) { const a = ringSeat.rotation.y; v.set(Math.cos(a), -0.3, -Math.sin(a)); } }, ringSeat, { x: W(TOWER.x, TOWER.z).x, z: W(TOWER.x, TOWER.z).z, r: 6 });
}

// the balloon carousel: striped hot-air balloons on gilded arms, turning and rising and falling
const BAL = { x: 0, z: -12 }, balTop = new THREE.Group(), balloons = [];
{
  const m = new Merge();
  m.add(new THREE.CylinderGeometry(3, 3.4, 0.6, 32), new V3(BAL.x, 0.3, BAL.z), new V3(1, 1, 1), C('#f4ecd8'));
  m.limb(new V3(BAL.x, 0, BAL.z), new V3(BAL.x, 10.5, BAL.z), 0.5, 0.4, C('#d6aa3e'));
  m.add(GEO.cone, new V3(BAL.x, 11.5, BAL.z), new V3(2, 2, 2), C('#a8232e'));
  hall.add(new THREE.Mesh(m.build(), gold));
  balTop.position.set(BAL.x, 9.5, BAL.z); hall.add(balTop);
  const ENV = ['#a8232e', '#1f3f8a', '#c9a23a', '#a8232e', '#1f3f8a', '#c9a23a'];
  for (let k = 0; k < 6; k++) {
    const arm = new THREE.Group(); arm.rotation.y = k / 6 * Math.PI * 2; balTop.add(arm);
    const am = new Merge(); am.limb(new V3(0, 0, 0), new V3(6.2, 0, 0), 0.08, 0.08, C('#d6aa3e')); arm.add(new THREE.Mesh(am.build(), gold));
    const b = new THREE.Group(); b.position.set(6.2, 0, 0); arm.add(b);
    const bm = new Merge(), c = C(ENV[k]);
    bm.add(GEO.sph, new V3(0, -1.8, 0), new V3(1.5, 1.8, 1.5), c);
    for (let s = 0; s < 6; s++) { const a = s / 6 * Math.PI * 2; bm.add(GEO.box, new V3(Math.cos(a) * 1.46, -1.8, Math.sin(a) * 1.46), new V3(0.25, 3.2, 0.04), C('#f4ecd8'), new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), -a + Math.PI / 2)); }
    for (const [x, z] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) bm.limb(new V3(x * 1.5, -3.2, z * 1.5), new V3(x, -4.3, z), 0.02, 0.02, C('#8a6a4c'));
    bm.add(GEO.box, new V3(0, -4.7, 0), new V3(1.3, 0.8, 1.3), C('#c9a23a'));
    b.add(new THREE.Mesh(bm.build(), toy)); balloons.push({ b, ph: k * 1.1 });
  }
  ride({ key: 'balloons', label: 'Ride a balloon', name: 'In a hot-air balloon', follow: true, exit: exitAt(BAL.x + 9, BAL.z),
    seat(v) { balloons[0].b.localToWorld(v.set(0, -3.8, 0)); } }, balTop, { x: W(BAL.x, BAL.z).x, z: W(BAL.x, BAL.z).z, r: 8 });
}

// the royal train: crimson-and-gold carriages on a track down the gallery and round both ends
const TR = { x: 11.5, z: 44 }, TRL = 4 * TR.z + 2 * Math.PI * TR.x, train = [];
// a point at distance s along the track: up the west side, round the north end, down the east, round the south
function trackAt(s) {
  s = ((s % TRL) + TRL) % TRL; const L = 2 * TR.z, A = Math.PI * TR.x;
  if (s < L) return [-TR.x, TR.z - s];
  if ((s -= L) < A) { const a = Math.PI + s / TR.x; return [Math.cos(a) * TR.x, -TR.z + Math.sin(a) * TR.x]; }
  if ((s -= A) < L) return [TR.x, -TR.z + s];
  s -= L; const a = s / TR.x; return [Math.cos(a) * TR.x, TR.z + Math.sin(a) * TR.x];
}
{
  const m = new Merge();
  for (let s = 0; s < TRL; s += 1.5) { const [x, z] = trackAt(s), [x2, z2] = trackAt(s + 0.5), a = Math.atan2(x2 - x, z2 - z); m.add(GEO.box, new V3(x, 0.08, z), new V3(2.2, 0.12, 0.3), C('#5a3a1e'), new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), a)); for (const o of [-0.7, 0.7]) m.add(GEO.box, new V3(x + Math.cos(a) * o, 0.2, z - Math.sin(a) * o), new V3(0.08, 0.1, 1.55), C('#c9a23a'), new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), a)); }
  hall.add(new THREE.Mesh(m.build(), toy));
  const CAR = ['#7a1a2a', '#a8232e', '#1f3f8a', '#a8232e', '#1f3f8a'];
  CAR.forEach((col, k) => {
    const g = new THREE.Group(), cm = new Merge(), c = C(col), G = C('#d6aa3e');
    if (k === 0) { cm.add(GEO.box, new V3(0, 1, 0), new V3(1.8, 1.4, 2.6), c); cm.add(new THREE.CylinderGeometry(0.7, 0.7, 2.2, 16).rotateX(Math.PI / 2), new V3(0, 1.3, 1.6), new V3(1, 1, 1), G); cm.add(GEO.cylB, new V3(0, 1.9, 2.2), new V3(0.25, 0.9, 0.25), C('#2a2228')); cm.add(GEO.box, new V3(0, 2.3, -0.6), new V3(1.9, 0.15, 1.6), G); }
    else { cm.add(GEO.box, new V3(0, 0.75, 0), new V3(1.8, 0.9, 2.4), c); cm.add(GEO.box, new V3(0, 1.25, 0), new V3(1.9, 0.12, 2.5), G); }
    for (const z of [-0.8, 0.8]) for (const s of [-1, 1]) cm.add(new THREE.CylinderGeometry(0.35, 0.35, 0.15, 12).rotateZ(Math.PI / 2), new V3(s * 0.95, 0.35, z), new V3(1, 1, 1), G);
    g.add(new THREE.Mesh(cm.build(), toy)); hall.add(g); train.push(g);
  });
  ride({ key: 'train', label: 'Ride the royal train', name: 'On the royal train', follow: true, exit: exitAt(-TR.x + 2.5, 30),
    seat(v) { train[2].localToWorld(v.set(0, 2.1, 0)); } }, train[0], { x: W(-TR.x, 30).x, z: W(-TR.x, 30).z, r: 4 });
}

// bumper cars: a royal-blue arena with a gilded rail; your own car (car 0) you drive while riding
const ARENA = { x: 0, z: 36, hw: 8, hd: 5.5 }, cars = [];
let driving = false;
{
  const m = new Merge();
  m.add(GEO.box, new V3(ARENA.x, 0.1, ARENA.z), new V3(ARENA.hw * 2 + 1, 0.2, ARENA.hd * 2 + 1), C('#1f2f6a'));
  for (const [x, z, w, d] of [[0, -ARENA.hd - 0.4, ARENA.hw * 2 + 1.6, 0.6], [0, ARENA.hd + 0.4, ARENA.hw * 2 + 1.6, 0.6], [-ARENA.hw - 0.4, 0, 0.6, ARENA.hd * 2 + 1.6], [ARENA.hw + 0.4, 0, 0.6, ARENA.hd * 2 + 1.6]]) m.add(GEO.box, new V3(ARENA.x + x, 0.5, ARENA.z + z), new V3(w, 0.8, d), C('#d6aa3e'));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.limb(new V3(ARENA.x + sx * (ARENA.hw + 0.4), 0, ARENA.z + sz * (ARENA.hd + 0.4)), new V3(ARENA.x + sx * (ARENA.hw + 0.4), 6, ARENA.z + sz * (ARENA.hd + 0.4)), 0.15, 0.15, C('#d6aa3e'));
  m.add(GEO.box, new V3(ARENA.x, 6.1, ARENA.z), new V3(ARENA.hw * 2 + 1.4, 0.3, ARENA.hd * 2 + 1.4), C('#1f2f6a'));
  hall.add(new THREE.Mesh(m.build(), gold));
  for (let x = -ARENA.hw; x <= ARENA.hw; x += 1.2) for (const z of [-ARENA.hd - 0.4, ARENA.hd + 0.4]) bulb(ARENA.x + x, 6.4, ARENA.z + z, '#ffd890');
  for (let x = -ARENA.hw + 1; x < ARENA.hw; x += 2) for (let z = -ARENA.hd + 1; z < ARENA.hd; z += 2) bulb(ARENA.x + x, 5.9, ARENA.z + z, '#fff6d0');
  const COL = ['#a8232e', '#1f3f8a', '#c9a23a', '#f4ecd8', '#7a1a2a', '#2f6a45', '#a8232e'];
  COL.forEach(col => {
    const g = new THREE.Group(), cm = new Merge(), c = C(col);
    cm.add(new THREE.CylinderGeometry(1.15, 1.2, 0.5, 20), new V3(0, 0.45, 0), new V3(1.2, 1, 1.45), C('#2c2c2c'));
    cm.add(GEO.box, new V3(0, 0.85, -0.1), new V3(1.8, 0.5, 2.2), c);
    cm.add(GEO.box, new V3(0, 1.3, -0.75), new V3(1.6, 0.6, 0.3), c);
    cm.limb(new V3(0, 1.0, -0.6), new V3(0, 5.9, -0.6), 0.03, 0.03, C('#c9c3b5'));
    cm.add(new THREE.TorusGeometry(0.28, 0.05, 6, 16).rotateX(-0.9), new V3(0, 1.35, 0.4), new V3(1, 1, 1), C('#2c2c2c'));
    g.add(new THREE.Mesh(cm.build(), toy)); hall.add(g);
    cars.push({ g, x: ARENA.x + (R() - 0.5) * ARENA.hw * 1.6, z: ARENA.z + (R() - 0.5) * ARENA.hd * 1.6, h: R() * 6.28, v: 2 + R() * 1.5, turn: 0 });
  });
  ride({ key: 'bumper', label: 'Drive a bumper car', name: 'Bumper cars: W to drive, A D to steer', exit: exitAt(ARENA.x + ARENA.hw + 2.2, ARENA.z),
    board() { driving = true; cars[0].v = 0; }, leave() { driving = false; },
    seat(v) { cars[0].g.localToWorld(v.set(0, 1.75, 0.35)); }, fwd(v) { v.set(Math.sin(cars[0].h), 0, Math.cos(cars[0].h)); },
    drive(dt, ix, iz) { const c = cars[0]; c.v += (iz * 5 - c.v) * Math.min(1, dt * 2.2); c.h -= ix * dt * 2.2 * (0.4 + Math.min(1, Math.abs(c.v) / 3)); } },
    cars[0].g, { x: W(ARENA.x + ARENA.hw + 1.5, ARENA.z).x, z: W(ARENA.x + ARENA.hw + 1.5, ARENA.z).z, r: 3.4 });
}

// every light in the gallery: candles and crystals, gently flickering
{
  const n = bulbs.length / 6, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), ph = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos.set(bulbs.slice(i * 6, i * 6 + 3), i * 3); col.set(bulbs.slice(i * 6 + 3, i * 6 + 6), i * 3); ph[i] = R() * 100; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
  const pts = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true, fog: false,
    vertexShader: 'uniform float uTime;attribute float aPh;varying vec3 vC;void main(){vC=color*(.8+.2*sin(uTime*3.+aPh));vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(240./-mv.z,2.,16.);gl_Position=projectionMatrix*mv;}',
    fragmentShader: 'varying vec3 vC;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,.0,d)*.55+smoothstep(.16,.0,d);gl_FragColor=vec4(vC*a,a);}' }));
  hall.add(pts); hall.userData.pts = pts;
}

/* ---------- every frame while you are inside ---------- */
addTick(dt => {
  if (!hall.visible) return;
  hall.userData.pts.material.uniforms.uTime.value = T;
  teaTop.rotation.y = T * 0.35; teaSubs.forEach((s, i) => { s.rotation.y = -T * 0.9 + i; }); cups.forEach((c, i) => { c.rotation.y = T * (1.4 + (i % 3) * 0.3); });
  // the drop tower: up slowly for 9 s, a breath at the top, a sudden fall, bounce, rest
  { const t = T % 18; dropY = t < 9 ? 2 + smooth(0, 9, t) * 16 : t < 11 ? 18 : t < 12 ? 18 - 16 * Math.pow(t - 11, 2) : 2 + Math.abs(Math.sin((t - 12) * 6)) * Math.exp(-(t - 12) * 2.5) * 1.5; ringSeat.position.y = dropY; ringSeat.rotation.y = T * 0.1; }
  balTop.rotation.y = T * 0.45; balloons.forEach(b => { b.b.position.y = Math.sin(T * 0.8 + b.ph) * 1.4; });
  train.forEach((c, k) => { const s = T * 4.2 - k * 2.9, [x, z] = trackAt(s), [x2, z2] = trackAt(s + 0.4); c.position.set(x, 0, z); c.rotation.y = Math.atan2(x2 - x, z2 - z); });
  // bumper cars: the others wander, everyone bounces off the rail and off each other
  cars.forEach((c, k) => {
    if (!(k === 0 && driving)) { c.turn += (R() - 0.5) * dt * 3; c.turn = clamp(c.turn, -1, 1); c.h += c.turn * dt * 1.2; c.v += (2.6 - c.v) * dt; }
    // your car: ui/worlds.js puts the keys (or joystick) on the ride as ix, iz
    if (k === 0 && driving) { const d = hallRides.find(r => r.key === 'bumper'); d.drive(dt, d.ix || 0, d.iz || 0); }
    c.x += Math.sin(c.h) * c.v * dt; c.z += Math.cos(c.h) * c.v * dt;
    if (c.x < ARENA.x - ARENA.hw + 1.2) { c.x = ARENA.x - ARENA.hw + 1.2; c.h = -c.h; c.v *= 0.6; }
    if (c.x > ARENA.x + ARENA.hw - 1.2) { c.x = ARENA.x + ARENA.hw - 1.2; c.h = -c.h; c.v *= 0.6; }
    if (c.z < ARENA.z - ARENA.hd + 1.2) { c.z = ARENA.z - ARENA.hd + 1.2; c.h = Math.PI - c.h; c.v *= 0.6; }
    if (c.z > ARENA.z + ARENA.hd - 1.2) { c.z = ARENA.z + ARENA.hd - 1.2; c.h = Math.PI - c.h; c.v *= 0.6; }
  });
  for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
    const a = cars[i], b = cars[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
    if (d < 2.4 && d > 0.01) { const push = (2.4 - d) / 2, nx = dx / d, nz = dz / d; a.x -= nx * push; a.z -= nz * push; b.x += nx * push; b.z += nz * push; a.h += Math.PI * 0.6; b.h -= Math.PI * 0.6; a.v *= 0.5; b.v *= 0.5; }
  }
  cars.forEach(c => { c.g.position.set(c.x, 0, c.z); c.g.rotation.y = c.h; });
});

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
  else if (Math.abs(lx - HALL.x) < 2.6 && lz - HALL.z > HALL.hl - 3.6) late.leaveHall && late.leaveHall();
}, true);
export const hallArrive = { pos: W(0, HALL.hl - 7), yaw: 0 };
export const castleFront = { pos: O.clone().add(new V3(CASTLE.x, 0, CASTLE.z + 17)), yaw: 0 };
export function showHall(on) { hall.visible = on; }
export const inHall = (x, z) => Math.abs(x - (O.x + HALL.x)) < HALL.hw + 4 && Math.abs(z - (O.z + HALL.z)) < HALL.hl + 4;
// standing and walking inside: the floor is level; the walls, the candelabra and the rides stop you
{
  const f = worlds.sun.floorH, b = worlds.sun.blocked;
  worlds.sun.floorH = (x, z) => inHall(x, z) ? O.y + HALL.y : f(x, z);
  worlds.sun.blocked = (x, z) => {
    if (!inHall(x, z)) return b(x, z);
    const lx = x - O.x - HALL.x, lz = z - O.z - HALL.z;
    if (Math.abs(lx) > HALL.hw - 2.1 || Math.abs(lz) > HALL.hl - 1.2) return true;
    if (Math.hypot(lx - TEA.x, lz - TEA.z) < TEA.r + 0.5 || Math.hypot(lx - TOWER.x, lz - TOWER.z) < 4.2 || Math.hypot(lx - BAL.x, lz - BAL.z) < 8) return true;
    if (Math.abs(lx - ARENA.x) < ARENA.hw + 0.8 && Math.abs(lz - ARENA.z) < ARENA.hd + 0.8) return true;
    return false;
  };
}
