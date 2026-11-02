import * as THREE from 'three';
import { C, V3, rng } from '../core/util.js';
import { state, T } from '../core/state.js';
import { canvasTex } from './textures.js';
import { GEO, Merge } from './geometry.js';
import { worlds } from '../core/worlds.js';
import { addTick, regThing } from '../core/things.js';
import { late } from '../core/late.js';
import { player } from '../player/camera.js';
import { O, sunScene } from './sunWorld.js';
import { HALL, OPEN_BAY, artTex, baroque, cover, frame, hall, img, loadArt } from './castleHall.js';

/* ================= the Library, inside the castle: after the State Hall of the Austrian National Library ================= */
// Down a hallway from the Hall of Mirrors (one bay of its east wall opens into it): a long hall of two storeys of walnut bookcases, a gallery
// running round on gilded brackets, library ladders, display cases down the middle, pairs of marble columns, and at
// its heart a great oval dome painted with a sky of figures, ringed with round windows, over a white marble statue.
// The shelves open (ui/library.js): famous books to read, and a shelf of your own where the books you write stand.
// Like the Hall of Mirrors it sits far below the fair, shown only while you are inside.

const R = rng(2468);
export const LIB = { x: 489, z: -56, y: -90, hw: 7.5, hl: 38, rx: 15, rz: 12.5, wall: 13.6, gal: 6.5 };
// the hallway: from the Hall of Mirrors' east wall (x 452) to the dome's west side, 6 m wide, on the library's axis
const HW = { x0: HALL.x + HALL.hw - LIB.x, x1: -LIB.rx + 0.4, half: 3, h: 7.5 };
const lib = new THREE.Group(); lib.position.set(O.x + LIB.x, O.y + LIB.y, O.z + LIB.z); lib.visible = false; sunScene.add(lib);
const J = Math.sqrt(1 - (LIB.hw / LIB.rx) ** 2) * LIB.rz; // where the wings' walls meet the dome's oval
const WALNUT = C('#6b3d1d'), WAL2 = C('#82502a'), WAL3 = C('#4f2c14'), GOLD = C('#d4a63a'), GOLD2 = C('#e8c25a'), CREAM = C('#efe6d2');
const wood = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 35, specular: '#5a3a1a', emissive: '#2a1608', emissiveIntensity: 0.9, fog: false });
const gilt = new THREE.MeshPhongMaterial({ vertexColors: true, specular: '#8a6a2a', shininess: 45, emissive: '#3a2808', emissiveIntensity: 0.7, fog: false });
const lit = (map, k = 0.55, extra = {}) => new THREE.MeshLambertMaterial(Object.assign({ map, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: k, color: '#d8ccb4', fog: false }, extra));

/* ---------- the books on the shelves: rows of old bindings, leather and vellum, gilt bands on their spines ---------- */
const shelfTex = canvasTex(512, 512, (g, w, h) => {
  const RS = rng(31), rows = 6, rh = h / rows;
  g.fillStyle = '#3a2210'; g.fillRect(0, 0, w, h);
  const LEATHER = ['#6e3a1e', '#7d4a24', '#5a2a18', '#8a5a2e', '#4a2a1a', '#9a6a3a', '#6a2620', '#3f3a22', '#b8996a', '#d8c69a'];
  for (let r = 0; r < rows; r++) {
    const y0 = r * rh + 6, y1 = (r + 1) * rh - 10;
    let x = 2;
    while (x < w - 2) {
      const bw = 8 + RS() * 13, bh = (y1 - y0) * (0.78 + RS() * 0.22), col = LEATHER[(RS() * LEATHER.length) | 0];
      const gr = g.createLinearGradient(x, 0, x + bw, 0); gr.addColorStop(0, 'rgba(0,0,0,.35)'); gr.addColorStop(0.35, col); gr.addColorStop(0.7, col); gr.addColorStop(1, 'rgba(0,0,0,.45)');
      g.fillStyle = col; g.fillRect(x, y1 - bh, bw, bh); g.fillStyle = gr; g.fillRect(x, y1 - bh, bw, bh);
      // gilt bands and a title label on many spines
      g.fillStyle = 'rgba(226,186,90,.85)'; for (const f of [0.12, 0.2, 0.8, 0.88]) g.fillRect(x + 1, y1 - bh * f, bw - 2, 1.6);
      if (RS() < 0.5) { g.fillStyle = RS() < 0.5 ? 'rgba(30,20,10,.65)' : 'rgba(120,30,20,.7)'; g.fillRect(x + 1.5, y1 - bh * 0.72, bw - 3, bh * 0.12); }
      x += bw + 0.6;
    }
    // the shelf board, lit along its front edge
    g.fillStyle = '#6b3d1d'; g.fillRect(0, y1, w, 10); g.fillStyle = 'rgba(255,220,160,.25)'; g.fillRect(0, y1, w, 2);
  }
  // the uprights between bays
  g.fillStyle = '#5a3216'; g.fillRect(0, 0, 6, h); g.fillRect(w - 6, 0, 6, h);
}, true);
// the floor: cream marble laid in squares, small dark diamonds where they meet, a band round the edge
const floorTex = canvasTex(512, 512, (g, w, h) => {
  const RS = rng(9); g.fillStyle = '#e8dfcc'; g.fillRect(0, 0, w, h);
  for (let k = 0; k < 160; k++) { g.strokeStyle = `rgba(150,130,100,${0.05 + RS() * 0.08})`; g.lineWidth = 1; g.beginPath(); let x = RS() * w, y = RS() * h; g.moveTo(x, y); for (let s = 0; s < 4; s++) { x += (RS() - 0.5) * 60; y += (RS() - 0.5) * 60; g.lineTo(x, y); } g.stroke(); }
  g.strokeStyle = 'rgba(120,100,80,.5)'; g.lineWidth = 2; for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(k * 128, 0); g.lineTo(k * 128, h); g.stroke(); g.beginPath(); g.moveTo(0, k * 128); g.lineTo(w, k * 128); g.stroke(); }
  for (let j = 0; j <= 4; j++) for (let i = 0; i <= 4; i++) { g.fillStyle = '#4a3020'; g.beginPath(); g.moveTo(i * 128, j * 128 - 22); g.lineTo(i * 128 + 22, j * 128); g.lineTo(i * 128, j * 128 + 22); g.lineTo(i * 128 - 22, j * 128); g.closePath(); g.fill(); }
}, true);
const marble = canvasTex(128, 512, (g, w, h) => {
  const RS = rng(41), gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#b8aaa2'); gr.addColorStop(0.5, '#d8ccc4'); gr.addColorStop(1, '#b4a69e'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let k = 0; k < 24; k++) { g.strokeStyle = `rgba(${150 + RS() * 40 | 0},${120 + RS() * 30 | 0},${120 + RS() * 30 | 0},${0.25 + RS() * 0.35})`; g.lineWidth = 0.8 + RS() * 1.8; g.beginPath(); let x = RS() * w, y = RS() * h; g.moveTo(x, y); for (let s = 0; s < 8; s++) { x += (RS() - 0.5) * 40; y += 10 + RS() * 30; g.lineTo(x, y); } g.stroke(); }
}, true);

