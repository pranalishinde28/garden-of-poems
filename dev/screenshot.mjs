// Headless smoke test and screenshots for The Garden of Poems.
//
//   node dev/screenshot.mjs                    screenshots of the built app (dist/)
//   node dev/screenshot.mjs --check            smoke test: fails on any page error
//   node dev/screenshot.mjs --legacy old.html  screenshots of the old single-file app
//   node dev/screenshot.mjs --check --url http://localhost:8080/   test a running server (npm run dev)
//   node dev/screenshot.mjs --flow swing        sit, swing, read five poems, stand up (desktop and phone)
//   node dev/screenshot.mjs --flow avatar       third person: walk, bench, swing, kneel to read, pond
//   node dev/screenshot.mjs --flow audit        screens, axe accessibility results, tap targets and frame times into dev/shots/audit/
//   node dev/screenshot.mjs --flow map          map: open, hover, two clicks to a poem, glide to a place, hidden features, phone
//   options: --views intro,tunnel  --out dev/shots/after  --base /garden-of-poems/
//
// The page exposes window.__garden when the URL has ?debug (src/debug.js).
// For the legacy single file, the same hook is injected into a temporary copy.
import { createServer } from 'node:http';
import { readFile, mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, extname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i < 0 ? def : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
const CHECK = opt('check', false) === true;
const FLOW = opt('flow', null);
const LEGACY = opt('legacy', null);
const URL_ = opt('url', null);
const BASE = String(opt('base', process.env.GARDEN_BASE || '/')).replace(/\/?$/, '/');

// Fixed viewpoints: camera position and look-at target, in world metres.
const VIEWS = {
  intro:   { intro: true },
  tunnel:  { pos: [0, 1.7, 35.5], look: [0, 1.5, 17] },
  pond:    { pos: [7, 2.2, 9], look: [0, -0.4, 0] },
  bench:   { pos: [-6.5, 1.75, 9.5], look: [-19, 1.4, 22] },
  swings:  { pos: [-13.5, 1.7, 15.5], look: [-21, 1.5, 24.5] },
  overview: { pos: [6, 34, 48], look: [-12, 0, 14] },
  'autumn-tunnel': { pos: [0, 1.7, 35.5], look: [0, 1.5, 17], season: 'autumn' },
  'autumn-swings': { pos: [-13.5, 1.7, 15.5], look: [-21, 1.5, 24.5], season: 'autumn' },
  'season-spring': { pos: [10, 9, 34], look: [-2, 1, 4], season: 'spring', samples: true },
  'season-summer': { pos: [10, 9, 34], look: [-2, 1, 4], season: 'summer', samples: true },
  'season-autumn': { pos: [10, 9, 34], look: [-2, 1, 4], season: 'autumn', samples: true },
  'season-winter': { pos: [10, 9, 34], look: [-2, 1, 4], season: 'winter', samples: true },
  'fuji-view': { pos: [8, 2.6, 16], look: [-25, 14, -200], season: 'spring' },
  'fuji-high': { pos: [4, 14, 44], look: [-20, 10, -200], season: 'spring' },
  'fuji-winter': { pos: [8, 2.6, 16], look: [-25, 14, -200], season: 'winter' },
  'lineup': { lineup: true, pos: [3.1, 1.25, 25.2], look: [3.1, 0.95, 21.6] },
  'on-swing': { sit: true }, // enter with the samples, sit on the first swing, pump, and open the reader if there is one
};
const views = String(opt('views', Object.keys(VIEWS).join(','))).split(',');
const out = String(opt('out', join(root, 'dev/shots', LEGACY ? 'before' : 'after')));

const HOOK = 'window.__garden = { state, camera, curLook, plants, openPoem, setSetting, get SETTINGS() { return SETTINGS; }, get poems() { return poems; } };';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2' };

async function siteDir() {
  if (!LEGACY) {
    const dist = join(root, 'dist');
    if (!existsSync(join(dist, 'index.html'))) throw new Error('dist/ is missing. Run npm run build first.');
    return { dir: dist, cleanup: async () => {} };
  }
  const dir = await mkdtemp(join(tmpdir(), 'garden-legacy-'));
  const html = (await readFile(LEGACY, 'utf8')).replace(/\ncloudInit\(\);\n\}\)\(\);/, `\n${HOOK}\ncloudInit();\n})();`);
  if (!html.includes('window.__garden')) throw new Error('Could not insert the debug hook into the legacy file.');
  await writeFile(join(dir, 'index.html'), html);
  await writeFile(join(dir, 'config.js'), 'window.GARDEN_CONFIG = {};');
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

