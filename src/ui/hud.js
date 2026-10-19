import { $, V3, clamp } from '../core/util.js';
import { groundH } from '../world/terrain.js';
import { POST, SETTINGS, flag, poems, savePoems, setPoems } from '../settings/storage.js';
import { state } from '../core/state.js';
import { camera } from '../world/renderer.js';
import { plants } from '../plants/registry.js';
import { rebuildConnections, rebuildPetals } from '../world/particles.js';
import { Music } from '../audio/music.js';
import { SPAWN, camTween, syncPlayerFromCamera } from '../player/camera.js';
import { setThirdPerson } from '../player/figure.js';
import { setCue, showHint, toast } from './helpers.js';
import { applyFilter } from './filter.js';
import { closePanel, closeReader, reader } from './reading.js';
import { editor, openEditor } from './writing.js';
import { hideSwingUI } from './swinging.js';
import { persistSettings, setSetting } from '../settings/customize.js';
import { setSkyButton } from './icons.js';
import { late, provide } from '../core/late.js';

// names other modules reach through late (see core/late.js)
provide({
  get closePops() { return closePops; },
  get setNightUI() { return setNightUI; },
  get setSoundUI() { return setSoundUI; },
  get setMusicMenu() { return setMusicMenu; },
  get fileInput() { return fileInput; },
  get setRainUI() { return setRainUI; },
});