/* ---------- floor ---------- */
{
  floorTex.repeat.set(LIB.rx / 2.5, LIB.hl / 2.5);
  const f = new THREE.Mesh(new THREE.PlaneGeometry(LIB.rx * 2, LIB.hl * 2).rotateX(-Math.PI / 2), new THREE.MeshPhongMaterial({ map: floorTex, shininess: 60, specular: '#4a3a2a', emissive: '#ffffff', emissiveMap: floorTex, emissiveIntensity: 0.32, color: '#bdb2a0', fog: false }));
  lib.add(f);
  // a dark inlaid ring round the statue, and a star of the same
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.2, 3.6, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#4a3020', fog: false })); ring.position.y = 0.01; ring.scale.set(1.25, 1, 1); lib.add(ring);
  const ring2 = ring.clone(); ring2.scale.set(2.4, 1, 2.4 * LIB.rz / LIB.rx); ring2.position.y = 0.012; lib.add(ring2);
}

/* ---------- the bookcases: two storeys, a gallery between on gilded brackets, pilasters, a cornice ---------- */
const cases = new Merge(), shelvesLo = [], shelvesHi = [];
// one run of bookcase along a straight line from a to b (local x, z), faces turned to point n (into the room)
function caseRun(ax, az, bx, bz, nx, nz) {
  const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, mx = (ax + bx) / 2, mz = (az + bz) / 2;
  shelvesLo.push({ mx, mz, L, nx, nz }); shelvesHi.push({ mx, mz, L, nx, nz });
  const q = new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), Math.atan2(nx, nz));
  const at = (s, y, d) => new V3(ax + ux * s + nx * d, y, az + uz * s + nz * d);
  const bays = Math.max(1, Math.round(L / 3.4));
  for (let k = 0; k <= bays; k++) {
    const s = k / bays * L;
    // pilasters on both storeys, with gilded capitals
    cases.add(GEO.box, at(s, 3.2, 0.25), new V3(0.5, 6.2, 0.5), WAL3, q);
    cases.add(GEO.box, at(s, 6.0, 0.32), new V3(0.62, 0.35, 0.62), GOLD, q);
    cases.add(GEO.box, at(s, 10.0, 0.18), new V3(0.42, 5.8, 0.36), WAL3, q);
    cases.add(GEO.box, at(s, 12.7, 0.24), new V3(0.54, 0.32, 0.5), GOLD, q);
    // a gilded bracket under the gallery
    cases.add(GEO.box, at(s, 6.15, 0.75), new V3(0.3, 0.55, 0.9), GOLD2, q);
    if (k < bays) {
      const sc = (k + 0.5) / bays * L;
      // a carved cartouche crowning each upper bay
      cases.add(GEO.sph, at(sc, 13.25, 0.2), new V3(0.75, 0.42, 0.18), GOLD2, q);
      cases.add(GEO.sph, at(sc, 13.25, 0.28), new V3(0.32, 0.26, 0.1), C('#f0d880'), q);
    }
  }
  // the case's solid back, the whole height of the wall
  cases.add(GEO.box, at(L / 2, LIB.wall / 2 + 0.3, -0.12), new V3(L + 0.4, LIB.wall + 0.6, 0.2), C('#2e1a0c'), q);
  // the base, the cornice below the gallery and the cornice at the top, in walnut
  cases.add(GEO.box, at(L / 2, 0.22, 0.32), new V3(L, 0.44, 0.64), WAL3, q);
  cases.add(GEO.box, at(L / 2, 6.35, 0.4), new V3(L, 0.3, 0.8), WALNUT, q);
  cases.add(GEO.box, at(L / 2, 13.5, 0.32), new V3(L, 0.4, 0.7), WAL2, q);
  // the gallery: a walnut floor 1.3 m deep, and a balustrade along its edge
  cases.add(GEO.box, at(L / 2, 6.62, 0.95), new V3(L, 0.24, 1.3), WALNUT, q);
  cases.add(GEO.box, at(L / 2, 7.62, 1.55), new V3(L, 0.12, 0.16), WAL2, q);
  for (let s = 0.2; s < L; s += 0.36) cases.add(GEO.box, at(s, 7.15, 1.55), new V3(0.07, 0.86, 0.07), (Math.round(s / 0.36) % 6) ? WAL2 : GOLD, q);
}
// the books themselves, as planes on the bookcases' faces
function shelfFaces(list, y0, y1, d) {
  list.forEach(({ mx, mz, L, nx, nz }) => {
    const t = shelfTex.clone(); t.needsUpdate = true; t.repeat.set(Math.max(1, Math.round(L / 2.6)), 1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(L, y1 - y0), lit(t, 0.5));
    m.position.set(mx + nx * d, (y0 + y1) / 2, mz + nz * d); m.rotation.y = Math.atan2(nx, nz); lib.add(m);
  });
}
{
  const { hw, hl } = LIB;
  for (const s of [-1, 1]) for (const e of [-1, 1]) caseRun(s * hw, e * J, s * hw, e * (hl - 0.2), -s, 0);
  // the end walls: bookcases either side of a doorway (south) or a painted window (north)
  for (const e of [-1, 1]) e < 0 ? (caseRun(-hw, e * hl, -2, e * hl, 0, -e), caseRun(2, e * hl, hw, e * hl, 0, -e)) : caseRun(-hw, e * hl, hw, e * hl, 0, -e);
  // the dome's walls: bookcases round the oval, in short straight runs
  const arc = (a0, a1, n) => { for (let k = 0; k < n; k++) { const t0 = a0 + (a1 - a0) * k / n, t1 = a0 + (a1 - a0) * (k + 1) / n, ax = Math.cos(t0) * LIB.rx, az = Math.sin(t0) * LIB.rz, bx = Math.cos(t1) * LIB.rx, bz = Math.sin(t1) * LIB.rz, tm = (t0 + t1) / 2, nx = -Math.cos(tm) / LIB.rx, nz = -Math.sin(tm) / LIB.rz, nl = Math.hypot(nx, nz); caseRun(ax, az, bx, bz, nx / nl, nz / nl); } };
  const aj = Math.atan2(J / LIB.rz, LIB.hw / LIB.rx);
  // round the dome's two sides (east and west); the north and south of the oval open into the wings
  arc(-aj, aj, 8); arc(Math.PI - aj, Math.PI - aj / 4, 3); arc(Math.PI + aj / 4, Math.PI + aj, 3);
  lib.add(new THREE.Mesh(cases.build(), wood));
  shelfFaces(shelvesLo, 0.45, 6.2, 0.05); shelfFaces(shelvesHi, 6.9, 13.1, 0.05);
}

