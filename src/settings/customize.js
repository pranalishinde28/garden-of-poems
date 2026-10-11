import * as THREE from 'three';
import { $, C, V3, rng } from '../core/util.js';
import { groundH } from '../world/terrain.js';
import { SETTINGS, THEME, cleanSettings } from './storage.js';
import { T, state } from '../core/state.js';
import { maxAniso, scene } from '../world/renderer.js';
import { canvasTex, wisTexP, wisTexW } from '../world/textures.js';
import { GEO, M, Merge, VC, part } from '../world/geometry.js';
import { REG, decor, featOn } from '../world/paths.js';
import { createPlant, nightGlow, plants, removePlant, setShadowDirty } from '../plants/registry.js';
import { koi } from '../water/water.js';
import { wisMatP, wisMatW } from '../world/arbors.js';
import { swingVeilMat, swingVeilTex } from '../world/swings.js';
import { animals } from '../animals/animals.js';
import { mist } from '../plants/flowerGardens.js';
import { rebuildConnections, rebuildPetals } from '../world/particles.js';
import { Music } from '../audio/music.js';
import { toast } from '../ui/helpers.js';
import { closePanel, openPanel } from '../ui/reading.js';
import { applyThemeMaterials, setTheme } from '../ui/themes.js';
import { Cloud, saveGardenSettings } from '../cloud/cloud.ts';
import { late, provide } from '../core/late.js';

// names other modules reach through late (see core/late.js)
provide({
  get settingsKey() { return settingsKey; },
  get localSettings() { return localSettings; },
  get persistSettings() { return persistSettings; },
  get applyAllSettings() { return applyAllSettings; },
  get updateVeils() { return updateVeils; },
  get board() { return board; },
  get openBoard() { return openBoard; },
  get openCustomize() { return openCustomize; },
});

/* ================= customizing a garden: scenery, features, trees, music, and the sign ================= */
animals.forEach(a => { a.cat = (a.train || a.legs || (a.home && a.head && !a.wl)) ? 'land' : (a.l || a.wl) ? 'air' : 'water'; });
const SHOW_LABELS = [['wisteria', 'Wisteria arbors'], ['tulips', 'Tulip fields'], ['roses', 'Rose garden'], ['hydrangeas', 'Blue hydrangeas'], ['lilies', 'White lilies'], ['orchids', 'Purple orchids'], ['lamps', 'Garden lamps'], ['swings', 'Swing garden'], ['land', 'Deer, peacocks and rabbits'], ['air', 'Birds and butterflies'], ['water', 'Ducks and koi']];
const SCENE_LABELS = [['fuji', 'Mount Fuji on the horizon'], ['mist', 'Morning mist over the water'], ['drift', 'Pollen, leaves or snow in the air']];
const settingsKey = () => 'garden-of-poems:settings' + (Cloud.user ? ':u:' + Cloud.user.id : '');
function localSettings(key) { try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v ? cleanSettings(v) : null; } catch (e) { return null; } }
let settingsTimer = null;
export function persistSettings() {
  if (state.visiting) return;
  try { localStorage.setItem(settingsKey(), JSON.stringify(SETTINGS)); } catch (e) {}
  if (Cloud.user) { clearTimeout(settingsTimer); settingsTimer = setTimeout(() => saveGardenSettings({ settings: SETTINGS, theme: THEME }), 900); }
}
export function applyVisibility() {
  for (const k in REG) { const on = k === 'fuji' ? SETTINGS.fuji : featOn(k); REG[k].forEach(o => { o.visible = on; }); }
  mist.forEach(s => { s.visible = SETTINGS.mist; });
  koi.forEach(k => { k.g.visible = featOn('water'); });
  setShadowDirty(true);
}
function applyWeather() { state.showerAt = T; late.setRainUI(); }
export function applyLight() { state.nightTarget = SETTINGS.light === 'day' ? 0 : SETTINGS.light === 'night' ? 1 : ((h => (h >= 18.5 || h < 5.5) ? 1 : 0)(new Date().getHours() + new Date().getMinutes() / 60)); late.setNightUI(); }
function rebuildAllPlants() {
  [...plants.values()].filter(p => !p.dying).forEach(pl => { const tg = pl.target; removePlant(pl); const np = createPlant(pl.poem, { visible: tg === 1 }); np.target = tg; });
  rebuildPetals(); rebuildConnections(); applyThemeMaterials();
}
function applyMusic(m) {
  if (m === 'off') { if (!Music.muted) Music.setMuted(true); }
  else if (m === 'own') { if (Music.mode !== 'own' || !Music.files.length) { late.fileInput.value = ''; late.fileInput.click(); } else if (Music.muted) Music.setMuted(false); }
  else { if (Music.muted) Music.setMuted(false); if (Music.mode === 'own') Music.backToPiano(); }
  late.setSoundUI();
}
function applyAllSettings(opts = {}) {
  if (SETTINGS.season !== THEME) setTheme(SETTINGS.season, true); else if (opts.trees) rebuildAllPlants();
  updateVeils(); applyVisibility(); applyLight(); applyWeather(); drawBoard(); if (customPanel.classList.contains('open')) renderCustom();
}
export function setSetting(k, v) {
  if (state.visiting) { toast('You are visiting. Return to your own garden to customize it.'); return; }
  if (k.startsWith('show.')) SETTINGS.show[k.slice(5)] = v; else SETTINGS[k] = v;
  if (k === 'season') setTheme(v);
  else if (k === 'tree' || k === 'blossom') { rebuildAllPlants(); updateVeils(); }
  else if (k === 'light') applyLight();
  else if (k === 'weather') applyWeather();
  else if (k === 'music') applyMusic(v);
  else applyVisibility();
  persistSettings(); renderCustom();
}

