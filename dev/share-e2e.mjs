// Private links, a garden's short address, visitor counts, the patrons' list and the book, end to end, with
// two strangers. Needs local Supabase (npx supabase start) and a dev server against it on port 8081:
//   VITE_SUPABASE_URL=<API_URL> VITE_SUPABASE_ANON_KEY=<PUBLISHABLE_KEY> npx vite --port 8081
// then: API_URL=… SERVICE_ROLE_KEY=… node dev/share-e2e.mjs dev/shots
import puppeteer from 'puppeteer';
const out = process.argv[2], API = process.env.API_URL, SR = process.env.SERVICE_ROLE_KEY, URL0 = 'http://localhost:8081/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const adm = { apikey: SR, Authorization: 'Bearer ' + SR, 'Content-Type': 'application/json' };
const rest = async q => (await fetch(`${API}/rest/v1/${q}`, { headers: adm })).json();
const uname = 'poet' + Math.random().toString(36).slice(2, 8), email = uname + '@example.test', pass = 'a-long-password-1';
const u = await (await fetch(`${API}/auth/v1/admin/users`, { method: 'POST', headers: adm, body: JSON.stringify({ email, password: pass, email_confirm: true, user_metadata: { username: uname, display_name: 'Ada Lovegarden' } }) })).json();
const id = u.id; const fail = []; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail.push(m); };
const b = await puppeteer.launch({ headless: 'new', args: ['--use-angle=metal'] });
await b.defaultBrowserContext().overridePermissions('http://localhost:8081', ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);
const enter = async (p, url) => { await p.goto(url, { waitUntil: 'load' }); await p.waitForSelector('#enter'); await sleep(2500); };
// ---- Ada: plants the samples, signs in, makes a private link ----
const A = await b.newPage(); await A.setViewport({ width: 1280, height: 860 }); A.on('dialog', d => d.accept());
await enter(A, URL0 + '?debug'); await A.click('#enter'); await A.waitForFunction(() => window.__garden.state.mode === 'walk', { timeout: 120000 });
await A.evaluate(() => { document.querySelector('#steps-skip')?.click(); document.querySelector('#m-sample').click(); }); await sleep(3000);
await A.evaluate(async (e, p) => { await window.__garden.cloud.sb.auth.signInWithPassword({ email: e, password: p }); }, email, pass);
for (let i = 0; i < 40; i++) { const r = await rest(`poems?owner=eq.${id}&select=id`); if (r.length >= 12) break; await sleep(1000); }
ok((await rest(`poems?owner=eq.${id}&select=id`)).length === 12, 'Ada’s twelve poems are in her account');
await A.evaluate(() => document.querySelector('#h-gardens').click()); await A.waitForSelector('#g-share-make', { visible: true }); await sleep(1500);
await A.type('#g-share-label', 'For my sister'); await A.click('#g-share-make'); await sleep(2500);
const shares = await rest(`garden_shares?owner=eq.${id}&select=token,label,opened`);
ok(shares.length === 1 && shares[0].label === 'For my sister', 'a private link is made, with its label');
const token = shares[0].token, clip = await A.evaluate(() => navigator.clipboard.readText().catch(() => ''));
ok(clip.endsWith('/s/' + token), 'the private link is copied: ' + clip);
// ---- a stranger opens the private link while the garden is private ----
const cB = await b.createBrowserContext(), B = await cB.newPage(); await B.setViewport({ width: 1280, height: 860 });
await enter(B, URL0 + 's/' + token + '?debug');
await B.waitForSelector('#intro-visit:not([hidden])', { timeout: 20000 }).catch(() => {});
ok(await B.$eval('#intro-visit', e => !e.hidden && /Visit/.test(e.textContent)), 'the private link offers a visit on the welcome screen');
ok(await B.evaluate(() => location.pathname) === '/s/' + token, 'the address bar keeps the short private link');
await B.click('#intro-visit'); await B.waitForFunction(() => window.__garden.state.visiting, { timeout: 30000 }); await sleep(2500);
const vb = await B.evaluate(() => ({ pub: window.__garden.state.visiting.isPublic, n: window.__garden.plants.size }));
ok(vb.pub === false && vb.n === 12, `the stranger walks the private garden (${vb.n} trees, public: ${vb.pub})`);
await B.screenshot({ path: `${out}/e2e-shared-visit.png` });
await sleep(1500);
ok((await rest(`garden_shares?owner=eq.${id}&select=opened`))[0].opened === 1, 'the link’s opening is counted');
// ---- Ada opens her garden to everyone; a second stranger arrives by its address ----
await A.click('#g-toggle'); await sleep(2500);
const cC = await b.createBrowserContext(), Cp = await cC.newPage(); await Cp.setViewport({ width: 1280, height: 860 });
await enter(Cp, URL0 + uname + '?debug');
await Cp.waitForSelector('#intro-visit:not([hidden])', { timeout: 20000 }).catch(() => {});
ok(await Cp.evaluate(() => location.pathname) === '/' + uname, 'a garden opens at its own short address: /' + uname);
await Cp.click('#intro-visit'); await Cp.waitForFunction(() => window.__garden.state.visiting, { timeout: 30000 }); await sleep(3000);
ok(await Cp.evaluate(() => window.__garden.state.visiting.isPublic) === true, 'the public visitor sees hearts and notes (public garden)');
// ---- Ada sees her visitors, the address and the links ----
await A.evaluate(() => { document.querySelector('#g-close').click(); }); await sleep(900);
await A.evaluate(() => document.querySelector('#h-gardens').click()); await sleep(3000);
const vt = await A.$eval('#g-visits', e => e.textContent), addr = await A.$eval('#g-addr-url', e => e.textContent), addrShown = await A.$eval('#g-address', e => !e.hidden);
ok(/2\s*today/.test(vt.replace(/\s+/g, ' ')), 'Ada sees 2 visitors today: ' + vt.replace(/\s+/g, ' ').slice(0, 90));
ok(addrShown && addr.endsWith('/' + uname), 'Ada sees her garden’s address: ' + addr);
await A.evaluate(() => { const g = document.querySelector('#gardens'); g.scrollTop = g.querySelector('#g-address').offsetTop - 120; }); await sleep(500);
await A.screenshot({ path: `${out}/e2e-gardens-panel.png` });
// ---- the patrons' list ----
await A.evaluate(() => document.querySelector('#g-patron').click()); await sleep(1500);
await A.click('#pt-go'); await sleep(2000);
ok((await rest(`waitlist?person=eq.${id}&select=wish`)).some(r => r.wish === 'patron'), 'Ada is on the patrons’ list');
ok(/on the list/i.test(await A.$eval('#pt-state', e => e.textContent)), 'the patron box says so');
await A.screenshot({ path: `${out}/e2e-patron.png` });
await A.evaluate(() => document.querySelector('#pt-close').click()); await sleep(900);
// ---- the book ----
await A.evaluate(() => document.querySelector('#m-book').click());
await A.waitForFunction(() => !document.querySelector('#bk-print').disabled, { timeout: 180000 });
const nb = await A.$$eval('#bk-pages .bp', e => e.length), pics = await A.$$eval('#bk-pages .poem img', e => e.length);
ok(nb === 16 && pics === 12, `the book has a cover, map, contents, 12 poems and a colophon (${nb} pages, ${pics} tree pictures)`);
await A.screenshot({ path: `${out}/e2e-book.png` });
await A.evaluate(() => { document.querySelector('#bk-pages .poem').scrollIntoView(); }); await sleep(600); await A.screenshot({ path: `${out}/e2e-book-poem.png` });
await A.pdf({ path: `${out}/e2e-book.pdf`, preferCSSPageSize: true, printBackground: true });
console.log(fail.length ? `\n${fail.length} FAILED` : '\nall passed');
await b.close();