/* ---------- a painted window above the gallery at the north end ---------- */
{
  const hl = LIB.hl;
  // north: a tall window above the gallery, pale with daylight
  const win = canvasTex(256, 512, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#eef4fa'); gr.addColorStop(1, '#c8d8e6'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#e8dcc4'; for (let i = 0; i <= 4; i++) g.fillRect(i * w / 4 - 4, 0, 8, h); for (let j = 0; j <= 8; j++) g.fillRect(0, j * h / 8 - 3, w, 6); });
  const wm = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 6), new THREE.MeshBasicMaterial({ map: win, fog: false })); wm.position.set(0, 10, -hl + 0.05); lib.add(wm);
  const wf = new Merge(); wf.add(new THREE.TorusGeometry(1.7, 0.18, 6, 24, Math.PI), new V3(0, 13, -hl + 0.1), new V3(1, 1, 1), GOLD); lib.add(new THREE.Mesh(wf.build(), gilt));
}

/* ---------- the wings' barrel vaults, painted: coffers, and frescoes in gilded frames ---------- */
{
  const vt = artTex(1024, 2048, (g, w, h) => {
    g.fillStyle = '#efe4c8'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 128) for (let x = 0; x < w; x += 128) { g.fillStyle = '#e4d4ac'; g.fillRect(x + 10, y + 10, 108, 108); g.fillStyle = '#d4a63a'; g.beginPath(); g.arc(x + 64, y + 64, 16, 0, 7); g.fill(); }
    baroque(g, 120, 260, w - 240, 620, 71); frame(g, 120, 260, w - 240, 620, 22);
    baroque(g, 120, 1170, w - 240, 620, 72); frame(g, 120, 1170, w - 240, 620, 22);
  }, (g, w, h) => {
    g.fillStyle = '#efe4c8'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 128) for (let x = 0; x < w; x += 128) { g.fillStyle = '#e4d4ac'; g.fillRect(x + 10, y + 10, 108, 108); g.fillStyle = '#d4a63a'; g.beginPath(); g.arc(x + 64, y + 64, 16, 0, 7); g.fill(); }
    cover(g, img.sky, 120, 260, w - 240, 620); frame(g, 120, 260, w - 240, 620, 22);
    cover(g, img.peace, 120, 1170, w - 240, 620); frame(g, 120, 1170, w - 240, 620, 22);
  });
  for (const e of [-1, 1]) {
    const L = LIB.hl - J + 1, g = new THREE.CylinderGeometry(LIB.hw, LIB.hw, L, 32, 1, true, -Math.PI / 2, Math.PI);
    const v = new THREE.Mesh(g, lit(vt, 0.75, { side: THREE.BackSide }));
    v.rotation.x = -Math.PI / 2; v.scale.set(1, 1, 4.2 / LIB.hw); v.position.set(0, LIB.wall, e * (J + L / 2 - 0.5)); lib.add(v);
    // the end of the vault over each end wall
    const lun = new THREE.Mesh(new THREE.CircleGeometry(LIB.hw, 32, 0, Math.PI), lit(vt, 0.6, { side: THREE.DoubleSide })); lun.position.set(0, LIB.wall, e * LIB.hl); lun.scale.set(1, 4.2 / LIB.hw, 1); lib.add(lun);
    // a gilded arch where each wing opens into the dome
    const a = new Merge(); a.add(new THREE.TorusGeometry(LIB.hw, 0.3, 8, 40, Math.PI), new V3(0, LIB.wall, e * J), new V3(1, 4.2 / LIB.hw, 1), GOLD); lib.add(new THREE.Mesh(a.build(), gilt));
  }
}