/* veils: wisteria in spring, autumn leaves in autumn; pink veils over the swings */
function leafVeilTex(seed) {
  return canvasTex(128, 384, (g) => {
    const R = rng(seed), pal = ['#c8382a', '#d9472c', '#e2622f', '#f0b23c', '#f4cf52', '#e07a2e', '#b82f2a'];
    g.strokeStyle = '#6a4a32'; g.lineWidth = 2; g.beginPath(); g.moveTo(64, 0); g.quadraticCurveTo(58, 190, 66, 372); g.stroke();
    for (let k = 0; k < 120; k++) {
      const t = k / 120, y = 10 + t * 362, spread = (1 - t) * 34 + 8, x = 64 + (R() - .5) * spread * 2, r = (1 - t) * 6 + 4;
      g.save(); g.translate(x, y); g.rotate(R() * 6.28); g.fillStyle = pal[Math.floor(R() * pal.length)]; g.beginPath();
      for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + i / 10 * Math.PI * 2, rr = i % 2 === 0 ? r : r * 0.45; i ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      g.closePath(); g.fill(); g.restore();
    }
  });
}
const veilAutumnA = leafVeilTex(71), veilAutumnB = leafVeilTex(72);
export function updateVeils() {
  const a = THEME === 'autumn';
  wisMatP.map = a ? veilAutumnA : wisTexP; wisMatW.map = a ? veilAutumnB : wisTexW; swingVeilMat.map = a ? veilAutumnA : swingVeilTex;
  wisMatP.emissive.set(a ? '#2a1008' : '#1d1430'); wisMatW.emissive.set(a ? '#2a1408' : '#22201c'); swingVeilMat.emissive.set(a ? '#2a1008' : '#2a1018');
  [wisMatP, wisMatW, swingVeilMat].forEach(m => { m.needsUpdate = true; });
}

