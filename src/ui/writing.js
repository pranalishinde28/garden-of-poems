import { $, V3, clamp, ease, reduceMotion, uid } from '../core/util.js';
import { groundH } from '../world/terrain.js';
import { poems, savePoems } from '../settings/storage.js';
import { T, seed, setSeed, setTween, state } from '../core/state.js';
import { MOODS } from '../plants/mapping.js';
import { camera } from '../world/renderer.js';
import { createPlant, plants, preparePoem, removePlant } from '../plants/registry.js';
import { benchSeat, lanternWorld } from '../world/decor.js';
import { emitTrail, fireBurst, rebuildConnections, rebuildPetals, seedObj, setTrailClock, trailClock } from '../world/particles.js';
import { Music } from '../audio/music.js';
import { camTween, curLook, floorH, syncPlayerFromCamera } from '../player/camera.js';
import { setCue, toast } from './helpers.js';
import { applyFilter, inFilter } from './filter.js';
import { closePanel, fillReader, openPanel, openPoem, reader } from './reading.js';
import { late, provide } from '../core/late.js';

// names other modules reach through late (see core/late.js)
provide({
  get openEditor() { return openEditor; },
  get closeEditor() { return closeEditor; },
});

/* ================= writing ================= */
export const editor = $('#editor'), eTitle = $('#e-title'), eBody = $('#e-body'), eTheme = $('#e-theme'), eMatters = $('#e-matters'), eGo = $('#e-go');
let eMood = null;
const moodWrap = $('#e-moods');
MOODS.forEach(([k, label]) => {
  const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.dataset.k = k; b.setAttribute('aria-pressed', 'false');
  b.onclick = () => { eMood = eMood === k ? null : k; moodWrap.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x.dataset.k === eMood ? 'true' : 'false')); };
  moodWrap.appendChild(b);
});
function autoGrow() { eBody.style.height = 'auto'; eBody.style.height = eBody.scrollHeight + 'px'; }
eBody.addEventListener('input', () => { autoGrow(); eGo.disabled = !eBody.value.trim(); countWords(); suggestMood(); keepDraft(); });
[eTitle, eTheme].forEach(i => i.addEventListener('input', keepDraft));