/* ---------- the great dome: a drum ringed with round windows, and a painted sky of figures ---------- */
{
  // the drum above the bookcases: cream and gold, with eight oval windows of daylight
  const drumTex = canvasTex(2048, 256, (g, w, h) => {
    g.fillStyle = '#efe4c8'; g.fillRect(0, 0, w, h); g.fillStyle = '#d4a63a'; g.fillRect(0, 0, w, 14); g.fillRect(0, h - 18, w, 18);
    for (let k = 0; k < 8; k++) { const x = (k + 0.5) * w / 8; g.fillStyle = '#c99a32'; g.beginPath(); g.ellipse(x, h / 2, 64, 96, 0, 0, 7); g.fill(); const gr = g.createRadialGradient(x, h / 2 - 20, 4, x, h / 2, 90); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#bcd2e4'); g.fillStyle = gr; g.beginPath(); g.ellipse(x, h / 2, 54, 84, 0, 0, 7); g.fill(); g.strokeStyle = '#e8dcc4'; g.lineWidth = 5; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(x + i * 20, h / 2 - 84); g.lineTo(x + i * 20, h / 2 + 84); g.stroke(); } g.beginPath(); g.moveTo(x - 54, h / 2); g.lineTo(x + 54, h / 2); g.stroke(); }
  });
  drumTex.repeat.set(1, 1); const drum = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 96, 1, true), lit(drumTex, 0.75, { side: THREE.BackSide }));
  drum.scale.set(LIB.rx + 0.15, 5.2, LIB.rz + 0.15); drum.position.y = LIB.wall + 0.6; lib.add(drum);
  // the dome: golden light at the crown, groups of figures on clouds round it, painted architecture at its foot
  const domeTex = artTex(2048, 1024, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#fff6d8'); sky.addColorStop(0.35, '#f2d89a'); sky.addColorStop(0.75, '#b9cce0'); sky.addColorStop(1, '#e8dcc0'); g.fillStyle = sky; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 4; k++) baroque(g, k * w / 4 + 20, 180, w / 4 - 40, 560, 80 + k);
    g.fillStyle = '#d4c49a'; g.fillRect(0, h - 120, w, 120); for (let x = 0; x < w; x += 32) { g.fillStyle = '#efe4c8'; g.fillRect(x + 6, h - 110, 18, 80); }
  }, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#fff6d8'); sky.addColorStop(0.3, '#f2d89a'); sky.addColorStop(1, '#e8dcc0'); g.fillStyle = sky; g.fillRect(0, 0, w, h);
    // the painted scenes side by side all round, each melting into the next and into the sky above
    const pics = [img.sky, img.peace, img.victory, img.sky, img.peace, img.victory], pw = w / pics.length;
    pics.forEach((im, k) => { cover(g, im, k * pw, 150, pw, 700); });
    for (let k = 0; k <= pics.length; k++) { const x = k * pw, gr = g.createLinearGradient(x - 70, 0, x + 70, 0); gr.addColorStop(0, 'rgba(242,216,154,0)'); gr.addColorStop(0.5, 'rgba(242,216,154,.85)'); gr.addColorStop(1, 'rgba(242,216,154,0)'); g.fillStyle = gr; g.fillRect(x - 70, 150, 140, 700); }
    const top = g.createLinearGradient(0, 150, 0, 380); top.addColorStop(0, 'rgba(242,216,154,1)'); top.addColorStop(1, 'rgba(242,216,154,0)'); g.fillStyle = top; g.fillRect(0, 150, w, 230);
    const bot = g.createLinearGradient(0, 700, 0, 850); bot.addColorStop(0, 'rgba(232,220,192,0)'); bot.addColorStop(1, 'rgba(232,220,192,1)'); g.fillStyle = bot; g.fillRect(0, 700, w, 150);
    // a golden glow at the crown, and the painted balustrade at the dome's foot
    const glow = g.createLinearGradient(0, 0, 0, 260); glow.addColorStop(0, 'rgba(255,246,216,1)'); glow.addColorStop(1, 'rgba(255,246,216,0)'); g.fillStyle = glow; g.fillRect(0, 0, w, 260);
    g.fillStyle = '#d4c49a'; g.fillRect(0, h - 120, w, 120); for (let x = 0; x < w; x += 32) { g.fillStyle = '#efe4c8'; g.fillRect(x + 6, h - 110, 18, 80); }
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2), lit(domeTex, 0.62, { side: THREE.BackSide }));
  dome.scale.set(LIB.rx + 0.15, 14, LIB.rz + 0.15); dome.position.y = LIB.wall + 3.2; lib.add(dome);
  // a lantern of light at the very top
  const lantern = new THREE.Mesh(new THREE.CircleGeometry(2.2, 32).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#fffaf0', fog: false })); lantern.position.y = LIB.wall + 3.2 + 13.9; lib.add(lantern);
}

