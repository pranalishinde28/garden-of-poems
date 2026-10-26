import { $, siteURL } from '../core/util.js';
import { toast } from '../ui/helpers.js';
import { closePanel, openPanel } from '../ui/reading.js';
import { Cloud, NEEDS_UPDATE, db, changeUsername, deleteAccount, exportGarden, listGardens, ownPoems, removedPoems, restoreRemoved, saveGardenSettings, suggestedGardens, syncNow, usernameAvailable } from './cloud.ts';
import { state } from '../core/state.js';
import { captchaOn, mountCaptcha, resetCaptcha } from './captcha.js';
import { late, provide } from '../core/late.js';

// names other modules reach through late (see core/late.js)
provide({
  get renderAccount() { return renderAccount; },
  get openGardens() { return openGardens; },
});

/* ---------- the Gardens panel: account, your garden, visiting ---------- */
const gardensPanel = $('#gardens');
export const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
// signing out, from the Gardens panel or the ⋯ menu: save anything waiting first
async function signOut() { await syncNow(); await Cloud.sb.auth.signOut(); late.closePops && late.closePops(); toast('You have signed out. Your poems are safe in your account.'); }
$('#m-signout').onclick = signOut;
function renderAccount() {
  const box = $('#g-account'); box.innerHTML = '';
  { const on = !!(Cloud.ready && Cloud.user); $('#m-signout').hidden = !on; $('#m-acct-h').hidden = !on; if (on) $('#m-signout-who').textContent = 'signed in as ' + ((Cloud.profile && Cloud.profile.username) ? '@' + Cloud.profile.username : Cloud.user.email); }
  if (!Cloud.ready) {
    box.append(el('p', '', 'Accounts are not connected yet. Your garden is saved on this device only. To turn on sign-in and public gardens, add your Supabase keys to the .env file.'));
    $('#g-mine').hidden = true; $('#g-visit').hidden = true; return;
  }
  $('#g-visit').hidden = false;
  if (Cloud.recovering) {
    box.append(el('h3', '', 'Choose a new password'));
    const pw = el('input'); pw.type = 'password'; pw.placeholder = 'New password (at least 8 characters)'; pw.autocomplete = 'new-password';
    const go = el('button', 'g-btn', 'Save new password');
    go.onclick = async () => { if (pw.value.length < 8) { toast('Use at least 8 characters.'); return; } const { error } = await Cloud.sb.auth.updateUser({ password: pw.value }); if (error) toast(error.message); else { Cloud.recovering = false; toast('Your password was changed.'); renderAccount(); } };
    box.append(pw, go); $('#g-mine').hidden = true; return;
  }
  if (!Cloud.user) {
    $('#g-mine').hidden = true;
    const mode = box.dataset.mode || 'in';
    box.append(el('h3', '', mode === 'up' ? 'Create your account' : 'Sign in'));
    box.append(el('p', '', mode === 'up' ? 'Your garden will follow you to any device. It stays private until you choose to open it.' : 'Sign in to keep your garden in your account and visit other people\u2019s gardens.'));
    // one tap with Google or GitHub; the email form below for everyone else
    const oauth = el('div', 'g-oauth');
    [['google', 'Continue with Google', '<svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.2-2.7l-3.5-2.7c-1 .7-2.2 1-3.7 1-2.8 0-5.2-1.9-6.1-4.5H2.3v2.8A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.9 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.3a11 11 0 0 0 0 9.8z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.1 1.6l3.1-3.1A11 11 0 0 0 2.3 7.1l3.6 2.8C6.8 7.3 9.2 5.4 12 5.4z"/></svg>'],
     ['github', 'Continue with GitHub', '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 1.5a10.5 10.5 0 0 0-3.3 20.5c.5.1.7-.2.7-.5v-1.8c-2.9.6-3.5-1.4-3.5-1.4-.5-1.2-1.2-1.5-1.2-1.5-.9-.6.1-.6.1-.6 1 .1 1.6 1.1 1.6 1.1.9 1.6 2.5 1.1 3 .8.1-.7.4-1.1.7-1.4-2.3-.3-4.8-1.2-4.8-5.2 0-1.1.4-2.1 1.1-2.8-.1-.3-.5-1.4.1-2.8 0 0 .9-.3 2.9 1.1a10 10 0 0 1 5.3 0c2-1.4 2.9-1.1 2.9-1.1.6 1.4.2 2.5.1 2.8.7.7 1.1 1.7 1.1 2.8 0 4-2.5 4.9-4.8 5.2.4.3.7 1 .7 2v3c0 .3.2.6.7.5A10.5 10.5 0 0 0 12 1.5z"/></svg>']].forEach(([prov, text, icon]) => {
      const b = el('button', 'g-oauth-btn'); b.type = 'button'; b.innerHTML = icon + '<span></span>'; b.querySelector('span').textContent = text;
      b.onclick = async () => {
        b.disabled = true;
        const { error } = await Cloud.sb.auth.signInWithOAuth({ provider: prov, options: { redirectTo: siteURL() } });
        if (error) { b.disabled = false; toast(/not enabled|unsupported provider/i.test(error.message) ? `Signing in with ${prov === 'google' ? 'Google' : 'GitHub'} isn't switched on for this garden yet. Use your email for now.` : error.message, 6000); }
      };
      oauth.append(b);
    });
    box.append(oauth, el('p', 'g-or', 'or with your email'));
    const f = el('form', 'g-form'); f.noValidate = true;
    const field = (label, type, name, ac) => { const l = el('label', 'f', label); const i = el('input'); i.type = type; i.name = name; i.autocomplete = ac; l.htmlFor = i.id = 'ga-' + name; f.append(l, i); return i; };
    const disp = mode === 'up' ? field('Your name, as other poets will see it', 'text', 'display', 'nickname') : null;
    const user = mode === 'up' ? field('Username for your garden link (a-z, 0-9, _)', 'text', 'username', 'username') : null;
    const email = field('Email', 'email', 'email', 'email');
    const pass = field('Password', 'password', 'password', mode === 'up' ? 'new-password' : 'current-password');
    const cap = el('div', 'g-captcha'), captcha = mountCaptcha(cap); if (captchaOn()) f.append(cap);
    const err = el('p', 'g-err'); err.setAttribute('role', 'alert');
    const submit = el('button', 'g-btn', mode === 'up' ? 'Create account' : 'Sign in'); submit.type = 'submit';
    f.append(err, submit);
    f.onsubmit = async ev => {
      ev.preventDefault(); err.textContent = '';
      const em = email.value.trim(), pw = pass.value;
      if (!/^\S+@\S+\.\S+$/.test(em)) { err.textContent = 'Enter a valid email address.'; return; }
      if (pw.length < 8) { err.textContent = 'Use a password of at least 8 characters.'; return; }
      const captchaToken = captcha(); if (captchaOn() && !captchaToken) { err.textContent = 'Tick the box to show you are a person, then try again.'; return; }
      submit.disabled = true;
      try {
        if (mode === 'up') {
          const un = user.value.trim().toLowerCase();
          if (!/^[a-z0-9_]{3,24}$/.test(un)) throw new Error('Usernames are 3 to 24 characters: lowercase letters, numbers and _.');
          if (!(await usernameAvailable(un))) throw new Error('That username is taken. Try another.');
          const { data, error } = await Cloud.sb.auth.signUp({ email: em, password: pw, options: { data: { username: un, display_name: disp.value.trim().slice(0, 60) }, emailRedirectTo: siteURL(), captchaToken } });
          if (error) throw error;
          if (!data.session) { box.innerHTML = ''; box.append(el('h3', '', 'Check your email'), el('p', '', `We sent a confirmation link to ${em}. Open it on this device to finish creating your account.`)); return; }
        } else {
          const { error } = await Cloud.sb.auth.signInWithPassword({ email: em, password: pw, options: { captchaToken } });
          if (error) throw error;
        }
      } catch (e2) { err.textContent = /captcha/i.test(e2.message || '') ? 'The check that you are human expired. Tick the box again.' : (e2.message || 'Something went wrong. Try again.'); resetCaptcha(); }
      submit.disabled = false;
    };
    box.append(f);
    const sw = el('button', 'g-link', mode === 'up' ? 'I already have an account' : 'Create an account');
    sw.onclick = () => { box.dataset.mode = mode === 'up' ? 'in' : 'up'; renderAccount(); };
    box.append(sw);
    if (mode === 'in') {
      const fg = el('button', 'g-link', 'Forgot your password?');
      fg.onclick = async () => { const em = email.value.trim(); if (!/^\S+@\S+\.\S+$/.test(em)) { err.textContent = 'Type your email above first.'; return; } const captchaToken = captcha(); if (captchaOn() && !captchaToken) { err.textContent = 'Tick the box to show you are a person first.'; return; } const { error } = await Cloud.sb.auth.resetPasswordForEmail(em, { redirectTo: siteURL(), captchaToken }); resetCaptcha(); err.textContent = error ? error.message : 'If that email has an account, a reset link is on its way.'; };
      box.append(fg);
    }
    return;
  }
  const p = Cloud.profile || {}, g = Cloud.garden || {};
  const who = el('div', 'g-who');
  who.append(el('div', 'g-n', p.display_name || 'Poet'), el('div', 'g-m', p.username ? '@' + p.username : Cloud.user.email));
  const out = el('button', 'g-btn', 'Sign out'); out.onclick = signOut;
  box.append(who, out);
  $('#g-mine').hidden = false;
  $('#g-status').textContent = g.is_public ? 'Your garden is public. Anyone can walk through it and read the poems you have not kept private.' : 'Your garden is private. Only you can see it.';
  $('#g-toggle').textContent = g.is_public ? 'Make my garden private' : 'Make my garden public';
  $('#g-copy').hidden = !(g.is_public && p.username);
  renderRemoved(); renderAcct();
}

