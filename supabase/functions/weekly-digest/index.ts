// The weekly letter. Run once a day by pg_cron (see docs/email.md); each run writes to the poets due a letter
// (none in the last six days), and only to those with something new: hearts, notes, visitors, new tenders, or new
// poems in gardens they tend. Everyone it looks at is marked, so the next run moves on.
//
// Environment (supabase secrets set …):
//   DIGEST_SECRET   required; callers send "Authorization: Bearer <DIGEST_SECRET>"
//   MAIL_FROM       "The Garden of Poems <you@example.com>", an address the mail service has verified
//   BREVO_API_KEY | RESEND_API_KEY | MAILPIT_URL   the first one set is used (Mailpit is the local mail catcher)
//   SITE_URL        the garden's address, default https://pranalishinde28.github.io/garden-of-poems/
//   MAX_SENDS       letters per run, default 250 (Brevo's free plan sends 300 a day)
// Query: ?dry=1 returns the letters instead of sending them; ?only=<email> writes to that one address now (a test,
// which is not marked as sent).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

type Letter = {
  hearts: number; loved: { title: string; n: number }[];
  notes: number; said: { title: string; name: string; text: string }[];
  visitors: number; tenders: number;
  tended: { name: string; poet: string; username: string | null; n: number; titles: string[] }[];
};
type Row = { user_id: string; email: string; name: string; username: string | null; token: string; since: string; letter: Letter };

const env = (k: string, d = '') => Deno.env.get(k) ?? d;
const SITE = env('SITE_URL', 'https://pranalishinde28.github.io/garden-of-poems/').replace(/\/?$/, '/');
const esc = (t: unknown) => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const gardenURL = (u: string | null) => (u ? SITE + encodeURIComponent(u) : SITE);
const hasNews = (l: Letter) => l.hearts > 0 || l.notes > 0 || l.visitors > 0 || l.tenders > 0 || l.tended.length > 0;

function subject(l: Letter) {
  const bits = [];
  if (l.notes) bits.push(plural(l.notes, 'note', 'notes'));
  if (l.hearts) bits.push(plural(l.hearts, 'heart', 'hearts'));
  if (bits.length) return `Your week in the garden: ${bits.join(' and ')}`;
  if (l.tended.length) return `New poems in ${l.tended[0].name}`;
  return 'Your week in the garden';
}