/* ---------- columns, the statue, display cases, ladders, a writing desk ---------- */
const desk = new THREE.Group();
{
  const m = new Merge(), cm = new Merge();
  // pairs of marble columns where each wing opens into the dome
  for (const sx of [-1, 1]) for (const e of [-1, 1]) for (const dz of [0, 1.9]) {
    const x = sx * (LIB.hw - 0.9), z = e * (J - 0.6 + dz);
    cm.add(new THREE.CylinderGeometry(0.5, 0.55, LIB.wall - 1.4, 20), new V3(x, (LIB.wall - 1.4) / 2 + 0.5, z), new V3(1, 1, 1), C('#ffffff'));
    m.add(GEO.box, new V3(x, 0.25, z), new V3(1.3, 0.5, 1.3), CREAM);
    m.add(GEO.box, new V3(x, LIB.wall - 0.7, z), new V3(1.25, 0.6, 1.25), GOLD);
    for (const o of [-0.5, 0.5]) m.add(GEO.sph, new V3(x + o, LIB.wall - 0.55, z), new V3(0.22, 0.26, 0.22), GOLD2);
  }
  // the statue at the heart of the dome: a figure in white marble on a dark pedestal, one arm held out
  m.add(GEO.box, new V3(0, 0.2, 0), new V3(3.4, 0.4, 3.0), C('#e8e0d0'));
  m.add(GEO.box, new V3(0, 1.4, 0), new V3(2.4, 2.0, 2.0), C('#3a3a30'));
  m.add(GEO.box, new V3(0, 2.5, 0), new V3(2.7, 0.25, 2.3), CREAM);
  m.add(GEO.box, new V3(0, 1.4, 1.02), new V3(1.4, 0.9, 0.04), GOLD);
  const W = C('#f4f0e8'), W2 = C('#e6e0d4');
  for (const sx of [-0.22, 0.22]) m.limb(new V3(sx, 2.65, 0), new V3(sx * 0.9, 3.9, 0), 0.2, 0.17, W);
  m.add(GEO.cone, new V3(0, 4.2, 0), new V3(0.72, 0.9, 0.55), W2, new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), Math.PI));
  m.limb(new V3(0, 4.3, 0), new V3(0, 5.2, 0), 0.45, 0.4, W);
  m.add(GEO.cone, new V3(0, 3.6, -0.3), new V3(0.85, 2.6, 0.45), W2);
  m.add(GEO.sph, new V3(0, 5.6, 0), new V3(0.3, 0.36, 0.3), W);
  m.add(GEO.sph, new V3(0, 5.75, -0.08), new V3(0.34, 0.32, 0.32), W2);
  m.limb(new V3(0.42, 5.0, 0), new V3(0.95, 4.65, 0.55), 0.13, 0.11, W); m.limb(new V3(0.95, 4.65, 0.55), new V3(1.25, 4.6, 1.05), 0.11, 0.09, W);
  m.limb(new V3(-0.42, 5.0, 0), new V3(-0.62, 4.2, 0.15), 0.13, 0.11, W);
  // four smaller statues round the dome
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + k * Math.PI / 2, x = Math.cos(a) * (LIB.rx - 4.2), z = Math.sin(a) * (LIB.rz - 3.6);
    m.add(GEO.box, new V3(x, 0.7, z), new V3(1.1, 1.4, 1.1), C('#e8e0d0'));
    m.limb(new V3(x, 1.4, z), new V3(x, 3.1, z), 0.38, 0.3, W); m.add(GEO.sph, new V3(x, 3.4, z), new V3(0.24, 0.28, 0.24), W);
    m.add(GEO.cone, new V3(x, 2.0, z), new V3(0.55, 1.4, 0.55), W2);
  }
  // display cases down the wings: walnut stands, a glass lid, an old book open inside
  for (const e of [-1, 1]) for (const zz of [18, 26, 33]) for (const sx of [-1, 1]) {
    const x = sx * 2.7, z = e * zz;
    m.add(GEO.box, new V3(x, 0.45, z), new V3(1.1, 0.9, 1.9), WAL3);
    m.add(GEO.box, new V3(x, 0.95, z), new V3(1.2, 0.1, 2.0), GOLD);
    m.add(GEO.box, new V3(x - 0.24, 1.06, z), new V3(0.46, 0.04, 0.66), C('#f2ead6'), new THREE.Quaternion().setFromAxisAngle(new V3(0, 0, 1), 0.1));
    m.add(GEO.box, new V3(x + 0.24, 1.06, z), new V3(0.46, 0.04, 0.66), C('#f2ead6'), new THREE.Quaternion().setFromAxisAngle(new V3(0, 0, 1), -0.1));
  }
  // library ladders leaning on the lower shelves
  for (const [x, z, sx] of [[-LIB.hw + 0.9, 16, -1], [LIB.hw - 0.9, -21, 1], [-LIB.hw + 0.9, -30, -1], [LIB.hw - 0.9, 29, 1]]) {
    for (const dz of [-0.32, 0.32]) m.limb(new V3(x - sx * 0.9, 0, z + dz), new V3(x, 5.6, z + dz), 0.04, 0.04, WAL2);
    for (let k = 1; k < 14; k++) { const t = k / 14; m.add(GEO.box, new V3(x - sx * 0.9 * (1 - t), 5.6 * t, z), new V3(0.05, 0.05, 0.64), WAL2); }
  }
  lib.add(new THREE.Mesh(m.build(), gilt));
  const cols = new THREE.Mesh(cm.build(), new THREE.MeshPhongMaterial({ map: marble, shininess: 70, specular: '#ffffff', emissive: '#ffffff', emissiveMap: marble, emissiveIntensity: 0.3, fog: false }));
  lib.add(cols);
  // glass over the display cases
  const glass = new THREE.MeshPhongMaterial({ color: '#dfeef5', transparent: true, opacity: 0.22, shininess: 120, specular: '#ffffff', depthWrite: false, fog: false });
  for (const e of [-1, 1]) for (const zz of [18, 26, 33]) for (const sx of [-1, 1]) { const g2 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.42, 1.9), glass); g2.position.set(sx * 2.7, 1.22, e * zz); lib.add(g2); }
  // the writing desk under the dome, with a quill and an inkwell: where your own books are written
  const dm = new Merge();
  dm.add(GEO.box, new V3(0, 0.82, 0), new V3(2.2, 0.1, 1.1), WALNUT);
  for (const [dx, dz] of [[-1, -0.45], [1, -0.45], [-1, 0.45], [1, 0.45]]) dm.add(GEO.box, new V3(dx, 0.4, dz), new V3(0.1, 0.8, 0.1), WAL3);
  dm.add(GEO.box, new V3(-0.2, 0.9, 0.05), new V3(0.75, 0.04, 0.55), C('#f4ecd8'));
  dm.add(GEO.box, new V3(0.65, 0.95, -0.2), new V3(0.16, 0.16, 0.16), C('#20203a'));
  dm.limb(new V3(0.62, 1.0, -0.2), new V3(0.4, 1.6, -0.35), 0.015, 0.06, C('#f2f0ea'));
  desk.add(new THREE.Mesh(dm.build(), wood)); desk.position.set(0, 0, 7.6); desk.rotation.y = Math.PI; lib.add(desk);
}

