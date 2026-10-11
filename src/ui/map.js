import { $, V3, clamp, isTouch } from '../core/util.js';
import { BRIDGES, POND_R, RIVER, WORLD_R } from '../world/terrain.js';
import { SETTINGS } from '../settings/storage.js';
import { state } from '../core/state.js';
import { REGIONS, MOODS } from '../plants/mapping.js';
import { camera } from '../world/renderer.js';
import { BENCH, TULIPS, featOn, stones } from '../world/paths.js';
import { plants } from '../plants/registry.js';
import { sign } from '../world/decor.js';
import { SWING_GARDEN, swings } from '../world/swings.js';
import { ROSE_GARDEN } from '../plants/flowerGardens.js';
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

export const MOOD_INK = { love: '#c97b93', joy: '#d6a838', sorrow: '#6f8fb4', anger: '#b8473f', childhood: '#d88a4a', dream: '#8a6fb8', reflection: '#5f8050' };
const moodOf = p => (p.mood && MOOD_INK[p.mood]) ? p.mood : 'reflection';
// on the map: growing or grown, and not hidden by 'Walk through time'
const onMap = pl => !pl.dying && pl.target !== 0;
const view = $('#mapview'), stage = $('#map-stage'), cv = $('#map-canvas'), marks = $('#map-marks'), me = $('#map-me');
const mini = $('#minimap'), miniBtn = $('#minimap-btn');

// ---- drawing the garden ----
const INK = 'rgba(52,62,42,', WATER = 'rgba(120,163,186,';
function drawWorld(g, P, s, full) {
  const at = (x, z) => P(x, z);
  g.lineCap = g.lineJoin = 'round';
  // the garden ground and its hedge
  let [cx, cy] = at(0, 0);
  g.fillStyle = 'rgba(112,140,88,.13)'; g.beginPath(); g.arc(cx, cy, WORLD_R * s, 0, 7); g.fill();
  g.setLineDash([2, 5]); g.strokeStyle = INK + '.28)'; g.lineWidth = 1.2; g.stroke(); g.setLineDash([]);
  // regions: a faint wash and a soft name
  if (full) for (const k in REGIONS) {
    const r = REGIONS[k]; g.beginPath(); g.arc(cx, cy, r.r1 * s, r.a - r.sa, r.a + r.sa); g.arc(cx, cy, r.r0 * s, r.a + r.sa, r.a - r.sa, true); g.closePath();
    g.fillStyle = 'rgba(160,140,180,.06)'; g.fill();
  }
  // the stream and the pond
  g.strokeStyle = WATER + '.75)'; g.lineWidth = Math.max(2, 3.6 * s); g.beginPath();
  RIVER.forEach((p, i) => { const [x, y] = at(p.x, p.z); if (Math.hypot(p.x, p.z) > WORLD_R + 6) return; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
  g.fillStyle = WATER + '.6)'; g.beginPath(); g.arc(cx, cy, POND_R * s, 0, 7); g.fill(); g.strokeStyle = 'rgba(64,96,116,.55)'; g.lineWidth = 1.2; g.stroke();
  // bridges
  g.strokeStyle = 'rgba(128,96,68,.9)'; g.lineWidth = Math.max(2, 1.3 * s);
  BRIDGES.forEach(b => { const [x0, y0] = at(b.x - b.D.x * b.half, b.z - b.D.z * b.half), [x1, y1] = at(b.x + b.D.x * b.half, b.z + b.D.z * b.half); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); });
  // stepping stones
  g.fillStyle = INK + '.38)'; const sr = Math.max(0.8, 0.26 * s);
  stones.forEach(st => { const [x, y] = at(st.x, st.z); g.beginPath(); g.arc(x, y, sr, 0, 7); g.fill(); });
  // flowers and features the owner keeps
  if (featOn('tulips')) TULIPS.forEach(t => {
    const [x0, y0] = at(t.x0, t.z0), [x1, y1] = at(t.x1, t.z1), cols = ['#d6443f', '#e9c04a', '#e98fb0', '#f3ece0'];
    for (let i = 0, n = Math.max(3, Math.round((x1 - x0) / Math.max(3, s * 1.2))); i < n; i++) { g.fillStyle = cols[i % 4]; g.globalAlpha = 0.5; g.fillRect(x0 + (x1 - x0) * i / n, y0, (x1 - x0) / n * 0.7, y1 - y0); }
    g.globalAlpha = 1;
  });
  if (featOn('roses')) { const [x, y] = at(ROSE_GARDEN.x, ROSE_GARDEN.z); g.strokeStyle = 'rgba(160,70,70,.45)'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, 7.5 * s, 0, 7); g.stroke(); g.fillStyle = 'rgba(190,64,72,.55)'; for (let i = 0; i < 18; i++) { const a = i / 18 * 6.28, r = (i % 2 ? 3.5 : 5.6) * s; g.beginPath(); g.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, Math.max(1, 0.5 * s), 0, 7); g.fill(); } }
  if (featOn('wisteria')) { const [x0, y0] = at(-1.8, 20.1), [x1, y1] = at(1.8, 33.1); g.fillStyle = 'rgba(150,120,200,.32)'; g.fillRect(x0, y0, x1 - x0, y1 - y0); }
  if (featOn('swings')) { g.strokeStyle = 'rgba(110,84,64,.85)'; g.lineWidth = Math.max(1.2, 0.35 * s); swings.forEach(sw => { const p = sw.g.position, a = sw.g.rotation.y, w = 1.3 * 1.35, dx = Math.cos(a) * w, dz = -Math.sin(a) * w, [x0, y0] = at(p.x - dx, p.z - dz), [x1, y1] = at(p.x + dx, p.z + dz); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }); }
  // the bench, the gate, the sign
  g.save(); let [bx, by] = at(BENCH.x, BENCH.z); g.translate(bx, by); g.rotate(-Math.atan2(-BENCH.x, -BENCH.z)); g.fillStyle = 'rgba(110,80,56,.9)'; g.fillRect(-0.85 * s, -0.2 * s, 1.7 * s, Math.max(2, 0.4 * s)); g.restore();
  { const [x, y] = at(0, 39.2); g.strokeStyle = 'rgba(150,52,40,.85)'; g.lineWidth = Math.max(1.5, 0.4 * s); g.beginPath(); g.moveTo(x - 2.2 * s, y); g.lineTo(x + 2.2 * s, y); g.stroke(); }
  if (sign.visible) { const [x, y] = at(sign.position.x, sign.position.z); g.fillStyle = 'rgba(110,84,64,.9)'; g.fillRect(x - Math.max(2, 0.8 * s), y - 1, Math.max(4, 1.6 * s), 3); }
}

