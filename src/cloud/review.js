import { $ } from '../core/util.js';
import { Cloud, isModerator, reviewNote, reviewQueue } from './cloud.ts';
import { closePanel, openPanel } from '../ui/reading.js';
import { toast } from '../ui/helpers.js';
import { late } from '../core/late.js';

/* ================= reports to review (moderators only) ================= */
// People listed in public.moderators see "Review reports" in the ⋯ menu: every reported note, most-reported first,
// with its reasons, where it was left and by whom; "Keep it hidden" or "Show it again" settles it.
const panel = $('#review'), list = $('#rv-list'), row = $('#m-review');
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let asked = null;
setInterval(async () => { const id = Cloud.user && Cloud.user.id; if (id === asked) return; asked = id; row.hidden = !(id && await isModerator()); }, 2000);
async function open() {
  late.closePops && late.closePops();
  list.innerHTML = '<p>Gathering reports…</p>'; openPanel(panel);
  const items = await reviewQueue().catch(() => null); list.innerHTML = '';
  if (!items) { list.innerHTML = '<p>The queue could not be reached just now.</p>'; return; }
  if (!items.length) { list.innerHTML = '<p>Nothing to review. All is kind.</p>'; return; }
  items.forEach(it => {
    const d = document.createElement('div'); d.className = 'rv-item';
    d.innerHTML = `<blockquote>${esc(it.text)}</blockquote><p class="rv-m">${esc(it.author_name)} on <i>${esc(it.poem_title)}</i> in ${esc(it.poet_name)}’s garden · reported ${it.reports} time${it.reports === 1 ? '' : 's'}${it.reasons.length ? ': ' + it.reasons.map(esc).join('; ') : ''}${it.hidden ? ' · hidden now' : ''}</p>`;
    const acts = document.createElement('div'); acts.className = 'rv-acts';
    for (const [label, hide] of [['Keep it hidden', true], ['Show it again', false]]) { const b = document.createElement('button'); b.className = 'g-link'; b.textContent = label; b.onclick = async () => { if (await reviewNote(it.note_id, hide)) { d.remove(); toast(hide ? 'Hidden for good.' : 'It shows again.'); if (!list.children.length) list.innerHTML = '<p>Nothing left to review.</p>'; } }; acts.append(b); }
    d.append(acts); list.append(d);
  });
}
row.onclick = open;
$('#rv-close').onclick = () => closePanel(panel);
