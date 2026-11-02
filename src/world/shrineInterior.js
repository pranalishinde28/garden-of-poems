import * as THREE from 'three';
import { C, V3 } from '../core/util.js';
import { canvasTex, glowTex } from './textures.js';
import { DS } from './geometry.js';
import { worlds } from '../core/worlds.js';
import { state } from '../core/state.js';
import { addTick, regThing } from '../core/things.js';
import { late } from '../core/late.js';
import { SFX } from '../animals/animals.js';

/* ================= inside the garden's pagoda: a Japanese shrine hall ================= */
// After the owner's photographs (Kasuga Taisha's bronze hanging lanterns, a haiden with a painted coffered
// ceiling and red-and-white curtains, Itsukushima's vermilion pillars over a polished floor, a lantern-lit
// shrine at night). Vermilion pillars and tie beams, white plaster, black lattice windows, a dark polished
// floor; rows of bronze hanging lanterns glowing through pierced honeycomb; a ceiling of painted panels;
// at the back a raised dais behind a shimenawa rope and its zigzag papers, curtains of white and red, the
// small inner shrine, the round mirror, sakaki, offerings and two great paper lanterns; the suzu bell to
// ring (then two claps) and a taiko to strike. Its own scene (state.world 'shrine'), built on first entry.

const SO = new V3(3000, 0, 400);
export const shrineScene = new THREE.Scene();
shrineScene.background = C('#140c08');
const root = new THREE.Group(); root.position.copy(SO); shrineScene.add(root);
const W = 11, DOOR_Z = 13, BACK_Z = -15, WALL_H = 5.4, CEIL = 6.4, DAIS_Z = -10.4, DAIS_H = 0.75;
const PILLARS = []; for (const x of [-9, -4, 4, 9]) for (const z of [9, 3, -3, -9]) PILLARS.push([x, z]);
const BELL = { x: 0, z: -9.3 }, TAIKO = { x: 6.6, z: -8.6 }, CHOCHIN = [[-2.6, -9.6], [2.6, -9.6]];

