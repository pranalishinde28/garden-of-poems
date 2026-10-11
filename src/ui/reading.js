import { $, V3, clamp, monthYear } from '../core/util.js';
import { WATER_Y } from '../world/terrain.js';
import { poems, savePoems, setPoems } from '../settings/storage.js';
import { T, setTween, state } from '../core/state.js';
import { REGIONS, TYPE_REGION } from '../plants/mapping.js';
import { camera } from '../world/renderer.js';
import { stoneNear } from '../world/paths.js';
import { plants } from '../plants/registry.js';
import { waterU } from '../water/water.js';
import { rebuildConnections, rebuildPetals } from '../world/particles.js';
import { Music } from '../audio/music.js';
import { blocked, camTween, floorH, syncPlayerFromCamera } from '../player/camera.js';
import { setCue, toast } from './helpers.js';
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
export function openPanel(el) { el.hidden = false; requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('open'))); }
export function closePanel(el) { el.classList.remove('open'); clearTimeout(el._t); el._t = setTimeout(() => { if (!el.classList.contains('open')) el.hidden = true; }, 900); }
function regionLabel(p) { const n = REGIONS[TYPE_REGION[p.plantType]].name; return 'Grows in ' + n.replace(/^The /, 'the '); }
export function fillReader(p, reflection) {
  reader.classList.toggle('is-reflection', !!reflection);
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
  $('#r-prev').disabled = idx <= 0; $('#r-next').disabled = idx < 0 || idx >= list.length - 1;
  $('#r-again').hidden = $('#r-visit').hidden = !reflection;
  $('#r-again').disabled = visiblePoems().length < 2;
  $('#r-edit').hidden = $('#r-del').hidden = !!reflection || !!state.visiting;
  late.loadNotes(p, reflection);
  $('#r-confirm').hidden = true; $('#r-bar').hidden = false;
  reader.querySelector('.scroll').scrollTop = 0;
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
export function openPoem(plant) {
  late.hideSwingUI();
  late.closePops(); setCue(null);
  state.mode = 'focus'; state.reading = plant.poem.id; state.reflection = false;
  const v = viewFor(plant), d = camera.position.distanceTo(v.pos);
  camTween(v.pos, v.look, clamp(1.3 + d * 0.05, 1.5, 3.4));
  plant.pulse = 1; Music.ducked = true;
  fillReader(plant.poem, false); openPanel(reader); reader.focus({ preventScroll: true });
}
export function closeReader() {
  if (state.mode !== 'focus') return;
  closePanel(reader); setTween(null); state.mode = 'walk'; state.reading = null; state.reflection = false;
  Music.ducked = false; syncPlayerFromCamera();
}
function stepPoem(dir) {
  const list = visiblePoems().sort(byDate), idx = list.findIndex(q => q.id === state.reading);
  const next = list[idx + dir]; if (!next || !plants.has(next.id)) return;
  openPoem(plants.get(next.id));
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
  if (state.mode !== 'focus' || !state.reflection) {
    const dir = new V3(camera.position.x, 0, camera.position.z); if (dir.lengthSq() < 0.01) dir.set(0, 0, 1); dir.normalize();
    const pos = dir.clone().multiplyScalar(11); pos.y = floorH(pos.x, pos.z) + 1.55;
    const look = dir.clone().multiplyScalar(2.5); look.y = WATER_Y;
    if (innerWidth > 760) look.addScaledVector(new V3(dir.z, 0, -dir.x), 3.2);
    camTween(pos, look, clamp(1.2 + camera.position.distanceTo(pos) * 0.05, 1.4, 3));
  }
  state.mode = 'focus'; state.reading = p.id; state.reflection = true; Music.ducked = true;
  fillReader(p, true); openPanel(reader); reader.focus({ preventScroll: true });
}
$('#r-close').onclick = closeReader;
$('#r-prev').onclick = () => stepPoem(-1);
$('#r-next').onclick = () => stepPoem(1);
$('#r-again').onclick = () => { reader.classList.remove('open'); setTimeout(() => reflect(new V3((Math.random() - .5) * 8, WATER_Y, (Math.random() - .5) * 8)), 350); };
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
  setPoems(poems.filter(q => q.id !== id)); savePoems();
  const pl = plants.get(id); if (pl) { pl.dying = true; pl.target = 0; pl.speed = 1 / 1.4; pl.delay = 0.5; }
  closeReader(); toast(`“${p.title}” was removed from the garden.`);
  rebuildConnections(); rebuildPetals(); late.updateSign(); state.season = computeSeason();
};

