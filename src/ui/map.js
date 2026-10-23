import { $, V3, clamp, isTouch } from '../core/util.js';
import { BRIDGES, POND_R, RIVER, WORLD_R } from '../world/terrain.js';
import { SETTINGS } from '../settings/storage.js';
import { state } from '../core/state.js';
import { MOOD_INK, REGIONS, MOODS } from '../plants/mapping.js';
export { MOOD_INK };
import { camera } from '../world/renderer.js';
import { BENCH, TULIPS, featOn, stones } from '../world/paths.js';
import { plants } from '../plants/registry.js';
import { sign } from '../world/decor.js';
import { SWING_GARDEN, swings } from '../world/swings.js';
import { ROSE_GARDEN } from '../plants/flowerGardens.js';
import { FOUNTAIN } from '../world/fountain.js';
import { LANDMARKS } from '../world/shrines.js';
import { LANTERN_WALL } from '../world/lanterns.js';
import { LOOKOUT } from '../world/gorge.js';
import { GATE } from '../settings/customize.js';
import { blocked, camTween, floorH, player } from '../player/camera.js';
import { keys } from './input.js';
import { openPoem } from './reading.js';
import { closeSwingReader } from './swingReader.js';
import { hideSwingUI } from './swinging.js';
import { late, provide } from '../core/late.js';

/* ================= the garden map (M) and the corner map ================= */
// Drawn from the same layout the 3D garden is built from, in ink on paper. Features the owner has
// hidden stay hidden. Choosing a place or a poem glides you there: a slow lift, a drift across, and
// a settle at a spot to stand (it never teleports).

const moodOf = p => (p.mood && MOOD_INK[p.mood]) ? p.mood : 'reflection';
// on the map: growing or grown, and not hidden by 'Walk through time'
const onMap = pl => !pl.dying && pl.target !== 0;
const view = $('#mapview'), stage = $('#map-stage'), cv = $('#map-canvas'), marks = $('#map-marks'), me = $('#map-me');
const mini = $('#minimap'), miniBtn = $('#minimap-btn');