// the letter: aged paper, a serif, short lines; every part links back into the garden
function write(r: Row) {
  const l = r.letter, home = gardenURL(r.username), stop = `${SITE}?unsubscribe=${r.token}`;
  const P = (h: string) => `<p style="margin:0 0 14px;font-size:18px;line-height:1.55;color:#2e2014">${h}</p>`;
  const H = (h: string) => `<h2 style="margin:26px 0 10px;font:italic 600 21px Georgia,'Times New Roman',serif;color:#5a3a1c">${h}</h2>`;
  const parts: string[] = [], text: string[] = [];
  if (l.hearts) {
    parts.push(H(`${plural(l.hearts, 'heart', 'hearts')} on your poems`));
    parts.push(P(l.loved.map(p => `<i>${esc(p.title)}</i>${p.n > 1 ? ` (${p.n})` : ''}`).join(', ')));
    text.push(`${plural(l.hearts, 'heart', 'hearts')} on your poems: ${l.loved.map(p => p.title).join(', ')}`);
  }
  if (l.notes) {
    parts.push(H(l.notes === 1 ? 'A note was left for you' : `${l.notes} notes were left for you`));
    l.said.forEach(n => {
      parts.push(`<blockquote style="margin:0 0 14px;padding:10px 16px;border-left:3px solid #c39a5a;background:#efe0bf;font-size:17px;line-height:1.5;color:#3a2614">“${esc(n.text)}”<br><span style="font-size:15px;color:#6b5236">${esc(n.name)}, on <i>${esc(n.title)}</i></span></blockquote>`);
      text.push(`${n.name} on ${n.title}: “${n.text}”`);
    });
    if (l.notes > l.said.length) parts.push(P(`and ${plural(l.notes - l.said.length, 'more', 'more')} in your garden.`));
  }
  const walked = [];
  if (l.visitors) walked.push(l.visitors === 1 ? 'One person walked your garden.' : `${l.visitors} people walked your garden.`);
  if (l.tenders) walked.push(l.tenders === 1 ? 'Someone began tending it.' : `${l.tenders} people began tending it.`);
  if (walked.length) { parts.push(H('Visitors')); parts.push(P(walked.join(' '))); text.push(walked.join(' ')); }
  if (l.tended.length) {
    parts.push(H('New in the gardens you tend'));
    l.tended.forEach(g => {
      parts.push(P(`<a href="${esc(gardenURL(g.username))}" style="color:#7a3a1a;font-weight:bold;text-decoration:none">${esc(g.name)}</a>, by ${esc(g.poet)}: ${plural(g.n, 'new poem', 'new poems')}, ${g.titles.map(t => `<i>${esc(t)}</i>`).join(', ')}`));
      text.push(`${g.name}, by ${g.poet}: ${plural(g.n, 'new poem', 'new poems')} (${gardenURL(g.username)})`);
    });
  }
  const hello = r.name ? `Dear ${esc(r.name)},` : 'Hello,';
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#e9dcc0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e9dcc0"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#f6ebd2;border:1px solid #cdb38a;border-radius:6px">
<tr><td style="padding:34px 36px 30px;font-family:Georgia,'Times New Roman',serif">
<p style="margin:0 0 4px;font-size:15px;letter-spacing:.08em;color:#8a6a44;text-align:center">✿ THE GARDEN OF POEMS ✿</p>
<h1 style="margin:0 0 22px;font:normal 32px Georgia,'Times New Roman',serif;color:#2a1a0c;text-align:center">Your week in the garden</h1>
${P(hello)}${P('Here is what grew around your poems this week.')}
${parts.join('\n')}
<p style="margin:30px 0 8px;text-align:center"><a href="${esc(home)}" style="display:inline-block;padding:13px 30px;border-radius:999px;background:#2d1f12;color:#fbf2dc;font:italic 19px Georgia,serif;text-decoration:none">Walk your garden</a></p>
</td></tr></table>
<p style="max-width:560px;margin:16px auto 0;font:14px/1.5 Georgia,serif;color:#6b5a44;text-align:center">A letter comes once a week, only when something has happened.<br><a href="${esc(stop)}" style="color:#6b5a44">Stop these letters</a>, or turn them off in Gardens, under your account.</p>
</td></tr></table></body></html>`;
  const plain = `${r.name ? `Dear ${r.name},` : 'Hello,'}\n\nHere is what grew around your poems this week.\n\n${text.join('\n\n')}\n\nWalk your garden: ${home}\n\nA letter comes once a week, only when something has happened. Stop these letters: ${stop}\n`;
  return { subject: subject(l), html, text: plain, stop };
}

const FROM = (() => { const f = env('MAIL_FROM', 'The Garden of Poems <garden@poems.test>'), m = f.match(/^\s*(.*?)\s*<([^>]+)>\s*$/); return m ? { name: m[1] || 'The Garden of Poems', email: m[2] } : { name: 'The Garden of Poems', email: f.trim() }; })();

async function send(to: { email: string; name: string }, m: { subject: string; html: string; text: string; stop: string }) {
  const headers = { 'List-Unsubscribe': `<${m.stop}>` };
  let res: Response;
  if (env('BREVO_API_KEY')) {
    res = await fetch('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { 'api-key': env('BREVO_API_KEY'), 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sender: FROM, to: [{ email: to.email, name: to.name || undefined }], subject: m.subject, htmlContent: m.html, textContent: m.text, headers }) });
  } else if (env('RESEND_API_KEY')) {
    res = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: `Bearer ${env('RESEND_API_KEY')}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: `${FROM.name} <${FROM.email}>`, to: [to.email], subject: m.subject, html: m.html, text: m.text, headers }) });
  } else if (env('MAILPIT_URL')) {
    res = await fetch(env('MAILPIT_URL').replace(/\/$/, '') + '/api/v1/send', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ From: { Email: FROM.email, Name: FROM.name }, To: [{ Email: to.email, Name: to.name }], Subject: m.subject, HTML: m.html, Text: m.text, Headers: headers }) });
  } else throw new Error('no mail service is configured (BREVO_API_KEY, RESEND_API_KEY or MAILPIT_URL)');
  if (!res.ok) throw new Error(`the mail service said ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

Deno.serve(async req => {
  const secret = env('DIGEST_SECRET');
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return new Response('not allowed', { status: 401 });
  const q = new URL(req.url).searchParams, dry = q.get('dry') === '1', only = q.get('only') || null, max = Number(env('MAX_SENDS', '250')) || 250;
  const sb = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  let sent = 0, quiet = 0; const failed: string[] = [], letters: unknown[] = [];
  for (let round = 0; round < 40 && sent < max; round++) {
    const { data, error } = await sb.rpc('digest_batch', { p_lim: Math.min(50, max - sent + 10), p_only: only });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    const rows = (data || []) as Row[]; if (!rows.length) break;
    const done: string[] = [];
    for (const r of rows) {
      if (!hasNews(r.letter)) { quiet++; done.push(r.user_id); continue; }
      if (sent >= max) break;
      const m = write(r);
      if (dry) { letters.push({ to: r.email, subject: m.subject, text: m.text }); sent++; continue; }
      try { await send({ email: r.email, name: r.name }, m); sent++; done.push(r.user_id); }
      catch (e) { failed.push(`${r.email}: ${(e as Error).message}`); if (failed.length > 5) break; }
    }
    // a test send or a dry run leaves everyone due as before
    if (dry || only) break;
    if (done.length) await sb.rpc('digest_sent', { p_ids: done });
    if (failed.length > 5) break;
  }
  return Response.json({ sent, quiet, failed, ...(dry ? { letters } : {}) });
});
