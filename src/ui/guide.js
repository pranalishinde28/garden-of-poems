import { $, isTouch } from '../core/util.js';
import { flag } from '../settings/storage.js';
import { openPanel, closePanel } from './reading.js';
import { provide } from '../core/late.js';
import { isTyping } from './input.js';
import { state } from '../core/state.js';

/* ================= first steps, and the help sheet ================= */
// Three short, skippable steps the first time someone enters; the help sheet (? or H) lists every control.
const STEPS = [
  ['Walk', isTouch ? 'Use the circle at the bottom left to walk, and swipe to look around.' : 'Walk with W A S D or the arrow keys, and drag to look around. Hold Shift to go a little faster.'],
  ['Write', isTouch ? 'Poems begin at the white bench marked “Sit here”, to the left past the tulips. Or tap the lantern at the top.' : 'Poems begin at the white bench marked “Sit here”, to the left past the tulips. Or press N, or choose the lantern at the top.'],
  ['Find and read', isTouch ? 'Every cherry tree is a poem. When one glows, tap it. The map shows every poem and every place.' : 'Every cherry tree is a poem. When one glows, press E or click it. The map (M) shows every poem and every place.'],
];
const box = $('#steps'); let at = 0;
function show() {
  const [t, b] = STEPS[at];
  $('#steps-n').textContent = `${at + 1} of ${STEPS.length}`; $('#steps-t').textContent = t; $('#steps-b').textContent = b;
  $('#steps-next').textContent = at === STEPS.length - 1 ? 'Begin' : 'Next';
}
export function startSteps() { at = 0; show(); box.hidden = false; requestAnimationFrame(() => box.classList.add('show')); }
function endSteps() { flag.set('seen-steps', '1'); box.classList.remove('show'); setTimeout(() => { if (!box.classList.contains('show')) box.hidden = true; }, 500); }
$('#steps-next').onclick = () => { if (at < STEPS.length - 1) { at++; show(); } else endSteps(); };
$('#steps-skip').onclick = endSteps;
export const maybeStartSteps = () => { if (!flag.get('seen-steps')) setTimeout(startSteps, 600); };

const help = $('#helpsheet');
export const openHelp = () => { if (help.hidden || !help.classList.contains('open')) openPanel(help); };
$('#help-close').onclick = () => closePanel(help);
$('#help-steps').onclick = () => { closePanel(help); startSteps(); };
provide({ get openHelp() { return openHelp; }, get maybeStartSteps() { return maybeStartSteps; } });

/* ---------- shortcut keys ---------- */
// Each key presses the same button you would, so what it does lives in one place. Walking only (the
// swing, reading and writing keep their own keys), never while typing or with a modifier held.
const SHORTCUTS = { KeyN: 'h-write', KeyC: 'h-custom', KeyA: 'h-you', KeyO: 'h-view-horizon', KeyG: 'h-gardens', KeyU: 'h-sound', KeyL: 'h-night', KeyY: 'h-theme', KeyT: 'h-time', KeyB: 'h-home', KeyP: 'h-weather' };
addEventListener('keydown', e => {
  if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || isTyping(e) || state.mode !== 'walk' || document.body.classList.contains('panel-open')) return;
  if (e.code === 'KeyF') { e.preventDefault(); if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.().catch(() => {}); return; }
  const id = SHORTCUTS[e.code], b = id && document.getElementById(id);
  if (b && !b.disabled) { e.preventDefault(); b.click(); }
});
