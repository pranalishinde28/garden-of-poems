import { $, monthYear } from '../core/util.js';
import { state } from '../core/state.js';
import { visiblePoems } from './filter.js';
import { openPanel, closePanel, regionLabel } from './reading.js';
import { late, provide } from '../core/late.js';

/* ================= reading while swinging ================= */
// A quiet reader docked to the side (a bottom sheet on phones). The swing keeps working while it's
// open: it has no text fields, and its buttons never take W, Space or the arrow keys from the swing.
const panel = $('#swreader');
const sr = { open: false, order: 'new', list: [], i: 0 };
export const swingReaderOpen = () => sr.open;
// input.js runs earlier and reaches these through late
provide({ get swingReaderOpen() { return swingReaderOpen; }, get toggleSwingReader() { return toggleSwingReader; }, get closeSwingReader() { return closeSwingReader; }, get stepSwingReader() { return stepSwingReader; } });

function ordered() {
  const list = visiblePoems().slice();
  if (sr.order === 'near' && state.swing) {
    const at = state.swing.g.position, d = p => p.position ? Math.hypot(p.position.x - at.x, p.position.z - at.z) : 1e9;
    return list.sort((a, b) => d(a) - d(b));
  }
  return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function render() {
  const p = sr.list[sr.i], none = !p;
  $('#sr-title').textContent = none ? 'Nothing grows here yet' : p.title;
  const body = $('#sr-body'); body.innerHTML = '';
  const text = none ? 'Write a poem at the white bench (“Sit here”), then come back and read it here.' : p.content.replace(/\s+$/, '');
  let n = 0;
  text.split('\n').forEach(line => {
    const d = document.createElement('div');
    if (!line.trim()) d.className = 'gap'; else { d.className = 'ln'; d.textContent = line; d.style.setProperty('--i', Math.min(n++, 30)); }
    body.appendChild(d);
  });
  $('#sr-date').textContent = none ? '' : monthYear(p.createdAt);
  $('#sr-where').textContent = none ? '' : regionLabel(p);
  // left is always "back": Earlier in time (the list is newest first), or Nearer
  const near = sr.order === 'near', L = near ? -1 : 1;
  $('#sr-prev').textContent = near ? 'Nearer' : 'Earlier';
  $('#sr-next').textContent = near ? 'Farther' : 'Later';
  $('#sr-prev').disabled = none || !sr.list[sr.i + L];
  $('#sr-next').disabled = none || !sr.list[sr.i - L];
  $('#sr-pos').textContent = none ? '' : `${sr.i + 1} of ${sr.list.length}`;
  panel.querySelectorAll('[data-o]').forEach(b => b.setAttribute('aria-pressed', b.dataset.o === sr.order ? 'true' : 'false'));
  $('#sr-auto').setAttribute('aria-pressed', state.swingAuto ? 'true' : 'false');
  panel.querySelector('.scroll').scrollTop = 0;
}

export function openSwingReader() {
  if (sr.open || state.mode !== 'swing') return;
  const keep = sr.list[sr.i] && sr.list[sr.i].id;
  sr.list = ordered(); sr.i = Math.max(0, sr.list.findIndex(p => p.id === keep));
  sr.open = true; render(); openPanel(panel);
  document.body.classList.add('sr-open'); $('#sw-read').setAttribute('aria-pressed', 'true');
}
export function closeSwingReader() {
  if (!sr.open) return;
  sr.open = false; closePanel(panel);
  document.body.classList.remove('sr-open'); $('#sw-read').setAttribute('aria-pressed', 'false');
}
export const toggleSwingReader = () => sr.open ? closeSwingReader() : openSwingReader();
// side -1 is the left button (Earlier / Nearer), +1 the right (Later / Farther)
export function stepSwingReader(side) {
  if (!sr.open) return;
  const i = sr.i + side * (sr.order === 'near' ? 1 : -1); if (i < 0 || i >= sr.list.length) return;
  sr.i = i; render();
}

// buttons act on click but never keep focus, so Space and the arrows stay with the swing
panel.addEventListener('pointerup', e => { if (e.target.closest('button')) requestAnimationFrame(() => e.target.closest('button').blur()); });
$('#sr-close').onclick = () => closeSwingReader();
$('#sr-prev').onclick = () => stepSwingReader(-1);
$('#sr-next').onclick = () => stepSwingReader(1);
panel.querySelectorAll('[data-o]').forEach(b => { b.onclick = () => { if (sr.order === b.dataset.o) return; sr.order = b.dataset.o; sr.list = ordered(); sr.i = 0; render(); }; });
$('#sr-auto').onclick = () => { late.toggleKeepSwinging(); render(); };
