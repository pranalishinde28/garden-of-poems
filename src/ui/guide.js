import { $, isTouch } from '../core/util.js';
import { flag } from '../settings/storage.js';
import { openPanel, closePanel } from './reading.js';
import { provide } from '../core/late.js';

/* ================= first steps, and the help sheet ================= */
// Three short, skippable steps the first time someone enters; the help sheet (? or H) lists every control.
const STEPS = [
  ['Walk', isTouch ? 'Use the circle at the bottom left to walk, and swipe to look around.' : 'Walk with W A S D or the arrow keys, and drag to look around. Hold Shift to go a little faster.'],
  ['Write', isTouch ? 'Poems begin at the bench under the wisteria, to the left past the tulips. Or tap the lantern at the top.' : 'Poems begin at the bench under the wisteria, to the left past the tulips. Or choose the lantern at the top.'],
  ['Find and read', isTouch ? 'Every plant is a poem. When one glows, tap it. The map shows every poem and every place.' : 'Every plant is a poem. When one glows, press E or click it. The map (M) shows every poem and every place.'],
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
