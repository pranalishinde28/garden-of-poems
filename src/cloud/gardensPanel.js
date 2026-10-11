import { $, siteURL } from '../core/util.js';
import { toast } from '../ui/helpers.js';
import { closePanel, openPanel } from '../ui/reading.js';
import { Cloud, ownPoems, saveGardenSettings, syncNow } from './cloud.js';
import { late, provide } from '../core/late.js';

// names other modules reach through late (see core/late.js)
provide({
  get renderAccount() { return renderAccount; },
  get openGardens() { return openGardens; },
});

/* ---------- the Gardens panel: account, your garden, visiting ---------- */
const gardensPanel = $('#gardens');
export const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
function renderAccount() {
  const box = $('#g-account'); box.innerHTML = '';
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
    const f = el('form', 'g-form'); f.noValidate = true;
    const field = (label, type, name, ac) => { const l = el('label', 'f', label); const i = el('input'); i.type = type; i.name = name; i.autocomplete = ac; l.htmlFor = i.id = 'ga-' + name; f.append(l, i); return i; };
    const disp = mode === 'up' ? field('Your name, as other poets will see it', 'text', 'display', 'nickname') : null;
    const user = mode === 'up' ? field('Username for your garden link (a-z, 0-9, _)', 'text', 'username', 'username') : null;
    const email = field('Email', 'email', 'email', 'email');
    const pass = field('Password', 'password', 'password', mode === 'up' ? 'new-password' : 'current-password');
    const err = el('p', 'g-err'); err.setAttribute('role', 'alert');
    const submit = el('button', 'g-btn', mode === 'up' ? 'Create account' : 'Sign in'); submit.type = 'submit';
    f.append(err, submit);
    f.onsubmit = async ev => {
      ev.preventDefault(); err.textContent = '';
      const em = email.value.trim(), pw = pass.value;
      if (!/^\S+@\S+\.\S+$/.test(em)) { err.textContent = 'Enter a valid email address.'; return; }
      if (pw.length < 8) { err.textContent = 'Use a password of at least 8 characters.'; return; }
      submit.disabled = true;
      try {
        if (mode === 'up') {
          const un = user.value.trim().toLowerCase();
          if (!/^[a-z0-9_]{3,24}$/.test(un)) throw new Error('Usernames are 3 to 24 characters: lowercase letters, numbers and _.');
          const { data: taken } = await Cloud.sb.from('profiles').select('id').eq('username', un).maybeSingle();
          if (taken) throw new Error('That username is taken. Try another.');
          const { data, error } = await Cloud.sb.auth.signUp({ email: em, password: pw, options: { data: { username: un, display_name: disp.value.trim().slice(0, 60) }, emailRedirectTo: siteURL() } });
          if (error) throw error;
          if (!data.session) { box.innerHTML = ''; box.append(el('h3', '', 'Check your email'), el('p', '', `We sent a confirmation link to ${em}. Open it on this device to finish creating your account.`)); return; }
        } else {
          const { error } = await Cloud.sb.auth.signInWithPassword({ email: em, password: pw });
          if (error) throw error;
        }
      } catch (e2) { err.textContent = e2.message || 'Something went wrong. Try again.'; }
      submit.disabled = false;
    };
    box.append(f);
    const sw = el('button', 'g-link', mode === 'up' ? 'I already have an account' : 'Create an account');
    sw.onclick = () => { box.dataset.mode = mode === 'up' ? 'in' : 'up'; renderAccount(); };
    box.append(sw);
    if (mode === 'in') {
      const fg = el('button', 'g-link', 'Forgot your password?');
      fg.onclick = async () => { const em = email.value.trim(); if (!/^\S+@\S+\.\S+$/.test(em)) { err.textContent = 'Type your email above first.'; return; } const { error } = await Cloud.sb.auth.resetPasswordForEmail(em, { redirectTo: siteURL() }); err.textContent = error ? error.message : 'If that email has an account, a reset link is on its way.'; };
      box.append(fg);
    }
    return;
  }
  const p = Cloud.profile || {}, g = Cloud.garden || {};
  const who = el('div', 'g-who');
  who.append(el('div', 'g-n', p.display_name || 'Poet'), el('div', 'g-m', p.username ? '@' + p.username : Cloud.user.email));
  const out = el('button', 'g-link', 'Sign out'); out.onclick = async () => { await syncNow(); await Cloud.sb.auth.signOut(); };
  box.append(who, out);
  $('#g-mine').hidden = false;
  $('#g-status').textContent = g.is_public ? 'Your garden is public. Anyone can walk through it and read the poems you have not kept private.' : 'Your garden is private. Only you can see it.';
  $('#g-toggle').textContent = g.is_public ? 'Make my garden private' : 'Make my garden public';
  $('#g-copy').hidden = !(g.is_public && p.username);
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
async function loadGardens() {
  const list = $('#g-list'), empty = $('#g-empty');
  list.innerHTML = ''; empty.hidden = false;
  if (!Cloud.ready) return;
  empty.textContent = 'Looking for gardens…';
  const { data, error } = await Cloud.sb.from('public_gardens').select('*').order('updated_at', { ascending: false }).limit(60);
  if (error) { empty.textContent = 'The gardens could not be loaded just now.'; return; }
  const rows = (data || []).filter(g => (!Cloud.user || g.owner !== Cloud.user.id) && g.poem_count > 0);
  if (!rows.length) { empty.textContent = 'No public gardens yet. When other poets open their gardens, they will appear here.'; return; }
  empty.hidden = true;
  rows.forEach(g => {
    const row = el('div', 'g-row'), t = el('div', 'g-t');
    t.append(el('div', 'g-n', g.name || 'A quiet garden'), el('div', 'g-m', `${g.display_name || 'A poet'}${g.username ? ' (@' + g.username + ')' : ''}, ${g.poem_count} poem${g.poem_count === 1 ? '' : 's'}`));
    if (g.description) t.append(el('div', 'g-d', g.description));
    const b = el('button', '', 'Visit'); b.onclick = () => late.visitGarden(g);
    row.append(t, b); list.appendChild(row);
  });
}
function openGardens() { late.closePops(); renderAccount(); openPanel(gardensPanel); loadGardens(); }
export function closeGardens() { closePanel(gardensPanel); }
$('#h-gardens').onclick = () => gardensPanel.classList.contains('open') ? closeGardens() : openGardens();
$('#g-close').onclick = closeGardens;
$('#intro-account').onclick = () => { late.enterGarden(false); setTimeout(openGardens, 600); };