/* ---------- the hallway from the Hall of Mirrors: marble walls, paintings, a painted vault, a red carpet ---------- */
const wayLamps = [];
{
  const { x0, x1, half, h } = HW, L = x1 - x0, xm = (x0 + x1) / 2, way = new THREE.Group(); lib.add(way);
  // the walls: cream marble with a green dado, framed panels between gilded pilasters
  const wallTex = canvasTex(512, 512, (g, w, hh) => {
    const RS = rng(13); g.fillStyle = '#efe6d2'; g.fillRect(0, 0, w, hh);
    for (let k = 0; k < 40; k++) { g.strokeStyle = `rgba(160,140,110,${0.08 + RS() * 0.1})`; g.lineWidth = 1.2; g.beginPath(); let x = RS() * w, y = RS() * hh; g.moveTo(x, y); for (let q = 0; q < 5; q++) { x += (RS() - 0.5) * 50; y += 15 + RS() * 30; g.lineTo(x, y); } g.stroke(); }
    g.fillStyle = '#5a7a62'; g.fillRect(0, hh - 110, w, 110); g.fillStyle = '#d4a63a'; g.fillRect(0, hh - 114, w, 6); g.fillRect(0, hh - 8, w, 8);
    g.strokeStyle = '#d4a63a'; g.lineWidth = 5; g.strokeRect(60, 50, w - 120, hh - 220);
  }, true);
  wallTex.repeat.set(Math.round(L / 4.4), 1);
  for (const sz of [-1, 1]) { const wm = new THREE.Mesh(new THREE.PlaneGeometry(L, h), lit(wallTex, 0.42)); wm.position.set(xm, h / 2, sz * half); wm.rotation.y = sz > 0 ? Math.PI : 0; way.add(wm); }
  // the floor, and a long red carpet with a gold border down its middle
  const ft = floorTex.clone(); ft.needsUpdate = true; ft.repeat.set(L / 2.5, half * 2 / 2.5);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(L + 1, half * 2).rotateX(-Math.PI / 2), new THREE.MeshPhongMaterial({ map: ft, shininess: 60, specular: '#4a3a2a', emissive: '#ffffff', emissiveMap: ft, emissiveIntensity: 0.32, color: '#bdb2a0', fog: false })); fl.position.set(xm, 0.005, 0); way.add(fl);
  const carpet = canvasTex(64, 256, (g, w, hh) => { g.fillStyle = '#8a1f24'; g.fillRect(0, 0, w, hh); g.fillStyle = '#d4a63a'; g.fillRect(0, 0, 5, hh); g.fillRect(w - 5, 0, 5, hh); g.fillStyle = 'rgba(212,166,58,.35)'; for (let y = 16; y < hh; y += 32) { g.beginPath(); g.moveTo(w / 2, y - 8); g.lineTo(w / 2 + 8, y); g.lineTo(w / 2, y + 8); g.lineTo(w / 2 - 8, y); g.closePath(); g.fill(); } }, true);
  carpet.repeat.set(1, L / 4);
  const cp = new THREE.Mesh(new THREE.PlaneGeometry(2.2, L + 6).rotateX(-Math.PI / 2).rotateY(Math.PI / 2), lit(carpet, 0.35)); cp.position.set(xm + 1.5, 0.015, 0); way.add(cp);
  // a painted barrel vault: coffers with gold rosettes
  const vaultTex = canvasTex(512, 256, (g, w, hh) => { g.fillStyle = '#efe4c8'; g.fillRect(0, 0, w, hh); for (let y = 0; y < hh; y += 64) for (let x = 0; x < w; x += 64) { g.fillStyle = '#e2d0a4'; g.fillRect(x + 6, y + 6, 52, 52); g.fillStyle = '#d4a63a'; g.beginPath(); g.arc(x + 32, y + 32, 9, 0, 7); g.fill(); } }, true);
  vaultTex.repeat.set(L / 6, 1);
  const vg = new THREE.CylinderGeometry(half, half, L, 24, 1, true, 0, Math.PI);
  const vt = new THREE.Mesh(vg, lit(vaultTex, 0.55, { side: THREE.BackSide })); vt.rotation.z = Math.PI / 2; vt.scale.set(1, 1, 1); vt.position.set(xm, h, 0); way.add(vt);
  // gilded pilasters, a cornice, framed paintings between, a lamp on the wall beside each
  const m = new Merge(), bays = Math.round(L / 4.4), pics = ['sky', 'peace', 'victory', 'sun'];
  for (let k = 0; k <= bays; k++) { const x = x0 + k / bays * L; for (const sz of [-1, 1]) { m.add(GEO.box, new V3(x, h / 2, sz * (half - 0.15)), new V3(0.5, h, 0.3), GOLD); m.add(GEO.box, new V3(x, 0.4, sz * (half - 0.2)), new V3(0.7, 0.8, 0.4), CREAM); } }
  for (const sz of [-1, 1]) m.add(GEO.box, new V3(xm, h - 0.2, sz * (half - 0.2)), new V3(L, 0.4, 0.4), GOLD2);
  let pk = 0;
  for (let k = 0; k < bays; k++) {
    const x = x0 + (k + 0.5) / bays * L;
    for (const sz of [-1, 1]) {
      const which = pics[pk++ % pics.length], pw = 2.6, ph = 2.0, t = artTex(512, 400, (g, w, hh) => baroque(g, 0, 0, w, hh, 90 + pk), (g, w, hh) => cover(g, img[which], 0, 0, w, hh));
      const pm = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), lit(t, 0.5)); pm.position.set(x, 4.1, sz * (half - 0.04)); pm.rotation.y = sz > 0 ? Math.PI : 0; way.add(pm);
      for (const [fx, fy, fw, fh] of [[x, 4.1 + ph / 2 + 0.1, pw + 0.4, 0.2], [x, 4.1 - ph / 2 - 0.1, pw + 0.4, 0.2], [x - pw / 2 - 0.1, 4.1, 0.2, ph], [x + pw / 2 + 0.1, 4.1, 0.2, ph]]) m.add(GEO.box, new V3(fx, fy, sz * (half - 0.08)), new V3(fw, fh, 0.12), GOLD);
      m.limb(new V3(x0 + k / bays * L + 0.01, 5.6, sz * (half - 0.3)), new V3(x0 + k / bays * L + 0.01, 5.9, sz * (half - 0.7)), 0.04, 0.04, GOLD);
      wayLamps.push(x0 + k / bays * L, 6.0, sz * (half - 0.75));
    }
  }
  // gilded arches at both ends; over the library end, its name
  for (const ex of [x0 + 0.15, x1 - 0.15]) m.add(new THREE.TorusGeometry(half, 0.28, 8, 32, Math.PI).rotateY(Math.PI / 2), new V3(ex, h, 0), new V3(1, 1, 1), GOLD);
  way.add(new THREE.Mesh(m.build(), gilt));
  const sign = canvasTex(512, 128, (g, w, hh) => { g.fillStyle = '#2a1a10'; g.fillRect(0, 0, w, hh); g.strokeStyle = '#d4a63a'; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, hh - 16); g.fillStyle = '#f0d890'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 64px "Cormorant Garamond", Georgia, serif'; g.fillText('The Library', w / 2, hh / 2 + 4); });
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: sign, fog: false })); sg.position.set(x1 - 0.5, h - 1.2, 0); sg.rotation.y = -Math.PI / 2; way.add(sg);
  // walls closing round the hallway's ends: above it where it meets the dome, and the open bay of the hall above and beside it
  const cream = new THREE.MeshLambertMaterial({ color: '#e8dcc4', emissive: '#efe6d2', emissiveIntensity: 0.38, fog: false }), dark = new THREE.MeshLambertMaterial({ color: '#3a2210', emissive: '#2a1608', emissiveIntensity: 0.6, fog: false });
  const box = (mat, x, y, z, w, hh, d) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), mat); b.position.set(x, y, z); way.add(b); };
  // the library end: dark walnut above the arch, to the drum, and either side to the dome's bookcases
  box(dark, x1 + 0.2, (h + LIB.wall + 1) / 2 + 0.1, 0, 0.5, LIB.wall + 1 - h, half * 2 + 1.4);
  for (const sz of [-1, 1]) box(dark, x1 + 0.2, LIB.wall / 2, sz * (half + 0.45), 0.5, LIB.wall, 0.9);
  // the hall's end: its open bay, filled above the hallway and beside it, in the hall's own cream and gold
  const bz = HALL.bay / 2;
  box(cream, x0 - 0.15, (h + HALL.wall) / 2, 0, 0.3, HALL.wall - h, HALL.bay);
  for (const sz of [-1, 1]) box(cream, x0 - 0.15, HALL.wall / 2, sz * (half + (bz - half) / 2), 0.3, HALL.wall, bz - half);
  // and a sign over the way in, seen from the Hall of Mirrors
  const sg2 = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: sign, fog: false, polygonOffset: true, polygonOffsetFactor: -1 })); sg2.position.set(x0 - 0.5, h + 0.75, 0); sg2.rotation.y = -Math.PI / 2; sg2.scale.setScalar(1.3); way.add(sg2);
}