// ---- the full map ----
let P = null, S = 1, prevMode = 'walk', openedFrom = null;
function layout() {
  const r = stage.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px';
  S = Math.min(r.width, r.height) / (2 * 60); const cx = r.width / 2, cy = r.height / 2 - 3 * S;
  P = (x, z) => [cx + x * S, cy + (z - 2) * S];
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, r.width, r.height);
  drawWorld(g, P, S, true);
  // region names, softly
  g.font = `italic ${Math.max(11, Math.min(15, S * 3.2))}px "Cormorant Garamond", Georgia, serif`; g.textAlign = 'center'; g.fillStyle = 'rgba(70,64,90,.55)';
  for (const k in REGIONS) { const rg = REGIONS[k], rr = (rg.r0 + rg.r1) / 2, [x, y] = P(Math.cos(rg.a) * rr, Math.sin(rg.a) * rr); g.fillText(rg.name.replace(/^The /, ''), x, y); }
}
// places to do something, each with a short hint and where to stand
function places() {
  const L = [];
  const toPond = (x, z) => { const d = Math.hypot(x, z) || 1; return [-x / d, -z / d]; };
  { const [dx, dz] = toPond(BENCH.x, BENCH.z); L.push({ name: 'Writing bench', hint: 'write a poem', x: BENCH.x, z: BENCH.z, stand: [BENCH.x + dx * 1.9, BENCH.z + dz * 1.9], face: [BENCH.x, BENCH.z], side: 'l' }); }
  { const a = Math.atan2(player.pos.z, player.pos.x), r = POND_R + 2.3; L.push({ name: 'The pond', hint: 'see an older poem', x: 0, z: -POND_R * 0.2, stand: [Math.cos(a) * r, Math.sin(a) * r], face: [0, 0], side: 'c' }); }
  if (featOn('swings')) { const [dx, dz] = toPond(SWING_GARDEN.x, SWING_GARDEN.z); L.push({ name: 'Swing Garden', hint: 'swing and read', x: SWING_GARDEN.x - 1, z: SWING_GARDEN.z + 2.5, stand: [SWING_GARDEN.x + dx * 2.6, SWING_GARDEN.z + dz * 2.6], face: [SWING_GARDEN.x, SWING_GARDEN.z], side: 'l' }); }
  if (sign.visible) { const a = sign.rotation.y, nx = Math.sin(a), nz = Math.cos(a); L.push({ name: 'The sign at the gate', hint: 'about this garden', x: sign.position.x, z: sign.position.z, stand: [sign.position.x + nx * 2.4, sign.position.z + nz * 2.4], face: [sign.position.x, sign.position.z], side: 'r' }); }
  if (featOn('wisteria')) L.push({ name: 'Wisteria walk', hint: 'under the hanging flowers', x: 0, z: 26.6, stand: [0, 35.5], face: [0, 20], side: 'l', small: true });
  if (featOn('tulips')) { const t = TULIPS[2]; L.push({ name: 'Tulip fields', hint: 'walk among flowers', x: (t.x0 + t.x1) / 2, z: (t.z0 + t.z1) / 2, stand: [(t.x0 + t.x1) / 2, t.z0 - 1.5], face: [(t.x0 + t.x1) / 2, t.z1], side: 'r' }); }
  if (featOn('roses')) { const [dx, dz] = toPond(ROSE_GARDEN.x, ROSE_GARDEN.z); L.push({ name: 'Rose garden', hint: 'walk among flowers', x: ROSE_GARDEN.x, z: ROSE_GARDEN.z, stand: [ROSE_GARDEN.x + dx * 9.5, ROSE_GARDEN.z + dz * 9.5], face: [ROSE_GARDEN.x, ROSE_GARDEN.z], side: 'l' }); }
  { const b = BRIDGES[0]; L.push({ name: 'Bridges', hint: 'cross the water', x: b.x, z: b.z, stand: [b.x - b.D.x * (b.half + 1.6), b.z - b.D.z * (b.half + 1.6)], face: [b.x, b.z], side: 'r' }); }
  { const i = 50, p = RIVER[i], q = RIVER[i + 1], tx = q.x - p.x, tz = q.z - p.z, l = Math.hypot(tx, tz); L.push({ name: 'The stream walk', hint: 'follow the water', x: p.x, z: p.z, stand: [p.x + tz / l * 4.2, p.z - tx / l * 4.2], face: [RIVER[i + 6].x + tz / l * 4.2, RIVER[i + 6].z - tx / l * 4.2], side: 'r' }); }
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
    const b = add('map-place side-' + pl.side + (pl.small ? ' small' : ''), pl.x, pl.z, { 'aria-label': `${pl.name}: ${pl.hint}` }, `<span class="dot"></span><span class="t"><em>${pl.name}</em><small>${pl.hint}</small></span>`);
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
}
function legend() {
  $('#map-legend').innerHTML = MOODS.map(([k, label]) => `<span><i style="background:${MOOD_INK[k]}"></i>${label}</span>`).join('') + '<span class="me-key"><b>▲</b>You</span>';
}
export function openMap() {
  if (!view.hidden || !(state.mode === 'walk' || state.mode === 'swing')) return;
  late.closePops(); keys.clear(); openedFrom = document.activeElement;
  $('#map-title').textContent = state.visiting ? (state.visiting.name || 'This garden') : (SETTINGS.name || 'Your garden');
  view.hidden = false; layout(); buildMarks(); legend();
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
$('#h-map').onclick = () => toggleMap();

// ---- the corner map ----
const W = 150, PX = 5, world = document.createElement('canvas'); world.width = world.height = W * 2 * PX;
let worldAt = -1e9, miniAt = 0;
function redrawWorld() { const g = world.getContext('2d'); g.clearRect(0, 0, world.width, world.height); drawWorld(g, (x, z) => [(x + W) * PX, (z + W) * PX], PX, false); }
const miniFrame = now => {
  requestAnimationFrame(miniFrame);
  const show = state.minimap && (state.mode === 'walk' || state.mode === 'swing') && !document.body.classList.contains('sr-open');
  if (miniBtn.hidden === show) miniBtn.hidden = !show;
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
if (isTouch) miniBtn.classList.add('touch');