/* the sign at the gate */
export const board = new THREE.Group();
(function buildBoard() {
  const x = -4.6, z = 33.4; board.position.set(x, groundH(x, z), z); board.rotation.y = Math.atan2(0 - x, 35.5 - z);
  const wood = M('#5a4535'), dark = M('#3f2f24');
  for (const sx of [-1.12, 1.12]) part(board, GEO.cylB, wood, [sx, 0, 0], [0.075, 2.45, 0.075]);
  part(board, GEO.box, dark, [0, 1.6, -0.04], [2.4, 1.5, 0.08]);
  part(board, GEO.box, wood, [0, 2.42, 0], [2.65, 0.09, 0.32]);
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 640; board.userData.cv = cv;
  const tex = new THREE.CanvasTexture(cv); tex.anisotropy = Math.min(8, maxAniso); board.userData.tex = tex;
  const fm = new THREE.MeshLambertMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.15 }); nightGlow.push({ m: fm, day: 0.12, night: 0.55 });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.4375), fm); face.position.set(0, 1.6, 0.005); board.add(face);
  const vm = new Merge(), R = rng(808);
  for (let i = 0; i < 40; i++) { const p = new V3(-1.25 + R() * 2.5, 2.48 + R() * 0.06, (R() - .5) * 0.3); vm.add(GEO.ico, p, new V3(0.07, 0.06, 0.07), C(['#567a3a', '#668c45'][i % 2])); if (i % 3 === 0) vm.add(GEO.ico, p.clone().add(new V3(0, 0.05, 0.06)), new V3(0.04, 0.04, 0.04), C(['#f4b6c8', '#ffffff'][i % 2])); }
  board.add(new THREE.Mesh(vm.build(), VC));
  board.traverse(o => { o.userData.board = true; if (o.isMesh) o.castShadow = true; });
  scene.add(board); decor.push({ x, z, r: 1.4, collide: 0.45 });
})();
const safeUrl = u => typeof u === 'string' && /^https?:\/\/[^\s<>"]+$/i.test(u) ? u : null;
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } };
function boardInfo() {
  if (state.visiting) return state.visiting.sign;
  const own = Cloud.user && Cloud.garden;
  return { name: (own ? Cloud.garden.name : SETTINGS.name) || 'The Garden of Poems', desc: (own ? Cloud.garden.description : SETTINGS.desc) || '', by: own && Cloud.profile ? (Cloud.profile.display_name || '') : '', links: SETTINGS.links || [], own: true };
}
function wrapText(g, text, maxW) { const words = String(text).split(/\s+/), lines = []; let line = ''; words.forEach(w => { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }); if (line) lines.push(line); return lines; }
export function drawBoard() {
  const info = boardInfo(), cv = board.userData.cv, g = cv.getContext('2d'), W = cv.width, H = cv.height, R = rng(19);
  g.fillStyle = '#6f553f'; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(35,22,14,.22)'; g.lineWidth = 2;
  for (let i = 0; i < 26; i++) { const y = R() * H; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(W * 0.3, y + (R() - .5) * 30, W * 0.7, y + (R() - .5) * 30, W, y + (R() - .5) * 14); g.stroke(); }
  g.strokeStyle = 'rgba(240,226,200,.55)'; g.lineWidth = 3; g.strokeRect(22, 22, W - 44, H - 44);
  g.fillStyle = '#f5ead6'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  let size = 86; g.font = `600 ${size}px "Cormorant Garamond", Georgia, serif`;
  while (g.measureText(info.name).width > W - 120 && size > 44) { size -= 4; g.font = `600 ${size}px "Cormorant Garamond", Georgia, serif`; }
  g.fillText(info.name, W / 2, 128);
  let y = 128;
  if (info.by) { g.font = 'italic 400 40px "Cormorant Garamond", Georgia, serif'; g.fillStyle = 'rgba(245,234,214,.85)'; y += 56; g.fillText('a garden by ' + info.by, W / 2, y); }
  if (info.desc) { g.font = 'italic 400 36px "Cormorant Garamond", Georgia, serif'; g.fillStyle = '#f5ead6'; wrapText(g, info.desc, W - 160).slice(0, 2).forEach(l => { y += 50; g.fillText(l, W / 2, y); }); }
  const links = (info.links || []).filter(l => safeUrl(l.url)).slice(0, 5);
  y += 34; g.strokeStyle = 'rgba(245,234,214,.4)'; g.beginPath(); g.moveTo(W * 0.3, y); g.lineTo(W * 0.7, y); g.stroke();
  g.font = '500 34px "Cormorant Garamond", Georgia, serif'; g.fillStyle = '#f5ead6';
  if (links.length) { links.forEach(l => { y += 46; g.fillText(`${l.label || hostOf(l.url)}  ·  ${hostOf(l.url)}`, W / 2, y); }); g.font = 'italic 400 28px "Cormorant Garamond", Georgia, serif'; g.fillStyle = 'rgba(245,234,214,.7)'; g.fillText('Click the sign to open these links', W / 2, H - 46); }
  else if (info.own) { g.font = 'italic 400 30px "Cormorant Garamond", Georgia, serif'; g.fillStyle = 'rgba(245,234,214,.75)'; y += 50; g.fillText('Add your name, a welcome line, socials or portfolio', W / 2, y); y += 40; g.fillText('with the Customize button at the top of the screen.', W / 2, y); }
  board.userData.tex.needsUpdate = true;
}
if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawBoard);
const signPanel = $('#signpanel');
function openBoard() {
  const info = boardInfo(); late.closePops();
  $('#s-name').textContent = info.name; $('#s-by').textContent = info.by ? 'A garden by ' + info.by : ''; $('#s-desc').textContent = info.desc || '';
  const box = $('#s-links'); box.innerHTML = '';
  (info.links || []).forEach(l => { const u = safeUrl(l.url); if (!u) return; const a = document.createElement('a'); a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer nofollow'; a.textContent = (l.label || hostOf(u)) + ' · ' + hostOf(u); box.appendChild(a); });
  if (!box.children.length) { const p = document.createElement('p'); p.className = 'n-empty'; p.textContent = info.own ? 'No links yet. Add your socials or portfolio in Customize.' : 'No links on this sign.'; box.appendChild(p); }
  $('#s-edit').hidden = !info.own;
  openPanel(signPanel);
}
$('#s-close').onclick = () => closePanel(signPanel);
$('#s-edit').onclick = () => { closePanel(signPanel); openCustomize(); };

/* the Customize panel */
const customPanel = $('#custom');
(function buildCustomChecks() {
  const mk = (wrap, list, prefix) => list.forEach(([k, label]) => { const l = document.createElement('label'); l.className = 'matters'; const i = document.createElement('input'); i.type = 'checkbox'; i.dataset.k = prefix + k; i.onchange = () => setSetting(i.dataset.k, i.checked); l.append(i, document.createTextNode(' ' + label)); wrap.appendChild(l); });
  mk($('#c-scene'), SCENE_LABELS, ''); mk($('#c-show'), SHOW_LABELS, 'show.');
  customPanel.querySelectorAll('.seg[data-k] button').forEach(b => { b.onclick = () => setSetting(b.parentElement.dataset.k, b.dataset.v); });
})();
function linkRows() { return [...$('#c-links').querySelectorAll('.c-link')].map(r => ({ label: r.querySelector('.c-l').value.trim().slice(0, 40), url: r.querySelector('.c-u').value.trim().slice(0, 200) })); }
function saveLinks() {
  const rows = linkRows(), bad = rows.filter(r => r.url && !safeUrl(r.url));
  $('#c-linkerr').textContent = bad.length ? 'Links need to start with https:// (for example https://instagram.com/yourname).' : '';
  SETTINGS.links = rows.filter(r => safeUrl(r.url)).slice(0, 6); persistSettings(); drawBoard();
}
function addLinkRow(l) {
  const wrap = $('#c-links'); if (wrap.children.length >= 6) return;
  const row = document.createElement('div'); row.className = 'c-link';
  const a = document.createElement('input'); a.className = 'c-l'; a.placeholder = 'Instagram'; a.maxLength = 40; a.value = l ? l.label : ''; a.setAttribute('aria-label', 'Link name');
  const u = document.createElement('input'); u.className = 'c-u'; u.placeholder = 'https://'; u.maxLength = 200; u.type = 'url'; u.value = l ? l.url : ''; u.setAttribute('aria-label', 'Link address');
  const x = document.createElement('button'); x.className = 'g-link'; x.textContent = 'Remove'; x.onclick = () => { row.remove(); saveLinks(); };
  [a, u].forEach(i => i.addEventListener('change', saveLinks));
  row.append(a, u, x); wrap.appendChild(row);
}
function renderCustom() {
  const vis = !!state.visiting;
  $('#c-note').textContent = vis ? 'You are visiting someone else\u2019s garden. Return home to customize your own.' : (Cloud.user ? 'Changes save to your account, and visitors see them too.' : 'Changes save on this device. Sign in to keep them with your garden everywhere.');
  // your own figure (#c-you) stays editable while visiting; the garden's settings don't
  customPanel.querySelectorAll('input, .seg button, #c-addlink').forEach(i => { if (i.id !== 'c-close' && !i.closest('#c-you')) i.disabled = vis; });
  const own = Cloud.user && Cloud.garden;
  $('#c-name').value = (own ? Cloud.garden.name : SETTINGS.name) || ''; $('#c-desc').value = (own ? Cloud.garden.description : SETTINGS.desc) || '';
  customPanel.querySelectorAll('.seg[data-k]').forEach(s => s.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', SETTINGS[s.dataset.k] === b.dataset.v ? 'true' : 'false')));
  $('#c-blossom').hidden = SETTINGS.tree !== 'sakura';
  customPanel.querySelectorAll('input[type=checkbox][data-k]').forEach(i => { const k = i.dataset.k; i.checked = k.startsWith('show.') ? SETTINGS.show[k.slice(5)] !== false : !!SETTINGS[k]; });
  $('#c-links').innerHTML = ''; (SETTINGS.links || []).forEach(addLinkRow); $('#c-linkerr').textContent = '';
}
function openCustomize() { late.closePops(); renderCustom(); openPanel(customPanel); }
$('#h-custom').onclick = () => customPanel.classList.contains('open') ? closePanel(customPanel) : openCustomize();
$('#c-close').onclick = () => closePanel(customPanel);
$('#c-addlink').onclick = () => { if (state.visiting) return; addLinkRow(null); };
$('#c-name').addEventListener('change', () => { if (state.visiting) return; const v = $('#c-name').value.trim().slice(0, 60); if (Cloud.user && Cloud.garden) saveGardenSettings({ name: v || 'A quiet garden' }).then(drawBoard); else { SETTINGS.name = v; persistSettings(); drawBoard(); } });
$('#c-desc').addEventListener('change', () => { if (state.visiting) return; const v = $('#c-desc').value.trim().slice(0, 280); if (Cloud.user && Cloud.garden) saveGardenSettings({ description: v }).then(drawBoard); else { SETTINGS.desc = v; persistSettings(); drawBoard(); } });