/* ---------- warm light: flickering lamps on the gallery rail ---------- */
{
  const pos = [];
  for (const s of [-1, 1]) for (let z = -LIB.hl + 3; z <= LIB.hl - 3; z += 3.4) if (Math.abs(z) > J) pos.push(s * (LIB.hw - 1.55), 7.85, z);
  for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; if (Math.abs(Math.cos(a) * LIB.rx) > LIB.hw + 0.5) pos.push(Math.cos(a) * (LIB.rx - 1.55), 7.85, Math.sin(a) * (LIB.rz - 1.55)); }
  pos.push(...wayLamps);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const pts = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: 'uniform float uTime;varying float vF;void main(){vF=.85+.15*sin(uTime*7.+position.x*3.+position.z*5.);vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(500./-mv.z,2.,28.);gl_Position=projectionMatrix*mv;}',
    fragmentShader: 'varying float vF;void main(){float d=length(gl_PointCoord-.5);float a=(smoothstep(.5,.0,d)*.55+smoothstep(.14,.0,d))*vF;gl_FragColor=vec4(vec3(1.,.82,.5)*a,a);}' }));
  lib.add(pts); lib.userData.pts = pts;
}
addTick(() => { if (lib.visible) lib.userData.pts.material.uniforms.uTime.value = T; }, true);

