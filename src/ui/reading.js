import { $, V3, clamp, monthYear } from '../core/util.js';
import { POND_R, WATER_Y } from '../world/terrain.js';
import { SETTINGS, poems, savePoems, setPoems } from '../settings/storage.js';
import { T, setTween, state } from '../core/state.js';
import { MOOD_INK, REGIONS, regionKeyFor } from '../plants/mapping.js';
import { camera } from '../world/renderer.js';
import { decor, stoneNear } from '../world/paths.js';
import { createPlant, plants, removePlant } from '../plants/registry.js';
import { waterU } from '../water/water.js';
import { rebuildConnections, rebuildPetals } from '../world/particles.js';
import { Music } from '../audio/music.js';
import { blocked, camTween, floorH, syncPlayerFromCamera } from '../player/camera.js';
import { setCue, toast } from './helpers.js';
import { isTyping } from './input.js';
import { byDate, computeSeason, visiblePoems } from './filter.js';
import { late, provide } from '../core/late.js';

// names other modules reach through late (see core/late.js)
provide({
  get openPoem() { return openPoem; },
  get closeReader() { return closeReader; },
  get stepPoem() { return stepPoem; },
  get reflect() { return reflect; },
});

/* ================= reading ================= */
export const reader = $('#reader');
// One behaviour for every panel: focus moves in and comes back when it closes, Tab stays inside,
// and Esc or a click on the garden closes the settings-like panels (the reader and the editor keep
// their own closing, and the swing reader never takes focus from the swing).
const panels = [], CLOSERS = { youpanel: '#y-close', custom: '#c-close', gardens: '#g-close', signpanel: '#s-close', helpsheet: '#help-close' };
export function openPanel(el) {
  el.hidden = false; requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('open')));
  if (el.id === 'swreader') return;
  if (!panels.includes(el)) { panels.push(el); el._returnTo = document.activeElement; }
  document.body.classList.add('panel-open');
  requestAnimationFrame(() => { if (!el.contains(document.activeElement)) el.focus({ preventScroll: true }); });
}
export function closePanel(el) {
  el.classList.remove('open'); clearTimeout(el._t); el._t = setTimeout(() => { if (!el.classList.contains('open')) el.hidden = true; }, 900);
  const i = panels.indexOf(el); if (i < 0) return; panels.splice(i, 1);
  if (!panels.length) document.body.classList.remove('panel-open');
  const back = el._returnTo; el._returnTo = null;
  if (el.contains(document.activeElement) && back && back.focus && document.contains(back)) back.focus({ preventScroll: true });
}
const focusables = el => [...el.querySelectorAll('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])')].filter(n => !n.disabled && n.offsetParent !== null);
addEventListener('keydown', e => {
  const top = panels[panels.length - 1]; if (!top) return;
  if (e.key === 'Escape' && CLOSERS[top.id]) { e.preventDefault(); e.stopImmediatePropagation(); $(CLOSERS[top.id]).click(); return; }
  if (e.key !== 'Tab') return;
  const f = focusables(top); if (!f.length) return;
  const i = f.indexOf(document.activeElement);
  if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && (i === f.length - 1 || i < 0)) { e.preventDefault(); f[0].focus(); }
}, true);
addEventListener('pointerdown', e => {
  const top = panels[panels.length - 1];
  if (top && CLOSERS[top.id] && e.target.id === 'c' && !top.contains(e.target)) $(CLOSERS[top.id]).click();
}, true);
export function regionLabel(p) { const n = REGIONS[regionKeyFor(p)].name; return 'Grows in ' + n.replace(/^The /, 'the '); }
// ---- the card as a book: pages turn over the spine, and the cover swings open ----
const book = $('#r-book'), leaf = $('#r-leaf'), still = matchMedia('(prefers-reduced-motion: reduce)');
const EASE = 'cubic-bezier(.45,.05,.3,1)';
function copyOfPage() {
  const c = leaf.cloneNode(true); c.removeAttribute('id'); c.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
  c.className = 'face leaf static'; c.setAttribute('aria-hidden', 'true');
  return c;
}
function sheet(face) { const t = document.createElement('div'); t.className = 'leaf turning'; const back = document.createElement('div'); back.className = 'back'; t.append(face, back); return t; }
function settle(scrollTop, nodes) { nodes.forEach(n => { const s = n.querySelector('.scroll'); if (s) s.scrollTop = scrollTop; }); }
// next: the old page lifts away to the left; earlier: the previous page swings back over the old one
function turnPage(dir, fill) {
  if (still.matches || !reader.classList.contains('open')) { fill(); return; }
  book.querySelectorAll('.leaf.turning,.leaf.under').forEach(n => n.remove());
  const top = leaf.querySelector('.scroll').scrollTop, old = copyOfPage();
  fill();
  const fresh = copyOfPage(), dur = 950;
  reader.classList.add('flipping');
  let moving, under = null;
  if (dir > 0) { moving = sheet(old); book.append(moving); settle(top, [moving]); }
  else { under = old; under.className = 'leaf under static'; moving = sheet(fresh); book.append(under, moving); settle(top, [under]); }
  moving.style.setProperty('--dur', dur + 'ms');
  const frames = dir > 0 ? [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-95deg) scaleX(1.02)', offset: 0.5 }, { transform: 'rotateY(-180deg)', opacity: 0.5 }] : [{ transform: 'rotateY(-180deg)', opacity: 0.5 }, { transform: 'rotateY(-85deg) scaleX(1.02)', offset: 0.5 }, { transform: 'rotateY(0deg)', opacity: 1 }];
  // the turning page lifts a little off the spine and throws a shadow across the page beneath
  const shade = document.createElement('div'); shade.className = 'page-shade'; book.append(shade);
  shade.animate(dir > 0 ? [{ opacity: 0.55 }, { opacity: 0.25, offset: 0.5 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 0.25, offset: 0.5 }, { opacity: 0.55, offset: 0.95 }, { opacity: 0 }], { duration: dur, easing: 'ease-in-out', fill: 'forwards' });
  moving.animate(frames.map((f, i) => ({ ...f, transform: f.transform + ' translateZ(0)' })), { duration: dur, easing: EASE, fill: 'forwards' }).finished.catch(() => {}).then(() => { moving.remove(); shade.remove(); under && under.remove(); reader.classList.remove('flipping'); });
}
// opening: a cloth cover with the garden's name swings open on the first page
function openCover() {
  if (still.matches) return;
  book.querySelectorAll('.leaf.cover').forEach(n => n.remove());
  const c = document.createElement('div'); c.className = 'leaf cover'; c.setAttribute('aria-hidden', 'true');
  const face = document.createElement('div'); face.className = 'face'; face.textContent = state.visiting ? state.visiting.name : (SETTINGS.name || 'The Garden of Poems');
  const back = document.createElement('div'); back.className = 'back'; c.append(face, back); book.append(c);
  reader.classList.add('flipping');
  c.animate([{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(0deg)', offset: 0.2 }, { transform: 'rotateY(-180deg)', opacity: 0.5 }], { duration: 1250, easing: EASE, fill: 'forwards' })
    .finished.catch(() => {}).then(() => { c.remove(); if (!book.querySelector('.leaf.turning')) reader.classList.remove('flipping'); });
}

export function fillReader(p, reflection) {
  reader.classList.toggle('is-reflection', !!reflection);
  // the header: whose poem, and where it grows
  const ink = MOOD_INK[p.mood] || MOOD_INK.reflection, poet = state.visiting ? state.visiting.by : 'Your garden';
  $('#r-poet').textContent = poet; const av = $('#r-av'); av.textContent = (poet.trim()[0] || '·').toUpperCase(); av.style.setProperty('--c', ink);
  const k = $('#r-kicker'); k.hidden = !reflection; k.textContent = reflection ? 'A reflection from the water' : '';
  $('#r-title').textContent = p.title;
  const body = $('#r-body'); body.innerHTML = ''; let i = 0;
  p.content.replace(/\s+$/, '').split('\n').forEach(line => {
    const d = document.createElement('div');
    if (!line.trim()) d.className = 'gap'; else { d.className = 'ln'; d.textContent = line; d.style.setProperty('--i', Math.min(i++, 40)); }
    body.appendChild(d);
  });
  $('#r-date').textContent = monthYear(p.createdAt);
  $('#r-where').textContent = regionLabel(p);
  const list = visiblePoems().sort(byDate), idx = list.findIndex(q => q.id === p.id);
  $('#r-prev').hidden = $('#r-next').hidden = !!reflection;
  $('#r-prev').setAttribute('aria-label', 'Earlier poem (←)'); $('#r-next').setAttribute('aria-label', 'Later poem (→)');
  $('#r-prev').disabled = idx <= 0; $('#r-next').disabled = idx < 0 || idx >= list.length - 1;
  $('#r-again').hidden = $('#r-visit').hidden = !reflection;
  $('#r-again').disabled = visiblePoems().length < 2;
  $('#r-edit').hidden = $('#r-del').hidden = !!reflection || !!state.visiting;
  late.loadSocial(p, reflection);
  $('#r-confirm').hidden = true; $('#r-bar').hidden = false;
  leaf.querySelector('.scroll').scrollTop = 0;
}
function viewFor(plant) {
  const c = plant.root.position, toCam = new V3(camera.position.x - c.x, 0, camera.position.z - c.z);
  if (toCam.lengthSq() < 0.01) toCam.set(0, 0, 1); toCam.normalize();
  const small = plant.h < 2.5;
  const dist = small ? 1.4 + plant.radius * 0.8 + plant.h * 0.5 : 2.0 + plant.radius * 0.8 + plant.h * 0.5;
  const pos = new V3();
  for (const off of [0, 0.45, -0.45, 0.9, -0.9, 1.4, -1.4]) {
    const cs = Math.cos(off), sn = Math.sin(off);
    pos.set(c.x + (toCam.x * cs - toCam.z * sn) * dist, 0, c.z + (toCam.x * sn + toCam.z * cs) * dist);
    if (!stoneNear(pos.x, pos.z, 1.2) && !blocked(pos.x, pos.z)) break;
  }
  pos.y = floorH(pos.x, pos.z) + Math.max(1.7, 1.3 + plant.h * 0.2);
  const look = new V3(c.x, c.y + plant.h * 0.48, c.z);
  const fwd = new V3().subVectors(look, pos); fwd.y = 0; fwd.normalize();
  const right = new V3(-fwd.z, 0, fwd.x);
  if (innerWidth > 760) look.addScaledVector(right, dist * 0.42); else look.y -= dist * 0.3;
  return { pos, look };
}
export function openPoem(plant, dir = 0) {
  late.hideSwingUI();
  late.closePops(); setCue(null);
  state.mode = 'focus'; state.reading = plant.poem.id; state.reflection = false;
  const v = viewFor(plant), d = camera.position.distanceTo(v.pos);
  camTween(v.pos, v.look, clamp(1.3 + d * 0.05, 1.5, 3.4));
  plant.pulse = 1; Music.ducked = true;
  const wasOpen = reader.classList.contains('open') && !reader.hidden, changed = wasOpen && $('#r-title').textContent !== plant.poem.title;
  // any new poem while the book is open turns a page: the arrows say which way, another tree turns forward
  if (wasOpen && (dir || changed)) turnPage(dir || 1, () => fillReader(plant.poem, false));
  else { fillReader(plant.poem, false); if (!wasOpen) openCover(); }
  openPanel(reader); reader.focus({ preventScroll: true });
}
export function closeReader() {
  if (state.mode !== 'focus') return;
  closePanel(reader); setTween(null); state.mode = 'walk'; state.reading = null; state.reflection = false;
  Music.ducked = false; syncPlayerFromCamera();
}
function stepPoem(dir) {
  const list = visiblePoems().sort(byDate), idx = list.findIndex(q => q.id === state.reading);
  const next = list[idx + dir]; if (!next || !plants.has(next.id)) return;
  openPoem(plants.get(next.id), dir);
}
function reflect(point) {
  const vis = visiblePoems();
  if (!vis.length) { toast(poems.length ? 'Nothing from this time is reflected in the water.' : 'The water is still. Write a poem and it will surface here in time.'); return; }
  late.closePops(); setCue(null);
  const at = point || new V3(0, WATER_Y, 0); waterU.uRip.value.set(at.x, at.z, T, 0);
  const sorted = vis.slice().sort(byDate), pool = sorted.slice(0, Math.max(1, Math.ceil(sorted.length * 0.6)));
  let p = pool[Math.floor(Math.random() * pool.length)];
  if (p.id === state.lastReflect && pool.length > 1) p = pool[(pool.indexOf(p) + 1) % pool.length];
  if (p.id === state.lastReflect && sorted.length > 1) p = sorted.find(q => q.id !== p.id);
  state.lastReflect = p.id;
  if ((state.mode !== 'focus' || !state.reflection) && state.thirdPerson) {
    // third person: choose a clear spot on the shore for your figure, then frame it from behind and to the right
    const base = Math.atan2(camera.position.z, camera.position.x), R0 = POND_R + 0.55;
    let a = base;
    for (const da of [0, 0.14, -0.14, 0.28, -0.28, 0.42, -0.42, 0.6, -0.6, 0.8, -0.8]) { const x = Math.cos(base + da) * R0, z = Math.sin(base + da) * R0; if (!decor.some(o => o.collide > 0 && Math.hypot(o.x - x, o.z - z) < o.collide + 0.5)) { a = base + da; break; } }
    const out = new V3(Math.cos(a), 0, Math.sin(a)), side = new V3(out.z, 0, -out.x);
    state.pondSpot = { x: out.x * R0, z: out.z * R0 };
    const pos = out.clone().multiplyScalar(R0 + 2.9).addScaledVector(side, 1.0); pos.y = floorH(pos.x, pos.z) + 1.75;
    const look = out.clone().multiplyScalar(R0 - 4).addScaledVector(side, innerWidth > 760 ? 2.2 : 0.6); look.y = WATER_Y + 0.4;
    camTween(pos, look, clamp(1.2 + camera.position.distanceTo(pos) * 0.05, 1.4, 3));
  } else if (state.mode !== 'focus' || !state.reflection) {
    const dir = new V3(camera.position.x, 0, camera.position.z); if (dir.lengthSq() < 0.01) dir.set(0, 0, 1); dir.normalize();
    const pos = dir.clone().multiplyScalar(11); pos.y = floorH(pos.x, pos.z) + 1.55;
    const look = dir.clone().multiplyScalar(2.5); look.y = WATER_Y;
    if (innerWidth > 760) look.addScaledVector(new V3(dir.z, 0, -dir.x), 3.2);
    camTween(pos, look, clamp(1.2 + camera.position.distanceTo(pos) * 0.05, 1.4, 3));
  }
  const wasOpen = reader.classList.contains('open') && !reader.hidden;
  state.mode = 'focus'; state.reading = p.id; state.reflection = true; Music.ducked = true;
  if (wasOpen) turnPage(1, () => fillReader(p, true)); else { fillReader(p, true); openCover(); }
  openPanel(reader); reader.focus({ preventScroll: true });
}
$('#r-close').onclick = closeReader;
$('#r-prev').onclick = () => stepPoem(-1);
$('#r-next').onclick = () => stepPoem(1);
$('#r-again').onclick = () => reflect(new V3((Math.random() - .5) * 8, WATER_Y, (Math.random() - .5) * 8));
// a double tap on the page is a heart, as on a photo (two quick taps close together; dblclick is unreliable on phones)
let lastTap = null;
leaf.addEventListener('pointerup', e => {
  const now = performance.now(), near = lastTap && now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30;
  lastTap = near ? null : { t: now, x: e.clientX, y: e.clientY };
  if (near && late.canHeart && late.canHeart()) { getSelection()?.removeAllRanges(); late.heartPoem(true); }
});
addEventListener('keydown', e => {
  if (state.mode !== 'focus' || e.repeat || e.metaKey || e.ctrlKey || e.altKey || isTyping(e)) return;
  if (e.code === 'KeyJ' && late.canHeart && late.canHeart()) { e.preventDefault(); late.heartPoem(); }
  else if (e.code === 'KeyK' && !$('#r-talk').hidden) { e.preventDefault(); $('#r-talk').click(); }
});
$('#r-visit').onclick = () => { const pl = plants.get(state.reading); if (pl) openPoem(pl); };
$('#r-edit').onclick = () => { const p = poems.find(q => q.id === state.reading); if (p) late.openEditor(p); };
$('#r-del').onclick = () => {
  const p = poems.find(q => q.id === state.reading); if (!p) return;
  $('#r-confirm-t').textContent = `Delete “${p.title}”? Its plant goes with it.`;
  $('#r-confirm').hidden = false; $('#r-bar').hidden = true; $('#r-no').focus();
};
$('#r-no').onclick = () => { $('#r-confirm').hidden = true; $('#r-bar').hidden = false; };
$('#r-yes').onclick = () => {
  const id = state.reading, p = poems.find(q => q.id === id); if (!p) return;
  const at = poems.indexOf(p);
  setPoems(poems.filter(q => q.id !== id)); savePoems();
  const pl = plants.get(id); if (pl) { pl.dying = true; pl.target = 0; pl.speed = 1 / 1.4; pl.delay = 0.5; }
  closeReader();
  toast(`“${p.title}” was removed.`, 7000, { label: 'Undo', run: () => {
    // put it back where it was, and let it grow again
    const list = poems.slice(); list.splice(Math.min(at, list.length), 0, p); setPoems(list); savePoems();
    const old = plants.get(p.id); if (old) removePlant(old);
    const np = createPlant(p, { visible: false }); np.target = 1; np.speed = 1 / 1.6; np.pulse = 1;
    rebuildConnections(); rebuildPetals(); late.updateSign(); state.season = computeSeason(); toast(`“${p.title}” is growing again.`, 2600);
  } });
  rebuildConnections(); rebuildPetals(); late.updateSign(); state.season = computeSeason();
};

