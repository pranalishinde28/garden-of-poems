import { $ } from '../core/util.js';
import { state } from '../core/state.js';
import { poems } from '../settings/storage.js';
import { toast } from './helpers.js';
import { closePanel, openPanel } from './reading.js';
import { Cloud, listAnswers, plantAnswer, promptDays, reportAnswer, takeBackAnswer } from '../cloud/cloud.ts';
import { fillGrove, groveDayNow } from '../world/promptGrove.js';
import { dayWords, promptFor, todayKey } from './prompts.js';
import { late, provide } from '../core/late.js';

provide({ get shareAnswer() { return shareAnswer; }, get loadGroveDay() { return loadGroveDay; }, get readGrove() { return readGrove; }, get openGroveDays() { return openGroveDays; } });

/* ================= the Prompt Garden's answers: planting, reading, the earlier days ================= */
// An answer to today's prompt grows in your own garden as ever; with an account it may also be planted in the
// shared grove (prompt_answers, a copy of the poem chosen per poem). Without an account (or before the live
// database has the grove) the grove shows this device's own answers. Readers may report an answer; a poet may
// take one of theirs back.

const nameOf = () => (Cloud.profile && (Cloud.profile.display_name || Cloud.profile.username)) || 'A poet';
async function shareAnswer(p) {
  if (!Cloud.user) { toast('It grows in your garden. Sign in to plant a copy in the shared Prompt Garden.', 4200); return; }
  try {
    await plantAnswer({ day: p.prompt, poem_id: p.id, title: p.title, body: p.content, mood: p.mood || 'reflection', by_name: nameOf() });
    setTimeout(() => toast('Planted in today’s Prompt Garden too. Walk through the moon gate to see it among the others.', 4800), 5200);
  } catch (e) { toast(e.message || 'The shared grove could not be reached just now.', 4200); }
}

let shown = [];
async function loadGroveDay(day) {
  let list = [];
  const rows = await listAnswers(day).catch(() => null);
  if (rows) list = rows.map(r => ({ key: `${r.day}/${r.owner}/${r.poem_id}`, day: r.day, owner: r.owner, poem_id: r.poem_id, title: r.title, body: r.body, mood: r.mood, by: r.by_name || 'A poet' }));
  // this device's own answers to that day's prompt that are not in the shared grove (no account, or kept back)
  const mine = poems.filter(p => p.prompt === day && !list.some(a => a.poem_id === p.id && a.owner === (Cloud.user && Cloud.user.id)));
  mine.forEach(p => list.push({ key: `${day}/me/${p.id}`, day, owner: null, poem_id: p.id, title: p.title, body: p.content, mood: p.mood, by: 'You', local: true }));
  shown = list; fillGrove(day, list);
  if (state.world === 'grove' && !list.length) toast(day === todayKey() ? 'No answers yet today. Yours could be the first tree here: the stele will take you to the bench.' : 'Nobody answered that day’s prompt.', 4600);
}

function readGrove(i) {
  const L = shown.map(a => [a.title, a.by, dayWords(a.day), a.body]);
  late.readPoems && late.readPoems(L, i, at => {
    const a = shown[at], mineInGrove = a && !a.local && Cloud.user && a.owner === Cloud.user.id;
    $('#wp-takeback').hidden = !mineInGrove; $('#wp-report').hidden = !a || a.local || !Cloud.user || mineInGrove;
    $('#wp-takeback').onclick = async () => { if (await takeBackAnswer(a.day, a.poem_id)) { toast('Taken back. It still grows in your own garden.'); closePanel($('#wallpoem')); loadGroveDay(a.day); } };
    $('#wp-report').onclick = async () => { try { await reportAnswer(a.day, a.owner, a.poem_id); toast('Thank you. It will be looked at.'); } catch (e) { toast(e.message); } };
  });
}

// the earlier days: today first, then every day with answers (from the grove, or this device's own)
const panel = $('#grovedays');
async function openGroveDays() {
  if (state.mode !== 'walk') return;
  const today = todayKey(), counts = new Map([[today, 0]]);
  const days = await promptDays(90).catch(() => null);
  (days || []).forEach(d => counts.set(d.day, d.answers));
  poems.forEach(p => { if (p.prompt && !counts.has(p.prompt)) counts.set(p.prompt, 1); });
  const list = $('#gd-list'); list.innerHTML = '';
  [...counts.keys()].sort().reverse().forEach(day => {
    const li = document.createElement('li'), b = document.createElement('button'), n = counts.get(day);
    b.innerHTML = `<b>${day === today ? 'Today' : dayWords(day)}</b><i>${promptFor(day)}</i><small>${n ? (n === 1 ? 'one answer' : n + ' answers') : 'no answers yet'}${day === groveDayNow() ? ' · you are here' : ''}</small>`;
    b.onclick = () => { closePanel(panel); loadGroveDay(day); };
    li.append(b); list.append(li);
  });
  openPanel(panel);
}
$('#gd-close').onclick = () => closePanel(panel);