// ---- the count, under the poem ----
function countWords() {
  const t = eBody.value.trim(), w = t ? t.split(/\s+/).length : 0, l = t ? t.split('\n').filter(x => x.trim()).length : 0;
  $('#e-count').textContent = w ? `${w} ${w === 1 ? 'word' : 'words'} · ${l} ${l === 1 ? 'line' : 'lines'}` : '';
}
// ---- a gentle mood suggestion from the words; only offered, never chosen for you ----
const MOOD_WORDS = {
  love: /\b(love|loved|lover|kiss|hold(ing)?|your (hand|mouth|name)|heart|darling|tender|beloved|embrace)\w*/g,
  joy: /\b(joy|laugh|bright|sun(light|lit)?|dance|sing|glad|delight|bloom|morning|happy|warm)\w*/g,
  sorrow: /\b(grief|griev|mourn|tears?|weep|cry|cried|lonely|alone|gone|lost|miss(ed|ing)?|empty|ache|goodbye|funeral|dying)\w*/g,
  anger: /\b(anger|angry|rage|furious|burn(ed|ing)?|scream|fire|matches|hate|bitter|fists?|slam)\w*/g,
  childhood: /\b(child(hood)?|kid|mother|father|grand(mother|father|ma|pa)|school|toys?|small|swing|recess|crayon|bedtime|young)\w*/g,
  dream: /\b(dream|dreamt|sleep|asleep|moon|stars?|float(ing)?|strange|wings?|ghost|night|whale|surreal)\w*/g,
  reflection: /\b(remember|memory|years?|time|once|learn(ed|ing)?|age|older|life|change|still|became)\w*/g,
};
let suggested = null;
function suggestMood() {
  const box = $('#e-suggest'), t = eBody.value.toLowerCase();
  if (eMood || t.split(/\s+/).length < 12) { box.hidden = true; return; }
  let best = null, n = 1;
  for (const k in MOOD_WORDS) { const c = (t.match(MOOD_WORDS[k]) || []).length; if (c > n) { n = c; best = k; } }
  if (!best || best === suggested && !box.hidden) return;
  suggested = best; const label = MOODS.find(m => m[0] === best)[1];
  box.innerHTML = ''; box.append(`This feels like ${label.toLowerCase()}. `);
  const b = document.createElement('button'); b.className = 'g-link'; b.textContent = `Choose ${label}`; b.onclick = () => { moodWrap.querySelector(`[data-k="${best}"]`).click(); box.hidden = true; }; box.append(b);
  box.hidden = false;
}
// ---- drafts: an unfinished poem waits on this device until it is planted or you start over ----
const DRAFT = 'garden-of-poems:draft';
let draftT = 0;
function keepDraft() {
  if (state.editing) return; clearTimeout(draftT);
  draftT = setTimeout(() => { try { if (eBody.value.trim() || eTitle.value.trim()) localStorage.setItem(DRAFT, JSON.stringify({ title: eTitle.value, body: eBody.value, theme: eTheme.value, mood: eMood, at: Date.now() })); else localStorage.removeItem(DRAFT); } catch (e) {} }, 400);
}
const readDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT) || 'null'); } catch (e) { return null; } };
const clearDraft = () => { try { localStorage.removeItem(DRAFT); } catch (e) {} $('#e-draft').hidden = true; };
$('#e-fresh').onclick = () => { clearDraft(); eTitle.value = eBody.value = eTheme.value = ''; eMood = null; moodWrap.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', 'false')); autoGrow(); countWords(); eGo.disabled = true; $('#e-suggest').hidden = true; eTitle.focus(); };
export function openEditor(p) {
  if (state.visiting) { toast('You are visiting someone else\'s garden. Return home to write.'); return; }
  late.hideSwingUI();
  late.closePops(); setCue(null);
  state.editing = p ? p.id : null;
  eTitle.value = p ? p.title : ''; eBody.value = p ? p.content : ''; eTheme.value = p && p.theme ? p.theme : ''; eMatters.checked = !!(p && p.important); $('#e-private').checked = !!(p && p.private);
  eMood = p ? (p.mood || null) : null;
  const dr = !p && readDraft(); $('#e-draft').hidden = !(dr && (dr.body || dr.title));
  if (dr) { eTitle.value = dr.title || ''; eBody.value = dr.body || ''; eTheme.value = dr.theme || ''; eMood = dr.mood || null; }
  $('#e-suggest').hidden = true; suggested = null; setTimeout(countWords);
  moodWrap.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x.dataset.k === eMood ? 'true' : 'false'));
  $('#e-ask').textContent = p ? `Tending “${p.title}”` : 'What are you carrying today?';
  eGo.textContent = p ? 'Save changes' : 'Plant this poem'; eGo.disabled = !eBody.value.trim();
  editor.classList.remove('sowing');
  if (p) { closePanel(reader); state.mode = 'writing'; openPanel(editor); setTimeout(() => { autoGrow(); eBody.focus({ preventScroll: true }); }, 60); return; }
  if (state.mode === 'focus') closePanel(reader);
  state.mode = 'writing'; Music.ducked = true;
  const seat = benchSeat(), d = camera.position.distanceTo(seat.pos);
  camTween(seat.pos, seat.look, clamp(1 + d / 9, 1.2, 3.6), () => {
    if (state.mode !== 'writing') return;
    openPanel(editor); setTimeout(() => { autoGrow(); eTitle.focus({ preventScroll: true }); }, 400);
  });
}
function closeEditor() {
  if (state.mode !== 'writing') return;
  closePanel(editor); setTween(null);
  const p = state.editing && poems.find(q => q.id === state.editing);
  state.editing = null;
  if (p && plants.has(p.id)) { state.mode = 'focus'; state.reading = p.id; fillReader(p, false); openPanel(reader); return; }
  state.mode = 'walk'; Music.ducked = false; syncPlayerFromCamera();
}
$('#e-cancel').onclick = closeEditor;
eGo.onclick = () => {
  const content = eBody.value.replace(/\s+$/, ''); if (!content.trim()) return;
  if (!state.editing) clearDraft();
  const first = content.split('\n').find(l => l.trim()) || 'Untitled';
  const title = eTitle.value.trim() || (first.trim().length > 40 ? first.trim().slice(0, 38) + '…' : first.trim());
  const theme = eTheme.value.trim() || undefined;
  if (state.editing) {
    const p = poems.find(q => q.id === state.editing); if (!p) return closeEditor();
    Object.assign(p, { title, content, mood: eMood || undefined, theme, important: eMatters.checked || undefined, private: $('#e-private').checked || undefined, updatedAt: new Date().toISOString() });
    preparePoem(p); savePoems();
    editor.classList.add('sowing');
    setTimeout(() => {
      closePanel(editor); state.editing = null;
      const old = plants.get(p.id); if (old) removePlant(old);
      const pl = createPlant(p, { visible: false }); pl.target = 1; pl.speed = 1 / 2.4; pl.pulse = 1;
      rebuildConnections(); rebuildPetals();
      openPoem(pl); toast('Saved. The plant is growing back.');
    }, 1000);
    return;
  }
  const p = { id: uid(), title, content, createdAt: new Date().toISOString(), mood: eMood || undefined, theme, important: eMatters.checked || undefined, private: $('#e-private').checked || undefined };
  preparePoem(p); poems.push(p); savePoems();
  editor.classList.add('sowing');
  setTimeout(() => { closePanel(editor); state.editing = null; startSeed(p); }, 1150);
};

