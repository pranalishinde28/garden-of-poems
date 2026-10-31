import { $ } from '../core/util.js';
import { closePanel, openPanel } from './reading.js';
import { toast } from './helpers.js';
import { Cloud, NEEDS_UPDATE, myWishes, setWish } from '../cloud/cloud.ts';
import { late, provide } from '../core/late.js';

provide({ get openPatron() { return openPatron; } });

/* ================= become a patron of the garden ================= */
// Patronage is not open yet: this keeps a list of the people who would like to hear when it is.
const panel = $('#patron'), st = $('#pt-state'), go = $('#pt-go'), undo = $('#pt-undo');
async function render() {
  go.hidden = false; undo.hidden = true; go.disabled = false; st.textContent = '';
  if (!Cloud.ready) { st.textContent = 'Accounts are not connected here yet, so names cannot be kept.'; go.disabled = true; return; }
  if (!Cloud.user) { go.textContent = 'Sign in to leave your name'; go.onclick = () => { closePanel(panel); late.openGardens && late.openGardens(); }; return; }
  go.textContent = 'Count me in';
  const w = await myWishes();
  if (w === null) { st.textContent = NEEDS_UPDATE; go.disabled = true; return; }
  if (w.has('patron')) { st.textContent = 'You are on the list. Thank you for wanting the garden to grow.'; go.hidden = true; undo.hidden = false; }
  go.onclick = async () => { go.disabled = true; if (await setWish('patron', true)) { toast('Your name is on the list. Thank you.'); render(); } else { go.disabled = false; toast('That did not work. Try again.'); } };
}
undo.onclick = async () => { undo.disabled = true; if (await setWish('patron', false)) toast('Your name is off the list.'); undo.disabled = false; render(); };
function openPatron() { late.closePops && late.closePops(); openPanel(panel); render(); }
$('#pt-close').onclick = () => closePanel(panel);
$('#m-patron').onclick = () => openPatron();
