import { $, V3, clamp } from '../core/util.js';
import { groundH } from '../world/terrain.js';
import { POST, SETTINGS, flag, poems, savePoems, setPoems } from '../settings/storage.js';
import { state } from '../core/state.js';
import { camera } from '../world/renderer.js';
import { plants } from '../plants/registry.js';
import { rebuildConnections, rebuildPetals } from '../world/particles.js';
import { Music } from '../audio/music.js';
import { SPAWN, camTween, syncPlayerFromCamera } from '../player/camera.js';
import { setCue, showHint, toast } from './helpers.js';
import { applyFilter } from './filter.js';
import { closePanel, closeReader, reader } from './reading.js';
import { editor, openEditor } from './writing.js';
import { hideSwingUI } from './swinging.js';
import { persistSettings, setSetting } from '../settings/customize.js';
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
const timePop = $('#time-pop'), menuPop = $('#menu-pop');
function closePops() { timePop.classList.remove('open'); menuPop.classList.remove('open'); $('#h-time').setAttribute('aria-pressed', 'false'); $('#h-more').setAttribute('aria-pressed', 'false'); clearConfirm(); }
$('#h-time').onclick = () => { const o = !timePop.classList.contains('open'); closePops(); if (o) { timePop.classList.add('open'); $('#h-time').setAttribute('aria-pressed', 'true'); } };
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
export function setNightUI() { const n = state.nightTarget === 1; $('#h-night').setAttribute('aria-pressed', n ? 'true' : 'false'); $('#h-night').dataset.tip = n ? 'Daylight' : 'Moonlight'; $('#i-moon').hidden = n; $('#i-sun').hidden = !n; }
$('#h-night').onclick = () => { state.nightTarget = state.nightTarget ? 0 : 1; setNightUI(); };
export function setSoundUI() { $('#h-sound').setAttribute('aria-pressed', Music.muted ? 'false' : 'true'); $('#i-snd').hidden = Music.muted; $('#i-mute').hidden = !Music.muted; $('#h-sound').dataset.tip = Music.muted ? 'Music is off' : 'Music is on'; }
$('#h-sound').onclick = () => { Music.setMuted(!Music.muted); setSoundUI(); if (!state.visiting) { SETTINGS.music = Music.muted ? 'off' : (Music.mode === 'own' ? 'own' : 'piano'); persistSettings(); } };
export function setMusicMenu() { $('#m-piano').hidden = Music.mode !== 'own'; $('#m-own').textContent = Music.mode === 'own' ? 'Choose different music files' : 'Play my own music files'; }
const fileInput = $('#file-music');
$('#m-own').onclick = () => { closePops(); fileInput.value = ''; fileInput.click(); };
fileInput.addEventListener('change', () => { if (fileInput.files && fileInput.files.length) Music.useFiles(fileInput.files); });
$('#m-piano').onclick = () => { closePops(); Music.backToPiano(); toast('Back to the piano.'); };
$('#m-help').onclick = () => { closePops(); showHint(10000); };
function setCineUI() { $('#m-cine').textContent = POST.on ? 'Cinematic look: on' : 'Cinematic look: off'; }
$('#m-cine').onclick = () => { POST.on = !POST.on; flag.set('cine', POST.on ? '1' : '0'); setCineUI(); };
setCineUI();
function setRainUI() { $('#m-rain').textContent = SETTINGS.weather === 'clear' ? 'Let it rain' : 'Let the sky clear'; }
$('#m-rain').onclick = () => { setSetting('weather', SETTINGS.weather === 'clear' ? 'rain' : 'clear'); closePops(); };
setRainUI();
$('#m-sample').onclick = () => { closePops(); if (state.visiting) { toast('Return to your own garden first.'); return; } const n = late.plantSamples(true); toast(n ? `${n} sample poems are taking root.` : 'The sample poems are already growing here.'); };
let clearArmed = false;
function clearConfirm() { clearArmed = false; $('#m-clear').textContent = 'Clear the garden'; }
$('#m-clear').onclick = e => {
  e.stopPropagation();
  if (state.visiting) { closePops(); toast('Return to your own garden first.'); return; }
  if (!poems.length) { closePops(); toast('The garden is already empty.'); return; }
  if (!clearArmed) { clearArmed = true; $('#m-clear').textContent = `Delete all ${poems.length} poems? Click again`; return; }
  closePops();
  if (state.mode === 'focus') closeReader();
  setPoems([]); savePoems();
  plants.forEach(pl => { pl.dying = true; pl.target = 0; pl.speed = 1 / 1.6; pl.delay = Math.random() * 0.8; });
  rebuildConnections(); rebuildPetals(); late.updateSign(); toast('The garden is empty again.');
};