function serve(dir) {
  const server = createServer(async (req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/favicon.ico') { res.writeHead(204); return res.end(); }
    if (!p.startsWith(BASE)) { res.writeHead(404); return res.end(); }
    p = p.slice(BASE.length) || 'index.html';
    try { const body = await readFile(join(dir, p)); res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream' }); res.end(body); }
    catch { res.writeHead(404); res.end(); }
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r(server)));
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const site = URL_ ? { cleanup: async () => {} } : await siteDir();
  const server = URL_ ? { close() {} } : await serve(site.dir);
  const url = URL_ ? URL_ + (URL_.includes('?') ? '&' : '?') + 'debug' : `http://127.0.0.1:${server.address().port}${BASE}?debug`;
  // macOS: the real GPU through Metal. Linux CI has no GPU, so WebGL runs on SwiftShader (slow but complete).
  const gpu = process.platform === 'darwin' ? ['--use-angle=metal', '--enable-gpu'] : ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
  const browser = await puppeteer.launch({ headless: true, protocolTimeout: 600000, args: [...gpu, '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const errors = [];
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 820 });
    page.on('pageerror', e => errors.push('page error: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console error: ' + m.text()); });
    page.on('requestfailed', r => { if (!/fonts\.g/.test(r.url())) errors.push('request failed: ' + r.url()); });
    page.on('response', r => { if (r.status() >= 400 && /^http:\/\/(127\.0\.0\.1|localhost)/.test(r.url())) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
    // the same random numbers on every run, so before and after shots line up
    await page.evaluateOnNewDocument(() => { let s = 1; Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; });
    if (CHECK) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.goto(url, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.__garden && document.querySelector('#loading')?.classList.contains('done'), { timeout: 120000, polling: 500 });
    await page.evaluate(() => window.__garden.setSetting('light', 'day'));

    if (FLOW === 'avatar') await avatarFlow(page);
    else if (FLOW === 'map') await mapFlow(page, browser, url, errors);
    else if (FLOW === 'ux') await uxFlow(page);
    else if (FLOW === 'quality') await qualityFlow(page);
    else if (FLOW === 'audit') await auditFlow(page, browser, url, errors);
    else if (FLOW === 'swing') { await swingFlow(page, 'desktop'); await swingFlowPhone(browser, url, errors); }
    else if (CHECK) await smoke(page);
    else await shoot(page);
  } catch (e) {
    errors.unshift('harness: ' + (e.message || e));
  } finally {
    await browser.close(); server.close(); await site.cleanup();
  }
  if (errors.length) { console.error('\n' + [...new Set(errors)].join('\n')); process.exit(1); }
  console.log(CHECK ? 'Smoke test passed: no page errors.' : 'No page errors.');
}

async function shoot(page) {
  await mkdir(dirname(out + '-x.png'), { recursive: true });
  for (const name of views) {
    const v = VIEWS[name]; if (!v) throw new Error('Unknown view: ' + name);
    if (v.samples && !(await page.evaluate(() => window.__garden.poems.length))) {
      await page.click('#enter-sample'); await page.waitForFunction(() => window.__garden.state.mode === 'walk' && window.__garden.poems.length >= 10, { timeout: 180000, polling: 500 });
      await page.evaluate(() => document.querySelector('#steps-skip')?.click()); await sleep(9000);
    }
    if (v.lineup) await page.evaluate(() => {
      const O = [['casual', '#3d4a6b', 'short', '#1d1a19', '#d9a77f', 'none'], ['yukata', '#efe6d4', 'bun', '#3a2a20', '#f6dcc6', 'parasol'], ['kimono', '#e7b7c4', 'long', '#1d1a19', '#ecc4a2', 'none'],
        ['coat', '#b5603d', 'bob', '#8a4f2e', '#7f5236', 'scarf'], ['yukata', '#3d4a6b', 'tail', '#c49a62', '#a26c47', 'hat'], ['casual', '#6f8a5a', 'short', '#9c9893', '#3f2a1f', 'scarf']];
      window.__garden.lineup(O.map(([outfit, cloth, hairStyle, hairColor, skin, extra], i) => ({ outfit, cloth, hairStyle, hairColor, skin, extra, accent: ['#c9474a', '#e9c46a', '#d98fa6', '#f3efe6', '#c9474a', '#2f3f5c'][i], height: [1, 0.94, 0.97, 1.05, 1.02, 0.92][i] })), 0.85, 21.6);
    });
    if (v.sit) {
      await page.click('#enter-sample');
      await page.waitForFunction(() => window.__garden.state.mode === 'walk' && window.__garden.poems.length >= 10, { timeout: 180000, polling: 500 });
      await page.evaluate(() => window.__garden.sit(0));
      await page.waitForFunction(() => window.__garden.state.mode === 'swing', { timeout: 60000, polling: 200 });
      await page.keyboard.down('KeyW'); await sleep(1800); await page.keyboard.up('KeyW');
      if (await page.$('#sw-read')) { await page.keyboard.press('KeyR'); }
      await sleep(2800); await page.screenshot({ path: `${out}-${name}.png` }); console.log('saved', `${out}-${name}.png`); continue;
    }
    if (!v.intro) await page.evaluate(v => {
      const g = window.__garden;
      if (!document.querySelector('#hide-ui')) { const s = document.createElement('style'); s.id = 'hide-ui'; s.textContent = '#intro,#loading,#hud,.toast,#toast,#steps,#minimap-btn,#cue,#hint,#savestate{display:none!important}'; document.head.append(s); }
      g.state.mode = 'cinematic';
      if (g.SETTINGS.season !== (v.season || 'spring')) g.setSetting('season', v.season || 'spring');
      document.querySelector('#toast')?.classList.remove('show');
      g.camera.position.set(...v.pos); g.curLook.set(...v.look); g.camera.lookAt(g.curLook);
    }, v);
    await sleep(v.season ? 4000 : 2500);
    await page.screenshot({ path: `${out}-${name}.png` });
    console.log('saved', `${out}-${name}.png`);
  }
}

// Walk the main paths: enter with the sample poems, read one, switch season and weather.
async function smoke(page) {
  const step = async (label, fn) => { process.stdout.write(label + '… '); await fn(); console.log('ok'); };
  const cloud = await page.evaluate(() => window.__garden.cloudReady);
  console.log(cloud === undefined ? 'accounts: unknown (legacy file)' : cloud ? 'accounts: connected to Supabase' : 'accounts: not configured (guest mode)');
  await step('enter the garden with the sample poems', async () => {
    await page.click('#enter-sample');
    await page.waitForFunction(() => window.__garden.state.mode === 'walk', { timeout: 180000, polling: 500 });
    await page.waitForFunction(() => window.__garden.poems.length >= 10, { timeout: 60000, polling: 500 });
  });
  await step('read a poem', async () => {
    await page.evaluate(() => { const g = window.__garden; g.openPoem([...g.plants.values()][0]); });
    await sleep(3000);
    await page.keyboard.press('Escape'); await sleep(1500);
  });
  await step('sit on a swing, read two poems, stand up', async () => {
    await page.evaluate(() => window.__garden.sit(0));
    await page.waitForFunction(() => window.__garden.state.mode === 'swing', { timeout: 120000, polling: 300 });
    await page.keyboard.press('KeyR'); await sleep(600);
    const t0 = await page.$eval('#sr-title', e => e.textContent); await page.keyboard.press('ArrowLeft'); await sleep(300);
    if (t0 === await page.$eval('#sr-title', e => e.textContent)) throw new Error('the swing reader did not turn the page');
    await page.keyboard.press('KeyE'); await page.waitForFunction(() => window.__garden.state.mode === 'walk', { timeout: 120000, polling: 300 });
  });
  await step('open the map, glide to the bench', async () => {
    await page.keyboard.press('KeyM'); await page.waitForSelector('#mapview.open', { timeout: 10000 });
    const ok = await page.evaluate(() => { const b = [...document.querySelectorAll('.map-place')].find(x => x.getAttribute('aria-label').startsWith('Writing bench')); if (b) b.click(); return !!b; });
    if (!ok) throw new Error('no Writing bench on the map');
    await page.waitForFunction(() => window.__garden.state.mode === 'walk' && !window.__garden.state.gliding, { timeout: 180000, polling: 300 });
  });
  await step('switch to autumn and rain', async () => {
    await page.evaluate(() => { const g = window.__garden; g.setSetting('season', 'autumn'); g.setSetting('weather', 'rain'); });
    await sleep(3000);
  });
  await step('check the canvas drew something', async () => {
    const lit = await page.evaluate(() => new Promise(res => requestAnimationFrame(() => {
      const c = document.querySelector('canvas'), x = document.createElement('canvas'); x.width = 32; x.height = 32;
      const g = x.getContext('2d'); g.drawImage(c, 0, 0, 32, 32); const d = g.getImageData(0, 0, 32, 32).data;
      let sum = 0; for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2]; res(sum / (32 * 32 * 3));
    })));
    if (!(lit > 8)) throw new Error('The canvas looks blank (mean brightness ' + lit + ').');
  });
}

main().catch(e => { console.error(e.message || e); process.exit(1); });

// ---- reading while swinging ----
const step = async (label, fn) => { process.stdout.write('  ' + label + '… '); const r = await fn(); console.log(r === undefined ? 'ok' : r); };
const swingState = page => page.evaluate(() => { const g = window.__garden, sw = g.state.swing; return { mode: g.state.mode, theta: sw ? sw.theta : 0, open: document.querySelector('#swreader').classList.contains('open'), title: document.querySelector('#sr-title').textContent }; });
async function amplitude(page, ms) { let a = 0; const end = Date.now() + ms; while (Date.now() < end) { a = Math.max(a, Math.abs((await swingState(page)).theta)); await sleep(100); } return a; }
async function enterAndSit(page, tapOrClick) {
  await tapOrClick('#enter-sample');
  await page.waitForFunction(() => window.__garden.state.mode === 'walk' && window.__garden.poems.length >= 10, { timeout: 180000, polling: 500 });
  await page.evaluate(() => window.__garden.sit(0));
  await page.waitForFunction(() => window.__garden.state.mode === 'swing', { timeout: 60000, polling: 200 });
}
async function swingFlow(page, label) {
  console.log(label + ':');
  await step('enter and sit on a swing', () => enterAndSit(page, sel => page.click(sel)));
  await step('hold W to swing', async () => { await page.keyboard.down('KeyW'); const a = await amplitude(page, 3000); await page.keyboard.up('KeyW'); if (a < 0.25) throw new Error('swing amplitude only ' + a.toFixed(2)); return 'amplitude ' + a.toFixed(2) + ' rad'; });
  await step('press R to open the reader', async () => { await page.keyboard.press('KeyR'); await sleep(900); if (!(await swingState(page)).open) throw new Error('reader did not open'); });
  await step('keep swinging with the reader open', async () => { await page.keyboard.down('Space'); const a = await amplitude(page, 2500); await page.keyboard.up('Space'); if (a < 0.3) throw new Error('amplitude ' + a.toFixed(2)); return 'amplitude ' + a.toFixed(2) + ' rad'; });
  await step('flip through five poems while swinging', async () => {
    const seen = new Set([(await swingState(page)).title]);
    await page.keyboard.down('KeyW');
    for (let i = 0; i < 2; i++) { await page.keyboard.press('ArrowLeft'); await sleep(250); seen.add((await swingState(page)).title); }
    for (let i = 0; i < 2; i++) { await page.click('#sr-prev'); await sleep(250); seen.add((await swingState(page)).title); }
    const st = await swingState(page); await page.keyboard.up('KeyW');
    if (seen.size < 5) throw new Error('saw only ' + seen.size + ' poems'); if (st.mode !== 'swing') throw new Error('left the swing');
    return seen.size + ' poems, still swinging';
  });
  await step('Space after clicking a button pumps, and does not press the button', async () => {
    await page.click('#sr-prev'); await sleep(200); const before = (await swingState(page)).title;
    await page.keyboard.down('Space'); await sleep(1200); await page.keyboard.up('Space'); await sleep(200);
    const after = await swingState(page); if (after.title !== before) throw new Error('Space pressed the focused button');
    const focused = await page.evaluate(() => document.activeElement && document.activeElement.id); return 'focus on: ' + (focused || 'nothing');
  });
  await step('order: near me', async () => { await page.click('[data-o="near"]'); await sleep(300); return (await page.$eval('#sr-prev', b => b.textContent)) + ' / ' + (await page.$eval('#sr-next', b => b.textContent)); });
  await step('swing by itself with no keys held', async () => { await page.click('#sr-auto'); await sleep(4000); const a = await amplitude(page, 5000); if (a < 0.12) throw new Error('auto swing amplitude ' + a.toFixed(2)); return 'amplitude ' + a.toFixed(2) + ' rad'; });
  await page.screenshot({ path: join(root, 'dev/shots/swing-reader-desktop.png') });
  await step('press E to stand up; the reader closes', async () => {
    await page.keyboard.press('KeyE'); await page.waitForFunction(() => window.__garden.state.mode === 'walk', { timeout: 30000, polling: 200 });
    await sleep(1200); if ((await swingState(page)).open) throw new Error('reader still open');
  });
}
async function swingFlowPhone(browser, url, errors) {
  console.log('phone:');
  const ctx = await browser.createBrowserContext(), page = await ctx.newPage(); // fresh storage: no garden yet
  page.on('pageerror', e => errors.push('page error (phone): ' + e.message));
  await page.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  await page.evaluateOnNewDocument(() => { let s = 7; Math.random = () => { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; }; });
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__garden && document.querySelector('#loading')?.classList.contains('done'), { timeout: 120000, polling: 500 });
  await page.evaluate(() => window.__garden.setSetting('light', 'day'));
  await step('enter and sit on a swing', () => enterAndSit(page, sel => page.tap(sel)));
  await step('tap Read: a bottom sheet opens', async () => { await page.tap('#sw-read'); await sleep(900); const st = await swingState(page); if (!st.open) throw new Error('not open'); const h = await page.$eval('#swreader', e => Math.round(e.getBoundingClientRect().top)); return 'sheet starts at y=' + h + ' of 844'; });
  await step('Swing, Read and Stand up stay reachable above the sheet', async () => {
    const r = await page.evaluate(() => ['#sw-pump', '#sw-read', '#sw-off'].map(s => { const b = document.querySelector(s).getBoundingClientRect(), top = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return s + (top === document.querySelector(s) ? ' ok' : ' covered') + ' (' + Math.round(b.height) + 'px)'; }));
    if (r.some(x => x.includes('covered'))) throw new Error(r.join(', ')); return r.join(', ');
  });
  await step('hold Swing while reading', async () => {
    const b = await page.$eval('#sw-pump', e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await page.touchscreen.touchStart(b.x, b.y); const a = await amplitude(page, 3000); await page.touchscreen.touchEnd();
    if (a < 0.25) throw new Error('amplitude ' + a.toFixed(2)); return 'amplitude ' + a.toFixed(2) + ' rad';
  });
  await step('swing by itself from still, no touch', async () => {
    await page.evaluate(() => { const sw = window.__garden.state.swing; sw.theta = 0; sw.omega = 0; });
    await page.tap('#sr-auto'); await sleep(9000); const a = await amplitude(page, 5000);
    if (a < 0.3 || a > 0.6) throw new Error('amplitude ' + a.toFixed(2) + ' rad, wanted a gentle 0.3–0.6'); return 'settles at ' + a.toFixed(2) + ' rad';
  });
  await step('flip through five poems', async () => { const seen = new Set([(await swingState(page)).title]); for (let i = 0; i < 4; i++) { await page.tap('#sr-prev'); await sleep(300); seen.add((await swingState(page)).title); } if (seen.size < 5) throw new Error('saw ' + seen.size); return seen.size + ' poems'; });
  await sleep(2500); // let the lines finish fading in
  await page.screenshot({ path: join(root, 'dev/shots/swing-reader-phone.png') });
  await step('tap Stand up; the reader closes', async () => { await page.tap('#sw-off'); await page.waitForFunction(() => window.__garden.state.mode === 'walk', { timeout: 30000, polling: 200 }); await sleep(1200); if ((await swingState(page)).open) throw new Error('reader still open'); });
}

// ---- your figure, in third person ----
async function avatarFlow(page) {
  const shot = async n => { await page.screenshot({ path: join(root, `dev/shots/avatar-${n}.png`) }); };
  const mode = () => page.evaluate(() => window.__garden.state.mode);
  await page.evaluate(() => { const g = window.__garden; g.setAvatar({ outfit: 'yukata', cloth: '#3d4a6b', accent: '#e9c46a', hairStyle: 'bun', hairColor: '#3a2a20', skin: '#d9a77f', extra: 'none', height: 1 }); });
  await step('enter, switch to third person (V)', async () => {
    await page.click('#enter-sample'); await page.waitForFunction(() => window.__garden.state.mode === 'walk' && window.__garden.poems.length >= 10, { timeout: 180000, polling: 500 });
    await page.keyboard.press('KeyV'); await sleep(1500);
    if (!(await page.evaluate(() => window.__garden.state.thirdPerson))) throw new Error('not in third person');
  });
  await step('change your figure in Customize (live preview)', async () => {
    await page.click('#h-custom'); await sleep(1200);
    await page.click('[data-av="outfit"] [data-v="kimono"]'); await page.click('[data-av="extra"] [data-v="parasol"]'); await page.click('[data-av="hairStyle"] [data-v="long"]');
    await page.click('[data-av="cloth"] button:nth-child(2)'); await sleep(1500);
    await page.$eval('#custom', e => { e.scrollTop = 0; }); await shot('editor');
    const a = await page.evaluate(() => JSON.parse(localStorage.getItem('garden-of-poems:avatar')));
    if (a.outfit !== 'kimono' || a.extra !== 'parasol') throw new Error('not saved: ' + JSON.stringify(a));
    await page.keyboard.press('Escape'); await sleep(900); await page.click('#c-close').catch(() => {}); await sleep(900);
    return 'saved on this device';
  });
  await step('walk up the path, then run', async () => {
    await page.keyboard.down('KeyW'); await sleep(1600); await shot('walk'); await page.keyboard.down('ShiftLeft'); await sleep(1200); await shot('run'); await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW'); await sleep(1200); await shot('idle');
  });
  await step('camera pulls in near the tunnel posts (no clipping)', async () => {
    await page.evaluate(() => { const p = window.__garden.player; p.pos.set(1.45, 0, 27); p.yaw = 0; p.pitch = -0.1; }); await sleep(2000); await shot('tunnel');
  });
  await step('sit at the bench to write', async () => {
    await page.evaluate(() => { const p = window.__garden.player; p.pos.set(-7.2, 0, 11.6); }); await sleep(600);
    await page.keyboard.press('KeyE'); await page.waitForFunction(() => window.__garden.state.mode === 'writing', { timeout: 30000, polling: 200 }); await sleep(2500); await shot('bench');
    await page.keyboard.press('Escape'); await page.waitForFunction(() => window.__garden.state.mode === 'walk', { timeout: 30000, polling: 200 });
  });
  await step('kneel to read a poem', async () => {
    await page.evaluate(() => { const g = window.__garden, pl = [...g.plants.values()].find(p => p.h < 2.5) || [...g.plants.values()][0]; g.player.pos.set(pl.root.position.x + 2.5, 0, pl.root.position.z + 2.5); g.openPoem(pl); });
    await sleep(4000); await shot('kneel'); await page.keyboard.press('Escape'); await sleep(1500); return 'mode ' + await mode();
  });
  await step('look into the pond for an older poem', async () => {
    await page.evaluate(() => { const p = window.__garden.player; p.pos.set(0, 0, 10.6); p.yaw = 0; p.pitch = -0.3; }); await sleep(1500);
    await page.keyboard.press('KeyE'); await sleep(4000); await shot('pond'); await page.keyboard.press('Escape'); await sleep(1500); return 'mode ' + await mode();
  });
  await step('swing in third person', async () => {
    await page.evaluate(() => window.__garden.sit(1)); await page.waitForFunction(() => window.__garden.state.mode === 'swing', { timeout: 30000, polling: 200 });
    await page.keyboard.down('KeyW'); await sleep(2500); await shot('swing'); await page.keyboard.up('KeyW');
    await page.keyboard.press('KeyE'); await page.waitForFunction(() => window.__garden.state.mode === 'walk', { timeout: 30000, polling: 200 });
  });
}

// ---- the map ----
async function mapFlow(page, browser, url, errors) {
  const shot = async n => { await page.screenshot({ path: join(root, `dev/shots/map-${n}.png`) }); };
  await step('enter as a first-time visitor (sample garden)', async () => {
    await page.click('#enter-sample'); await page.waitForFunction(() => window.__garden.state.mode === 'walk' && window.__garden.poems.length >= 10, { timeout: 180000, polling: 500 });
    await sleep(1500); await shot('minimap'); return (await page.$eval('#minimap-btn', b => !b.hidden)) ? 'corner map showing' : 'corner map hidden';
  });
  let target;
  await step('click 1: open the map', async () => { await page.click('#h-map'); await sleep(900); if (!(await page.$('#mapview.open'))) throw new Error('map did not open'); const n = await page.$$eval('.map-poem', b => b.length), p = await page.$$eval('.map-place', b => b.map(x => x.getAttribute('aria-label'))); await shot('full'); return `${n} poems, places: ${p.join(' | ')}`; });
  await step('hover a poem shows its title', async () => { const b = (await page.$$('.map-poem'))[3]; await b.hover(); await sleep(400); target = await b.evaluate(e => e.dataset.title); await shot('hover'); return target; });
  await step('click 2: choose it; glide there and read it', async () => {
    const b = (await page.$$('.map-poem'))[3]; await b.click();
    await page.waitForFunction(() => window.__garden.state.gliding, { timeout: 5000, polling: 50 }).catch(() => {});
    await sleep(1400); await shot('glide');
    await page.waitForFunction(() => window.__garden.state.mode === 'focus', { timeout: 30000, polling: 200 }); await sleep(2500); await shot('arrive');
    const t = await page.$eval('#r-title', e => e.textContent); if (t !== target) throw new Error('opened "' + t + '" instead of "' + target + '"'); return 'reading "' + t + '"';
  });
  await step('glide to the Swing Garden', async () => {
    await page.keyboard.press('Escape'); await sleep(1500); await page.keyboard.press('KeyM'); await sleep(900);
    const btn = await page.$$('.map-place'); let sw = null; for (const b of btn) if ((await b.evaluate(e => e.getAttribute('aria-label'))).startsWith('Swing')) sw = b;
    await sw.click(); await page.waitForFunction(() => window.__garden.state.mode === 'walk' && !window.__garden.state.gliding, { timeout: 30000, polling: 200 }); await sleep(1500); await shot('swing-garden');
    const d = await page.evaluate(() => Math.hypot(window.__garden.player.pos.x + 19, window.__garden.player.pos.z - 21)); return d.toFixed(1) + ' m from the swings, cue: ' + await page.$eval('#cue', e => e.textContent.trim() || '(none)');
  });
  await step('hidden features stay hidden on the map', async () => {
    await page.evaluate(() => { window.__garden.setSetting('show.swings', false); window.__garden.setSetting('show.roses', false); });
    await page.keyboard.press('KeyM'); await sleep(900); const p = await page.$$eval('.map-place', b => b.map(x => x.getAttribute('aria-label').split(':')[0]));
    await page.keyboard.press('Escape'); await page.evaluate(() => { window.__garden.setSetting('show.swings', true); window.__garden.setSetting('show.roses', true); });
    if (p.includes('Swing Garden') || p.includes('Rose garden')) throw new Error('still shows ' + p.join(', ')); return p.join(', ');
  });
  // phone
  const ctx = await browser.createBrowserContext(), ph = await ctx.newPage(); ph.on('pageerror', e => errors.push('page error (phone): ' + e.message));
  await ph.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1' });
  await ph.goto(url, { waitUntil: 'load', timeout: 180000 }); await ph.waitForFunction(() => window.__garden && document.querySelector('#loading')?.classList.contains('done'), { timeout: 120000, polling: 500 });
  await ph.evaluate(() => window.__garden.setSetting('light', 'day'));
  await step('phone: open the map and tap a poem', async () => {
    await ph.tap('#enter-sample'); await ph.waitForFunction(() => window.__garden.state.mode === 'walk' && window.__garden.poems.length >= 10, { timeout: 180000, polling: 500 });
    await ph.tap('#minimap-btn'); await sleep(900); await ph.screenshot({ path: join(root, 'dev/shots/map-phone.png') });
    await ph.tap('.map-poem'); await ph.waitForFunction(() => window.__garden.state.mode === 'focus', { timeout: 30000, polling: 200 }); return 'reading on the phone';
  });
}

// ---- UX audit: every screen, axe results, tap targets, frame times ----
async function auditFlow(page, browser, url, errors) {
  const { readFile: rf, writeFile: wf, mkdir: mk } = await import('node:fs/promises');
  const axeSrc = await rf(join(root, 'node_modules/axe-core/axe.min.js'), 'utf8'), dir = join(root, 'dev/shots/audit'); await mk(dir, { recursive: true });
  const report = {};
  async function audit(pg, name) {
    await pg.screenshot({ path: join(dir, name + '.png') });
    await pg.evaluate(axeSrc);
    const r = await pg.evaluate(async () => { const res = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'best-practice'], resultTypes: ['violations'] }); return res.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, n: v.nodes.length, where: v.nodes.slice(0, 4).map(n => n.target.join(' ')) })); });
    r.push(...await pg.evaluate(() => [...document.querySelectorAll('button')].filter(b => b.offsetParent && !b.textContent.trim() && !b.getAttribute('aria-label') && !b.getAttribute('aria-labelledby')).map(b => ({ id: 'unnamed-button', where: [b.id || b.className] })).slice(0, 1)));
    report[name] = r; console.log('  ' + name + ': ' + (r.length ? r.map(v => `${v.id}(${v.n})`).join(' ') : 'no axe violations'));
  }
  async function runAll(pg, prefix, tap) {
    // a control that can't be reached is a finding, not a reason to stop
    const click = async sel => { try { await (tap ? pg.tap(sel) : pg.click(sel)); } catch (e) { (report[prefix + 'unreachable'] = report[prefix + 'unreachable'] || []).push(sel); console.log('  ' + prefix + 'could not reach ' + sel); await pg.evaluate(s => document.querySelector(s)?.click(), sel); } };
    await audit(pg, prefix + '01-intro');
    await click('#enter-sample'); await pg.waitForFunction(() => window.__garden.state.mode === 'walk' && window.__garden.poems.length >= 10, { timeout: 180000, polling: 500 });
    await sleep(1200); await audit(pg, prefix + '02-first-walk');
    report[prefix + 'hud'] = await pg.evaluate(() => { const b = [...document.querySelectorAll('#hud button')], r = b.map(x => x.getBoundingClientRect()); return { buttons: b.length, smallest: Math.round(Math.min(...r.map(q => Math.min(q.width, q.height)))), offscreen: r.filter(q => q.left < 0 || q.right > innerWidth).length, labels: b.map(x => x.getAttribute('aria-label')) }; });
    console.log('  ' + prefix + 'hud: ' + JSON.stringify(report[prefix + 'hud']).slice(0, 160));
    for (const [sel, name, wait] of [['#h-gardens', '03-gardens', 900], ['#h-custom', '04-customize', 1200], ['#h-time', '05-time', 500], ['#h-more', '06-menu', 500]]) {
      await click(sel); await sleep(wait); await audit(pg, prefix + name); await pg.keyboard.press('Escape'); await sleep(900);
      await pg.evaluate(() => document.querySelectorAll('.panel.open .x, #c-close, #g-close').forEach(b => b.click())); await sleep(700);
    }
    await click('#h-help'); await sleep(900); await audit(pg, prefix + '07-help'); await pg.keyboard.press('Escape'); await sleep(800);
    await pg.evaluate(() => { const g = window.__garden; g.openPoem([...g.plants.values()][2]); }); await sleep(3500); await audit(pg, prefix + '08-reader'); await pg.keyboard.press('Escape'); await sleep(1500);
    await click('#h-write'); await pg.waitForFunction(() => window.__garden.state.mode === 'writing', { timeout: 60000, polling: 200 }); await sleep(1500); await audit(pg, prefix + '09-editor'); await pg.keyboard.press('Escape'); await sleep(1500);
    await pg.evaluate(() => window.__garden.setSetting('light', 'night')); await sleep(4500); await audit(pg, prefix + '10-night');
    await click('#h-custom'); await sleep(1200); await audit(pg, prefix + '11-night-customize'); await pg.keyboard.press('Escape'); await sleep(700);
    await pg.evaluate(() => window.__garden.setSetting('light', 'day')); await sleep(3000);
  }
  console.log('desktop:'); await runAll(page, 'desktop-', false);
  // frame time while walking, on this machine
  report.fps = await page.evaluate(() => new Promise(res => { const t = []; let last = performance.now(); const f = n => { t.push(n - last); last = n; if (t.length < 240) requestAnimationFrame(f); else { t.sort((a, b) => a - b); res({ medianMs: +t[120].toFixed(1), p95Ms: +t[228].toFixed(1) }); } }; requestAnimationFrame(f); }));
  console.log('  frame time on this machine: ' + JSON.stringify(report.fps));
  const ctx = await browser.createBrowserContext(), ph = await ctx.newPage(); ph.on('pageerror', e => errors.push('page error (phone): ' + e.message));
  await ph.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1' });
  await ph.goto(url, { waitUntil: 'load', timeout: 180000 }); await ph.waitForFunction(() => window.__garden && document.querySelector('#loading')?.classList.contains('done'), { timeout: 120000, polling: 500 });
  await ph.evaluate(() => window.__garden.setSetting('light', 'day'));
  console.log('phone:'); await runAll(ph, 'phone-', true);
  await wf(join(dir, 'audit.json'), JSON.stringify(report, null, 1)); console.log('  wrote dev/shots/audit/audit.json');
}