// ---- drawing the garden ----
const INK = 'rgba(52,62,42,', WATER = 'rgba(120,163,186,';
// A hand-drawn garden plan, after the owner's references: watercolour washes with ink outlines on
// parchment, cobbled paths, blue water with lily pads, yellow and red flower beds, round ink-drawn trees
// with trunks, temples with red walls and grey roofs, and leaf sprigs in the corners.
const INKC = '#3b3428';
function drawWorld(g, P, s, full) {
  const at = (x, z) => P(x, z), R = (seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647)(11);
  const lw = Math.max(0.8, 0.22 * s);
  const ink = (w = lw) => { g.strokeStyle = INKC; g.lineWidth = w; g.stroke(); };
  const fill = c => { g.fillStyle = c; g.fill(); };
  const circle = (x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, 7); };
  // a watercolour wash: the base colour, then soft blotches of lighter and darker tints inside the shape
  const wash = (path, base, tints, n, spread) => { path(); fill(base); g.save(); path(); g.clip(); for (let k = 0; k < n; k++) { const [x, y] = spread(); g.globalAlpha = 0.18; circle(x, y, (2 + R() * 6) * s); fill(tints[k % tints.length]); } g.restore(); g.globalAlpha = 1; };
  const tree = (x, y, r, c1, c2) => { g.fillStyle = 'rgba(60,50,30,.18)'; circle(x + r * 0.3, y + r * 0.45, r); g.fill(); g.fillStyle = '#7a5434'; g.fillRect(x - r * 0.12, y, r * 0.24, r * 0.75); circle(x, y, r); fill(c1); ink(); circle(x - r * 0.3, y - r * 0.3, r * 0.45); fill(c2); };
  g.lineCap = g.lineJoin = 'round';
  const [cx, cy] = at(0, 0);
  // the garden: a soft-edged watercolour lawn, outlined in ink, on the parchment
  const edge = () => { g.beginPath(); for (let k = 0; k <= 90; k++) { const a = k / 90 * Math.PI * 2, r = (WORLD_R + 4 + Math.sin(a * 7) * 1.2 + Math.sin(a * 13 + 1) * 0.6) * s; k ? g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) : g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath(); };
  wash(edge, '#9fc27a', ['#c7dc98', '#7fae5a', '#b4d08a', '#6f9e4e'], 140, () => { const a = R() * 6.28, r = Math.sqrt(R()) * WORLD_R; return at(Math.cos(a) * r, Math.sin(a) * r); });
  edge(); ink(lw * 1.4);
  // the hedge: a ring of ink-outlined bushes with hydrangea blooms on the inside
  for (let k = 0; k < 120; k++) { const a = k / 120 * Math.PI * 2, [x, y] = at(Math.cos(a) * (WORLD_R + 1.5), Math.sin(a) * (WORLD_R + 1.5)); circle(x, y, 1.9 * s); fill(k % 2 ? '#5f8e45' : '#6f9e50'); ink(lw * 0.7); }
  const hyd = ['#7c9be6', '#f2a0c0', '#c09ae6', '#ffffff', '#e66aa2'];
  for (let k = 0; k < 150; k++) { const a = R() * Math.PI * 2, r = 66.5 + R() * 4; if (Math.abs(Math.cos(a) * r) < 5.5 && Math.sin(a) > 0) continue; const [x, y] = at(Math.cos(a) * r, Math.sin(a) * r); circle(x, y, 0.55 * s); fill(hyd[k % 5]); }
  // trees beyond the hedge (only on the full map, where there is room)
  if (full) for (let k = 0; k < 70; k++) { const a = R() * Math.PI * 2, r = WORLD_R + 8 + R() * 20, [x, y] = at(Math.cos(a) * r, Math.sin(a) * r); tree(x, y, (1.7 + R() * 1.4) * s, k % 3 ? '#5e9444' : '#4b7f3a', '#86b75e'); }
  // cobbled paths: the walk from the gate to the pond, then the stepping stones, each stone inked
  const cobble = (x, y, r) => { circle(x, y, r); fill(['#d8cdb4', '#cfc3a8', '#e2d8c0'][Math.floor(R() * 3)]); ink(lw * 0.6); };
  for (let z = 52; z > POND_R + 1; z -= 0.9) for (const dx of [-1, 0, 1]) { const [x, y] = at(dx * 0.95 + (R() - 0.5) * 0.3, z + (R() - 0.5) * 0.3); cobble(x, y, 0.5 * s); }
  stones.forEach(st => { const [x, y] = at(st.x, st.z); cobble(x, y, Math.max(1.2, 0.8 * s)); });
  // the stream and the pond: blue washes with an ink bank, lily pads, a few ripples
  const stream = w => { g.beginPath(); RIVER.forEach((p, i) => { if (Math.hypot(p.x, p.z) > WORLD_R + 6) return; const [x, y] = at(p.x, p.z); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.lineWidth = w; g.stroke(); };
  g.strokeStyle = INKC; stream(4.2 * s + lw * 2); g.strokeStyle = '#6fa9c7'; stream(4.2 * s); g.strokeStyle = 'rgba(255,255,255,.45)'; stream(1 * s);
  wash(() => circle(cx, cy, POND_R * s), '#6fa9c7', ['#9fcbe0', '#5a8fb0'], 30, () => { const a = R() * 6.28, r = R() * POND_R; return at(Math.cos(a) * r, Math.sin(a) * r); });
  circle(cx, cy, POND_R * s); ink(lw * 1.4); circle(cx, cy, (POND_R + 0.9) * s); ink(lw * 0.6);
  for (let k = 0; k < 10; k++) { const a = R() * 6.28, r = R() * POND_R * 0.8, [x, y] = at(Math.cos(a) * r, Math.sin(a) * r); g.beginPath(); g.arc(x, y, 0.75 * s, 0.4, 6.0); g.lineTo(x, y); g.closePath(); fill('#7aa65a'); ink(lw * 0.5); }
  // bridges: planks across, inked
  BRIDGES.forEach(b => { const [x0, y0] = at(b.x - b.D.x * b.half, b.z - b.D.z * b.half), [x1, y1] = at(b.x + b.D.x * b.half, b.z + b.D.z * b.half); g.strokeStyle = INKC; g.lineWidth = 2.4 * s + lw * 2; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.strokeStyle = '#a77a52'; g.lineWidth = 2.4 * s; g.stroke(); });
  // flower beds: warm yellow and red plots with small blooms
  if (featOn('tulips')) TULIPS.forEach((t, i) => {
    const [x0, y0] = at(t.x0, t.z0), [x1, y1] = at(t.x1, t.z1);
    g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); fill(i % 2 ? '#e8634f' : '#f2c95a'); ink();
    for (let k = 0; k < Math.max(6, (x1 - x0) * (y1 - y0) / (9 * s * s)); k++) { circle(x0 + R() * (x1 - x0), y0 + R() * (y1 - y0), 0.42 * s); fill(['#ffffff', '#c23a52', '#f7e48a', '#a65ad8'][k % 4]); }
  });
  if (featOn('roses')) { const [x, y] = at(ROSE_GARDEN.x, ROSE_GARDEN.z); circle(x, y, 7.6 * s); fill('#f2c95a'); ink(); for (let i = 0; i < 22; i++) { const a = i / 22 * 6.28, r = (i % 2 ? 3.5 : 5.6) * s, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; circle(px, py, 1 * s); fill('#5f8e45'); ink(lw * 0.5); circle(px, py - 0.2 * s, 0.55 * s); fill('#d23a4a'); } }
  if (featOn('wisteria')) { const [x0, y0] = at(-1.9, 20.1), [x1, y1] = at(1.9, 33.1); g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); fill('#b9a0e2'); ink(); }
  // the parasol court over the wisteria walk: a dotted frame with round paper parasols
  { const [x0, y0] = at(-8.8, 16.4), [x1, y1] = at(8.8, 31.6); g.setLineDash([2, 3]); g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); ink(lw); g.setLineDash([]); for (let k = 0; k < 9; k++) { const [x, y] = at(-7 + (k % 3) * 7 + (R() - .5) * 2, 18.5 + Math.floor(k / 3) * 5 + (R() - .5) * 2); circle(x, y, 1.1 * s); fill('rgba(251,238,226,.9)'); ink(lw * 0.6); circle(x, y, 0.2 * s); fill('#b8452e'); } }
  { const W = LANTERN_WALL, [x, y] = at(W.x, W.z); for (let k = -2; k <= 2; k++) { circle(x, y + k * 0.9 * s, 0.42 * s); fill('#ffe7b0'); ink(lw * 0.5); } }
  // swings: white pergolas with a coral bench
  if (featOn('swings')) swings.forEach(sw => { const p = sw.g.position, [x, y] = at(p.x, p.z); g.save(); g.translate(x, y); g.rotate(-sw.g.rotation.y); const w = 2.9 * s, d = 2.3 * s; g.beginPath(); g.rect(-w / 2, -d / 2, w, d); fill('#fbf7ee'); ink(); g.fillStyle = '#d85a43'; g.fillRect(-w * 0.3, -d * 0.15, w * 0.6, d * 0.3); g.restore(); });
  // the writing bench in its mulch bed, the gate's blossom arch
  { const [x, y] = at(BENCH.x, BENCH.z); g.save(); g.translate(x, y); g.rotate(-Math.atan2(-BENCH.x, -BENCH.z)); g.beginPath(); g.ellipse(0, -0.35 * s, 3 * s, 2.1 * s, 0, 0, 7); fill('#9a6b45'); ink(); g.beginPath(); g.rect(-1.1 * s, -0.35 * s, 2.2 * s, 0.7 * s); fill('#ffffff'); ink(lw * 0.6); g.restore(); }
  { const [x, y] = at(0, 39.2); g.beginPath(); g.arc(x, y, 3.1 * s, Math.PI * 1.05, Math.PI * 1.95); g.strokeStyle = INKC; g.lineWidth = 1.5 * s; g.stroke(); g.strokeStyle = '#f2a8c2'; g.lineWidth = 1.1 * s; g.stroke(); }
  // the fountain: a stone octagon, water, a statue at the centre
  { const [x, y] = at(FOUNTAIN.x, FOUNTAIN.z); g.beginPath(); for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28 + Math.PI / 8; g.lineTo(x + Math.cos(a) * 3.9 * s, y + Math.sin(a) * 3.9 * s); } g.closePath(); fill('#cbc3b0'); ink(); circle(x, y, 3 * s); fill('#6fa9c7'); ink(lw * 0.7); circle(x, y, 1.2 * s); fill('#e4ddcc'); ink(lw * 0.7); circle(x, y, 0.45 * s); fill('#8a8478'); }
  // temples: red walls, grey hipped roofs with their ridge lines, a gold finial
  const temple = (L, w, d) => { const [x, y] = at(L.x, L.z); g.save(); g.translate(x, y); g.rotate(-Math.atan2(-L.x, -L.z)); w *= s; d *= s; const o = 0.6 * s;
    g.fillStyle = 'rgba(60,50,30,.2)'; g.fillRect(-w / 2 - o + 0.6 * s, -d / 2 - o + 0.8 * s, w + 2 * o, d + 2 * o);
    g.beginPath(); g.rect(-w / 2 - o, -d / 2 - o, w + 2 * o, d + 2 * o); fill('#6c7072'); ink();
    g.beginPath(); g.moveTo(-w / 2 - o, -d / 2 - o); g.lineTo(0, 0); g.lineTo(w / 2 + o, -d / 2 - o); g.moveTo(-w / 2 - o, d / 2 + o); g.lineTo(0, 0); g.lineTo(w / 2 + o, d / 2 + o); ink(lw * 0.7);
    g.beginPath(); g.rect(-w / 2 - o, d / 2 + o - 0.5 * s, w + 2 * o, 0.5 * s); fill('#c0503a'); circle(0, 0, Math.min(w, d) * 0.12); fill('#d6a84a'); ink(lw * 0.5); g.restore(); };
  temple(LANDMARKS.pagoda, 7, 7); temple(LANDMARKS.bell, 5, 5); temple(LANDMARKS.shrine, 6.6, 9);
  { const L = LANDMARKS.shrine, a = Math.atan2(-L.x, -L.z), [x, y] = at(L.x + Math.sin(a) * 12.4, L.z + Math.cos(a) * 12.4); g.save(); g.translate(x, y); g.rotate(-a); g.beginPath(); g.moveTo(-2.4 * s, 0); g.lineTo(2.4 * s, 0); g.strokeStyle = '#c0503a'; g.lineWidth = Math.max(1.6, 0.6 * s); g.stroke(); g.restore(); }
}

