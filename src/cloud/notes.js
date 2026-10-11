import { $ } from '../core/util.js';
import { poems } from '../settings/storage.js';
import { state } from '../core/state.js';
import { toast } from '../ui/helpers.js';
import { Cloud } from './cloud.ts';
import { el } from './gardensPanel.js';
import { late, provide } from '../core/late.js';

// names other modules reach through late (see core/late.js)
provide({
  get loadNotes() { return loadNotes; },
});

/* ---------- kind notes ---------- */
async function loadNotes(p, reflection) {
  const box = $('#r-notes'), list = $('#r-notes-list'), form = $('#r-note-form');
  box.hidden = true; list.innerHTML = '';
  if (!Cloud.ready || reflection) return;
  const visiting = !!state.visiting;
  if (!visiting && !(Cloud.user && Cloud.garden && Cloud.garden.is_public)) return;
  const owner = visiting ? state.visiting.owner : Cloud.user.id, poemId = visiting ? p._oid : String(p.id);
  box.hidden = false;
  form.hidden = !(visiting && Cloud.user);
  $('#r-notes-h').textContent = visiting ? 'Kind words left here' : 'Notes visitors left you';
  if (visiting && !Cloud.user) list.append(el('p', 'n-empty', 'Sign in to leave a note for the poet.'));
  const { data, error } = await Cloud.sb.from('notes').select('id,text,created_at,author,hidden,profiles(display_name,username)').eq('garden_owner', owner).eq('poem_id', poemId).order('created_at').limit(100);
  if (state.reading !== p.id) return;
  if (error) { list.append(el('p', 'n-empty', 'Notes could not be loaded just now.')); return; }
  if (!data.length) { list.append(el('p', 'n-empty', visiting ? 'No notes yet. Be the first to leave one.' : 'No notes on this poem yet.')); return; }
  data.forEach(n => {
    const row = el('div', 'n-row' + (n.hidden ? ' is-hidden' : ''));
    row.append(el('div', 'n-t', n.text), el('div', 'n-w', `${(n.profiles && n.profiles.display_name) || 'A visitor'}, ${new Date(n.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })}${n.hidden ? ' · hidden from visitors' : ''}`));
    const acts = el('div', 'n-acts');
    if (Cloud.user && owner === Cloud.user.id) { // the poet: hide without deleting, or remove
      const hide = el('button', 'g-link', n.hidden ? 'Show to visitors' : 'Hide from visitors');
      hide.onclick = async () => { const { error: e2 } = await Cloud.sb.from('notes').update({ hidden: !n.hidden }).eq('id', n.id); if (e2) toast('That did not work just now.'); else loadNotes(p, false); };
      acts.append(hide);
    }
    if (Cloud.user && (n.author === Cloud.user.id || owner === Cloud.user.id)) {
      const del = el('button', 'g-link', 'Remove'); del.onclick = async () => { const { error: e2 } = await Cloud.sb.from('notes').delete().eq('id', n.id); if (!e2) loadNotes(p, false); };
      acts.append(del);
    }
    if (Cloud.user && n.author !== Cloud.user.id && owner !== Cloud.user.id) { // a visitor can report an unkind note
      const rep = el('button', 'g-link', 'Report');
      rep.onclick = async () => { rep.disabled = true; const { error: e2 } = await Cloud.sb.from('note_reports').insert({ note_id: n.id }); rep.textContent = e2 ? (e2.code === '23505' ? 'Reported' : 'Could not report') : 'Reported. Thank you.'; };
      acts.append(rep);
    }
    if (acts.children.length) row.append(acts);
    list.appendChild(row);
  });
}
$('#r-note-send').onclick = async () => {
  const ta = $('#r-note'), text = ta.value.trim().slice(0, 280);
  if (!text || !state.visiting || !Cloud.user) return;
  const p = poems.find(q => q.id === state.reading); if (!p) return;
  $('#r-note-send').disabled = true;
  const { error } = await Cloud.sb.from('notes').insert({ garden_owner: state.visiting.owner, poem_id: p._oid, text });
  if (error) toast(error.code === 'P0001' ? error.message : 'Your note could not be left just now.', 6000); else { ta.value = ''; toast('Your note was left beside the poem.'); loadNotes(p, false); }
  $('#r-note-send').disabled = false;
};