/* ---------- painted surfaces ---------- */
function textures() {
  // the polished floor: long dark boards
  const floor = canvasTex(512, 512, (g, S) => {
    for (let i = 0; i < 8; i++) { const x = i * S / 8; g.fillStyle = `hsl(20,${30 + Math.random() * 10}%,${15 + Math.random() * 5}%)`; g.fillRect(x, 0, S / 8, S); g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(x, 0, 2, S); g.fillRect(x, Math.random() * S, S / 8, 2); }
    g.globalAlpha = 0.15; for (let i = 0; i < 300; i++) { g.strokeStyle = Math.random() < 0.5 ? '#000' : '#7a4a30'; g.beginPath(); const x = Math.random() * S; g.moveTo(x, 0); g.bezierCurveTo(x + Math.random() * 6 - 3, S / 3, x + Math.random() * 6 - 3, S * 2 / 3, x, S); g.stroke(); }
  }, true);
  // the ceiling: a grid of painted panels (flowers, cranes, clouds) in faded colours, dark lacquered ribs
  const ceil = canvasTex(1024, 1024, (g, S) => {
    const n = 8, c = S / n, R = (a, b) => a + Math.random() * (b - a);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = i * c, y = j * c, cx = x + c / 2, cy = y + c / 2, k = (i * 3 + j * 5) % 6;
      g.fillStyle = `hsl(40,${R(25, 40)}%,${R(76, 84)}%)`; g.fillRect(x, y, c, c);
      g.save(); g.translate(cx, cy);
      if (k === 0 || k === 3) { // a peony or chrysanthemum
        const col = k ? ['#c0574a', '#e39a8a'] : ['#c9a03a', '#ecd27a'];
        for (let p = 0; p < 14; p++) { const a = p / 14 * 6.283; g.fillStyle = col[p % 2]; g.beginPath(); g.ellipse(Math.cos(a) * 18, Math.sin(a) * 18, 20, 9, a, 0, 7); g.fill(); }
        g.fillStyle = '#7a3a2a'; g.beginPath(); g.arc(0, 0, 9, 0, 7); g.fill();
        g.fillStyle = '#4a7a5a'; for (const a of [0.8, 2.4, 4.0, 5.6]) { g.beginPath(); g.ellipse(Math.cos(a) * 42, Math.sin(a) * 42, 14, 6, a, 0, 7); g.fill(); }
      } else if (k === 1 || k === 4) { // a crane in flight
        g.rotate(k === 1 ? -0.4 : 0.5); g.fillStyle = '#f6f2ea'; g.beginPath(); g.ellipse(0, 0, 26, 9, 0, 0, 7); g.fill();
        g.beginPath(); g.moveTo(-6, -2); g.quadraticCurveTo(-10, -44, 18, -50); g.quadraticCurveTo(6, -24, 8, -2); g.fill(); g.beginPath(); g.moveTo(-6, 2); g.quadraticCurveTo(-14, 40, 14, 46); g.quadraticCurveTo(4, 22, 8, 2); g.fill();
        g.strokeStyle = '#2a2a2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(24, 0); g.lineTo(46, -6); g.stroke(); g.fillStyle = '#c0302a'; g.beginPath(); g.arc(46, -7, 4, 0, 7); g.fill();
        g.fillStyle = '#2a2a2a'; g.beginPath(); g.moveTo(14, -48); g.lineTo(20, -52); g.lineTo(18, -40); g.fill();
      } else { // clouds in blue and gold
        g.strokeStyle = k === 2 ? '#4a6a8a' : '#b08a3a'; g.lineWidth = 5;
        for (const [ox, oy, r] of [[-20, 8, 16], [4, -6, 20], [26, 10, 14]]) { g.beginPath(); g.arc(ox, oy, r, Math.PI, 0); g.stroke(); g.beginPath(); g.arc(ox, oy, r * 0.5, Math.PI, 0); g.stroke(); }
        g.beginPath(); g.moveTo(-44, 12); g.lineTo(44, 12); g.stroke();
      }
      g.restore();
      g.fillStyle = `rgba(90,60,30,${R(0.05, 0.16)})`; g.fillRect(x, y, c, c); // age
      g.strokeStyle = '#2a1810'; g.lineWidth = 12; g.strokeRect(x, y, c, c); g.strokeStyle = '#6a4a2a'; g.lineWidth = 2; g.strokeRect(x + 8, y + 8, c - 16, c - 16);
    }
  }, true);
  // a bronze lantern's pierced body: honeycomb and flower windows, glowing where pierced
  const pierce = (glow) => canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = glow ? '#000' : '#3d4a3a'; g.fillRect(0, 0, w, h);
    const hole = glow ? '#ffd27a' : '#e8b860';
    for (let p = 0; p < 6; p++) {
      const x0 = p * w / 6 + 8, x1 = (p + 1) * w / 6 - 8;
      if (!glow) { g.fillStyle = '#56685a'; g.fillRect(x0 - 6, 6, x1 - x0 + 12, h - 12); g.fillStyle = '#2a332a'; g.fillRect(x0, 12, x1 - x0, h - 24); }
      g.fillStyle = hole;
      if (p % 2 === 0) { for (let r = 0; r < 7; r++) for (let q = 0; q < 6; q++) { const cx = x0 + 6 + q * 12 + (r % 2) * 6, cy = 18 + r * 13; if (cx < x1 - 4) { g.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283 + 0.52; g.lineTo(cx + Math.cos(a) * 5, cy + Math.sin(a) * 5); } g.fill(); } } }
      else { const cx = (x0 + x1) / 2, cy = h / 2; for (let k = 0; k < 5; k++) { const a = k / 5 * 6.283 - 1.57; g.beginPath(); g.ellipse(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14, 11, 7, a, 0, 7); g.fill(); } for (let k = 0; k < 8; k++) { g.fillRect(x0 + 4, 16 + k * 12, 6, 6); g.fillRect(x1 - 10, 16 + k * 12, 6, 6); } }
    }
  });
  // the curtains: white with red stripes and a mon (a circle of three commas)
  const maku = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#f4efe6'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) { g.fillStyle = '#b8282a'; g.fillRect(i * w / 4 + w / 8 - 14, 0, 28, h); }
    for (let i = 0; i < 4; i++) { const cx = i * w / 4 + w / 8 + 64 * (i % 2 ? -1 : 1) * 0, cy = h * 0.3 + (i % 2) * h * 0.35; g.fillStyle = '#f4efe6'; g.beginPath(); g.arc(cx, cy, 34, 0, 7); g.fill(); ume(g, cx, cy, 30, '#b8282a'); }
    g.fillStyle = 'rgba(0,0,0,.08)'; for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 3, h);
  });
  // the taiko's head: three commas in black on cream
  const head = canvasTex(256, 256, (g, S) => { g.fillStyle = '#e8dcc0'; g.fillRect(0, 0, S, S); g.fillStyle = 'rgba(120,90,50,.25)'; g.beginPath(); g.arc(S / 2, S / 2, S * 0.48, 0, 7); g.fill(); tomoe(g, S / 2, S / 2, S * 0.3, '#1e1a18'); });
  // a great paper lantern: red-orange ribs, black lettering ("sacred light"), dark rims
  const paper = canvasTex(512, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#c8501e'); gr.addColorStop(0.5, '#f08a36'); gr.addColorStop(1, '#c8501e'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(80,20,0,.35)'; g.lineWidth = 3; for (let y = 8; y < h; y += 18) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.fillStyle = '#1a0c06'; g.font = 'bold 118px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const x of [w * 0.25, w * 0.75]) ['御', '神', '燈'].forEach((ch, i) => g.fillText(ch, x, h * 0.2 + i * h * 0.3));
  });
  return { floor, ceil, pierceMap: pierce(false), pierceGlow: pierce(true), maku, head, paper };
}
// mitsudomoe: three commas chasing round, each a round head with a tail that thins along the rim
function tomoe(g, cx, cy, r, col) {
  g.fillStyle = col;
  for (let k = 0; k < 3; k++) {
    const a = k / 3 * 6.283, hx = cx + Math.cos(a) * r * 0.5, hy = cy + Math.sin(a) * r * 0.5;
    g.beginPath(); g.arc(hx, hy, r * 0.42, 0, 7); g.fill();
    g.beginPath();
    for (let i = 0; i <= 24; i++) { const t = i / 24, an = a + t * 2.3; g.lineTo(cx + Math.cos(an) * r * 0.92, cy + Math.sin(an) * r * 0.92); }
    for (let i = 24; i >= 0; i--) { const t = i / 24, an = a + t * 2.3, rr = r * (0.92 - 0.5 * Math.pow(1 - t, 1.6)); g.lineTo(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr); }
    g.fill();
  }
}
// ume-bachi: the plum-blossom crest, five round petals round a ring
function ume(g, cx, cy, r, col) {
  g.fillStyle = col;
  for (let k = 0; k < 5; k++) { const a = k / 5 * 6.283 - Math.PI / 2; g.beginPath(); g.arc(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55, r * 0.4, 0, 7); g.fill(); }
  g.fillStyle = '#f4efe6'; g.beginPath(); g.arc(cx, cy, r * 0.2, 0, 7); g.fill(); g.fillStyle = col; g.beginPath(); g.arc(cx, cy, r * 0.09, 0, 7); g.fill();
}