// ---- what each quality level costs: render time per frame, measured around the frame callback ----
async function qualityFlow(page) {
  await page.click('#enter-sample'); await page.waitForFunction(() => window.__garden.state.mode === 'walk' && window.__garden.poems.length >= 10, { timeout: 180000, polling: 500 });
  await page.evaluate(() => { const p = window.__garden.player; p.pos.set(0, 0, 14); p.yaw = 0; p.pitch = -0.15; });
  for (const lv of ['high', 'medium', 'low']) {
    await page.evaluate(lv => window.__garden.chooseQuality(lv), lv); await sleep(2500);
    const r = await page.evaluate(() => new Promise(res => {
      // add up every render pass (reflection, scene, post) per frame
      const R = window.__garden.renderer, orig = R.render.bind(R); let tri = 0, calls = 0, px = 0; R.info.autoReset = false;
      R.render = (sc, cam) => { R.info.reset(); orig(sc, cam); tri += R.info.render.triangles; calls += R.info.render.calls; const t = R.getRenderTarget(); px += t ? t.width * t.height : R.domElement.width * R.domElement.height; };
      const N = 60; let n = 0; const f = () => { if (++n < N) requestAnimationFrame(f); else { R.render = orig; R.info.autoReset = true; res({ trianglesPerFrame: Math.round(tri / N), drawCallsPerFrame: Math.round(calls / N), megapixelsDrawnPerFrame: +(px / N / 1e6).toFixed(2), pixelRatio: R.getPixelRatio() }); } };
      requestAnimationFrame(f); }));
    console.log('  ' + lv.padEnd(7) + JSON.stringify(r));
  }
  await page.evaluate(() => window.__garden.chooseQuality('auto'));
}

