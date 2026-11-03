import { V3 } from '../core/util.js';
import { player } from '../player/camera.js';
import { O, SUN_PLAN as P0 } from '../world/sunWorld.js';
import { late, provide } from '../core/late.js';

provide({ get sunPlan() { return PLAN; }, get drawSunMini() { return drawSunMini; } });

/* ================= the map of the secret world ================= */
// The secret world uses the garden's own map (ui/map.js: the parchment sheet, the ribbon title, medallions with
// line icons, label cards that keep out of each other's way, the legend); this module gives it what is
// different there: the hand-drawn plan, the places (each with its icon and where it takes you), the areas'
// names, and the corner map. Coordinates are the world's local ones (x across, z from the lake at +72 to
// behind the castle at −192); ui/map.js turns the sheet sideways when the screen is wide.

const R0 = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const INKC = '#3b3428';

// the plan, in the garden map's manner: watercolour washes inked on parchment, cobbled paths, round trees
function draw(g, P, s, full) {
  const R = R0(29), lw = Math.max(0.8, 0.22 * s);
  const ink = (w = lw) => { g.strokeStyle = INKC; g.lineWidth = w; g.stroke(); };
  const fill = c => { g.fillStyle = c; g.fill(); };
  const circle = (x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, 7); };
  const at = (x, z) => P(x, z);
  // an axis-aligned rectangle and an ellipse in world terms, whichever way the sheet is turned
  const rect = (x0, z0, x1, z1) => { const [a, b] = at(x0, z0), [c, d] = at(x1, z1); g.beginPath(); g.rect(Math.min(a, c), Math.min(b, d), Math.abs(c - a), Math.abs(d - b)); return [Math.min(a, c), Math.min(b, d), Math.abs(c - a), Math.abs(d - b)]; };
  const ell = (x, z, rx, rz) => { const [cx, cy] = at(x, z), [ax, ay] = at(x + rx, z), [bx, by] = at(x, z + rz); g.beginPath(); g.ellipse(cx, cy, Math.abs(ax - cx) + Math.abs(bx - cx), Math.abs(ay - cy) + Math.abs(by - cy), 0, 0, 7); };
  const wash = (path, base, tints, n, spread) => { path(); fill(base); g.save(); path(); g.clip(); for (let k = 0; k < n; k++) { const [x, y] = spread(); g.globalAlpha = 0.18; circle(x, y, (2 + R() * 6) * s); fill(tints[k % tints.length]); } g.restore(); g.globalAlpha = 1; };
  const tree = (x, y, r, c1, c2) => { g.fillStyle = 'rgba(60,50,30,.18)'; circle(x + r * 0.3, y + r * 0.45, r); g.fill(); circle(x, y, r); fill(c1); ink(); circle(x - r * 0.3, y - r * 0.3, r * 0.45); fill(c2); };
  const cobble = (x, y, r) => { circle(x, y, r); fill(['#d8cdb4', '#cfc3a8', '#e2d8c0'][Math.floor(R() * 3)]); ink(lw * 0.6); };
  const rnd = (x0, x1, z0, z1) => at(x0 + R() * (x1 - x0), z0 + R() * (z1 - z0));
  g.lineCap = g.lineJoin = 'round';

  // the land: a soft-edged lawn inside the woods
  const edge = () => { g.beginPath(); for (let k = 0; k <= 120; k++) { const a = k / 120 * Math.PI * 2, w = 1 + Math.sin(a * 7) * 0.012 + Math.sin(a * 13 + 1) * 0.008, [x, y] = at(Math.cos(a) * 102 * w, -60 + Math.sin(a) * 134 * w); k ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); };
  wash(edge, '#9fc27a', ['#c7dc98', '#7fae5a', '#b4d08a', '#6f9e4e'], 260, () => rnd(-100, 100, -190, 70));
  edge(); ink(lw * 1.4);
  // the woods all round, a ring of round trees on the lawn's edge
  for (let k = 0; k < 150; k++) { const a = k / 150 * Math.PI * 2, [x, y] = at(Math.cos(a) * 104, -60 + Math.sin(a) * 136); tree(x, y, 2.3 * s, k % 3 ? '#5e9444' : '#4b7f3a', '#86b75e'); }
  if (full) for (let k = 0; k < 90; k++) { const a = R() * Math.PI * 2, f = 1.08 + R() * 0.2, [x, y] = at(Math.cos(a) * 104 * f, -60 + Math.sin(a) * 136 * f); tree(x, y, (2 + R() * 1.5) * s, k % 3 ? '#5e9444' : '#4b7f3a', '#86b75e'); }

  // the sunflower field: a golden wash scattered with flower heads
  wash(() => rect(-34, P0.FIELD.z0, 34, P0.FIELD.z1), '#f2cf4a', ['#f7de7a', '#e4b22e'], 60, () => rnd(-34, 34, P0.FIELD.z1, P0.FIELD.z0));
  rect(-34, P0.FIELD.z0, 34, P0.FIELD.z1); ink();
  for (let k = 0; k < 190; k++) { const [x, y] = rnd(-33, 33, P0.FIELD.z1 + 1, P0.FIELD.z0 - 1); circle(x, y, 0.9 * s); fill('#f7c81e'); circle(x, y, 0.4 * s); fill('#6a3e18'); }
  // Splash Cove: a tiled deck, the pools in turquoise, the slide's flume from its tower
  rect(P0.WP.x0, P0.WP.z0, P0.WP.x1, P0.WP.z1); fill('#efe6d2'); ink();
  { const [x, y, w, h] = rect(P0.WP.x0, P0.WP.z0, P0.WP.x1, P0.WP.z1); g.save(); g.clip(); g.strokeStyle = 'rgba(120,100,70,.18)'; g.lineWidth = 1; for (let i = x; i < x + w; i += 2.2 * s) { g.beginPath(); g.moveTo(i, y); g.lineTo(i, y + h); g.stroke(); } for (let j = y; j < y + h; j += 2.2 * s) { g.beginPath(); g.moveTo(x, j); g.lineTo(x + w, j); g.stroke(); } g.restore(); }
  for (const pool of [P0.WP.wave, P0.WP.splash]) {
    wash(() => ell(pool.x, pool.z, pool.rx, pool.rz), '#5cc0d4', ['#8fdcea', '#3ea6c0'], 20, () => rnd(pool.x - pool.rx, pool.x + pool.rx, pool.z - pool.rz, pool.z + pool.rz));
    ell(pool.x, pool.z, pool.rx, pool.rz); ink(lw * 1.2);
  }
  { const p = P0.WP.wave; for (let k = -2; k <= 2; k++) { g.beginPath(); for (let i = 0; i <= 20; i++) { const x = p.x - p.rx * 0.7 + i / 20 * p.rx * 1.4, [a, b] = at(x, p.z + k * p.rz * 0.3 + Math.sin(i * 1.3) * 0.6); i ? g.lineTo(a, b) : g.moveTo(a, b); } g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = lw; g.stroke(); } }
  if (P0.FLUME) { const line = () => { g.beginPath(); P0.FLUME.forEach((q, i) => { const [a, b] = at(q.x, q.z); i ? g.lineTo(a, b) : g.moveTo(a, b); }); }; line(); g.strokeStyle = INKC; g.lineWidth = 1.6 * s + lw * 2; g.stroke(); line(); g.strokeStyle = '#f2b81e'; g.lineWidth = 1.6 * s; g.stroke(); }
  { rect(P0.WP.tower.x - 2.2, P0.WP.tower.z - 2.2, P0.WP.tower.x + 2.2, P0.WP.tower.z + 2.2); fill('#3b78d0'); ink(); }

  // water: the lake by the arrival, the lagoon across the fair, the storybook canal round its island
  for (const W of [P0.LAKE, P0.LAGOON]) {
    wash(() => ell(W.x, W.z, W.rx, W.rz), '#6fa9c7', ['#9fcbe0', '#5a8fb0'], 40, () => rnd(W.x - W.rx, W.x + W.rx, W.z - W.rz, W.z + W.rz));
    ell(W.x, W.z, W.rx, W.rz); ink(lw * 1.4); ell(W.x, W.z, W.rx + 1, W.rz + 1); ink(lw * 0.6);
  }
  for (let k = 0; k < 9; k++) { const a = R() * 6.28, r = R() * 0.7, [x, y] = at(P0.LAKE.x + Math.cos(a) * P0.LAKE.rx * r, P0.LAKE.z + Math.sin(a) * P0.LAKE.rz * r); g.beginPath(); g.arc(x, y, 0.9 * s, 0.4, 6.0); g.lineTo(x, y); g.closePath(); fill('#7aa65a'); ink(lw * 0.5); }
  const canal = () => { g.beginPath(); P0.CANAL_PTS.forEach(([x, z], i) => { const [a, b] = at(x, z); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.closePath(); };
  canal(); g.strokeStyle = INKC; g.lineWidth = P0.CANAL.half * 2 * s + lw * 2; g.stroke(); canal(); g.strokeStyle = '#6fa9c7'; g.lineWidth = P0.CANAL.half * 2 * s; g.stroke();
  for (let k = 0; k < 6; k++) { const a = k / 6 * 6.28 + 0.4, [x, y] = at(P0.CANAL.x + Math.cos(a) * (P0.CANAL.rx - 6), P0.CANAL.z + Math.sin(a) * (P0.CANAL.rz - 5)); g.beginPath(); g.rect(x - 1.1 * s, y - 1.1 * s, 2.2 * s, 2.2 * s); fill(['#f2a0c4', '#a8d0f0', '#f6e08a'][k % 3]); ink(lw * 0.6); }
  // the jetty and the bridge, in planks
  const planks = (x0, z0, x1, z1, w) => { const [a, b] = at(x0, z0), [c, d] = at(x1, z1); g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.strokeStyle = INKC; g.lineWidth = w * s + lw * 2; g.stroke(); g.strokeStyle = '#a77a52'; g.lineWidth = w * s; g.stroke(); };
  planks(0, 43.5, 0, 35.2, 1.8);
  planks(0, P0.LAGOON.z + P0.LAGOON.rz + 1, 0, P0.LAGOON.z - P0.LAGOON.rz - 1, P0.BRIDGE.half * 2);
  if (P0.DOCK) planks(P0.DOCK.x, P0.DOCK.z0, P0.DOCK.x, P0.DOCK.z1, 1.6);

  // the cobbled way: through the field to the arch, across the plaza and the bridge to the castle
  for (let z = P0.FIELD.z0 + 4; z > P0.CASTLE.z + 12; z -= 1.1) { if (Math.abs(z - P0.LAGOON.z) < P0.LAGOON.rz + 1) continue; for (const dx of [-0.9, 0, 0.9]) { const [x, y] = at(P0.pathX(z) + dx + (R() - 0.5) * 0.3, z + (R() - 0.5) * 0.3); cobble(x, y, 0.5 * s); } }
  ell(P0.PLAZA.x, P0.PLAZA.z, P0.PLAZA.r, P0.PLAZA.r); fill('#e8dcc4'); ink();
  for (let k = 0; k < 70; k++) { const a = R() * 6.28, r = (0.4 + R() * 0.55) * P0.PLAZA.r, [x, y] = at(P0.PLAZA.x + Math.cos(a) * r, P0.PLAZA.z + Math.sin(a) * r); cobble(x, y, 0.55 * s); }
  // the sunflower arch, the white door
  { const [x, y] = at(0, P0.ARCH_Z); g.beginPath(); g.arc(x, y, 3.4 * s, 0, Math.PI * 2); g.strokeStyle = INKC; g.lineWidth = 1.6 * s; g.stroke(); g.strokeStyle = '#6aa04a'; g.lineWidth = 1.1 * s; g.stroke(); for (let k = 0; k < 10; k++) { const a = k / 10 * 6.28; circle(x + Math.cos(a) * 3.4 * s, y + Math.sin(a) * 3.4 * s, 0.55 * s); fill('#f7c81e'); } }
  { rect(P0.DOOR.x - 1, P0.DOOR.z - 0.6, P0.DOOR.x + 1, P0.DOOR.z + 0.6); fill('#ffffff'); ink(); }

  // the rides, drawn small from above
  const ring = (x, z, r, c, spokes, c2) => { ell(x, z, r, r); fill(c); ink(); if (spokes) { const [cx, cy] = at(x, z); for (let k = 0; k < spokes; k++) { const a = k / spokes * 6.28; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * r * s, cy + Math.sin(a) * r * s); g.strokeStyle = c2 || INKC; g.lineWidth = lw * 0.8; g.stroke(); } } };
  ring(P0.CAROUSEL.x, P0.CAROUSEL.z, P0.CAROUSEL.r, '#f4c6d0', 12, '#d8506a');
  { const [cx, cy] = at(P0.CAROUSEL.x, P0.CAROUSEL.z); circle(cx, cy, 1.4 * s); fill('#f2d35a'); ink(lw * 0.7); }
  ring(P0.SWING.x, P0.SWING.z, P0.SWING.r, '#cfe0f4', 16, '#4a7fd0');
  { const T = P0.FAIR_RIDES.tea; ring(T.x, T.z, T.r, '#f7d8e4'); for (let k = 0; k < 5; k++) { const a = k / 5 * 6.28, [x, y] = at(T.x + Math.cos(a) * T.r * 0.55, T.z + Math.sin(a) * T.r * 0.55); circle(x, y, 1.5 * s); fill(['#e66a8a', '#6ab0e6', '#f2c12e', '#8ad06a', '#b07ae6'][k]); ink(lw * 0.6); } }
  { const D = P0.FAIR_RIDES.drop; ring(D.x, D.z, 4.5, '#ffffff', 8, '#e8463a'); const [x, y] = at(D.x, D.z); circle(x, y, 1.3 * s); fill('#e8463a'); ink(lw * 0.6); }
  { const K = P0.KIOSK; rect(K.x - 1.6, K.z - 1.6, K.x + 1.6, K.z + 1.6); fill('#f6f0e0'); ink(); const [x, y] = at(K.x, K.z); for (let k = -1; k <= 1; k++) { g.fillStyle = '#e8463a'; g.fillRect(x - 1.6 * s + (k + 1) * 1.07 * s, y - 1.6 * s, 0.5 * s, 3.2 * s); } }
  { const Wh = P0.WHEEL; ring(Wh.x, Wh.z, Wh.r * 0.55, '#fbf2e0', 12, '#d8322e'); }
  { const tr = () => { g.beginPath(); P0.track.forEach((p, i) => { const [a, b] = at(p.x, p.z); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.closePath(); }; tr(); g.strokeStyle = INKC; g.lineWidth = 1.4 * s + lw * 2; g.stroke(); tr(); g.strokeStyle = '#d8322e'; g.lineWidth = 1.4 * s; g.stroke(); }
  // the castle: pink walls round a court, blue round towers with gold finials
  { const C = P0.CASTLE; g.fillStyle = 'rgba(60,50,30,.2)'; rect(C.x - 17, C.z - 8, C.x + 19, C.z + 11); g.fill(); rect(C.x - 18, C.z - 9, C.x + 18, C.z + 10); fill('#ecbcb8'); ink(lw * 1.2); rect(C.x - 7, C.z - 4, C.x + 7, C.z + 5); fill('#f6dcd6'); ink(lw * 0.7);
    for (const [dx, dz, r] of [[-18, 10, 3.4], [18, 10, 3.4], [-18, -9, 3.6], [18, -9, 3.6], [0, -1, 4.2]]) { ell(C.x + dx, C.z + dz, r, r); fill('#4a7fd0'); ink(); const [x, y] = at(C.x + dx, C.z + dz); circle(x, y, 0.8 * s); fill('#e8c25a'); } }
  // lamps along the way, as small gold dots
  for (let z = P0.FIELD.z0; z > P0.ARCH_Z; z -= 7) for (const sd of [-1, 1]) { const [x, y] = at(P0.pathX(z) + sd * 2.6, z); circle(x, y, 0.45 * s); fill('#e8b84a'); ink(lw * 0.5); }
}

// the places: a name, a few words, the icon, where it stands on the plan, and where choosing it takes you
const hop = (x, z, yaw, name) => () => late.hopTo && late.hopTo(O.clone().add(new V3(x, 0, z)), yaw, name);
function places() {
  const L = [], add = (name, hint, glyph, x, z, side, go) => L.push({ name, hint, glyph, x, z, side, go });
  add('Arrival', 'the jetty on the lake', 'arrival', 0, 36, 'r', hop(0, 34.8, 0, 'Arrival'));
  add('Sunflower field', 'walk among the sunflowers', 'sunflower', -22, 14, 'l', hop(P0.pathX(14), 14, 0, 'The sunflowers'));
  add('White door', 'the way home', 'door', P0.DOOR.x, P0.DOOR.z, 'l', hop(P0.DOOR.x, P0.DOOR.z + 3.2, 0, 'The white door'));
  add('Sunflower arch', 'into the fair', 'arch', 0, P0.ARCH_Z, 'r', hop(0, P0.ARCH_Z + 5, 0, 'The sunflower arch'));
  add('Wave pool', 'float on the waves', 'wave', P0.WP.wave.x, P0.WP.wave.z, 't', hop(P0.WP.wave.x, P0.WP.wave.z - P0.WP.wave.rz - 2.6, Math.PI, 'The wave pool'));
  add('Water slide', 'twist down into the pool', 'slide', P0.WP.tower.x, P0.WP.tower.z, 'l', hop(P0.WP.tower.x - 4, P0.WP.tower.z - 4.5, Math.PI * 0.75, 'The water slide'));
  add('Carousel', 'horses round and round', 'carousel', P0.CAROUSEL.x, P0.CAROUSEL.z, 'b', hop(0, P0.CAROUSEL.z + P0.CAROUSEL.r + 3, 0, 'The carousel'));
  add('Teacups', 'spin and spin', 'teacup', P0.FAIR_RIDES.tea.x, P0.FAIR_RIDES.tea.z, 'l', hop(P0.FAIR_RIDES.tea.x + P0.FAIR_RIDES.tea.r + 2.2, P0.FAIR_RIDES.tea.z, Math.PI / 2, 'The teacups'));
  add('Fireworks', 'the striped kiosk', 'fireworks', P0.KIOSK.x, P0.KIOSK.z, 'r', hop(P0.KIOSK.x, P0.KIOSK.z + 2.4, 0, 'Fireworks'));
  add('Canal boats', 'boats round the island', 'boat', P0.CANAL.x, P0.CANAL.z, 'l', hop(P0.CANAL.x + P0.CANAL.rx + P0.CANAL.half + 3.2, P0.CANAL.z, Math.PI / 2, 'The storybook canal'));
  add('Swings', 'fly out over the lagoon', 'swingride', P0.SWING.x, P0.SWING.z, 'r', hop(P0.SWING.x - P0.SWING.r - 2.5, P0.SWING.z, -Math.PI / 2, 'The swings'));
  add('Drop tower', '56 metres up, then down', 'drop', P0.FAIR_RIDES.drop.x, P0.FAIR_RIDES.drop.z, 'r', hop(P0.FAIR_RIDES.drop.x - 6.5, P0.FAIR_RIDES.drop.z + 2, -Math.PI / 2, 'The drop tower'));
  if (P0.DOCK) add('Jet skis', 'out on the lagoon', 'jetski', P0.DOCK.x, P0.DOCK.z1 + 2, 'b', hop(P0.DOCK.x, P0.DOCK.z0 + 2.2, Math.PI, 'Jet skis'));
  add('Ferris wheel', 'see the whole fair', 'wheel', P0.WHEEL.x, P0.WHEEL.z, 'l', hop(P0.WHEEL.x, P0.WHEEL.z + 6.5, 0, 'The Ferris wheel'));
  add('Roller coaster', 'hold on tight', 'coaster', 50, -142, 'r', hop(29, -118, -Math.PI / 2, 'The roller coaster'));
  add('Hall of Mirrors', 'inside the castle', 'castle', P0.CASTLE.x + 6, P0.CASTLE.z, 'r', () => late.enterHallFromMap && late.enterHallFromMap());
  add('Library', 'read, or write a book', 'book', P0.CASTLE.x - 9, P0.CASTLE.z + 3, 'l', () => late.enterLibraryFromMap && late.enterLibraryFromMap());
  return L;
}
// the areas' names, written softly where there is room (a few spots to try for each)
const regions = () => [
  ['The lake', [[-14, P0.LAKE.z], [16, P0.LAKE.z + 4]]],
  ['The lagoon', [[-34, P0.LAGOON.z], [30, P0.LAGOON.z + 3], [-20, P0.LAGOON.z + 4]]],
  ['Splash Cove', [[(P0.WP.x0 + P0.WP.x1) / 2, P0.WP.z0 - 3], [70, -14]]],
  ['The fair', [[-14, P0.PLAZA.z + 14], [18, P0.PLAZA.z - 16]]],
  ['The castle', [[P0.CASTLE.x, P0.CASTLE.z - 14], [P0.CASTLE.x - 26, P0.CASTLE.z]]],
];

// the sheet's extent (local x and z), so ui/map.js can fit it
export const PLAN = { title: 'The Secret Garden', sub: 'Choose a place, and you will be taken there.', x0: -108, x1: 108, z0: -197, z1: 77, draw, places, regions, local: () => [player.pos.x - O.x, player.pos.z - O.z] };

/* ---------- the corner map ---------- */
// ui/map.js draws the round corner map; here it takes a window of the plan round you (+z down, as on the sheet)
let plan = null; const PS = 4;
const mp = (x, z) => [(x - PLAN.x0) * PS, (z - PLAN.z0) * PS];
function drawSunMini(g, N, span) {
  if (!plan) { plan = document.createElement('canvas'); plan.width = (PLAN.x1 - PLAN.x0) * PS; plan.height = (PLAN.z1 - PLAN.z0) * PS; const pg = plan.getContext('2d'); pg.fillStyle = '#efe4c8'; pg.fillRect(0, 0, plan.width, plan.height); draw(pg, mp, PS, false); }
  const [lx, lz] = PLAN.local(), [a, b] = mp(lx, lz), k = N / (2 * span * PS);
  g.drawImage(plan, a - span * PS, b - span * PS, span * 2 * PS, span * 2 * PS, 0, 0, N, N);
  for (const p of places()) {
    const [c, d] = mp(p.x, p.z), mx = N / 2 + (c - a) * k, my = N / 2 + (d - b) * k;
    if (mx < -8 || my < -8 || mx > N + 8 || my > N + 8) continue;
    g.fillStyle = '#2f5a3a'; g.beginPath(); g.arc(mx, my, 6, 0, 7); g.fill(); g.strokeStyle = '#fffaf0'; g.lineWidth = 2; g.stroke();
  }
  return -player.yaw;
}