/* ---------- the hall ---------- */
let built = false, bell = null, drum = null;
const glows = [];
function plane(w, h, mat, x, y, z, ry = 0, rx = 0) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0, 'YXZ'); root.add(m); return m; }
function box(w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); root.add(m); return m; }
function glow(x, y, z, s, col, op) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false })); sp.position.set(x, y, z); sp.scale.set(s, s, s); root.add(sp); glows.push({ sp, op, ph: Math.random() * 6 }); return sp; }
const lathe = (pts, n = 16) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), n);

function build() {
  if (built) return; built = true;
  const X = textures();
  shrineScene.add(new THREE.HemisphereLight('#ffe6c8', '#2a1810', 0.42));
  shrineScene.add(new THREE.AmbientLight('#ffd8b0', 0.1));
  const pl = (x, y, z, i, d, col = '#ffb868') => { const l = new THREE.PointLight(col, i, d, 1.7); l.position.set(x, y, z).add(SO); shrineScene.add(l); };
  for (const z of [7, 0, -6]) for (const x of [-6.5, 6.5]) pl(x, 3.2, z, 0.5, 10);
  pl(0, 3.4, -12, 0.75, 14, '#ffc880'); pl(0, 3, 11, 0.45, 12, '#ffe6c8');

  const vermilion = new THREE.MeshPhongMaterial({ color: '#d2431c', shininess: 28, specular: '#3a2010' });
  const plaster = new THREE.MeshLambertMaterial({ color: '#efe8da' });
  const woodM = new THREE.MeshLambertMaterial({ color: '#8a6440' });
  const blackM = new THREE.MeshPhongMaterial({ color: '#1a1412', shininess: 40 });
  const bronze = new THREE.MeshPhongMaterial({ color: '#4f6a58', shininess: 30, specular: '#5a6a4a' });
  const giltM = new THREE.MeshPhongMaterial({ color: '#d4a640', shininess: 70, specular: '#8a6a2a' });

  // floor, walls, ceiling
  X.floor.repeat.set(2 * W / 4, (DOOR_Z - BACK_Z) / 4);
  plane(2 * W, DOOR_Z - BACK_Z, new THREE.MeshPhongMaterial({ map: X.floor, shininess: 110, specular: '#6a5040' }), 0, 0, (DOOR_Z + BACK_Z) / 2, 0, -Math.PI / 2);
  for (const s of [-1, 1]) {
    plane(DOOR_Z - BACK_Z, WALL_H, plaster, s * W, WALL_H / 2, (DOOR_Z + BACK_Z) / 2, -s * Math.PI / 2);
    box(0.08, 1.0, DOOR_Z - BACK_Z, woodM, s * (W - 0.04), 0.5, (DOOR_Z + BACK_Z) / 2); // wainscot
    // black lattice windows between the pillars, daylight behind
    for (const z of [6, 0, -6]) {
      plane(4.6, 2.8, new THREE.MeshBasicMaterial({ color: '#f2e2c2' }), s * (W - 0.02), 2.7, z, -s * Math.PI / 2);
      for (let k = 0; k <= 12; k++) box(0.08, 2.9, 0.06, blackM, s * (W - 0.08), 2.7, z - 2.3 + k * 4.6 / 12);
      for (const y of [1.3, 4.1, 2.7]) box(0.1, 0.1, 4.7, blackM, s * (W - 0.08), y, z);
      glow(s * (W - 0.6), 2.7, z, 4.5, '#ffe6c0', 0.12);
    }
  }
  plane(2 * W, WALL_H, plaster, 0, WALL_H / 2, BACK_Z, 0);
  // the entrance wall and its open doors onto daylight
  for (const s of [-1, 1]) plane(W - 2.4, WALL_H, plaster, s * (W + 2.4) / 2, WALL_H / 2, DOOR_Z, Math.PI);
  plane(4.8, WALL_H - 3.6, plaster, 0, 3.6 + (WALL_H - 3.6) / 2, DOOR_Z, Math.PI);
  const day = plane(4.8, 3.6, new THREE.MeshBasicMaterial({ color: '#fff2d8' }), 0, 1.8, DOOR_Z + 0.05, Math.PI);
  box(5.2, 0.3, 0.3, vermilion, 0, 3.75, DOOR_Z - 0.15); for (const s of [-1, 1]) box(0.3, 3.6, 0.3, vermilion, s * 2.55, 1.8, DOOR_Z - 0.15);
  regThing(day, 'Step back outside', () => late.leaveTemple && late.leaveTemple(), { x: SO.x, z: SO.z + DOOR_Z - 1.4, r: 2.4 });
  // the ceiling: a cove of dark ribs from the walls, then the painted panels
  X.ceil.repeat.set((2 * W - 3.2) / 7.2, (DOOR_Z - BACK_Z - 3.2) / 7.2);
  plane(2 * W - 3.2, DOOR_Z - BACK_Z - 3.2, new THREE.MeshLambertMaterial({ map: X.ceil }), 0, CEIL, (DOOR_Z + BACK_Z) / 2, 0, Math.PI / 2);
  const cove = new THREE.MeshLambertMaterial({ color: '#5a3a22', side: DS }), L = DOOR_Z - BACK_Z, cz = (DOOR_Z + BACK_Z) / 2, tilt = Math.atan2(CEIL - WALL_H, 1.6), cw = Math.hypot(1.6, CEIL - WALL_H);
  for (const s of [-1, 1]) {
    const a = plane(L, cw, cove, s * (W - 0.8), (WALL_H + CEIL) / 2, cz); a.rotation.set(Math.PI / 2 - tilt, -s * Math.PI / 2, 0, 'YXZ');
    const b = plane(2 * W, cw, cove, 0, (WALL_H + CEIL) / 2, s > 0 ? DOOR_Z - 0.8 : BACK_Z + 0.8); b.rotation.set(Math.PI / 2 - tilt, s > 0 ? Math.PI : 0, 0, 'YXZ');
  }
  box(2 * W, 0.3, 0.3, vermilion, 0, WALL_H, DOOR_Z - 0.15); box(2 * W, 0.3, 0.3, vermilion, 0, WALL_H, BACK_Z + 0.15);
  for (const s of [-1, 1]) box(0.3, 0.3, L, vermilion, s * (W - 0.15), WALL_H, cz);
  // vermilion pillars on stone bases, tied by beams
  const pGeo = new THREE.CylinderGeometry(0.28, 0.3, WALL_H, 20);
  for (const [x, z] of PILLARS) {
    const p = new THREE.Mesh(pGeo, vermilion); p.position.set(x, WALL_H / 2, z); root.add(p);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.22, 20), blackM); b.position.set(x, 0.11, z); root.add(b);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.14, 20), giltM); c.position.set(x, 0.3, z); root.add(c);
  }
  for (const x of [-9, -4, 4, 9]) box(0.24, 0.32, L, vermilion, x, 4.6, cz);
  for (const z of [9, 3, -3, -9]) box(2 * W, 0.32, 0.24, vermilion, 0, 4.6, z);

  // the bronze hanging lanterns, two rows down the hall and a few by the dais
  const bodyG = new THREE.CylinderGeometry(0.3, 0.3, 0.52, 6, 1, true), bodyM = new THREE.MeshPhongMaterial({ map: X.pierceMap, emissive: '#ffb050', emissiveMap: X.pierceGlow, emissiveIntensity: 1.1, shininess: 30, side: DS });
  const roofG = lathe([[0.02, 0.42], [0.08, 0.36], [0.18, 0.2], [0.42, 0.04], [0.5, 0.0], [0.44, -0.02], [0.3, 0.0]], 6), baseG = lathe([[0.31, 0], [0.36, -0.06], [0.36, -0.12], [0.28, -0.15], [0.42, -0.36], [0.38, -0.38], [0.2, -0.2]], 6);
  const spots = []; for (const x of [-6.5, 6.5]) for (let z = 10; z > -8; z -= 2.6) spots.push([x, z, 3.3 + ((z * 7) % 2 === 0 ? 0 : 0.25)]);
  for (const [x, z, y] of spots) {
    const body = new THREE.Mesh(bodyG, bodyM); body.position.set(x, y, z); root.add(body);
    const top = new THREE.Mesh(roofG, bronze); top.position.set(x, y + 0.26, z); root.add(top);
    const bot = new THREE.Mesh(baseG, bronze); bot.position.set(x, y - 0.26, z); root.add(bot);
    for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283; const curl = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 6, 10, 4.2), bronze); curl.position.set(x + Math.cos(a) * 0.5, y + 0.32, z + Math.sin(a) * 0.5); curl.rotation.set(0, -a + Math.PI / 2, 0); root.add(curl); }
    const fin = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), bronze); fin.position.set(x, y + 0.76, z); root.add(fin);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.015, 6, 12), bronze); ring.position.set(x, y + 0.88, z); root.add(ring);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 3.7 - y, 4), blackM); chain.position.set(x, (4.6 + y + 0.9) / 2, z); root.add(chain);
    glow(x, y, z, 1.5, '#ffb050', 0.42);
  }
  // the dais: unvarnished wood, three steps, a black lacquered rail
  const hinoki = new THREE.MeshLambertMaterial({ color: '#c8a678' });
  box(2 * W - 0.2, DAIS_H, DAIS_Z - BACK_Z, hinoki, 0, DAIS_H / 2, (DAIS_Z + BACK_Z) / 2);
  for (let k = 0; k < 3; k++) box(3.2, DAIS_H * (k + 1) / 3, 0.3, hinoki, 0, DAIS_H * (k + 1) / 6, DAIS_Z + 0.75 - k * 0.3);
  for (const s of [-1, 1]) { box(W - 2.0, 0.06, 0.06, blackM, s * (W / 2 + 0.8), DAIS_H + 0.5, DAIS_Z + 0.1); for (let k = 0; k < 6; k++) box(0.08, 0.5, 0.08, blackM, s * (2.0 + k * (W - 2.4) / 5), DAIS_H + 0.25, DAIS_Z + 0.1); }
  // curtains of white and red along the back, swagged purple valance
  X.maku.wrapS = THREE.RepeatWrapping; X.maku.repeat.set(2 * W / 5, 1);
  plane(2 * W - 0.4, WALL_H - DAIS_H - 0.6, new THREE.MeshLambertMaterial({ map: X.maku }), 0, DAIS_H + (WALL_H - DAIS_H - 0.6) / 2, BACK_Z + 0.08);
  box(2 * W - 0.3, 0.55, 0.12, new THREE.MeshLambertMaterial({ color: '#5a2a6a' }), 0, WALL_H - 0.35, BACK_Z + 0.14);
  // the inner shrine: a small house with a gabled roof, closed doors and gilt fittings
  const hz = BACK_Z + 1.6, hy = DAIS_H + 0.9;
  box(3.4, 0.9, 2.2, blackM, 0, DAIS_H + 0.45, hz); box(2.6, 1.8, 1.7, new THREE.MeshLambertMaterial({ color: '#b08a5a' }), 0, hy + 0.9, hz);
  for (const s of [-1, 1]) { box(1.1, 1.5, 0.05, new THREE.MeshLambertMaterial({ color: '#2a1a12' }), s * 0.58, hy + 0.85, hz + 0.86); box(0.08, 1.5, 0.07, giltM, s * 0.02, hy + 0.85, hz + 0.88); }
  for (const s of [-1, 1]) { const r = box(1.8, 0.08, 2.6, new THREE.MeshLambertMaterial({ color: '#3a2a20' }), s * 0.8, hy + 2.15, hz); r.rotation.z = -s * 0.5; }
  box(0.14, 0.14, 2.7, giltM, 0, hy + 2.55, hz); for (const s of [-1, 1]) { const ch = box(0.06, 0.8, 0.06, giltM, s * 0.4, hy + 2.75, hz + 1.2); ch.rotation.z = s * 0.5; } // chigi
  // the mirror on its cloud stand, sakaki in tall vases, offerings on stands, the gohei
  const mirror = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 40), new THREE.MeshPhongMaterial({ color: '#e8e2d0', shininess: 160, specular: '#ffffff', emissive: '#3a3020' })); mirror.rotation.x = Math.PI / 2; mirror.position.set(0, DAIS_H + 1.5, hz + 1.7); root.add(mirror);
  const mr = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.04, 8, 40), giltM); mr.position.copy(mirror.position); root.add(mr);
  box(0.12, 1.0, 0.12, blackM, 0, DAIS_H + 0.55, hz + 1.7); box(1.0, 0.2, 0.5, giltM, 0, DAIS_H + 0.1, hz + 1.7);
  glow(0, DAIS_H + 1.5, hz + 1.8, 1.4, '#fff4e0', 0.25);
  const leaf = new THREE.MeshLambertMaterial({ color: '#2f5a32' }), white = new THREE.MeshLambertMaterial({ color: '#faf7f0' });
  for (const s of [-1, 1]) {
    const vase = new THREE.Mesh(lathe([[0.14, 0], [0.16, 0.1], [0.1, 0.5], [0.12, 0.62]]), white); vase.position.set(s * 2.2, DAIS_H, hz + 1.6); root.add(vase);
    for (let k = 0; k < 26; k++) { const l = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 4), leaf); l.scale.set(0.06, 0.13, 0.03); l.position.set(s * 2.2 + (Math.random() - 0.5) * 0.5, DAIS_H + 0.7 + Math.random() * 0.8, hz + 1.6 + (Math.random() - 0.5) * 0.3); l.rotation.set(Math.random(), Math.random() * 3, Math.random()); root.add(l); }
    for (let k = 0; k < 4; k++) { const sx = s * (0.9 + k * 0.3); box(0.36, 0.28, 0.36, hinoki, sx, DAIS_H + 0.14, hz + 2.5); const b = new THREE.Mesh(lathe([[0.06, 0], [0.09, 0.08], [0.05, 0.25], [0.025, 0.3]], 10), white); b.position.set(sx, DAIS_H + 0.28, hz + 2.5); root.add(b); }
  }
  const gohei = new THREE.Group(); gohei.position.set(0, DAIS_H, hz + 2.6); root.add(gohei);
  { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 6), hinoki); st.position.y = 0.65; gohei.add(st); for (const s of [-1, 1]) shide(gohei, s * 0.06, 1.2, 0.5); }
  // the shimenawa: a thick twisted rope over the dais, its paper zigzags hanging
  { const pts = []; for (let i = 0; i <= 30; i++) { const t = i / 30; pts.push(new V3(-6 + 12 * t, 3.75 - Math.sin(Math.PI * t) * 0.35, DAIS_Z + 0.2)); }
    const ropeM = new THREE.MeshLambertMaterial({ color: '#d8c48a' }); const curve = new THREE.CatmullRomCurve3(pts);
    root.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.16, 10), ropeM));
    for (let k = 0; k < 3; k++) { const tw = []; for (let i = 0; i <= 120; i++) { const t = i / 120, p = curve.getPoint(t), a = t * 40 + k * 2.09; tw.push(new V3(p.x, p.y + Math.cos(a) * 0.13, p.z + Math.sin(a) * 0.13)); } root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tw), 240, 0.06, 6), ropeM)); }
    for (const t of [0.2, 0.4, 0.6, 0.8]) { const p = curve.getPoint(t); const g = new THREE.Group(); g.position.copy(p); root.add(g); shide(g, 0, -0.1, 0.8); }
    for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) { const p = curve.getPoint(t); box(0.06, 0.5, 0.06, ropeM, p.x, p.y - 0.4, p.z); }
  }
  // the bell: a cluster of brass bells under the eave, with its rope of red, white and purple
  bell = new THREE.Group(); bell.position.set(BELL.x, 4.6, BELL.z); root.add(bell);
  { const brass = new THREE.MeshPhongMaterial({ color: '#c8a040', shininess: 90, specular: '#fff0c0' });
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 14), brass); b.position.y = -0.34; bell.add(b);
    const slit = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 0.05), blackM); slit.position.set(0, -0.42, 0.24); bell.add(slit);
    const rope = new THREE.Group(); rope.position.y = -0.6; bell.add(rope);
    ['#c8302a', '#f4f0e6', '#6a3a8a'].forEach((col, k) => { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.9, 6), new THREE.MeshLambertMaterial({ color: col })); r.position.set((k - 1) * 0.06, -1.45, 0); r.rotation.z = (k - 1) * 0.02; rope.add(r); });
    const tas = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 10), new THREE.MeshLambertMaterial({ color: '#c8302a' })); tas.position.y = -3.0; rope.add(tas); }
  // the offering box under it
  const sbox = box(1.8, 0.85, 0.9, new THREE.MeshLambertMaterial({ color: '#6a4a2e' }), BELL.x, 0.425, BELL.z + 0.9);
  for (let k = 0; k < 9; k++) box(0.06, 0.06, 0.92, blackM, BELL.x - 0.8 + k * 0.2, 0.86, BELL.z + 0.9);
  regThing(bell, 'Ring the bell', ringBell, { x: SO.x + BELL.x, z: SO.z + BELL.z + 2.2, r: 1.8 });
  regThing(sbox, 'Ring the bell', ringBell, { x: SO.x + BELL.x, z: SO.z + BELL.z + 2.2, r: 0.01 });
  // the taiko on its stand
  drum = new THREE.Group(); drum.position.set(TAIKO.x, 1.35, TAIKO.z); drum.rotation.y = -0.5; root.add(drum);
  { const bodyG2 = lathe([[0.62, -0.5], [0.72, -0.25], [0.75, 0], [0.72, 0.25], [0.62, 0.5]], 28); bodyG2.rotateX(Math.PI / 2);
    drum.add(new THREE.Mesh(bodyG2, new THREE.MeshPhongMaterial({ color: '#7a2a18', shininess: 50 })));
    for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.CircleGeometry(0.62, 32), new THREE.MeshLambertMaterial({ map: X.head })); h.position.z = s * 0.5; if (s < 0) h.rotation.y = Math.PI; drum.add(h); const r = new THREE.Mesh(new THREE.TorusGeometry(0.63, 0.03, 6, 32), blackM); r.position.z = s * 0.49; drum.add(r); for (let k = 0; k < 24; k++) { const a = k / 24 * 6.283, t = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), giltM); t.position.set(Math.cos(a) * 0.64, Math.sin(a) * 0.64, s * 0.47); drum.add(t); } }
    const stand = new THREE.Group(); stand.position.set(TAIKO.x, 0, TAIKO.z); stand.rotation.y = -0.5; root.add(stand);
    for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.12), blackM); leg.position.set(s * 0.55, 0.55, 0); leg.rotation.z = s * 0.25; stand.add(leg); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.7), blackM); beam.position.y = 0.12; stand.add(beam); }
  regThing(drum, 'Strike the taiko', strikeDrum, { x: SO.x + TAIKO.x - 0.5, z: SO.z + TAIKO.z + 1.6, r: 1.6 });
  // two great paper lanterns on black stands before the dais
  for (const [x, z] of CHOCHIN) {
    const lp = new THREE.Mesh(lathe([[0.02, -0.75], [0.36, -0.7], [0.5, -0.4], [0.52, 0], [0.5, 0.4], [0.36, 0.7], [0.02, 0.75]], 28), new THREE.MeshLambertMaterial({ map: X.paper, emissive: '#ff7a2a', emissiveMap: X.paper, emissiveIntensity: 0.55 }));
    lp.position.set(x, 2.6, z); root.add(lp);
    for (const y of [1.84, 3.36]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.12, 24), blackM); c.position.set(x, y, z); root.add(c); }
    box(0.08, 1.8, 0.08, blackM, x, 0.9, z); box(0.6, 0.06, 0.6, blackM, x, 0.03, z); box(0.08, 0.08, 1.0, blackM, x, 3.5, z - 0.4);
    const tas = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.4, 10), new THREE.MeshLambertMaterial({ color: '#d03a1e' })); tas.position.set(x, 1.6, z); tas.rotation.x = Math.PI; root.add(tas);
    glow(x, 2.6, z, 3.2, '#ff8a3a', 0.35);
  }
}
// zigzag paper streamers (shide)
function shide(g, x, y, len) {
  const pm = new THREE.MeshLambertMaterial({ color: '#fbf8f0', side: DS });
  for (let k = 0; k < 4; k++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.12, len / 4), pm); p.position.set(x + (k % 2 ? 0.06 : 0), y - len / 8 - k * len / 4, 0); g.add(p); }
}