// ---- the place icons: white line glyphs in brown medallions, as on a printed park map ----
const GLYPHS = {
  bench: '<path d="M5 11h14M6 11v6M18 11v6M5 15h14M7 7h10v4"/>', pond: '<path d="M4 13c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5M7 9l2 2-2 2"/><circle cx="16" cy="9" r="1.2"/>',
  swing: '<path d="M5 5h14M8 5v10M16 5v10M7 15h10"/>', gate: '<path d="M6 19V10a6 6 0 0 1 12 0v9M4 19h16"/>', tulip: '<path d="M12 21V12M12 12c-3 0-4-2-4-5l2 1 2-3 2 3 2-1c0 3-1 5-4 5zM12 17c-2-2-4-2-5-2 1 3 3 4 5 4"/>',
  rose: '<circle cx="12" cy="11" r="5"/><path d="M12 8c-1.5 1-1.5 3 0 4 1.5-1 1.5-3 0-4M12 16v5"/>', stream: '<path d="M5 8c3-2 5 2 8 0s5-2 6 0M5 13c3-2 5 2 8 0s5-2 6 0M5 18c3-2 5 2 8 0s5-2 6 0"/>',
  fountain: '<path d="M6 18h12M8 18l1-4h6l1 4M12 14V8M9 8c0-2 1.5-3 3-3s3 1 3 3"/>', torii: '<path d="M4 7h16M6 10h12M8 7v12M16 7v12"/>', pagoda: '<path d="M12 3v3M7 9h10l-2-3H9zM6 14h12l-2-3H8zM8 19h8v-5H8z"/>',
  bell: '<path d="M8 17V11a4 4 0 0 1 8 0v6M6 17h12M12 7V5M11 20h2"/>',
  lantern: '<path d="M12 3v2M9 5h6M9 19h6M8 8c0-1.6 1.8-3 4-3s4 1.4 4 3v8c0 1.6-1.8 3-4 3s-4-1.4-4-3z"/><path d="M8 10h8M8 14h8"/>',
};
const glyphFor = name => /lantern/i.test(name) ? 'lantern' : /bench/i.test(name) ? 'bench' : /pond/i.test(name) ? 'pond' : /swing/i.test(name) ? 'swing' : /gate/i.test(name) ? 'gate' : /tulip/i.test(name) ? 'tulip' : /rose/i.test(name) ? 'rose' : /stream|gorge/i.test(name) ? 'stream' : /fountain/i.test(name) ? 'fountain' : /shrine/i.test(name) ? 'torii' : /pagoda/i.test(name) ? 'pagoda' : /bell/i.test(name) ? 'bell' : 'gate';
const medal = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${GLYPHS[glyphFor(name)]}</svg>`;

// ---- the full map ----
let P = null, S = 1, prevMode = 'walk', openedFrom = null;
function layout() {
  const r = stage.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px';
  S = Math.min(r.width, r.height) / (2 * 78); const cx = r.width / 2, cy = r.height / 2; // the whole garden and its hedge fit
  P = (x, z) => [cx + x * S, cy + (z - 2) * S];
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, r.width, r.height);
  drawWorld(g, P, S, true);
}
// places to do something, each with a short hint and where to stand
function places() {
  const L = [];
  const toPond = (x, z) => { const d = Math.hypot(x, z) || 1; return [-x / d, -z / d]; };
  { const [dx, dz] = toPond(BENCH.x, BENCH.z); L.push({ name: 'Writing bench', hint: 'write a poem', x: BENCH.x, z: BENCH.z, stand: [BENCH.x + dx * 1.9, BENCH.z + dz * 1.9], face: [BENCH.x, BENCH.z], side: 'l' }); }
  { const a = Math.atan2(player.pos.z, player.pos.x), r = POND_R + 2.3; L.push({ name: 'The pond', hint: 'see an older poem', x: 0, z: 0, stand: [Math.cos(a) * r, Math.sin(a) * r], face: [0, 0], side: 'r' }); }
  if (featOn('swings')) { const [dx, dz] = toPond(SWING_GARDEN.x, SWING_GARDEN.z); L.push({ name: 'Swing Garden', hint: 'swing and read', x: SWING_GARDEN.x - 1, z: SWING_GARDEN.z + 2.5, stand: [SWING_GARDEN.x + dx * 2.6, SWING_GARDEN.z + dz * 2.6], face: [SWING_GARDEN.x, SWING_GARDEN.z], side: 'l' }); }
  { const z = GATE.z; L.push({ name: 'The gate', hint: 'the wisteria walk begins here', x: 0, z, stand: [0, z + 4.5], face: [0, z - 10], side: 'r' }); }
  if (featOn('tulips')) { const t = TULIPS[2]; L.push({ name: 'Tulip fields', hint: 'walk among flowers', x: (t.x0 + t.x1) / 2, z: (t.z0 + t.z1) / 2, stand: [(t.x0 + t.x1) / 2, t.z0 - 1.5], face: [(t.x0 + t.x1) / 2, t.z1], side: 'r' }); }
  if (featOn('roses')) { const [dx, dz] = toPond(ROSE_GARDEN.x, ROSE_GARDEN.z); L.push({ name: 'Rose garden', hint: 'walk among flowers', x: ROSE_GARDEN.x, z: ROSE_GARDEN.z, stand: [ROSE_GARDEN.x + dx * 9.5, ROSE_GARDEN.z + dz * 9.5], face: [ROSE_GARDEN.x, ROSE_GARDEN.z], side: 'l' }); }
  { const i = 50, p = RIVER[i], q = RIVER[i + 1], tx = q.x - p.x, tz = q.z - p.z, l = Math.hypot(tx, tz); L.push({ name: 'The stream', hint: 'bridges and running water', x: p.x, z: p.z, stand: [p.x + tz / l * 4.2, p.z - tx / l * 4.2], face: [RIVER[i + 6].x + tz / l * 4.2, RIVER[i + 6].z - tx / l * 4.2], side: 'l' }); }
  { const [dx, dz] = toPond(FOUNTAIN.x, FOUNTAIN.z); L.push({ name: 'The fountain', hint: 'toss a coin, make a wish', x: FOUNTAIN.x, z: FOUNTAIN.z, stand: [FOUNTAIN.x - dx * 4, FOUNTAIN.z - dz * 4], face: [FOUNTAIN.x, FOUNTAIN.z], side: 'r' }); }
  const before = (Lm, d, name, hint, side) => { const a = Math.atan2(-Lm.x, -Lm.z); L.push({ name, hint, x: Lm.x, z: Lm.z, stand: [Lm.x + Math.sin(a) * d, Lm.z + Math.cos(a) * d], face: [Lm.x, Lm.z], side }); };
  { const W = LANTERN_WALL; L.push({ name: 'The lantern wall', hint: 'your newest poems, lit', x: W.x, z: W.z, stand: [W.x - 4.5, W.z], face: [W.x, W.z], side: 'r' }); }
  if (SETTINGS.view !== 'sea') { const r = Math.hypot(LOOKOUT.x, LOOKOUT.z), k = (r - 3) / r; L.push({ name: 'The gorge lookout', hint: 'Takachiho Gorge and its falls', x: LOOKOUT.x, z: LOOKOUT.z, stand: [LOOKOUT.x * k, LOOKOUT.z * k], face: [LOOKOUT.x * 2, LOOKOUT.z * 2], side: 'l' }); }
  before(LANDMARKS.shrine, 15, 'The shrine', 'ring the bell, make a wish', 'r');
  before(LANDMARKS.pagoda, 9, 'The pagoda', 'three storeys, and a lantern each side', 'r');
  before(LANDMARKS.bell, 5.5, 'The bell tower', 'strike the temple bell', 'l');
  return L;
}
function standNear(x, z, fx, fz) {
  // the first unblocked spot, turning around the destination if the first is taken
  const a0 = Math.atan2(z - fz, x - fx), d = Math.hypot(x - fx, z - fz);
  for (const da of [0, 0.35, -0.35, 0.7, -0.7, 1.1, -1.1, 1.6, -1.6, 2.4, -2.4, 3.14]) { const nx = fx + Math.cos(a0 + da) * d, nz = fz + Math.sin(a0 + da) * d; if (!blocked(nx, nz)) return [nx, nz]; }
  return [x, z];
}
function buildMarks() {
  marks.innerHTML = ''; const list = $('#map-places'); list.innerHTML = '';
  const add = (cls, x, z, attrs, html) => { const [sx, sy] = P(x, z), b = document.createElement('button'); b.className = cls; b.style.left = sx + 'px'; b.style.top = sy + 'px'; Object.entries(attrs).forEach(([k, v]) => b.setAttribute(k, v)); if (html) b.innerHTML = html; marks.appendChild(b); return b; };
  places().forEach(pl => {
    const go = () => { const [x, z] = standNear(pl.stand[0], pl.stand[1], pl.face[0], pl.face[1]); closeMap(false); glideTo(x, z, pl.face[0], pl.face[1]); };
    const b = add('map-place side-' + pl.side + (pl.small ? ' small' : ''), pl.x, pl.z, { 'aria-label': `${pl.name}: ${pl.hint}`, 'data-side': pl.side }, `<span class="dot">${medal(pl.name)}</span><span class="t"><em>${pl.name}</em><small>${pl.hint}</small></span>`);
    b.onclick = go;
    // on narrow screens the hints live in a row under the map instead of crowding it
    const li = document.createElement('button'); li.setAttribute('role', 'listitem'); li.innerHTML = `<em>${pl.name}</em> <small>${pl.hint}</small>`; li.onclick = go; list.appendChild(li);
  });
  [...plants.values()].filter(onMap).forEach(pl => {
    const p = pl.poem, c = pl.root.position, b = add('map-poem', c.x, c.z, { 'aria-label': `Poem: ${p.title}`, 'data-title': p.title });
    b.style.setProperty('--c', MOOD_INK[moodOf(p)]); if (p.important) b.classList.add('big');
    b.onclick = () => {
      const a = Math.atan2(player.pos.z - c.z, player.pos.x - c.x), d = Math.max(2.2, pl.radius * 0.6 + 2);
      const [x, z] = standNear(c.x + Math.cos(a) * d, c.z + Math.sin(a) * d, c.x, c.z);
      closeMap(false); glideTo(x, z, c.x, c.z, () => openPoem(pl));
    };
  });
  const [mx, my] = P(player.pos.x, player.pos.z); me.style.left = mx + 'px'; me.style.top = my + 'px'; me.style.transform = `translate(-50%,-50%) rotate(${-player.yaw}rad)`;
  // region names, softly, with a few spots to try inside their sector
  for (const k in REGIONS) {
    const rg = REGIONS[k], el = document.createElement('span'), spots = [];
    for (const [f, da] of [[0.5, 0], [0.5, 0.45], [0.5, -0.45], [0.25, 0], [0.8, 0], [0.8, 0.4], [0.8, -0.4]]) { const r = rg.r0 + (rg.r1 - rg.r0) * f, a = rg.a + rg.sa * da; spots.push(P(Math.cos(a) * r, Math.sin(a) * r)); }
    el.className = 'map-region'; el.textContent = rg.name.replace(/^The /, ''); el.dataset.spots = JSON.stringify(spots); el.style.fontSize = Math.max(12, Math.min(16, S * 3.3)) + 'px'; marks.appendChild(el);
  }
  settleLabels();
}
// ---- keeping the words apart ----
// Each place tries its own side, then the others; region names try a few spots in their sector. One
// that still finds no room keeps only its dot and shows its words on hover. Poem dots, your marker and
// every place's dot are kept clear.
function settleLabels() {
  const box = stage.getBoundingClientRect(), taken = [];
  const pad = (r, p) => ({ left: r.left - p, right: r.right + p, top: r.top - p, bottom: r.bottom + p });
  // a label never clashes with its own dot
  const clash = (r, self) => r.left < box.left + 4 || r.right > box.right - 4 || r.top < box.top + 2 || r.bottom > box.bottom - 2 ||
    taken.some(t => !(self && t.own === self) && r.left < t.right && r.right > t.left && r.top < t.bottom && r.bottom > t.top);
  marks.querySelectorAll('.map-poem').forEach(b => { const r = b.getBoundingClientRect(), x = (r.left + r.right) / 2, y = (r.top + r.bottom) / 2; taken.push({ left: x - 9, right: x + 9, top: y - 9, bottom: y + 9 }); });
  taken.push(pad(me.getBoundingClientRect(), 3));
  const placeEls = [...marks.querySelectorAll('.map-place')];
  placeEls.forEach(b => taken.push(Object.assign(pad(b.querySelector('.dot').getBoundingClientRect(), 2), { own: b })));
  placeEls.forEach(b => {
    const pref = b.dataset.side, order = [pref, ...['r', 'l', 'b', 't'].filter(s => s !== pref)];
    for (const s of order) {
      b.classList.remove('side-l', 'side-r', 'side-c', 'side-t', 'side-b'); b.classList.add('side-' + s);
      const r = pad(b.querySelector('.t').getBoundingClientRect(), 3); if (!clash(r, b)) { taken.push(r); return; }
    }
    b.classList.remove('side-l', 'side-c', 'side-t', 'side-b'); b.classList.add('side-r', 'quiet');
  });
  marks.querySelectorAll('.map-region').forEach(el => {
    for (const [x, y] of JSON.parse(el.dataset.spots)) { el.style.left = x + 'px'; el.style.top = y + 'px'; const r = pad(el.getBoundingClientRect(), 2); if (!clash(r)) { taken.push(r); return; } }
    el.hidden = true;
  });
}
function legend() {
  // the places with their medallions, then the poem trees by mood, then you
  const ps = places().map(pl => `<span class="lg-place"><b class="medal">${medal(pl.name)}</b>${(n => n[0].toUpperCase() + n.slice(1))(pl.name.replace(/^The /, ''))}</span>`).join('');
  $('#map-legend').innerHTML = `<div class="lg-places">${ps}</div><div class="lg-moods"><span class="lg-h">Poem trees</span>` + MOODS.map(([k, label]) => `<span><i style="background:${MOOD_INK[k]}"></i>${label}</span>`).join('') + '<span class="me-key"><b>▲</b>You</span></div>';
}
export function openMap() {
  if (!view.hidden || !(state.mode === 'walk' || state.mode === 'swing')) return;
  late.closePops(); keys.clear(); openedFrom = document.activeElement;
  $('#map-title').textContent = state.visiting ? (state.visiting.name || 'This garden') : (SETTINGS.name || 'Your garden');
  view.hidden = false; legend(); layout(); buildMarks(); // the legend first: it changes how much room the map has
  requestAnimationFrame(() => view.classList.add('open'));
  if (state.mode === 'walk') { prevMode = 'walk'; state.mode = 'map'; } else prevMode = state.mode;
  (marks.querySelector('.map-place') || $('#map-close')).focus({ preventScroll: true });
}
export function closeMap(restore = true) {
  if (view.hidden) return;
  view.classList.remove('open'); setTimeout(() => { if (!view.classList.contains('open')) view.hidden = true; }, 450);
  if (restore && state.mode === 'map') state.mode = prevMode;
  if (restore && openedFrom && openedFrom.focus) openedFrom.focus({ preventScroll: true });
}
export const toggleMap = () => view.hidden ? openMap() : closeMap();
provide({ get toggleMap() { return toggleMap; } });

// ---- gliding to a place: lift, drift, settle ----
export function glideTo(x, z, fx, fz, after) {
  if (state.swing) { closeSwingReader(); hideSwingUI(); document.body.classList.remove('on-swing'); state.swing = null; }
  const from = camera.position.clone(), eye = floorH(x, z) + 1.6, end = new V3(x, eye, z);
  const yaw = Math.atan2(-(fx - x), -(fz - z)), dir = new V3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const endLook = end.clone().addScaledVector(dir, 6); endLook.y = eye - 0.7;
  const dist = Math.hypot(end.x - from.x, end.z - from.z), total = clamp(2.2 + dist * 0.045, 2.4, 6);
  const mid = from.clone().lerp(end, 0.5); mid.y = Math.max(from.y, eye) + clamp(dist * 0.18, 2.5, 14);
  state.mode = 'cinematic'; state.gliding = true;
  camTween(mid, new V3(fx, eye - 1, fz), total * 0.5, () => camTween(end, endLook, total * 0.5, () => {
    state.gliding = false;
    player.pos.set(x, 0, z); player.yaw = yaw; player.pitch = -0.12; player.eyeY = eye; player.vel.set(0, 0, 0);
    state.mode = 'walk'; if (after) after();
  }));
}

$('#map-close').onclick = () => closeMap();
view.addEventListener('pointerdown', e => { if (e.target === view || e.target === stage || e.target === cv) closeMap(); });
addEventListener('keydown', e => {
  if (view.hidden) return;
  if (e.code === 'Escape' || e.code === 'KeyM') { e.preventDefault(); e.stopImmediatePropagation(); closeMap(); }
  else if (e.code === 'Tab') { // keep focus inside the map
    const f = [...view.querySelectorAll('button')], i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
  }
}, true);
addEventListener('resize', () => { if (!view.hidden) { layout(); buildMarks(); } });
$('#h-map').onclick = () => { late.closePops(); toggleMap(); };

// ---- the corner map ----
const W = 150, PX = 5, world = document.createElement('canvas'); world.width = world.height = W * 2 * PX;
let worldAt = -1e9, miniAt = 0;
function redrawWorld() { const g = world.getContext('2d'); g.clearRect(0, 0, world.width, world.height); drawWorld(g, (x, z) => [(x + W) * PX, (z + W) * PX], PX, false); }
const miniFrame = now => {
  requestAnimationFrame(miniFrame);
  const show = state.minimap && (state.mode === 'walk' || state.mode === 'swing') && !document.body.classList.contains('sr-open');
  if (miniBtn.hidden === show) miniBtn.hidden = !show;
  // a small × hides it; a little map button brings it back (the same choice as in You)
  const wantShow = (state.mode === 'walk' || state.mode === 'swing') && !document.body.classList.contains('sr-open') && !document.body.classList.contains('panel-open');
  hideBtn.hidden = !(show && wantShow); showBtn.hidden = !(wantShow && !state.minimap);
  if (!show || now - miniAt < 110) return; miniAt = now;
  if (now - worldAt > 5000) { redrawWorld(); worldAt = now; }
  const g = mini.getContext('2d'), N = mini.width, R = N / 2, span = 26, k = N / (2 * span);
  g.clearRect(0, 0, N, N); g.save(); g.beginPath(); g.arc(R, R, R - 2, 0, 7); g.clip();
  g.fillStyle = 'rgba(239,232,214,.92)'; g.fillRect(0, 0, N, N);
  const px = player.pos.x, pz = player.pos.z;
  g.drawImage(world, (px - span + W) * PX, (pz - span + W) * PX, span * 2 * PX, span * 2 * PX, 0, 0, N, N);
  plants.forEach(pl => { if (!onMap(pl)) return; const x = R + (pl.root.position.x - px) * k, y = R + (pl.root.position.z - pz) * k; if (x < -6 || y < -6 || x > N + 6 || y > N + 6) return; g.fillStyle = MOOD_INK[moodOf(pl.poem)]; g.beginPath(); g.arc(x, y, pl.poem.important ? 5 : 3.6, 0, 7); g.fill(); });
  g.translate(R, R); g.rotate(-player.yaw); g.fillStyle = '#2c3627'; g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 6); g.lineTo(0, 3); g.lineTo(-6, 6); g.closePath(); g.fill();
  g.restore(); g.strokeStyle = 'rgba(44,54,39,.35)'; g.lineWidth = 2; g.beginPath(); g.arc(R, R, R - 2, 0, 7); g.stroke();
};
requestAnimationFrame(miniFrame);
miniBtn.onclick = () => openMap();
const hideBtn = $('#minimap-hide'), showBtn = $('#minimap-show');
const setMini = on => { state.minimap = on; try { localStorage.setItem('garden-of-poems:minimap', on ? '1' : '0'); } catch (e) {} const c = document.getElementById('av-minimap'); if (c) c.checked = on; };
hideBtn.onclick = () => setMini(false);
showBtn.onclick = () => setMini(true);
if (isTouch) miniBtn.classList.add('touch');