// ---- Phase 5 behaviour: first steps, help, panels, drafts, undo ----
async function uxFlow(page) {
  const shot = n => page.screenshot({ path: join(root, `dev/shots/ux-${n}.png`) });
  await step('first steps appear for a first visit, and can be skipped', async () => {
    await page.click('#enter-sample'); await page.waitForFunction(() => window.__garden.state.mode === 'walk' && window.__garden.poems.length >= 10, { timeout: 180000, polling: 500 });
    await page.waitForSelector('#steps.show', { timeout: 8000 }); await shot('steps');
    const t = []; for (let i = 0; i < 3; i++) { t.push(await page.$eval('#steps-t', e => e.textContent)); await page.click('#steps-next'); await sleep(250); }
    await sleep(700); if (!(await page.$eval('#steps', e => e.hidden))) throw new Error('steps still showing'); return t.join(' → ');
  });
  await step('? opens the help sheet; Esc closes it and focus returns', async () => {
    await page.focus('#h-help'); await page.keyboard.press('Enter'); await page.waitForSelector('#helpsheet.open', { timeout: 5000 }); await sleep(900); await shot('help');
    const inside = await page.evaluate(() => document.querySelector('#helpsheet').contains(document.activeElement));
    await page.keyboard.press('Escape'); await sleep(1000);
    const back = await page.evaluate(() => document.activeElement && document.activeElement.id);
    if (!inside) throw new Error('focus did not move into the help sheet'); if (back !== 'h-help') throw new Error('focus went to ' + back); return 'focus in, then back on #h-help';
  });
  await step('Esc closes Customize; Tab stays inside it', async () => {
    await page.click('#h-custom'); await page.waitForSelector('#custom.open'); await sleep(600);
    for (let i = 0; i < 60; i++) await page.keyboard.press('Tab');
    const inside = await page.evaluate(() => document.querySelector('#custom').contains(document.activeElement));
    await page.keyboard.press('Escape'); await sleep(1000); const open = await page.$('#custom.open');
    if (!inside) throw new Error('Tab left the panel'); if (open) throw new Error('Esc did not close Customize');
  });
  await step('the More menu: labelled rows', async () => { await page.click('#h-more'); await sleep(500); await shot('menu'); const r = await page.$$eval('#menu button', b => b.filter(x => x.offsetParent).map(x => x.textContent.trim().replace(/\s+/g, ' '))); await page.keyboard.press('Escape'); return r.join(' | '); });
  await step('a draft survives closing the bench and reloading', async () => {
    await page.click('#h-write'); await page.waitForSelector('#editor.open', { timeout: 60000 }); await sleep(600);
    await page.type('#e-title', 'Unfinished'); await page.type('#e-body', 'The kettle sang\nbefore the house woke\nand I was alone with my grief and the tears of the morning\nmissing you, missing everything gone');
    await sleep(900); const count = await page.$eval('#e-count', e => e.textContent), sug = await page.$eval('#e-suggest', e => e.hidden ? '(none)' : e.textContent); await shot('editor');
    await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => window.__garden && document.querySelector('#loading')?.classList.contains('done'), { timeout: 120000, polling: 500 });
    await page.click('#enter'); await page.waitForFunction(() => window.__garden.state.mode === 'walk', { timeout: 180000, polling: 500 });
    await page.click('#h-write'); await page.waitForSelector('#editor.open', { timeout: 60000 }); await sleep(600);
    const back = await page.$eval('#e-body', e => e.value), note = await page.$eval('#e-draft', e => !e.hidden);
    await page.click('#e-cancel'); await sleep(800);
    if (!back.startsWith('The kettle sang') || !note) throw new Error('draft not restored'); return `${count}; suggestion: ${sug}`;
  });
  await step('removing a poem offers Undo, and Undo brings it back', async () => {
    const before = await page.evaluate(() => window.__garden.poems.length);
    await page.evaluate(() => { const g = window.__garden; g.openPoem([...g.plants.values()].find(p => !p.dying)); }); await sleep(2500);
    const title = await page.$eval('#r-title', e => e.textContent);
    await page.click('#r-del'); await sleep(300); await page.click('#r-yes'); await sleep(900); await shot('undo');
    const mid = await page.evaluate(() => window.__garden.poems.length);
    await page.click('#toast button'); await sleep(1500);
    const after = await page.evaluate(() => window.__garden.poems.length), has = await page.evaluate(t => window.__garden.poems.some(p => p.title === t), title);
    if (mid !== before - 1 || after !== before || !has) throw new Error(`${before} → ${mid} → ${after}`); return `“${title}”: ${before} → ${mid} → ${after}`;
  });
}