/* ---------- ringing, clapping, drumming ---------- */
let bellT = -1, drumT = -1;
function ringBell() {
  if (bellT >= 0) return; bellT = 0; SFX.suzu && SFX.suzu();
  setTimeout(() => SFX.clap && SFX.clap(), 1700); setTimeout(() => SFX.clap && SFX.clap(), 2150);
  late.toast && late.toast('Two bows, two claps, a wish, and one more bow.', 5000);
}
function strikeDrum() { drumT = 0; SFX.taiko && SFX.taiko(); }
addTick(dt => {
  if (state.world !== 'shrine') return;
  if (bellT >= 0 && bell) { bellT += dt; bell.rotation.z = 0.12 * Math.sin(bellT * 6) * Math.exp(-bellT * 1.2); if (bellT > 4) { bell.rotation.z = 0; bellT = -1; } }
  if (drumT >= 0 && drum) { drumT += dt; drum.position.y = 1.35 + 0.012 * Math.sin(drumT * 40) * Math.exp(-drumT * 6); if (drumT > 1) drumT = -1; }
  const t = performance.now() * 0.001; for (const g of glows) g.sp.material.opacity = g.op * (1 + 0.08 * Math.sin(t * 3 + g.ph) + 0.04 * Math.sin(t * 11 + g.ph * 2));
}, true);
SFX.clap = function () {
  const o = this.out(); if (!o) return; const ctx = late.Music.ctx, t = ctx.currentTime + 0.01, n = Math.floor(ctx.sampleRate * 0.12), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.012));
  const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain(); src.buffer = b; bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 0.9; g.gain.value = 0.9;
  src.connect(bp); bp.connect(g); g.connect(o); src.start(t);
};
SFX.taiko = function () {
  const o = this.out(); if (!o) return; const ctx = late.Music.ctx, t = ctx.currentTime + 0.01;
  const os = ctx.createOscillator(), g = ctx.createGain(); os.frequency.setValueAtTime(110, t); os.frequency.exponentialRampToValueAtTime(52, t + 0.5); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.9, t + 0.006); g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
  os.connect(g); g.connect(o); os.start(t); os.stop(t + 1.7);
  const n = Math.floor(ctx.sampleRate * 0.08), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.01));
  const src = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), g2 = ctx.createGain(); src.buffer = b; lp.type = 'lowpass'; lp.frequency.value = 900; g2.gain.value = 0.5; src.connect(lp); lp.connect(g2); g2.connect(o); src.start(t);
};

/* ---------- walking inside ---------- */
const loc = (x, z) => [x - SO.x, z - SO.z];
worlds.shrine = {
  scene: shrineScene,
  name: 'The Shrine in the Pagoda', sub: 'Walk among the lanterns. Ring the bell before the altar, or strike the taiko. The door behind you leads back out.',
  arrive: { pos: SO.clone().add(new V3(0, 0, DOOR_Z - 4.2)), yaw: 0 },
  floorH() { return 0; },
  blocked(x, z) {
    const [lx, lz] = loc(x, z);
    if (Math.abs(lx) > W - 0.5 || lz > DOOR_Z - 0.6 || lz < DAIS_Z + 0.9) return true;
    for (const [px, pz] of PILLARS) if (Math.hypot(lx - px, lz - pz) < 0.75) return true;
    if (Math.abs(lx - BELL.x) < 1.2 && Math.abs(lz - BELL.z - 0.9) < 0.75) return true;
    if (Math.hypot(lx - TAIKO.x, lz - TAIKO.z) < 1.1) return true;
    for (const [px, pz] of CHOCHIN) if (Math.hypot(lx - px, lz - pz) < 0.6) return true;
    return false;
  },
  enter() { build(); },
  leave() {},
};
