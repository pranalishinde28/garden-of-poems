// End-to-end against LOCAL Supabase (npx supabase start): accounts, sync, conflicts, removal, notes.
//   npm run e2e:local      (builds with the local URL and publishable key, then runs this)
// Talks to the local database directly (docker exec psql) to play "another device".
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DB = process.env.SUPABASE_DB_CONTAINER || 'supabase_db_garden-of-poems';
const sql = q => execFileSync('docker', ['exec', '-i', DB, 'psql', '-U', 'postgres', '-d', 'postgres', '-tAc', q], { encoding: 'utf8' }).trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const stamp = Date.now().toString(36).slice(-5), ADA = 'ada_' + stamp, BOB = 'bob_' + stamp;
let failed = 0;
const step = async (label, fn) => { process.stdout.write('  ' + label + '… '); try { const r = await fn(); console.log(r === undefined ? 'ok' : r); } catch (e) { failed++; console.log('FAILED: ' + (e.message || e)); } };

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; try { const b = readFileSync(join(root, 'dist', p)); r.writeHead(200, { 'Content-Type': TYPES[p.slice(p.lastIndexOf('.'))] || 'application/octet-stream' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(0, '127.0.0.1');
await new Promise(r => server.once('listening', r));
const url = `http://127.0.0.1:${server.address().port}/?debug`;
const browser = await puppeteer.launch({ headless: true, args: process.platform === 'darwin' ? ['--use-angle=metal'] : ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];

async function person() {
  const ctx = await browser.createBrowserContext(), page = await ctx.newPage();
  await page.setViewport({ width: 1300, height: 800 });
  page.on('pageerror', e => errors.push(e.message));
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto(url, { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => window.__garden && document.querySelector('#loading')?.classList.contains('done'), { timeout: 180000, polling: 500 });
  await page.click('#enter'); await page.waitForFunction(() => window.__garden.state.mode === 'walk', { timeout: 180000, polling: 300 });
  await page.evaluate(() => document.querySelector('#steps-skip')?.click());
  return { page, ctx };
}
async function signUp(page, name) {
  await page.click('#h-gardens'); await page.waitForSelector('#gardens.open');
  await page.evaluate(() => [...document.querySelectorAll('#g-account .g-link')].find(b => /Create an account/.test(b.textContent)).click());
  await page.type('#ga-display', name[0].toUpperCase() + name.slice(1, 3)); await page.type('#ga-username', name);
  await page.type('#ga-email', name + '@example.test'); await page.type('#ga-password', 'a quiet garden 123');
  await page.click('#g-account button[type=submit]');
  await page.waitForFunction(() => window.__garden.cloud.user && window.__garden.cloud.profile, { timeout: 30000, polling: 200 });
  await page.click('#g-close'); await sleep(900);
}
const saved = page => page.waitForFunction(() => { const s = document.querySelector('#savestate'); return s && !s.hidden && s.dataset.s === 'saved'; }, { timeout: 30000, polling: 200 });
async function write(page, title, body) {
  const n = await page.evaluate(() => window.__garden.poems.length);
  await page.click('#h-write'); await page.waitForSelector('#editor.open', { timeout: 60000 }); await sleep(500);
  await page.evaluate((t, b) => { const ti = document.querySelector('#e-title'), bo = document.querySelector('#e-body'); ti.value = t; bo.value = b; bo.dispatchEvent(new Event('input')); }, title, body);
  await page.click('#e-go'); await page.waitForFunction(n => window.__garden.poems.length > n, { timeout: 30000, polling: 200 }, n);
  await page.waitForFunction(() => window.__garden.state.mode === 'walk', { timeout: 60000, polling: 300 });
  return page.evaluate(t => window.__garden.poems.find(p => p.title === t).id, title);
}
async function editPoem(page, id, body) {
  await page.evaluate(id => { const g = window.__garden; g.openPoem(g.plants.get(id)); }, id); await sleep(1500);
  await page.click('#r-edit'); await page.waitForSelector('#editor.open'); await sleep(400);
  await page.evaluate(b => { const bo = document.querySelector('#e-body'); bo.value = b; bo.dispatchEvent(new Event('input')); }, body);
  await page.click('#e-go'); await sleep(2500);
  await page.keyboard.press('Escape'); await sleep(800);
}
const adaId = () => sql(`select id from public.profiles where username = '${ADA}'`);

console.log('Ada, the poet:');
const A = await person(), pa = A.page;
let p1, p2;
await step('sign up (local auth, no email confirmation)', async () => { await signUp(pa, ADA); return '@' + ADA; });
await step('write a poem; it reaches the database', async () => {
  p1 = await write(pa, 'Kettle', 'My grandmother\'s kettle\nsang before the house woke.'); await saved(pa);
  return sql(`select title from public.poems where owner = '${adaId()}' and id = '${p1}'`);
});
await step('offline: the poem waits, then saves when back online', async () => {
  await pa.setOfflineMode(true); await pa.evaluate(() => dispatchEvent(new Event('offline')));
  p2 = await write(pa, 'Low Tide', 'You left the way water does,\nnot all at once.');
  await sleep(2500); const st = await pa.$eval('#savestate', e => e.textContent);
  const before = sql(`select count(*) from public.poems where id = '${p2}'`);
  await pa.setOfflineMode(false); await pa.evaluate(() => dispatchEvent(new Event('online')));
  await saved(pa); const after = sql(`select count(*) from public.poems where id = '${p2}'`);
  if (before !== '0' || after !== '1') throw new Error(`database had ${before} then ${after}`); return `"${st}" while offline, then saved`;
});
await step('a change made elsewhere is not overwritten: conflict, keep both', async () => {
  sql(`update public.poems set content = 'Changed on another device.' where id = '${p1}'`);
  await editPoem(pa, p1, 'Changed on this device.');
  await pa.waitForSelector('#conflict.open', { timeout: 15000 }); await pa.screenshot({ path: join(root, 'dev/shots/cloud-conflict.png') });
  await pa.click('#cf-both-btn'); await sleep(3500); await saved(pa);
  const rows = sql(`select string_agg(content, ' | ' order by content) from public.poems where owner = '${adaId()}' and title = 'Kettle' and deleted_at is null`);
  if (!rows.includes('another device') || !rows.includes('this device')) throw new Error(rows); return rows;
});
await step('remove a poem: it waits in Recently removed, and comes back', async () => {
  await pa.evaluate(id => { const g = window.__garden; g.openPoem(g.plants.get(id)); }, p2); await sleep(1500);
  await pa.click('#r-del'); await sleep(300); await pa.click('#r-yes'); await sleep(2500); await saved(pa);
  const del = sql(`select deleted_at is not null from public.poems where id = '${p2}'`);
  await pa.click('#h-gardens'); await pa.waitForFunction(() => [...document.querySelectorAll('#g-removed button')].some(b => /Bring it back/.test(b.textContent)), { timeout: 15000, polling: 300 });
  await pa.screenshot({ path: join(root, 'dev/shots/cloud-removed.png') });
  await pa.evaluate(() => [...document.querySelectorAll('#g-removed button')].find(b => /Bring it back/.test(b.textContent)).click()); await sleep(2000);
  await pa.click('#g-close'); await sleep(800);
  const back = sql(`select deleted_at is null from public.poems where id = '${p2}'`), here = await pa.evaluate(id => window.__garden.poems.some(p => p.id === id), p2);
  if (del !== 't' || back !== 't' || !here) throw new Error(`deleted ${del}, back ${back}, here ${here}`); return 'removed, then restored';
});
await step('Undo after the removal has synced brings it back (not refused as removed)', async () => {
  await pa.evaluate(id => { const g = window.__garden; g.openPoem(g.plants.get(id)); }, p2); await sleep(1500);
  await pa.click('#r-del'); await sleep(300); await pa.click('#r-yes'); await saved(pa); await sleep(400);
  const mid = sql(`select deleted_at is not null from public.poems where id = '${p2}'`);
  await pa.click('#toast button'); await sleep(2500); await saved(pa);
  const end = sql(`select deleted_at is null from public.poems where id = '${p2}'`);
  if (mid !== 't' || end !== 't') throw new Error(`after remove ${mid}, after undo ${end}`); return 'restored on the server';
});
await step('a poem removed on another device does not come back', async () => {
  sql(`update public.poems set deleted_at = now() where id = '${p1}'`);
  await editPoem(pa, p1, 'One more edit from here.'); await sleep(2500);
  const here = await pa.evaluate(id => window.__garden.poems.some(p => p.id === id), p1), still = sql(`select deleted_at is not null from public.poems where id = '${p1}'`);
  if (here || still !== 't') throw new Error(`still here: ${here}, removed on server: ${still}`); return 'it stays removed, and this device lets it go';
});
await step('open the garden to visitors', async () => {
  await pa.click('#h-gardens'); await pa.waitForSelector('#gardens.open'); await pa.click('#g-toggle'); await sleep(1500); await pa.click('#g-close'); await sleep(600);
  return sql(`select is_public from public.gardens where owner = '${adaId()}'`) === 't' ? 'public' : 'still private';
});
await step('change username (checked as you type)', async () => {
  await pa.click('#h-gardens'); await pa.waitForSelector('#g-username');
  await pa.evaluate(v => { const i = document.querySelector('#g-username'); i.value = v; i.dispatchEvent(new Event('input')); }, ADA + '_g');
  await pa.waitForFunction(() => !document.querySelector('#g-acct .g-btn').disabled, { timeout: 8000, polling: 200 });
  await pa.click('#g-acct .g-btn'); await sleep(1500);
  const msg = await pa.$eval('#g-acct .g-m', e => e.textContent); await pa.click('#g-close'); await sleep(600);
  const now = sql(`select username from public.profiles where username = '${ADA}_g'`); if (!now) throw new Error('not changed; the panel said: ' + msg);
  return '@' + now + ' (' + msg + ')';
});
await step('export the garden as JSON and Markdown', async () => {
  // catch the files as the page hands them over, instead of relying on downloads in headless Chrome
  await pa.evaluate(() => { window.__exports = {}; const orig = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download) fetch(this.href).then(r => r.text()).then(t => { window.__exports[this.download] = t; }); else orig.call(this); }; });
  await pa.click('#h-gardens'); await pa.waitForSelector('#g-acct'); await pa.evaluate(() => document.querySelectorAll('#g-acct .g-ex button').forEach(b => b.click()));
  await pa.waitForFunction(() => Object.keys(window.__exports).length === 2, { timeout: 15000, polling: 200 }); await pa.click('#g-close');
  const ex = await pa.evaluate(() => window.__exports), j = JSON.parse(ex['garden-of-poems.json']), md = ex['garden-of-poems.md'];
  return `${Object.keys(ex).join(', ')}: ${j.poems.length} poems, ${j.notes.length} notes; markdown starts "${md.split('\n')[0]}"`;
});

console.log('Bob, a visitor:');
const B = await person(), pb = B.page;
await step('sign up', async () => { await signUp(pb, BOB); return '@' + BOB; });
await step('find Ada\'s garden by searching, and visit', async () => {
  await pb.click('#h-gardens'); await pb.waitForSelector('#g-search'); await pb.type('#g-search', ADA.slice(0, 7));
  await pb.waitForFunction(() => document.querySelectorAll('#g-list .g-row').length > 0, { timeout: 15000, polling: 300 });
  const n = await pb.$$eval('#g-list .g-row', r => r.length); await pb.click('#g-list .g-row button');
  await pb.waitForFunction(() => window.__garden.state.visiting && window.__garden.poems.length > 0, { timeout: 30000, polling: 300 });
  return `${n} result, visiting ${await pb.evaluate(() => window.__garden.poems.length)} poems`;
});
await step('leave notes; the fourth on one poem is kindly refused', async () => {
  await pb.evaluate(() => { const g = window.__garden; g.openPoem([...g.plants.values()][0]); }); await sleep(2500);
  for (let i = 1; i <= 4; i++) { await pb.evaluate(t => { document.querySelector('#r-note').value = t; }, 'Note ' + i); await pb.click('#r-note-send'); await sleep(1300); }
  const toast = await pb.$eval('#toast', e => e.textContent), n = sql(`select count(*) from public.notes where author = (select id from public.profiles where username = '${BOB}')`);
  if (n !== '3') throw new Error(n + ' notes stored'); return `${n} stored; then: "${toast}"`;
});
await step('Ada hides a note from visitors', async () => {
  await pa.evaluate(id => { const g = window.__garden; g.openPoem(g.plants.get(id)); }, p2); await sleep(2500);
  const btn = await pa.$('#r-notes-list .n-acts .g-link'); if (!btn) throw new Error('no notes shown to the poet');
  await btn.click(); await sleep(1500); return sql(`select count(*) from public.notes where hidden`) + ' hidden';
});
await step('Bob deletes his account; everything of his goes', async () => {
  await pb.keyboard.press('Escape'); await sleep(600); await pb.click('#h-gardens'); await pb.waitForSelector('#g-acct');
  await pb.evaluate(() => [...document.querySelectorAll('#g-acct .g-link')].find(b => /Delete my account/.test(b.textContent)).click());
  await pb.type('.g-confirm input', BOB); await pb.click('.g-confirm .g-btn'); await sleep(2500);
  const left = sql(`select count(*) from public.profiles where username = '${BOB}'`) + ' profiles, ' + sql(`select count(*) from public.notes n join auth.users u on u.id = n.author where u.email = '${BOB}@example.test'`) + ' notes';
  if (!left.startsWith('0 profiles')) throw new Error(left); return left + ' left';
});

await browser.close(); server.close();
if (errors.length) { console.log('page errors:\n' + errors.join('\n')); failed++; }
console.log(failed ? `\n${failed} step(s) failed.` : '\nAll steps passed.'); process.exit(failed ? 1 : 0);
