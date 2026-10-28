import { $ } from '../core/util.js';
import { state } from '../core/state.js';
import { HALL_POEMS as P } from '../world/castleHall.js';
import { closePanel, openPanel } from './reading.js';
import { provide } from '../core/late.js';

/* ================= reading a poem from the walls of the Hall of Mirrors ================= */
// Walk up to a framed poem (or click it) and it opens here, large and easy to read. ← → go along the wall.
const panel = $('#wallpoem');
let at = 0;
function show(k) {
  at = (k + P.length) % P.length; const [title, poet, year, text] = P[at];
  $('#wp-title').textContent = title; $('#wp-poet').textContent = poet; $('#wp-year').textContent = year;
  $('#wp-text').textContent = text; $('#wp-count').textContent = `${at + 1} of ${P.length}`;
}
function readWallPoem(k) { if (state.mode !== 'walk') return; show(k); openPanel(panel); }
$('#wp-close').onclick = () => closePanel(panel);
$('#wp-prev').onclick = () => show(at - 1);
$('#wp-next').onclick = () => show(at + 1);
addEventListener('keydown', e => {
  if (panel.hidden || !panel.classList.contains('open')) return;
  if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') { e.preventDefault(); e.stopImmediatePropagation(); show(at + (e.code === 'ArrowLeft' ? -1 : 1)); }
}, true);
provide({ get readWallPoem() { return readWallPoem; } });