/* ================= HUD wiring ================= */
const timePop = $('#time-pop'), menuPop = $('#menu-pop'), skyPop = $('#sky-pop');
function closePops() { timePop.classList.remove('open'); menuPop.classList.remove('open'); skyPop.classList.remove('open'); $('#h-sky').setAttribute('aria-pressed', 'false'); $('#h-time').setAttribute('aria-pressed', 'false'); $('#h-more').setAttribute('aria-pressed', 'false'); clearConfirm(); }
$('#h-time').onclick = () => { const o = !timePop.classList.contains('open'); closePops(); if (o) { timePop.classList.add('open'); $('#h-time').setAttribute('aria-pressed', 'true'); } };
// season, light, horizon and weather, all in one small page
function renderSky() { skyPop.querySelectorAll('.seg[data-k]').forEach(sg => sg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', SETTINGS[sg.dataset.k] === b.dataset.v ? 'true' : 'false'))); }
skyPop.querySelectorAll('.seg[data-k] button').forEach(b => { b.onclick = () => { if (state.visiting) { toast('You are visiting. The sky belongs to this garden.'); return; } setSetting(b.parentElement.dataset.k, b.dataset.v); renderSky(); }; });
$('#h-sky').onclick = () => { const o = !skyPop.classList.contains('open'); closePops(); if (o) { renderSky(); skyPop.classList.add('open'); $('#h-sky').setAttribute('aria-pressed', 'true'); } };
$('#h-more').onclick = () => { const o = !menuPop.classList.contains('open'); closePops(); if (o) { menuPop.classList.add('open'); $('#h-more').setAttribute('aria-pressed', 'true'); } };
document.querySelectorAll('#timebar button').forEach(b => b.onclick = () => { applyFilter(b.dataset.f, true); });
$('#h-write').onclick = () => { if (state.mode === 'cinematic' || state.mode === 'writing') return; openEditor(null); };
$('#h-home').onclick = () => {
  hideSwingUI();
  if (state.mode === 'cinematic') return; closePops();
  if (state.mode === 'focus') closePanel(reader); if (state.mode === 'writing') closePanel(editor);
  state.mode = 'cinematic'; Music.ducked = false; setCue(null);
  const pos = SPAWN.pos.clone(); pos.y = groundH(pos.x, pos.z) + 1.6;
  camTween(pos, new V3(0, pos.y - 0.4, 25), clamp(1.4 + camera.position.distanceTo(pos) * 0.05, 1.6, 3.6), () => { state.mode = 'walk'; state.reading = null; state.reflection = false; syncPlayerFromCamera(); });
};
// the light button walks the day round: daylight, then sunset, then moonlight
const NEXT_LIGHT = { day: 'sunset', sunset: 'night', night: 'day' }, LIGHT_TIP = { sunset: 'Sunset', night: 'Moonlight', day: 'Daylight' };
export function setNightUI() {
  const m = state.lightMode || 'day', next = NEXT_LIGHT[m];
  setSkyButton('h-night', m, LIGHT_TIP[m], 'change to ' + LIGHT_TIP[next].toLowerCase(), 'L');
}
$('#h-night').onclick = () => { if (state.visiting) { toast('You are visiting. The light belongs to this garden.'); return; } setSetting('light', NEXT_LIGHT[state.lightMode || 'day']); }; // kept with the garden, like Customize
export function setSoundUI() { $('#h-sound').setAttribute('aria-pressed', Music.muted ? 'false' : 'true'); $('#i-snd').hidden = Music.muted; $('#i-mute').hidden = !Music.muted; $('#h-sound').dataset.tip = Music.muted ? 'Music is off' : 'Music is on'; }
$('#h-sound').onclick = () => { Music.setMuted(!Music.muted); setSoundUI(); if (!state.visiting) { SETTINGS.music = Music.muted ? 'off' : (Music.mode === 'own' ? 'own' : 'piano'); persistSettings(); } };
export function setMusicMenu() { $('#m-piano').hidden = Music.mode !== 'own'; $('#m-own .t').textContent = Music.mode === 'own' ? 'Choose other music files' : 'Play my own music'; }
const fileInput = $('#file-music');
$('#m-own').onclick = () => { closePops(); fileInput.value = ''; fileInput.click(); };
fileInput.addEventListener('change', () => { if (fileInput.files && fileInput.files.length) Music.useFiles(fileInput.files); });
$('#m-piano').onclick = () => { closePops(); Music.backToPiano(); toast('Back to the piano.'); };
$('#h-help').onclick = () => { closePops(); late.openHelp(); };
// the rows in ⋯ show their current state as words (their data-tip changes with the view)
document.querySelectorAll('#menu .mrow').forEach(b => { let l = b.querySelector('.lbl'); if (!l) { l = document.createElement('span'); l.className = 'lbl'; b.append(l); } if (b.dataset.hint && !b.querySelector('small')) { const h = document.createElement('small'); h.textContent = b.dataset.hint; b.append(h); } const set = () => { l.textContent = (b.dataset.tip || '').replace(/ \(.\)$/, ''); }; set(); new MutationObserver(set).observe(b, { attributes: true, attributeFilter: ['data-tip'] }); });
function setCineUI() { $('#m-cine .t').textContent = POST.on ? 'Soft film look: on' : 'Soft film look: off'; }
$('#m-cine').onclick = () => { POST.on = !POST.on; flag.set('cine', POST.on ? '1' : '0'); setCineUI(); };
setCineUI();
// weather: clear, then passing showers, then steady rain
const NEXT_W = { clear: 'showers', showers: 'rain', rain: 'clear' }, W_WORDS = { clear: 'Clear skies', showers: 'Passing showers', rain: 'Rain' };
// the horizon: Mount Fuji or the sea
function setHorizonUI() { const v = SETTINGS.view; setSkyButton('h-view-horizon', v, v === 'sea' ? 'The sea' : 'Mount Fuji', v === 'sea' ? 'change to Mount Fuji' : 'change to the sea', 'O'); }
$('#h-view-horizon').onclick = () => { if (state.visiting) { toast('You are visiting. The horizon belongs to this garden.'); return; } setSetting('view', SETTINGS.view === 'sea' ? 'fuji' : 'sea'); toast(SETTINGS.view === 'sea' ? 'The garden opens onto the sea. Walk down to the water.' : 'Mount Fuji stands over the garden again.', 3200); };
function setRainUI() { setHorizonUI(); if (skyPop.classList.contains('open')) renderSky(); const w = SETTINGS.weather; setSkyButton('h-weather', w, W_WORDS[w], 'change to ' + W_WORDS[NEXT_W[w]].toLowerCase(), 'P'); }
$('#h-weather').onclick = () => { if (state.visiting) { toast('You are visiting. The weather belongs to this garden.'); return; } setSetting('weather', NEXT_W[SETTINGS.weather]); toast({ clear: 'The sky clears.', showers: 'Showers will pass through now and then.', rain: 'Let it rain.' }[SETTINGS.weather], 2400); };
setRainUI();
$('#m-sample').onclick = () => { closePops(); if (state.visiting) { toast('Return to your own garden first.'); return; } const n = late.plantSamples(true); toast(n ? `${n} sample poems are taking root.` : 'The sample poems are already growing here.'); };
let clearArmed = false;
function clearConfirm() { clearArmed = false; $('#m-clear .t').textContent = 'Clear the garden'; $('#m-clear small').textContent = 'remove every poem here'; }
$('#m-clear').onclick = e => {
  e.stopPropagation();
  if (state.visiting) { closePops(); toast('Return to your own garden first.'); return; }
  if (!poems.length) { closePops(); toast('The garden is already empty.'); return; }
  if (!clearArmed) { clearArmed = true; $('#m-clear .t').textContent = `Remove all ${poems.length} poems?`; $('#m-clear small').textContent = 'press again to remove them; there is no undo'; return; }
  closePops();
  if (state.mode === 'focus') closeReader();
  setPoems([]); savePoems();
  plants.forEach(pl => { pl.dying = true; pl.target = 0; pl.speed = 1 / 1.6; pl.delay = Math.random() * 0.8; });
  rebuildConnections(); rebuildPetals(); late.updateSign(); toast('The garden is empty again.');
};

/* first or third person */
export function setViewUI() { const t = !!state.thirdPerson, b = $('#h-view'); b.setAttribute('aria-pressed', t ? 'true' : 'false'); b.dataset.tip = t ? 'See through your eyes (V)' : 'See yourself (V)'; b.setAttribute('aria-label', t ? 'Switch to first person' : 'Switch to third person'); }
export function toggleView() { setThirdPerson(!state.thirdPerson); setViewUI(); toast(state.thirdPerson ? 'You can see yourself now. Press V to look through your own eyes again.' : 'Looking through your own eyes.', 3200); }
$('#h-view').onclick = () => toggleView();
setViewUI();
provide({ get toggleView() { return toggleView; } });
