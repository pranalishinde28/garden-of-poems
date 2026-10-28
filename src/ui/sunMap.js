import { $, V3 } from '../core/util.js';
import { state } from '../core/state.js';
import { player } from '../player/camera.js';
import { O, SUN_PLAN as P } from '../world/sunWorld.js';
import { closePanel, openPanel } from './reading.js';
import { late, provide } from '../core/late.js';

provide({ get toggleSunMap() { return toggleSunMap; } });

/* ================= the map of the secret world ================= */
// M (or Map in ⋯) in the secret world opens this: a hand-drawn plan of the sunflower field and the fair, with
// a medallion for every place. Choosing one takes you there (ui/worlds.js hop); the castle takes you inside.
const panel = $('#sunmap'), cv = $('#sm-canvas'), marks = $('#sm-marks'), S = 4;
// world (local x, z) to canvas: x across, the field at the bottom, the castle at the top
const px = (x, z) => [(x + 100) * S, (z + 186) * S * 0 + (70 - z) * S];
function draw() {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height;
  // parchment, a faint grid
  const pg = g.createLinearGradient(0, 0, 0, H); pg.addColorStop(0, '#f5ead2'); pg.addColorStop(1, '#ead9b4'); g.fillStyle = pg; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(140,110,70,.12)'; g.lineWidth = 1; for (let x = 0; x < W; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = 0; y < H; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  const ink = (w = 2) => { g.strokeStyle = '#5a4630'; g.lineWidth = w; g.stroke(); };
  const ell = (x, z, rx, rz, fill) => { const [a, b] = px(x, z); g.beginPath(); g.ellipse(a, b, rx * S, rz * S, 0, 0, 7); g.fillStyle = fill; g.fill(); ink(); };
  // the lawn
  g.beginPath(); g.ellipse(W / 2, H / 2, W * 0.47, H * 0.48, 0, 0, 7); g.fillStyle = '#b9d38c'; g.fill();
  // the sunflower field
  { const [x0, y0] = px(-34, P.FIELD.z0), [x1, y1] = px(34, P.FIELD.z1); g.fillStyle = '#f2cf4a'; g.fillRect(x0, y0, x1 - x0, y1 - y0); g.fillStyle = '#7a4e1e'; for (let y = y0 + 8; y < y1; y += 14) for (let x = x0 + 8; x < x1; x += 14) { g.beginPath(); g.arc(x + ((y / 14) % 2) * 7, y, 2.2, 0, 7); g.fill(); } g.strokeStyle = '#a8862a'; g.lineWidth = 2; g.strokeRect(x0, y0, x1 - x0, y1 - y0); }
  // water: the lake, the lagoon, the canal
  ell(P.LAKE.x, P.LAKE.z, P.LAKE.rx, P.LAKE.rz, '#8cc0dc');
  ell(P.LAGOON.x, P.LAGOON.z, P.LAGOON.rx, P.LAGOON.rz, '#8cc0dc');
  g.beginPath(); P.CANAL_PTS.forEach(([x, z], i) => { const [a, b] = px(x, z); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.closePath(); g.strokeStyle = '#6aa8cc'; g.lineWidth = P.CANAL.half * 2 * S; g.stroke();
  // the paths: through the field to the arch, then the fair's promenade to the castle
  g.beginPath(); for (let z = P.FIELD.z0 + 4; z >= P.CASTLE.z + 12; z -= 1) { const [a, b] = px(P.pathX(z), z); z === P.FIELD.z0 + 4 ? g.moveTo(a, b) : g.lineTo(a, b); } g.strokeStyle = '#f7efdc'; g.lineWidth = 12; g.stroke(); g.strokeStyle = 'rgba(90,70,48,.4)'; g.lineWidth = 1.5; g.stroke();
  ell(P.PLAZA.x, P.PLAZA.z, P.PLAZA.r, P.PLAZA.r, '#ead2c4');
  // the coaster's track
  g.beginPath(); P.track.forEach((p, i) => { const [a, b] = px(p.x, p.z); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.closePath(); g.strokeStyle = '#d8322e'; g.lineWidth = 4; g.stroke();
  // the castle: pink walls, blue spires
  { const [a, b] = px(P.CASTLE.x, P.CASTLE.z); g.fillStyle = '#e8b4b0'; g.fillRect(a - 18 * S, b - 8 * S, 36 * S, 18 * S); g.strokeStyle = '#5a4630'; g.lineWidth = 2; g.strokeRect(a - 18 * S, b - 8 * S, 36 * S, 18 * S);
    for (const [dx, dz, r] of [[-18, 9, 3.2], [18, 9, 3.2], [-15, -8, 3.4], [15, -8, 3.4], [0, -1, 4]]) { const [c, d] = px(P.CASTLE.x + dx, P.CASTLE.z + dz); g.beginPath(); g.arc(c, d, r * S, 0, 7); g.fillStyle = '#4a7fd0'; g.fill(); ink(1.5); } }
  // the rides, drawn small
  const ring = (x, z, r, fill) => ell(x, z, r, r, fill);
  ring(P.CAROUSEL.x, P.CAROUSEL.z, P.CAROUSEL.r, '#f0c0c8');
  { const [a, b] = px(P.WHEEL.x, P.WHEEL.z); g.strokeStyle = '#d8322e'; g.lineWidth = 4; g.beginPath(); g.moveTo(a - P.WHEEL.r * S, b); g.lineTo(a + P.WHEEL.r * S, b); g.stroke(); }
  ring(P.SWING.x, P.SWING.z, P.SWING.r, '#bcd4f0');
  ring(P.FAIR_RIDES.tea.x, P.FAIR_RIDES.tea.z, P.FAIR_RIDES.tea.r, '#f7c8dc');
  ring(P.FAIR_RIDES.drop.x, P.FAIR_RIDES.drop.z, 4, '#e8463a');
  // a ribbon title
  g.fillStyle = '#7a3a3a'; g.beginPath(); g.moveTo(W / 2 - 220, 24); g.lineTo(W / 2 + 220, 24); g.lineTo(W / 2 + 196, 46); g.lineTo(W / 2 + 220, 68); g.lineTo(W / 2 - 220, 68); g.lineTo(W / 2 - 196, 46); g.closePath(); g.fill();
  g.fillStyle = '#fff4de'; g.font = '700 30px "Cormorant Garamond", Georgia, serif'; g.textAlign = 'center'; g.fillText('The Secret Garden', W / 2, 56);
}
// the places, and where each one stands you
const PLACES = () => [
  ['Where you arrived', 'the jetty on the lake', 0, 34.8, 0, 34.8, 0, 'r'],
  ['The white door', 'the way home', P.DOOR.x, P.DOOR.z, P.DOOR.x, P.DOOR.z + 3.2, 0, 'r'],
  ['The sunflower arch', 'into the fair', 0, P.ARCH_Z, 0, P.ARCH_Z + 5, 0, 't'],
  ['The carousel', 'horses round and round', P.CAROUSEL.x, P.CAROUSEL.z, 0, P.CAROUSEL.z + P.CAROUSEL.r + 3, 0, 'b'],
  ['The teacups', 'spin and spin', P.FAIR_RIDES.tea.x, P.FAIR_RIDES.tea.z, P.FAIR_RIDES.tea.x + P.FAIR_RIDES.tea.r + 2.2, P.FAIR_RIDES.tea.z, Math.PI / 2, 'l'],
  ['Storybook canal', 'boats round the island', P.CANAL.x, P.CANAL.z, P.CANAL.x + P.CANAL.rx + P.CANAL.half + 3.2, P.CANAL.z, Math.PI / 2, 'l'],
  ['The swings', 'fly out over the lagoon', P.SWING.x, P.SWING.z, P.SWING.x - P.SWING.r - 2.5, P.SWING.z, -Math.PI / 2, 'r'],
  ['The drop tower', '56 metres up, then down', P.FAIR_RIDES.drop.x, P.FAIR_RIDES.drop.z, P.FAIR_RIDES.drop.x - 6.5, P.FAIR_RIDES.drop.z + 2, -Math.PI / 2, 'r'],
  ['Fireworks', 'the striped kiosk', P.KIOSK.x, P.KIOSK.z, P.KIOSK.x, P.KIOSK.z + 2.4, 0, 'r'],
  ['The Ferris wheel', 'see the whole fair', P.WHEEL.x, P.WHEEL.z, P.WHEEL.x, P.WHEEL.z + 6.5, 0, 'l'],
  ['The roller coaster', 'hold on tight', 50, -142, 29, -118, -Math.PI / 2, 'r'],
  ['The Hall of Mirrors', 'inside the castle', P.CASTLE.x, P.CASTLE.z, null, null, 0, 'r'],
];
function build() {
  marks.innerHTML = '';
  const W = cv.width, H = cv.height;
  PLACES().forEach(([name, hint, x, z, sx, sz, yaw, side]) => {
    const [a, b] = px(x, z), btn = document.createElement('button');
    btn.className = 'sm-place side-' + side; btn.style.left = (a / W * 100) + '%'; btn.style.top = (b / H * 100) + '%';
    btn.innerHTML = `<span class="dot"></span><span class="t"><em>${name}</em><small>${hint}</small></span>`;
    btn.setAttribute('aria-label', `${name}: ${hint}`);
    btn.onclick = () => { close(); if (sx === null) late.enterHallFromMap && late.enterHallFromMap(); else late.hopTo && late.hopTo(O.clone().add(new V3(sx, 0, sz)), yaw, name); };
    marks.appendChild(btn);
  });
  // you are here
  const [a, b] = px(player.pos.x - O.x, player.pos.z - O.z), me = document.createElement('span');
  me.className = 'sm-me'; me.textContent = '▲'; me.style.left = (a / W * 100) + '%'; me.style.top = (b / H * 100) + '%'; me.style.transform = `translate(-50%,-50%) rotate(${-player.yaw}rad)`;
  if (a > 0 && a < W && b > 0 && b < H) marks.appendChild(me);
}
function open() { if (state.mode !== 'walk') return; draw(); build(); openPanel(panel); }
function close() { closePanel(panel); }
function toggleSunMap() { panel.hidden || !panel.classList.contains('open') ? open() : close(); }
$('#sm-close').onclick = close;
if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
