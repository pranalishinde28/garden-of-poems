import { $, V3 } from '../core/util.js';
import { state } from '../core/state.js';
import { player } from '../player/camera.js';
import { O, SUN_PLAN as P } from '../world/sunWorld.js';
import { closePanel, openPanel } from './reading.js';
import { late, provide } from '../core/late.js';

provide({ get toggleSunMap() { return toggleSunMap; }, get drawSunMini() { return drawSunMini; } });

/* ================= the map of the secret world ================= */
// M (or Map in ⋯) in the secret world opens this: a hand-drawn plan of the sunflower field and the fair, with
// a medallion for every place. Choosing one takes you there (ui/worlds.js hop); the castle takes you inside.
const panel = $('#sunmap'), cv = $('#sm-canvas'), marks = $('#sm-marks'), S = 4;
// world (local x, z) to canvas: x across, the field at the bottom, the castle at the top
const px = (x, z) => [(x + 100) * S, (z + 186) * S * 0 + (70 - z) * S];
function draw(c = cv, title = true) {
  // a calm plan: soft fills, no ink outlines or patterns; the big areas named faintly; places are the dots
  const g = c.getContext('2d'), W = c.width, H = c.height;
  const pg = g.createLinearGradient(0, 0, 0, H); pg.addColorStop(0, '#f5ead2'); pg.addColorStop(1, '#ecdcba'); g.fillStyle = pg; g.fillRect(0, 0, W, H);
  const ell = (x, z, rx, rz, fill) => { const [a, b] = px(x, z); g.beginPath(); g.ellipse(a, b, rx * S, rz * S, 0, 0, 7); g.fillStyle = fill; g.fill(); };
  const box = (x0, z0, x1, z1, fill, r = 14) => { const [a0, b0] = px(x0, z0), [a1, b1] = px(x1, z1), x = Math.min(a0, a1), y = Math.min(b0, b1), w = Math.abs(a1 - a0), h = Math.abs(b1 - b0); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); g.fillStyle = fill; g.fill(); };
  const name = (t, x, z) => { const [a, b] = px(x, z); g.font = 'italic 600 26px "Cormorant Garamond", Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(90,64,36,.5)'; g.fillText(t, a, b); };
  // the lawn
  g.beginPath(); g.ellipse(W / 2, H / 2, W * 0.47, H * 0.48, 0, 0, 7); g.fillStyle = '#c5dc9c'; g.fill();
  // the sunflower field, the flower terraces, Splash Cove
  box(-34, P.FIELD.z0, 34, P.FIELD.z1, '#f4d76a');
  for (const T0 of P.TERRACES) { box(T0.x0, T0.z0, T0.x1, T0.z1, '#e3d2ee'); const n = 3, d = (T0.z0 - T0.z1) / n; ['#f2b8c8', '#f4e08e', '#c8b4e8'].forEach((col, k) => box(T0.x0 + 3, T0.z0 - k * d - 3, T0.x1 - 3, T0.z0 - (k + 1) * d + 3, col, 10)); }
  box(P.WP.x0, P.WP.z0, P.WP.x1, P.WP.z1, '#f1e8d6');
  ell(P.WP.wave.x, P.WP.wave.z, P.WP.wave.rx, P.WP.wave.rz, '#8fd2e2'); ell(P.WP.splash.x, P.WP.splash.z, P.WP.splash.rx, P.WP.splash.rz, '#8fd2e2');
  // water
  ell(P.LAKE.x, P.LAKE.z, P.LAKE.rx, P.LAKE.rz, '#a6cfe2');
  ell(P.LAGOON.x, P.LAGOON.z, P.LAGOON.rx, P.LAGOON.rz, '#a6cfe2');
  g.beginPath(); P.CANAL_PTS.forEach(([x, z], i) => { const [a, b] = px(x, z); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.closePath(); g.strokeStyle = '#a6cfe2'; g.lineWidth = P.CANAL.half * 2 * S; g.stroke();
  // the fair's plaza, the castle
  ell(P.PLAZA.x, P.PLAZA.z, P.PLAZA.r, P.PLAZA.r, '#efd9cc');
  box(P.CASTLE.x - 18, P.CASTLE.z + 10, P.CASTLE.x + 18, P.CASTLE.z - 8, '#ecc4c0');
  // the one path, through the field and on through the fair to the castle
  g.beginPath(); for (let z = P.FIELD.z0 + 4; z >= P.CASTLE.z + 10; z -= 1) { const [a, b] = px(P.pathX(z), z); z === P.FIELD.z0 + 4 ? g.moveTo(a, b) : g.lineTo(a, b); } g.strokeStyle = '#fbf5e8'; g.lineWidth = 10; g.lineCap = 'round'; g.stroke();
  // the areas' names
  name('Sunflower field', -16, P.FIELD.z0 - 9); name('Splash Cove', 70, -13);
  name('The fair', -16, P.PLAZA.z + 8); name('The lagoon', -32, P.LAGOON.z); name('The castle', P.CASTLE.x, P.CASTLE.z - 12);
  name('Flower terraces', (P.TERRACE.x0 + P.TERRACE.x1) / 2, P.TERRACE.z1 - 3.5);
  if (!title) return;
}
// the places, and where each one stands you
const PLACES = () => [
  ['Arrival', 'the jetty on the lake', 0, 34.8, 0, 34.8, 0, 'r'],
  ['White door', 'the way home', P.DOOR.x, P.DOOR.z, P.DOOR.x, P.DOOR.z + 3.2, 0, 'r'],
  ['Sunflower arch', 'into the fair', 0, P.ARCH_Z, 0, P.ARCH_Z + 5, 0, 't'],
  ['Carousel', 'horses round and round', P.CAROUSEL.x, P.CAROUSEL.z, 0, P.CAROUSEL.z + P.CAROUSEL.r + 3, 0, 'b'],
  ['Teacups', 'spin and spin', P.FAIR_RIDES.tea.x, P.FAIR_RIDES.tea.z, P.FAIR_RIDES.tea.x + P.FAIR_RIDES.tea.r + 2.2, P.FAIR_RIDES.tea.z, Math.PI / 2, 'l'],
  ['Canal boats', 'boats round the island', P.CANAL.x, P.CANAL.z, P.CANAL.x + P.CANAL.rx + P.CANAL.half + 3.2, P.CANAL.z, Math.PI / 2, 'l'],
  ['Swings', 'fly out over the lagoon', P.SWING.x, P.SWING.z, P.SWING.x - P.SWING.r - 2.5, P.SWING.z, -Math.PI / 2, 'r'],
  ['Drop tower', '56 metres up, then down', P.FAIR_RIDES.drop.x, P.FAIR_RIDES.drop.z, P.FAIR_RIDES.drop.x - 6.5, P.FAIR_RIDES.drop.z + 2, -Math.PI / 2, 'r'],
  ['Fireworks', 'the striped kiosk', P.KIOSK.x, P.KIOSK.z, P.KIOSK.x, P.KIOSK.z + 2.4, 0, 'r'],
  ['Ferris wheel', 'see the whole fair', P.WHEEL.x, P.WHEEL.z, P.WHEEL.x, P.WHEEL.z + 6.5, 0, 'l'],
  ['Roller coaster', 'hold on tight', 50, -142, 29, -118, -Math.PI / 2, 'r'],
  ['Hall of Mirrors', 'inside the castle', P.CASTLE.x, P.CASTLE.z, null, null, 0, 'r'],
  ['Library', 'read, or write a book', P.CASTLE.x - 12, P.CASTLE.z + 4, 'library', null, 0, 'l'],
  ['Water slide', 'twist down into the pool', P.WP.tower.x, P.WP.tower.z, P.WP.tower.x - 4, P.WP.tower.z - 4.5, Math.PI * 0.75, 'b'],
  ['Wave pool', 'float on the waves', P.WP.wave.x, P.WP.wave.z, P.WP.wave.x, P.WP.wave.z - P.WP.wave.rz - 2.6, Math.PI, 't'],
  ['Jet skis', 'out on the lagoon', P.DOCK.x, P.DOCK.z1 + 2, P.DOCK.x, P.DOCK.z0 + 2.2, Math.PI, 'b'],
  ['Terraces', 'rows of every colour', (P.TERRACE.x0 + P.TERRACE.x1) / 2, (P.TERRACE.z0 + P.TERRACE.z1) / 2, P.TERRACE.x1 + 1, (P.TERRACE.z0 + P.TERRACE.z1) / 2, Math.PI / 2, 'b'],
];
function build() {
  marks.innerHTML = '';
  const W = cv.width, H = cv.height;
  PLACES().forEach(([name, hint, x, z, sx, sz, yaw, side]) => {
    const [a, b] = px(x, z), btn = document.createElement('button');
    btn.className = 'sm-place side-' + side; btn.dataset.side = side; btn.style.left = (a / W * 100) + '%'; btn.style.top = (b / H * 100) + '%';
    btn.innerHTML = `<span class="dot"></span><span class="t"><em>${name}</em></span>`;
    btn.setAttribute('aria-label', `${name}: ${hint}`);
    const say = () => { cap.innerHTML = `<b>${name}</b> · ${hint}`; }; btn.onmouseenter = say; btn.onfocus = say;
    btn.onmouseleave = btn.onblur = () => { cap.textContent = CAP; };
    btn.onclick = () => { close(); if (sx === 'library') late.enterLibraryFromMap && late.enterLibraryFromMap(); else if (sx === null) late.enterHallFromMap && late.enterHallFromMap(); else late.hopTo && late.hopTo(O.clone().add(new V3(sx, 0, sz)), yaw, name); };
    marks.appendChild(btn);
  });
  // you are here
  const [a, b] = px(player.pos.x - O.x, player.pos.z - O.z), me = document.createElement('span');
  me.className = 'sm-me'; me.textContent = '▲'; me.style.left = (a / W * 100) + '%'; me.style.top = (b / H * 100) + '%'; me.style.transform = `translate(-50%,-50%) rotate(${Math.PI + player.yaw}rad)`; // +z is up on this plan
  if (a > 0 && a < W && b > 0 && b < H) marks.appendChild(me);
}
// each label takes the first side (its own first, then right, left, below, above) where it overlaps no other
// label or dot and stays on the map; failing that, the side that overlaps least
function settle() {
  const box = marks.getBoundingClientRect(), placed = [], dots = [...marks.querySelectorAll('.sm-place .dot, .sm-me')].map(d => d.getBoundingClientRect());
  const over = (r, q) => Math.max(0, Math.min(r.right, q.right) - Math.max(r.left, q.left) + 4) * Math.max(0, Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top) + 4);
  for (const btn of marks.querySelectorAll('.sm-place')) {
    const t = btn.querySelector('.t'), own = btn.querySelector('.dot').getBoundingClientRect(); let best = null, bestCost = 1e9;
    for (const side of [btn.dataset.side, 'r', 'l', 'b', 't']) {
      btn.className = 'sm-place side-' + side; const r = t.getBoundingClientRect();
      let cost = placed.reduce((s, q) => s + over(r, q), 0) + dots.reduce((s, q) => s + (q === own ? 0 : over(r, q)), 0);
      if (r.left < box.left || r.right > box.right || r.top < box.top || r.bottom > box.bottom) cost += 1e5;
      if (cost < bestCost) { bestCost = cost; best = side; } if (cost === 0) break;
    }
    btn.className = 'sm-place side-' + best; placed.push(t.getBoundingClientRect());
  }
}
const cap = $('#sm-cap'), CAP = cap.textContent;
function open() { if (state.mode !== 'walk') return; draw(); build(); openPanel(panel); requestAnimationFrame(() => requestAnimationFrame(settle)); }
function close() { closePanel(panel); }
function toggleSunMap() { panel.hidden || !panel.classList.contains('open') ? open() : close(); }
$('#sm-close').onclick = close;
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => draw());

/* ---------- the corner map in the secret world ---------- */
// ui/map.js draws the round corner map; here it takes a window of this plan (without its title) round you,
// with a small medallion for every place. +z is up on this plan, so the arrow turns the other way.
let plan = null;
function drawSunMini(g, N, span) {
  if (!plan) { plan = document.createElement('canvas'); plan.width = cv.width; plan.height = cv.height; draw(plan, false); }
  const k = N / (2 * span * S), [a, b] = px(player.pos.x - O.x, player.pos.z - O.z);
  g.drawImage(plan, a - span * S, b - span * S, span * 2 * S, span * 2 * S, 0, 0, N, N);
  for (const [, , x, z] of PLACES()) {
    const [c, d] = px(x, z), mx = N / 2 + (c - a) * k, my = N / 2 + (d - b) * k;
    if (mx < -8 || my < -8 || mx > N + 8 || my > N + 8) continue;
    g.fillStyle = '#7a4a2a'; g.beginPath(); g.arc(mx, my, 6, 0, 7); g.fill(); g.strokeStyle = '#f5ead2'; g.lineWidth = 2; g.stroke();
  }
  return Math.PI + player.yaw;
}
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { plan = null; });