/* ---------- arriving, leaving, what is touchable ---------- */
const LW = (x, z) => new V3(O.x + LIB.x + x, O.y + LIB.y, O.z + LIB.z + z);
// from the secret map: straight into the dome, looking north up the wing
export const libArrive = { pos: LW(0, 14), yaw: 0 };
// the library and its hallway are shown whenever the Hall of Mirrors is: you walk from one into the other
export function showLibrary(on) { hall.visible = on; lib.visible = on; if (on) loadArt(); }
addTick(() => { if (lib.visible !== hall.visible) lib.visible = hall.visible; }, true);
export const inLibrary = (x, z) => Math.abs(x - (O.x + LIB.x)) < LIB.rx + 4 && Math.abs(z - (O.z + LIB.z)) < LIB.hl + 4;
// the shelves (each wing, and each side of the dome) and the desk
const browse = () => late.openLibrary && late.openLibrary();
for (const [x, z] of [[-LIB.hw + 1.6, 24], [LIB.hw - 1.6, 24], [-LIB.hw + 1.6, -24], [LIB.hw - 1.6, -24], [-LIB.rx + 3, 6], [-LIB.rx + 3, -6], [LIB.rx - 2.6, 0], [0, LIB.hl - 1.8], [0, -LIB.hl + 1.8]]) {
  const p = LW(x, z); regThing(lib, 'Browse the shelves', browse, { x: p.x, z: p.z, r: 3.4 });
}
{ const p = LW(0, 7.6); regThing(desk, 'Write a book', () => late.openLibrary && late.openLibrary('write'), { x: p.x, z: p.z + 1.2, r: 2.4 }); }


/* ---------- walking inside: a level floor; the bookcases, columns, cases, statue and desk stop you ---------- */
{
  const f = worlds.sun.floorH, b = worlds.sun.blocked;
  // the hallway: from just inside the Hall of Mirrors to just inside the dome
  const inWay = (lx, lz) => lx > HW.x0 - 4 && lx < HW.x1 + 3 && Math.abs(lz) < HW.half + 1;
  worlds.sun.floorH = (x, z) => inLibrary(x, z) || inWay(x - O.x - LIB.x, z - O.z - LIB.z) ? O.y + LIB.y : f(x, z);
  worlds.sun.blocked = (x, z) => {
    const wx = x - O.x - LIB.x, wz = z - O.z - LIB.z;
    if (inWay(wx, wz)) { if (Math.abs(wz) < HW.half - 0.75) return false; if (wx < HW.x0 - 0.1) return b(x, z); if (wx > HW.x1 + 0.4) return blockedLib(wx, wz); return true; }
    if (!inLibrary(x, z)) return b(x, z);
    return blockedLib(wx, wz);
  };
  function blockedLib(lx, lz) {
    const wing = Math.abs(lx) < LIB.hw - 1.3 && Math.abs(lz) < LIB.hl - 1.1, domeIn = (lx / (LIB.rx - 1.6)) ** 2 + (lz / (LIB.rz - 1.6)) ** 2 < 1;
    if (!wing && !domeIn) return true;
    if (Math.hypot(lx / 1.6, lz / 1.4) < 1.15) return true;
    if (Math.abs(lx) < 1.25 && Math.abs(lz - 7.6) < 0.75) return true;
    for (const zz of [18, 26, 33]) if (Math.abs(Math.abs(lz) - zz) < 1.15 && Math.abs(Math.abs(lx) - 2.7) < 0.75) return true;
    if (Math.abs(Math.abs(lx) - (LIB.hw - 0.9)) < 0.75 && (Math.abs(Math.abs(lz) - (J - 0.6)) < 0.75 || Math.abs(Math.abs(lz) - (J + 1.3)) < 0.75)) return true;
    return false;
  };
}