// ---- recently removed: bring a poem back within 30 days ----
async function renderRemoved() {
  const box = $('#g-removed'); box.textContent = 'Looking…';
  const rows = await removedPoems(); box.innerHTML = '';
  if (!rows.length) { box.append(el('p', 'g-m', db.legacy ? NEEDS_UPDATE : 'Nothing here.')); return; }
  rows.forEach(r => {
    const days = Math.max(0, 30 - Math.floor((Date.now() - new Date(r.deleted_at)) / 864e5));
    const row = el('div', 'g-row'), t = el('div', 'g-t'); t.append(el('div', 'g-n', r.title), el('div', 'g-m', `${days} day${days === 1 ? '' : 's'} left`));
    const b = el('button', '', 'Bring it back'); b.onclick = async () => { b.disabled = true; if (await restoreRemoved(r)) row.remove(); else b.disabled = false; };
    row.append(t, b); box.append(row);
  });
}
// ---- your account: username, export, delete ----
function renderAcct() {
  const box = $('#g-acct'); box.innerHTML = '';
  const l = el('label', 'f', 'Username, for your garden link'), i = el('input'); i.type = 'text'; i.id = 'g-username'; l.htmlFor = i.id; i.value = (Cloud.profile && Cloud.profile.username) || ''; i.autocomplete = 'username';
  const msg = el('p', 'g-m'); msg.setAttribute('role', 'status'); const save = el('button', 'g-btn', 'Change username'); save.disabled = true;
  let t = 0;
  i.oninput = () => {
    const v = i.value.trim().toLowerCase(); save.disabled = true; clearTimeout(t);
    if (v === (Cloud.profile && Cloud.profile.username)) { msg.textContent = ''; return; }
    if (!/^[a-z0-9_]{3,24}$/.test(v)) { msg.textContent = '3 to 24 characters: lowercase letters, numbers and _.'; return; }
    msg.textContent = 'Checking…'; t = setTimeout(async () => { const ok = await usernameAvailable(v); if (i.value.trim().toLowerCase() !== v) return; msg.textContent = ok ? 'That one is free.' : 'That username is taken.'; save.disabled = !ok; }, 350);
  };
  save.onclick = async () => { save.disabled = true; try { const n = await changeUsername(i.value); msg.textContent = `Your garden link now uses @${n}.`; renderAccount(); } catch (e) { msg.textContent = e.message; } };
  const ex = el('div', 'g-ex'); const j = el('button', 'g-link', 'Download my garden (JSON)'), m = el('button', 'g-link', 'Download my poems (Markdown)');
  j.onclick = () => exportGarden('json'); m.onclick = () => exportGarden('md'); ex.append(j, m);
  const del = el('button', 'g-link danger', 'Delete my account');
  del.onclick = () => {
    const c = el('div', 'g-confirm'), name = (Cloud.profile && Cloud.profile.username) || '';
    c.append(el('p', '', `This removes your garden, every poem and every note, for good. Type ${name} to confirm.`));
    const ci = el('input'); ci.type = 'text'; ci.setAttribute('aria-label', 'Type your username to confirm'); const go = el('button', 'g-btn danger', 'Delete everything'); go.disabled = true;
    ci.oninput = () => { go.disabled = ci.value.trim().toLowerCase() !== name; };
    go.onclick = async () => { go.disabled = true; try { await deleteAccount(); closeGardens(); toast('Your account and garden are gone. Thank you for the poems.', 6000); } catch (e) { toast(e.message || 'That did not work. Try again.'); go.disabled = false; } };
    c.append(ci, go); del.replaceWith(c); ci.focus();
  };
  box.append(l, i, msg, save, ex, del);
}
$('#g-custom').onclick = () => { closeGardens(); late.openCustomize(); };
$('#g-toggle').onclick = async () => {
  const pub = !(Cloud.garden && Cloud.garden.is_public);
  if (pub && !ownPoems().some(p => !p.private)) { toast('Write a poem first, or plant the sample poems, so visitors have something to read.'); return; }
  await syncNow();
  if (await saveGardenSettings({ is_public: pub })) toast(pub ? 'Your garden is open to visitors now.' : 'Your garden is private again.');
  renderAccount();
};
$('#g-copy').onclick = async () => {
  const url = siteURL() + '?garden=' + encodeURIComponent(Cloud.profile.username);
  try { await navigator.clipboard.writeText(url); toast('The link to your garden is copied.'); } catch (e) { prompt('Copy the link to your garden:', url); }
};
let lastGarden = null, gq = '';
async function loadGardens(more) {
  const list = $('#g-list'), empty = $('#g-empty'), moreBtn = $('#g-morelist');
  if (!more) { list.innerHTML = ''; lastGarden = null; }
  empty.hidden = false; moreBtn.hidden = true;
  if (!Cloud.ready) return;
  empty.textContent = 'Looking for gardens…';
  let data;
  try { data = await listGardens(gq, lastGarden); } catch (e) { empty.textContent = 'The gardens could not be loaded just now.'; return; }
  if (data.length) lastGarden = data[data.length - 1];
  moreBtn.hidden = data.length < 12;
  const rows = data.filter(g => (!Cloud.user || g.owner !== Cloud.user.id) && g.poem_count > 0);
  if (!rows.length && !list.children.length) { empty.textContent = gq ? 'No gardens by that name yet.' : 'No public gardens yet. When other poets open their gardens, they will appear here.'; return; }
  empty.hidden = true;
  rows.forEach(g => {
    const row = el('div', 'g-row'), t = el('div', 'g-t');
    t.append(el('div', 'g-n', g.name || 'A quiet garden'), el('div', 'g-m', `${g.display_name || 'A poet'}${g.username ? ' (@' + g.username + ')' : ''}, ${g.poem_count} poem${g.poem_count === 1 ? '' : 's'}`));
    if (g.description) t.append(el('div', 'g-d', g.description));
    const b = el('button', '', 'Visit'); b.onclick = () => late.visitGarden(g);
    row.append(t, b); list.appendChild(row);
  });
}
// ---- suggested for you: loved, lately tended, and close to your own moods ----
async function loadSuggestions() {
  const box = $('#g-suggest'), list = $('#g-suggest-list');
  if (!Cloud.ready) { box.hidden = true; return; }
  let rows = [];
  try { rows = (await suggestedGardens()).filter(g => !state.visiting || g.owner !== state.visiting.owner); } catch (e) { rows = []; }
  list.innerHTML = ''; box.hidden = !rows.length; if (!rows.length) return;
  const cards = el('div', 'g-cards');
  rows.forEach(g => {
    const b = el('button', 'g-card');
    b.append(el('span', 'g-why', g.reason), el('span', 'g-n', g.name || 'A quiet garden'), el('span', 'g-m', `${g.display_name || 'A poet'} · ${g.poem_count} poem${g.poem_count === 1 ? '' : 's'}`));
    b.setAttribute('aria-label', `Visit ${g.name || 'a quiet garden'} by ${g.display_name || 'a poet'}: ${g.reason}`);
    b.onclick = () => late.visitGarden(g); cards.append(b);
  });
  list.append(cards);
}
// once a session, a while after you arrive, the best suggestion is offered quietly
export function offerSuggestion() {
  try { if (sessionStorage.getItem('garden-of-poems:offered')) return; sessionStorage.setItem('garden-of-poems:offered', '1'); } catch (e) { return; }
  // only into a quiet moment: walking, nothing open, no other message showing (it would replace an Undo)
  // signed in only: by then the page knows whether the database has suggested_gardens()
  const quiet = () => Cloud.ready && Cloud.user && !state.visiting && state.mode === 'walk' && !document.body.classList.contains('panel-open') && !$('#toast').classList.contains('show');
  let tries = 0;
  const offer = async () => {
    if (!quiet()) { if (++tries < 6) setTimeout(offer, 20000); return; }
    let g; try { g = (await suggestedGardens())[0]; } catch (e) { return; }
    if (!g || !quiet()) return;
    toast(`A garden you might like: “${g.name || 'A quiet garden'}”, by ${g.display_name || 'a poet'}.`, 9000, { label: 'Visit', run: () => late.visitGarden(g) });
  };
  setTimeout(offer, 45000);
}
function openGardens() { late.closePops(); renderAccount(); openPanel(gardensPanel); loadSuggestions(); loadGardens(); }
export function closeGardens() { closePanel(gardensPanel); }
$('#h-gardens').onclick = () => gardensPanel.classList.contains('open') ? closeGardens() : openGardens();
$('#g-close').onclick = closeGardens;
let searchT = 0;
$('#g-search').oninput = e => { clearTimeout(searchT); searchT = setTimeout(() => { gq = e.target.value.trim(); loadGardens(false); }, 300); };
$('#g-morelist').onclick = () => loadGardens(true);
$('#intro-account').onclick = () => { late.enterGarden(false); setTimeout(openGardens, 600); };