function startSeed(p) {
  state.mode = 'cinematic'; setCue(null);
  if (state.filter !== 'all' && !inFilter(p)) applyFilter('all', false);
  const plant = createPlant(p, { visible: false });
  const start = lanternWorld();
  const end = new V3(p.position.x, groundH(p.position.x, p.position.z) + 0.15, p.position.z);
  const mid = start.clone().lerp(end, 0.5); mid.y += 3.5 + start.distanceTo(end) * 0.2;
  const flat = new V3(end.x - start.x, 0, end.z - start.z).normalize();
  setSeed({ start, mid, end, t: 0, dur: (reduceMotion ? 1.6 : 2.8) + start.distanceTo(end) * 0.045, plant, poem: p, landed: false, after: 0, flat, first: poems.length === 1 });
  seedObj.position.copy(start); seedObj.visible = true;
  late.updateSign();
}
export function updateSeed(dt) {
  const s = seed, k = 1 - Math.exp(-dt * 2.0);
  if (!s.landed) {
    s.t = Math.min(1, s.t + dt / s.dur); const e = ease(s.t), u = 1 - e;
    const p = new V3(u * u * s.start.x + 2 * u * e * s.mid.x + e * e * s.end.x, u * u * s.start.y + 2 * u * e * s.mid.y + e * e * s.end.y, u * u * s.start.z + 2 * u * e * s.mid.z + e * e * s.end.z);
    seedObj.position.copy(p); seedObj.children[1].scale.setScalar(1.2 + Math.sin(T * 8) * 0.15);
    if ((setTrailClock(trailClock + dt)) > 0.035) { setTrailClock(0); emitTrail(p); }
    const want = p.clone().addScaledVector(s.flat, -5.5); want.y = Math.max(p.y + 1.6, floorH(want.x, want.z) + 1.4);
    camera.position.lerp(want, k); curLook.lerp(p, 1 - Math.exp(-dt * 5)); camera.lookAt(curLook);
    if (s.t >= 1) {
      s.landed = true; seedObj.visible = false; fireBurst(s.end);
      s.plant.target = 1; s.plant.speed = 1 / 3.2; s.plant.pulse = 1.4;
      rebuildPetals();
      toast(s.first ? 'Something is growing here now.' : `“${s.poem.title}” has been planted.`, 5000);
    }
  } else {
    s.after += dt;
    const pl = s.plant, c = pl.root.position;
    const want = c.clone().addScaledVector(s.flat, -(3.5 + pl.radius * 1.2 + pl.h * 0.5)); want.y = floorH(want.x, want.z) + 1.5 + pl.h * 0.22;
    camera.position.lerp(want, 1 - Math.exp(-dt * 1.2));
    curLook.lerp(new V3(c.x, c.y + pl.h * 0.45, c.z), 1 - Math.exp(-dt * 2)); camera.lookAt(curLook);
    if (s.after > (s.first ? 5.5 : 4.2)) {
      setSeed(null); state.mode = 'walk'; Music.ducked = false; syncPlayerFromCamera(); rebuildConnections();
      if (s.first) setTimeout(() => toast('Walk up to it whenever you want to read it again.', 5000), 600);
    }
  }
}

// on phones, keep the editor inside the part of the screen the keyboard leaves visible
if (window.visualViewport) {
  const vv = window.visualViewport, ed = $('#editor');
  const fit = () => {
    const kb = innerHeight - vv.height > 120 && !ed.hidden;
    ed.style.top = kb ? `${vv.offsetTop + vv.height / 2}px` : ''; ed.style.maxHeight = kb ? `${vv.height - 16}px` : '';
  };
  vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit);
}
