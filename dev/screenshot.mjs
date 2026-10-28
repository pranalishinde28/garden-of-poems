// Headless smoke test and screenshots for The Garden of Poems.
//
//   node dev/screenshot.mjs                    screenshots of the built app (dist/)
//   node dev/screenshot.mjs --check            smoke test: fails on any page error
//   node dev/screenshot.mjs --legacy old.html  screenshots of the old single-file app
//   node dev/screenshot.mjs --check --url http://localhost:8080/   test a running server (npm run dev)
//   node dev/screenshot.mjs --flow swing        sit, swing, read five poems, stand up (desktop and phone)
//   node dev/screenshot.mjs --flow avatar       third person: walk, bench, swing, kneel to read, pond
//   node dev/screenshot.mjs --flow battery      frames drawn and CPU busy time per second: idle, walking, reading, map
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
  'season-monsoon': { pos: [10, 9, 34], look: [-2, 1, 4], season: 'monsoon', samples: true },
  'season-autumn': { pos: [10, 9, 34], look: [-2, 1, 4], season: 'autumn', samples: true },
  'fuji-view': { pos: [8, 2.6, 16], look: [-25, 14, -200], season: 'spring' },
  'fuji-high': { pos: [4, 14, 44], look: [-20, 10, -200], season: 'spring' },
  'sea-view': { pos: [8, 2.6, 16], look: [-25, 2, -200], season: 'spring', view: 'sea' },
  'sea-high': { pos: [4, 26, 60], look: [-10, -2, -60], season: 'monsoon', view: 'sea' },
  'sea-gate': { pos: [30, 3, 55], look: [140, -4, 90], season: 'spring', view: 'sea' },
  'lineup': { lineup: true, pos: [0, 0.95, 40.2], look: [0, 0.62, 36.6] },
  'kinds': { kinds: true, pos: [0.2, 0.75, 38.6], look: [0.2, 0.4, 36.6] },
  'kinds-walk': { kinds: 'walk', pos: [0.2, 0.75, 38.6], look: [0.2, 0.4, 36.6] },
  'spawn': { pos: [0, 1.7, 49], look: [0, 1.15, 20] },
  'gate-close': { pos: [1.2, 2.2, 44], look: [0, 3, 39] },
  'gate-autumn': { pos: [1.2, 2.2, 44], look: [0, 3, 39], season: 'autumn' },
  'top': { pos: [0, 130, 0.01], look: [0, 0, 0] },
  'fountain': { pos: [16.5, 2.4, -3.5], look: [11, 0.9, -10.2] },
  'fountain-close': { pos: [13.6, 1.6, -7.2], look: [11, 1.0, -10.2] },
  'shrine': { pos: [-29, 2.4, -2.5], look: [-47, 2.6, -4] },
  'shrine-close': { pos: [-39.6, 1.7, -3.4], look: [-45.7, 2.3, -3.9] },
  'pagoda': { pos: [25, 3, -19], look: [41, 7, -31] },
  'bell': { pos: [24, 2.2, -35.6], look: [29, 3.2, -43] },
  'day-fuji': { pos: [8, 2.6, 16], look: [-25, 14, -200], season: 'spring' },
  'sunset-fuji': { pos: [8, 2.6, 16], look: [-25, 14, -200], season: 'spring', light: 'sunset' },
  'sunset-gate': { pos: [0, 1.7, 49], look: [0, 1.6, 20], season: 'spring', light: 'sunset' },
  'day-high': { pos: [4, 14, 44], look: [-20, 10, -200], season: 'spring' },
  'sunset-high': { pos: [4, 14, 44], look: [-20, 10, -200], season: 'autumn', light: 'sunset' },
  'swing-close': { pos: [-12.4, 1.7, 13.6], look: [-19, 1.4, 21] },
  'swing-sunset': { pos: [-12.4, 1.7, 13.6], look: [-19, 1.4, 21], light: 'sunset' },
  'swing-night': { pos: [-12.4, 1.7, 13.6], look: [-19, 1.4, 21], light: 'night' },
  'peacocks': { pos: [30, 1.8, 15], look: [25.5, 0.9, 21.5], fan: true },
  'trees-a': { pos: [14, 3.2, 20], look: [4, 2.6, 6], season: 'spring', samples: true },
  'trees-b': { pos: [-18, 3.5, -6], look: [-8, 2.5, -14], season: 'spring', samples: true },
  'trees-c': { pos: [20, 4, -2], look: [24, 2.5, -14], season: 'spring', samples: true },
  'trees-d': { pos: [-4, 3, 20], look: [-14, 2.5, 30], season: 'autumn', samples: true },
  'bench-front': { pos: [-5.6, 1.7, 8.3], look: [-9.4, 1.0, 12.6] },
  'beach-castle': { pos: [27, 2.2, 74], look: [33, 0.2, 73], view: 'sea', season: 'spring' },
  'beach-wide': { pos: [-20, 3.5, -62], look: [-40, 0, -88], view: 'sea', season: 'spring' },
  'beach-sunset': { pos: [30, 2, 70], look: [60, 0.5, 70], view: 'sea', season: 'spring', light: 'sunset' },
  'qr-boards': { pos: [0, 1.7, 49], look: [0, 1.6, 20], links: [{ label: 'Instagram', url: 'https://instagram.com/garden.of.poems' }, { label: 'Facebook', url: 'https://facebook.com/gardenofpoems' }, { label: 'Substack', url: 'https://gardenofpoems.substack.com' }, { label: 'Goodreads', url: 'https://www.goodreads.com/gardenofpoems' }] },
  'qr-close': { pos: [3.2, 1.9, 43.5], look: [6.3, 2, 38.6], links: [{ label: 'Instagram', url: 'https://instagram.com/garden.of.poems' }, { label: 'Facebook', url: 'https://facebook.com/gardenofpoems' }, { label: 'Substack', url: 'https://gardenofpoems.substack.com' }, { label: 'Goodreads', url: 'https://www.goodreads.com/gardenofpoems' }] },
  'board-close': { pos: [-3.2, 1.9, 43.5], look: [-6.3, 2, 38.6], links: [{ label: 'Instagram', url: 'https://instagram.com/garden.of.poems' }, { label: 'Facebook', url: 'https://facebook.com/gardenofpoems' }, { label: 'Substack', url: 'https://gardenofpoems.substack.com' }, { label: 'Goodreads', url: 'https://www.goodreads.com/gardenofpoems' }] },
  'edge': { pos: [40, 4, 40], look: [58, 0.5, 30] },
  'edge-high': { pos: [30, 18, 30], look: [55, 0, 40] },
  'fest-day': { pos: [0, 1.7, 47], look: [0, 3.2, 22], season: 'spring' },
  'fest-night': { pos: [0, 1.7, 47], look: [0, 3.2, 22], season: 'spring', light: 'night' },
  'canopy-under': { pos: [3.5, 1.6, 34], look: [0, 4.6, 22], season: 'spring', light: 'sunset' },
  'canopy-night': { pos: [3.5, 1.6, 34], look: [0, 4.6, 22], season: 'spring', light: 'night' },
  'wall-night': { pos: [5.6, 1.8, 20.2], look: [11.6, 1.9, 20.2], season: 'spring', light: 'night', samples: true },
  'pond-night': { pos: [7, 2.4, 10], look: [0, -0.3, 0], season: 'spring', light: 'night', samples: true },
  'sky-night': { pos: [6, 2, 16], look: [-30, 30, -60], season: 'spring', light: 'night', samples: true },
  'creek': { pos: [-1, 3, -10], look: [-4, -0.6, -22] },
  'qr-garden': { pos: [3.2, 2.3, 43], look: [6.3, 2.5, 38.6], publicAs: 'pranaaa28', links: [] },
  'qr-empty': { pos: [3.2, 2.3, 43], look: [6.3, 2.5, 38.6], links: [] },
  'gorge-girl': { pos: [70.4, 2.1, 8.4], look: [110, -3, 13.2], season: 'spring' },
  'gorge-walk': { pos: [58, 2.1, 7], look: [110, -2, 13.2], season: 'spring' },
  'gorge-sunset': { pos: [62, 2.6, 8], look: [140, 14, 16], season: 'spring', light: 'sunset' },
  'gorge-mid': { pos: [66, 2.2, 6], look: [140, 14, 18], season: 'spring' },
  'sign-big': { pos: [90, 6, -0.5], look: [102.6, 9, 0.2], season: 'spring' },
  'sign-mid': { pos: [62, 4, 2], look: [102.6, 8, 0.2], season: 'spring' },
  'gorge-far2': { pos: [45, 2.1, 2], look: [110, 0, 13.2], season: 'spring' },
  'gorge-far3': { pos: [40, 2.1, 20], look: [110, 0, 10], season: 'spring' },
  'edge-night': { pos: [20, 14, 20], look: [-30, 0, -40], season: 'spring', light: 'night' },
  'edge-night2': { pos: [-40, 2, 40], look: [-72, 1, -10], season: 'spring', light: 'night' },
  'sign-face': { pos: [-4.4, 2.05, 41.8], look: [-6.3, 2.05, 38.6], links: [{ label: 'Instagram', url: 'https://instagram.com/prana_._' }, { label: 'Facebook', url: 'https://facebook.com/pranali' }, { label: 'Substack', url: 'https://pranali.substack.com' }, { label: 'Goodreads', url: 'https://www.goodreads.com/prana' }] },
  'qr-face5': { pos: [4.6, 2.05, 41.4], look: [6.3, 2.05, 38.6], publicAs: 'prana', links: [{ label: 'Instagram', url: 'https://instagram.com/prana_._' }, { label: 'Facebook', url: 'https://facebook.com/pranali' }, { label: 'Substack', url: 'https://pranali.substack.com' }, { label: 'Goodreads', url: 'https://www.goodreads.com/prana' }] },
  'gate-arrive': { pos: [0, 1.7, 49], look: [0, 2, 38], links: [{ label: 'Instagram', url: 'https://instagram.com/prana_._' }, { label: 'Facebook', url: 'https://facebook.com/pranali' }, { label: 'Substack', url: 'https://pranali.substack.com' }, { label: 'Goodreads', url: 'https://www.goodreads.com/prana' }] },
  'gate-night': { pos: [0, 1.7, 49], look: [0, 2, 38], light: 'night', links: [{ label: 'Instagram', url: 'https://instagram.com/prana_._' }, { label: 'Facebook', url: 'https://facebook.com/pranali' }, { label: 'Substack', url: 'https://pranali.substack.com' }, { label: 'Goodreads', url: 'https://www.goodreads.com/prana' }] },
  'fuji-top': { pos: [8, 2.6, 16], look: [-210, 330, -1000], season: 'spring' },
  'patch-pagoda': { pos: [28, 22, -12], look: [42, 0, -32], season: 'spring' },
  'patch-shrine': { pos: [-30, 22, 6], look: [-48, 0, -6], season: 'spring' },
  'patch-bell': { pos: [16, 20, -28], look: [30, 0, -46], season: 'spring' },
  'patch-top': { pos: [0, 95, 0.1], look: [0, 0, 0], season: 'spring' },
  'fuji-look': { pos: [70, 2.2, 8], look: [-210, 60, -1000], season: 'spring' },
  'fuji-bench': { pos: [-6, 2, 10], look: [-210, 40, -1000], season: 'spring' },
  'night-temples': { pos: [8, 2.6, 16], look: [-10, 8, -100], season: 'spring', light: 'night' },
  'night-pagoda': { pos: [30, 3, -14], look: [41, 5, -31], season: 'spring', light: 'night' },
  'night-shrine': { pos: [-34, 2.5, 4], look: [-47, 3, -4], season: 'spring', light: 'night' },
  'gorge-far': { pos: [22, 2.2, 4], look: [119, 11, 14.4], season: 'spring' },
  'gorge-deck': { pos: [68.5, 1.8, 8.2], look: [119, 10, 14.4], season: 'spring' },
  'gorge-in': { pos: [96.8, 3, 15.7], look: [145.6, 12, 12.2], season: 'spring' },
  'gorge-in-autumn': { pos: [96.8, 3, 15.7], look: [145.6, 12, 12.2], season: 'autumn' },
  'gorge-in-night': { pos: [96.8, 3, 15.7], look: [145.6, 12, 12.2], season: 'spring', light: 'night' },
  'gorge-high': { pos: [40, 34, -14], look: [130, 8, 22], season: 'spring' },
  'gorge-bird': { pos: [55, 70, -60], look: [150, 0, 30], season: 'spring' },
  'gorge-deck-night': { pos: [68.5, 1.8, 8.2], look: [119, 6, 14.4], season: 'spring', light: 'night' },
  'gorge-far-autumn': { pos: [22, 2.2, 4], look: [119, 11, 14.4], season: 'autumn' },
  'gorge-sea': { pos: [22, 2.2, 4], look: [119, 11, 14.4], season: 'spring', view: 'sea' },
  'creek2': { pos: [-9, 2.5, -36], look: [-8, -0.8, -48] },
  'fairy-night': { pos: [12, 2.2, 16], look: [4, 2.6, 4], season: 'spring', light: 'night', samples: true },
  'qr-face': { pos: [4.6, 2.05, 41.4], look: [6.3, 2.05, 38.6], links: [{ label: 'Instagram', url: 'https://instagram.com/garden.of.poems' }, { label: 'Facebook', url: 'https://facebook.com/gardenofpoems' }, { label: 'Substack', url: 'https://gardenofpoems.substack.com' }, { label: 'Goodreads', url: 'https://www.goodreads.com/gardenofpoems' }] },
  'fairy-close': { pos: [-2.6, 1.6, -6.5], look: [-6, 2.8, -13], season: 'spring', light: 'night', samples: true },
  'sea-stream': { pos: [-4, 4, -58], look: [-14, -0.5, -82], view: 'sea', season: 'spring' },
  'sea-night': { pos: [8, 2.6, 16], look: [-25, 2, -200], view: 'sea', season: 'spring', light: 'night' },
  'qr-public': { pos: [4.6, 2.05, 41.4], look: [6.3, 2.05, 38.6], publicAs: 'prana', links: [{ label: 'Instagram', url: 'https://instagram.com/prana_._' }, { label: 'Substack', url: 'https://prana.substack.com' }] },
  'gate-back': { pos: [0, 1.7, 33], look: [0, 1.5, 50] },
  'entrance-high': { pos: [7, 7, 48], look: [0, 1.5, 30] },
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
    page.on('pageerror', e => errors.push('page error: ' + e.message + (process.env.STACK ? '\n' + e.stack : '')));
    page.on('console', m => { if (m.type() === 'error') errors.push('console error: ' + m.text()); });
    // third-party files (Google Fonts, hCaptcha's widget and images) may be slow or blocked on the test machine; only our own files must load
    page.on('requestfailed', r => { if (!/fonts\.g|hcaptcha\.com/.test(r.url())) errors.push('request failed: ' + r.url()); });
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
    else if (FLOW === 'battery') await batteryFlow(page);
    else if (FLOW === 'profile') await profileFlow(page);
    else if (FLOW === 'programs') await programsFlow(page);
    else if (FLOW === 'refl') { await page.evaluate(() => { const g = window.__garden; g.state.mode = 'cinematic'; g.camera.position.set(7, 2.2, 9); g.curLook.set(0, -0.4, 0); g.camera.lookAt(g.curLook); }); await sleep(2500); console.log('  reflection pixels:', JSON.stringify(await page.evaluate(() => { const g = window.__garden, rt = g.reflRT, out = []; for (const [fx, fy] of [[.5, .5], [.5, .2], [.5, .8], [.2, .5]]) { const b = new Uint8Array(4); g.renderer.readRenderTargetPixels(rt, Math.floor(rt.width * fx), Math.floor(rt.height * fy), 1, 1, b); out.push([...b]); } return { size: [rt.width, rt.height], out }; }))); }
    else if (FLOW === 'quality') await qualityFlow(page);
    else if (FLOW === 'card') await cardFlow(page, browser, url, errors);
    else if (FLOW === 'autoq') { // Auto quality must not step down while you simply stand still (the garden rests at 20 fps on purpose)
      await page.click('#enter'); await page.waitForFunction(() => window.__garden.state.mode === 'walk', { timeout: 180000, polling: 300 });
      await page.evaluate(() => { document.querySelector('#steps-skip')?.click(); window.__garden.chooseQuality('auto'); });
      await sleep(15000); const still = await page.evaluate(() => window.__garden.quality.level);
      await page.keyboard.down('KeyW'); await sleep(5000); await page.keyboard.up('KeyW'); const walked = await page.evaluate(() => window.__garden.quality.level);
      console.log(`  Auto after standing 15 s: ${still}; after walking: ${walked}`); if (still !== 'high') errors.push('Auto stepped down while standing still');
    }
    else if (FLOW === 'fountain') { // walk up, look in (E), watch the koi, toss a coin, step back
      await page.click('#enter'); await page.waitForFunction(() => window.__garden.state.mode === 'walk', { timeout: 180000, polling: 300 });
      await sleep(900); await page.evaluate(() => { document.querySelector('#steps-skip')?.click(); const p = window.__garden.player; p.pos.set(14.2, 0, -6.3); p.yaw = Math.atan2(14.2 - 11, -6.3 + 10.2); p.pitch = -0.15; });
      await sleep(1500); await page.screenshot({ path: join(root, 'dev/shots/fountain-near.png') });
      const cue = await page.$eval('#cue', e => e.textContent.trim()); await page.keyboard.press('KeyE');
      await sleep(5000); await page.screenshot({ path: join(root, 'dev/shots/fountain-look.png') });
      const mode = await page.evaluate(() => window.__garden.state.mode); console.log(`  cue "${cue}", mode after E: ${mode}`); await page.click('#fv-coin'); await sleep(1600); await page.screenshot({ path: join(root, 'dev/shots/fountain-coin.png') });
      await page.click('#fv-back'); await sleep(2500); const after = await page.evaluate(() => window.__garden.state.mode);
      console.log(`  cue "${cue}", looking: ${mode}, after stepping back: ${after}`); if (mode !== 'fountain' || after !== 'walk') errors.push('fountain view did not open or close');
      await page.evaluate(() => { const g = window.__garden; g.state.mode = 'cinematic'; g.camera.position.set(4.2, 1.6, 4.8); g.curLook.set(0, -0.4, 0); g.camera.lookAt(g.curLook); }); await sleep(1200); await page.screenshot({ path: join(root, 'dev/shots/pond-koi.png') });
    }
    else if (FLOW === 'row') { // the jetty, rowing, through Manai Falls into the cave, the Sunflower Garden, and the white door home
      const shot = async n => { await sleep(300); await page.screenshot({ path: join(root, `dev/shots/row-${n}.png`) }); };
      await page.click('#enter'); await page.waitForFunction(() => window.__garden.state.mode === 'walk', { timeout: 180000, polling: 300 });
      // walk from the lookout through the gap in the rail and down the meadow
      await sleep(900); await page.evaluate(() => { document.querySelector('#steps-skip')?.click(); const g = window.__garden, p = g.gorgeWorld(71, 0), q = g.gorgeWorld(100, 0); g.player.pos.set(p.x, 0, p.z); g.player.yaw = Math.atan2(p.x - q.x, p.z - q.z); g.player.pitch = -0.05; });
      await sleep(800); await page.keyboard.down('KeyW'); await sleep(4500); await page.keyboard.up('KeyW');
      const walked = await page.evaluate(() => { const g = window.__garden, p = g.player.pos, c = Math.cos(0.12), s = Math.sin(0.12); return p.x * c + p.z * s; }); await shot('meadow');
      console.log(`  walked down the meadow to along = ${walked.toFixed(1)} m (the deck is at 72.6)`); if (walked < 78) errors.push('could not walk down from the lookout');
      await sleep(900); await page.evaluate(() => { document.querySelector('#steps-skip')?.click(); const g = window.__garden, p = g.gorgeWorld(83.5, 0), q = g.gorgeWorld(100, 0); g.player.pos.set(p.x, 0, p.z); g.player.yaw = Math.atan2(p.x - q.x, p.z - q.z); g.player.pitch = -0.05; });
      await sleep(1500); const cue = await page.$eval('#cue', e => e.textContent.trim()); await shot('jetty');
      await page.keyboard.press('KeyE'); await sleep(2600); const m1 = await page.evaluate(() => window.__garden.state.mode); await shot('aboard');
      await page.keyboard.down('KeyW'); await sleep(5000); await page.keyboard.up('KeyW'); await shot('rowing');
      await page.keyboard.press('KeyV'); await sleep(1500); await shot('third'); await page.keyboard.press('KeyV'); await sleep(500);
      const moved = await page.evaluate(() => { const b = window.__garden.myBoat; return Math.hypot(b.pos.x - b.home.x, b.pos.z - b.home.z); });
      // out in the canyon, between the falls, facing Manai Falls
      await page.evaluate(() => { const g = window.__garden, b = g.myBoat, p = g.gorgeWorld(142, 2), q = g.gorgeWorld(146, -10); b.pos.set(p.x, b.pos.y, p.z); b.yaw = Math.atan2(q.x - p.x, q.z - p.z); g.player.yaw = b.yaw + Math.PI; g.player.pitch = 0.12; });
      await sleep(1200); await shot('canyon');
      await page.evaluate(() => { const g = window.__garden, b = g.myBoat, p = g.gorgeWorld(146, -6), q = g.gorgeWorld(146, -14); b.pos.set(p.x, b.pos.y, p.z); b.yaw = Math.atan2(q.x - p.x, q.z - p.z); g.player.yaw = b.yaw + Math.PI; g.player.pitch = 0.1; });
      await sleep(1000); await shot('falls');
      await page.keyboard.down('KeyW'); await sleep(2600); await shot('curtain'); await sleep(2600); await shot('cave');
      await page.waitForFunction(() => window.__garden.state.world === 'sun', { timeout: 30000, polling: 300 }).catch(() => {});
      await page.keyboard.up('KeyW'); await sleep(3200); await shot('sun-arrive');
      const world = await page.evaluate(() => window.__garden.state.world);
      const look = async (n, x, z, yaw, pitch = -0.02) => { await page.evaluate((x, z, yaw, pitch) => { const g = window.__garden, O = g.worlds.sun.arrive.pos; g.player.pos.set(O.x + x, 0, O.z - 34.8 + z); g.player.yaw = yaw; g.player.pitch = pitch; }, x, z, yaw, pitch); await sleep(1400); await shot(n); };
      await look('sun-back', 0, 33, Math.PI); await look('sun-field', 3, 10, 0.1); await look('sun-arch', 0, -30, 0, 0.05); await look('sun-plaza', 0, -44, 0, 0.12); await look('sun-lagoon', 6, -84, 0.15, 0.16); await look('sun-castle', 0, -128, 0, 0.3);
      await page.evaluate(() => window.__garden.setSetting('light', 'night')); await sleep(2500); await look('sun-night', 6, -80, 0.2, 0.16); await look('sun-night-plaza', 0, -44, 0, 0.15);
      await page.evaluate(() => window.__garden.setSetting('light', 'sunset')); await sleep(2500); await look('sun-sunset', 6, -80, 0.2, 0.16);
      await page.evaluate(() => window.__garden.setSetting('light', 'day')); await sleep(1500);
      await page.evaluate(() => window.__garden.setSetting('light', 'night')); await sleep(2000); await look('sun-field-night', 4.1, 24, 0.15, 0.05); await look('sun-field-wide', -14, 30, -0.6, -0.05); await look('sun-field-side', 20, 5, 1.2, 0.0);
      await page.evaluate(() => { const g = window.__garden; g.state.showFw = true; }); await look('sun-fair-night', 30, -40, 0.7, 0.18); await sleep(3000); await look('sun-fireworks', 0, -40, 0, 0.42);
      for (const k of ['wheel', 'carousel', 'coaster', 'swings', 'boats']) { await page.evaluate(k => { const g = window.__garden, r = g.rides.find(r => r.key === k); g.state.mode = 'walk'; g.late.startRide(r); }, k); await sleep(2500); await page.screenshot({ path: join(root, `dev/shots/row-ride-${k}.png`) }); const m = await page.evaluate(() => window.__garden.state.mode); if (m !== 'ride') errors.push('ride ' + k + ' did not start'); await page.click('#ride-off'); await sleep(600); }
      await page.evaluate(() => window.__garden.setSetting('light', 'day')); await sleep(1500);
      await look('sun-swing', 26, -62, -1.57, 0.25); await look('sun-canal', -30, -60, 1.2, 0.05);
      await look('sun-door', -4.2 - 1.14 + 0.0, -1.6, 0, 0.12);
      const dcue = await page.$eval('#cue', e => e.textContent.trim()); await page.keyboard.press('KeyE'); await sleep(1200); await shot('door-open');
      await page.waitForFunction(() => window.__garden.state.world !== 'sun' && window.__garden.state.mode === 'walk', { timeout: 20000, polling: 300 }).catch(() => {});
      await sleep(2600); await shot('home');
      const back = await page.evaluate(() => [window.__garden.state.world, window.__garden.state.mode]);
      console.log(`  cue "${cue}", aboard: ${m1}, rowed ${moved.toFixed(1)} m, world after the cave: ${world}, door cue "${dcue}", after the door: ${back}`);
      if (m1 !== 'boat' || moved < 2 || world !== 'sun' || back[0] === 'sun' || back[1] !== 'walk') errors.push('rowing or crossing worlds failed');
    }
    else if (FLOW === 'help') { // the guide: each tab
      await page.click('#enter'); await page.waitForFunction(() => window.__garden.state.mode === 'walk', { timeout: 180000, polling: 300 });
      await sleep(900); await page.evaluate(() => document.querySelector('#steps-skip')?.click()); await page.keyboard.press('KeyH'); await sleep(1200);
      for (const t of ['move', 'do', 'keys', 'read']) { await page.click('#ht-' + t); await sleep(500); await page.screenshot({ path: join(root, `dev/shots/help-${t}.png`) }); }
    }
    else if (FLOW === 'castle') { // the secret world, the castle's gate, the hall inside, every ride, and out again
      const shot = async n => { await sleep(400); await page.screenshot({ path: join(root, `dev/shots/castle-${n}.png`) }); };
      await page.click('#enter'); await page.waitForFunction(() => window.__garden.state.mode === 'walk', { timeout: 180000, polling: 300 });
      await sleep(900); await page.evaluate(() => { document.querySelector('#steps-skip')?.click(); window.__garden.late.enterSunWorld(); });
      await page.waitForFunction(() => window.__garden.state.world === 'sun' && window.__garden.state.mode === 'walk', { timeout: 30000, polling: 300 });
      await sleep(2500);
      await page.evaluate(() => { const g = window.__garden, O = g.worlds.sun.arrive.pos; g.player.pos.set(O.x + 1, 0, O.z - 34.8 - 136); g.player.yaw = 0; g.player.pitch = 0.12; });
      // walk straight into the gate: no prompt, it takes you in
      await page.keyboard.down('KeyW'); await sleep(2500); await page.keyboard.up('KeyW'); const cue = 'castle';
      await page.waitForFunction(() => window.__garden.state.mode === 'walk' && window.__garden.player.pos.y < -50 || window.__garden.camera.position.y < -50, { timeout: 20000, polling: 300 }).catch(() => {});
      await page.waitForFunction(() => window.__garden.state.mode === 'walk', { timeout: 20000, polling: 300 }); await sleep(2600); await shot('inside');
      const inside = await page.evaluate(() => window.__garden.camera.position.y < -50); if (!inside) errors.push('walking into the gate did not take you inside');
      await page.evaluate(() => { const g = window.__garden; g.player.yaw = 0.6; g.player.pitch = 0.12; }); await sleep(1000); await shot('inside2');
      await page.evaluate(() => { const g = window.__garden; g.player.yaw = -0.7; g.player.pitch = 0.1; }); await sleep(1000); await shot('inside3');
      for (const k of []) {
        await page.evaluate(k => { const g = window.__garden, r = g.rides.find(r => r.key === k); g.late.startRide(r); }, k);
        if (k === 'bumper') { await page.keyboard.down('KeyW'); await sleep(2500); await page.keyboard.up('KeyW'); } else await sleep(k === 'drop' ? 6000 : 2500);
        await page.screenshot({ path: join(root, `dev/shots/castle-ride-${k}.png`) });
        const m = await page.evaluate(() => window.__garden.state.mode); if (m !== 'ride') errors.push('ride ' + k + ' did not start');
        await page.click('#ride-off'); await sleep(700);
      }
      await page.evaluate(() => { const g = window.__garden, p = g.worlds.sun.arrive.pos; }); 
      await page.evaluate(() => { const g = window.__garden; g.player.yaw = 0; g.player.pitch = 1.0; }); await sleep(1200); await shot('vault');
      await page.evaluate(() => { const g = window.__garden; g.player.yaw = -1.2; g.player.pitch = 0.1; }); await sleep(1000); await shot('mirrors');
      // a poem on the wall, from the middle of the hall and close up; the curtains between them; reading one
      const back = await page.evaluate(() => { const p = window.__garden.player.pos; return { x: p.x, z: p.z }; });
      const sp = await page.evaluate(() => window.__garden.POEM_SPOTS);
      if (sp.length < 22) errors.push('only ' + sp.length + ' poems on the walls');
      const s0 = sp.find(s => s.k === 9) || sp[0], cx = (sp[0].x + sp[sp.length - 1].x) / 2;
      await page.evaluate((x, z) => { const g = window.__garden; g.player.pos.set(x, 0, z); g.player.yaw = Math.PI / 2; g.player.pitch = 0.1; }, cx, s0.z); await sleep(1500); await shot('poem-far');
      await page.evaluate((x, z) => { const g = window.__garden; g.player.pos.set(x, 0, z); g.player.yaw = Math.PI / 2; g.player.pitch = 0.12; }, cx - (cx - s0.x) * 0.1, s0.z + 8); await sleep(1500); await shot('curtains');
      await page.evaluate((x, z) => { const g = window.__garden; g.player.pos.set(x, 0, z); g.player.yaw = Math.PI / 2; g.player.pitch = 0.22; }, (s0.x + cx) / 2, s0.z); await sleep(1500); await shot('poem'); await page.evaluate((x, z) => { window.__garden.player.pos.set(x, 0, z); }, s0.x, s0.z); await sleep(900);
      const pcue = await page.$eval('#cue', e => e.textContent.trim()); await page.keyboard.press('KeyE'); await sleep(1200); await shot('poem-read');
      const ptitle = await page.$eval('#wp-title', e => e.textContent); await page.keyboard.press('ArrowRight'); await sleep(300); const ptitle2 = await page.$eval('#wp-title', e => e.textContent);
      console.log(`  poem cue "${pcue}"; reads "${ptitle}", then "${ptitle2}"`); if (!/read/i.test(pcue) || !ptitle || ptitle === ptitle2) errors.push('reading a wall poem did not work');
      await page.keyboard.press('Escape'); await sleep(900);
      await page.evaluate(b => { const g = window.__garden; g.player.pos.set(b.x, 0, b.z); g.player.yaw = 0; }, back); await sleep(800);
      await page.evaluate(() => { const g = window.__garden, p = g.camera.position; g.player.pos.set(p.x, 0, p.z - 70); g.player.yaw = 0; g.player.pitch = 0.05; }); await sleep(1200); await shot('north');
      await page.evaluate(() => { const g = window.__garden, p = g.camera.position; g.player.pos.set(p.x, 0, p.z + 119); g.player.yaw = Math.PI; }); await sleep(300); await page.keyboard.down('KeyW'); await sleep(1500); await page.keyboard.up('KeyW'); await sleep(2500); await page.waitForFunction(() => window.__garden.state.mode === 'walk', { timeout: 20000, polling: 300 }); await sleep(2600); await shot('out');
      const outside = await page.evaluate(() => window.__garden.camera.position.y > -20);
      // out at the fair: the drop tower and the teacups, seen and ridden
      const lookAt = async (n, x, z, yaw, pitch) => { await page.evaluate((x, z, yaw, pitch) => { const g = window.__garden, O = g.worlds.sun.arrive.pos; g.player.pos.set(O.x + x, 0, O.z - 34.8 + z); g.player.yaw = yaw; g.player.pitch = pitch; }, x, z, yaw, pitch); await sleep(1500); await shot(n); };
      await lookAt('tower', -2, -50, -1.03, 0.32); await lookAt('teacups', -18, -40, 1.6, 0.05);
      await lookAt('carousel', 0, -49.5, 0, 0.12); await lookAt('carousel-near', 7.5, -55.5, 0.8, 0.18); await lookAt('wheel', 0, -64, 0.6, 0.25);
      await page.evaluate(() => { const g = window.__garden; g.late.startRide(g.rides.find(r => r.key === 'carousel')); }); await sleep(3500); await page.screenshot({ path: join(root, 'dev/shots/castle-ride-carousel.png') }); await page.click('#ride-off'); await sleep(700);
      for (const [k, wait] of [['teacups', 2500], ['drop', 17500], ['drop', 3000]]) {
        if (!(k === 'drop' && wait === 3000)) { await page.evaluate(k => { const g = window.__garden, r = g.rides.find(r => r.key === k); g.late.startRide(r); }, k); }
        await sleep(wait); await page.screenshot({ path: join(root, `dev/shots/castle-ride-${k}${wait === 3000 ? '-fall' : ''}.png`) });
        if (await page.evaluate(() => window.__garden.state.mode) !== 'ride') errors.push('ride ' + k + ' did not start');
        if (k !== 'drop' || wait === 3000) { await page.click('#ride-off'); await sleep(700); }
      } console.log(`  walked in, rides all started; walked back out: ${outside}`); if (!outside) errors.push('walking to the door did not take you out');
      if (!/castle/i.test(cue)) errors.push('no castle cue at the gate');
    }
    else if (FLOW === 'sunmap') { // the secret world's map: open with M, go to the drop tower, then the Hall of Mirrors; and running
      await page.click('#enter'); await page.waitForFunction(() => window.__garden.state.mode === 'walk', { timeout: 180000, polling: 300 });
      await sleep(900); await page.evaluate(() => { document.querySelector('#steps-skip')?.click(); });
      // running: tap Shift, walk, compare speed
      const speed = async () => { const a = await page.evaluate(() => ({ x: window.__garden.player.pos.x, z: window.__garden.player.pos.z })); await page.keyboard.down('KeyW'); await sleep(1500); await page.keyboard.up('KeyW'); const b = await page.evaluate(() => ({ x: window.__garden.player.pos.x, z: window.__garden.player.pos.z })); return Math.hypot(b.x - a.x, b.z - a.z); };
      const walked = await speed(); await page.keyboard.press('ShiftLeft'); await sleep(300); const ran = await speed();
      const runOn = await page.evaluate(() => window.__garden.state.run); await page.screenshot({ path: join(root, 'dev/shots/run-btn.png') });
      console.log(`  walked ${walked.toFixed(1)} m, ran ${ran.toFixed(1)} m in the same time; run is ${runOn}`); if (!runOn || ran < walked * 1.4) errors.push('tapping Shift did not make you run');
      await page.keyboard.press('ShiftLeft'); await sleep(300); const sprinted = await speed(); const pace = await page.evaluate(() => window.__garden.state.pace);
      await page.screenshot({ path: join(root, 'dev/shots/sprint-btn.png') });
      console.log(`  sprinted ${sprinted.toFixed(1)} m; pace ${pace}`); if (pace !== 2 || sprinted < ran * 1.4) errors.push('a second tap of Shift did not sprint');
      await page.keyboard.press('ShiftLeft'); await sleep(300); if (await page.evaluate(() => window.__garden.state.pace) !== 0) errors.push('a third tap of Shift did not go back to walking');
      await page.evaluate(() => window.__garden.late.enterSunWorld()); await page.waitForFunction(() => window.__garden.state.world === 'sun' && window.__garden.state.mode === 'walk', { timeout: 30000, polling: 300 }); await sleep(2500);
      await page.keyboard.press('KeyM'); await sleep(1500); await page.screenshot({ path: join(root, 'dev/shots/sunmap.png') });
      const n = await page.$$eval('#sm-marks .sm-place', b => b.length); if (n < 10) errors.push('the secret map has too few places: ' + n);
      await page.evaluate(() => [...document.querySelectorAll('#sm-marks .sm-place')].find(b => /drop tower/i.test(b.textContent)).click());
      await sleep(3500); await page.screenshot({ path: join(root, 'dev/shots/sunmap-went.png') });
      const cue = await page.$eval('#cue', e => e.textContent.trim()); if (!/drop tower/i.test(cue)) errors.push('the map did not take you to the drop tower: ' + cue);
      await page.keyboard.press('KeyM'); await sleep(1200);
      await page.evaluate(() => [...document.querySelectorAll('#sm-marks .sm-place')].find(b => /Hall of Mirrors/i.test(b.textContent)).click());
      await sleep(4500); const inside = await page.evaluate(() => window.__garden.camera.position.y < -50);
      console.log(`  map places: ${n}; at the tower the cue says "${cue}"; Hall of Mirrors from the map: ${inside}`); if (!inside) errors.push('the map did not take you into the hall');
    }
    else if (FLOW === 'secret') { // the map's secret garden goes straight to the Sunflower Garden
      await page.click('#enter'); await page.waitForFunction(() => window.__garden.state.mode === 'walk', { timeout: 180000, polling: 300 });
      await sleep(900); await page.evaluate(() => document.querySelector('#steps-skip')?.click()); await page.keyboard.press('KeyM'); await sleep(1500);
      await page.evaluate(() => [...document.querySelectorAll('#map-marks .map-place')].find(b => /secret garden/i.test(b.getAttribute('aria-label'))).click());
      await page.waitForFunction(() => window.__garden.state.world === 'sun' && window.__garden.state.mode === 'walk', { timeout: 20000, polling: 300 }).catch(() => {});
      await sleep(2500); await page.screenshot({ path: join(root, 'dev/shots/secret.png') });
      const w = await page.evaluate(() => window.__garden.state.world); console.log(`  after the map's secret garden: ${w}`); if (w !== 'sun') errors.push('secret garden did not open');
    }
    else if (FLOW === 'gorge') { // walk to the lookout, look into the gorge (E), then step back
      await page.click('#enter'); await page.waitForFunction(() => window.__garden.state.mode === 'walk', { timeout: 180000, polling: 300 });
      await sleep(900); await page.evaluate(() => { document.querySelector('#steps-skip')?.click(); const p = window.__garden.player; p.pos.set(70.1, 0, 8.4); p.yaw = Math.atan2(70.1 - 120, 8.4 - 14.4); p.pitch = 0.04; });
      await sleep(1500); await page.screenshot({ path: join(root, 'dev/shots/gorge-lookout.png') });
      const cue = await page.$eval('#cue', e => e.textContent.trim()); await page.keyboard.press('KeyE');
      await sleep(2000); await page.screenshot({ path: join(root, 'dev/shots/gorge-glide.png') });
      await sleep(5000); await page.screenshot({ path: join(root, 'dev/shots/gorge-look.png') });
      const mode = await page.evaluate(() => window.__garden.state.mode);
      await page.click('#gv-back'); await sleep(6000); const after = await page.evaluate(() => window.__garden.state.mode);
      await page.screenshot({ path: join(root, 'dev/shots/gorge-back.png') });
      console.log(`  cue "${cue}", looking: ${mode}, after stepping back: ${after}`); if (mode !== 'gorge' || after !== 'walk' || !/Takachiho/.test(cue)) errors.push('gorge view did not open or close');
    }
    else if (FLOW === 'creatures') { // be a bird: take off over the garden; be a cat: trot and pounce
      await page.click('#enter'); await page.waitForFunction(() => window.__garden.state.mode === 'walk', { timeout: 180000, polling: 300 });
      await sleep(900); await page.evaluate(() => { document.querySelector('#steps-skip')?.click(); const g = window.__garden; g.setAvatar({ kind: 'bird', plumage: 'cream' }); g.setThirdPerson(true); });
      await sleep(1200); await page.keyboard.press('Space'); await page.keyboard.down('KeyW'); await sleep(2600); await page.screenshot({ path: join(root, 'dev/shots/bird-climb.png') });
      await sleep(2400); await page.screenshot({ path: join(root, 'dev/shots/bird-glide.png') }); const alt = await page.evaluate(() => window.__garden.player.alt.toFixed(1)); await page.keyboard.up('KeyW');
      await page.evaluate(() => { const g = window.__garden; g.setAvatar({ kind: 'cat', coat: 'siamese' }); g.player.pos.set(0, 0, 46); g.player.yaw = 0; }); await sleep(800);
      await page.keyboard.down('KeyW'); await sleep(1500); await page.screenshot({ path: join(root, 'dev/shots/cat-walk.png') }); await page.keyboard.press('Space'); await sleep(250); await page.screenshot({ path: join(root, 'dev/shots/cat-pounce.png') }); await page.keyboard.up('KeyW');
      await sleep(4500); await page.screenshot({ path: join(root, 'dev/shots/cat-sit.png') });
      console.log('  after one tap the bird is still flying at ' + alt + ' m'); if (+alt < 4) errors.push('the bird did not stay up');
    }
    else if (FLOW === 'boxes') { // the writing page and the menu, at sunset (as the owner saw them)
      await page.click('#enter'); await page.waitForFunction(() => window.__garden.state.mode === 'walk', { timeout: 180000, polling: 300 });
      await sleep(900); await page.evaluate(() => { document.querySelector('#steps-skip')?.click(); window.__garden.setSetting('light', 'sunset'); }); await sleep(3000);
      await page.click('#h-sky'); await sleep(700); await page.screenshot({ path: join(root, 'dev/shots/box-sky.png') }); await page.click('#h-sky'); await sleep(500);
      await page.click('#h-more'); await sleep(700); await page.screenshot({ path: join(root, 'dev/shots/box-menu.png') }); await page.keyboard.press('Escape'); await sleep(500);
      await page.click('#h-write'); await page.waitForFunction(() => window.__garden.state.mode === 'writing', { timeout: 60000, polling: 300 }); await sleep(2500);
      await page.type('#e-body', 'The plum tree forgot\nit was night.'); await page.evaluate(() => document.querySelector('#editor').scrollTop = 0); await sleep(1500); await page.screenshot({ path: join(root, 'dev/shots/box-editor.png') });
    }
    else if (FLOW === 'wade') { // by the sea: walk off the lawn, across the sand and into the water
      await page.click('#enter'); await page.waitForFunction(() => window.__garden.state.mode === 'walk', { timeout: 180000, polling: 300 });
      await sleep(900); await page.evaluate(() => { document.querySelector('#steps-skip')?.click(); const g = window.__garden; g.setSetting('view', 'sea'); g.player.pos.set(0, 0, 66); g.player.yaw = Math.PI; g.player.pitch = -0.1; });
      await sleep(1500); await page.keyboard.down('KeyW'); await sleep(9000); await page.keyboard.up('KeyW'); await sleep(600);
      const st = await page.evaluate(() => { const p = window.__garden.player.pos; return { r: Math.hypot(p.x, p.z).toFixed(1), eye: window.__garden.camera.position.y.toFixed(2) }; });
      await page.screenshot({ path: join(root, 'dev/shots/wade.png') }); console.log('  walked out to r ' + st.r + ' m, eye at ' + st.eye); if (+st.r < 90) errors.push('could not reach the water');
    }
    else if (FLOW === 'panels') { // the two customize boxes and the gardens box
      await page.click('#enter'); await page.waitForFunction(() => window.__garden.state.mode === 'walk', { timeout: 180000, polling: 300 });
      await sleep(900); await page.evaluate(() => document.querySelector('#steps-skip')?.click());
      await page.evaluate(() => window.__garden.setSetting('links', [{ label: 'Instagram', url: 'https://instagram.com/prana_._' }]));
      await page.click('#h-custom'); await sleep(1300); await page.evaluate(() => document.querySelector('#c-presets').scrollIntoView({ block: 'center' })); await sleep(400); await page.screenshot({ path: join(root, 'dev/shots/panel-links.png') }); await page.keyboard.press('Escape'); await sleep(900);
      // one box at a time: open Gardens, then You on top of it; only You should stay open
      await page.click('#h-gardens'); await sleep(1100); await page.click('#h-you'); await sleep(1300);
      const open = await page.$$eval('.panel.open', ps => ps.map(p => p.id)); console.log('  open after Gardens then You: ' + open.join(', ')); if (open.length !== 1) errors.push('boxes overlap: ' + open.join(', '));
      await page.screenshot({ path: join(root, 'dev/shots/panel-one.png') }); await page.keyboard.press('Escape'); await sleep(900);
      for (const [b, n] of [['#h-you', 'you'], ['#h-custom', 'garden'], ['#h-gardens', 'gardens']]) { await page.click(b); await sleep(1300); await page.screenshot({ path: join(root, `dev/shots/panel-${n}.png`) }); await page.keyboard.press('Escape'); await sleep(900); }
    }
    else if (FLOW === 'jump') { // every kind jumps with Space
      await page.click('#enter'); await page.waitForFunction(() => window.__garden.state.mode === 'walk', { timeout: 180000, polling: 300 });
      await sleep(900); await page.evaluate(() => { document.querySelector('#steps-skip')?.click(); window.__garden.setThirdPerson(true); });
      for (const kind of ['girl', 'boy', 'cat']) {
        await page.evaluate(k => window.__garden.setAvatar({ kind: k }), kind); await sleep(800);
        await page.keyboard.down('Space'); await sleep(180); const top = await page.evaluate(() => window.__garden.player.alt); await page.keyboard.up('Space');
        if (kind === 'girl') await page.screenshot({ path: join(root, 'dev/shots/jump-girl.png') });
        await sleep(1200); const back = await page.evaluate(() => window.__garden.player.alt);
        console.log(`  ${kind}: up to ${top.toFixed(2)} m, back to ${back.toFixed(2)}`); if (!(top > 0.2) || back > 0.01) errors.push(kind + ' did not jump and land');
      }
    }
    else if (FLOW === 'minimap') { // hide the corner map, then bring it back
      await page.click('#enter'); await page.waitForFunction(() => window.__garden.state.mode === 'walk', { timeout: 180000, polling: 300 });
      await sleep(900); await page.evaluate(() => document.querySelector('#steps-skip')?.click()); await sleep(800);
      await page.screenshot({ path: join(root, 'dev/shots/mini-on.png') }); await page.click('#minimap-hide'); await sleep(500);
      const hidden = await page.$eval('#minimap-btn', b => b.hidden); await page.screenshot({ path: join(root, 'dev/shots/mini-off.png') });
      await page.click('#minimap-show'); await sleep(500); const back = await page.$eval('#minimap-btn', b => !b.hidden);
      console.log('  hidden: ' + hidden + ', back: ' + back); if (!hidden || !back) errors.push('the corner map did not hide and return');
    }
    else if (FLOW === 'swingview') { // on a swing: switch between your own eyes and watching yourself
      await page.click('#enter'); await page.waitForFunction(() => window.__garden.state.mode === 'walk', { timeout: 180000, polling: 300 });
      await sleep(900); await page.evaluate(() => { document.querySelector('#steps-skip')?.click(); window.__garden.setThirdPerson(false); window.__garden.sit(0); });
      await page.waitForFunction(() => window.__garden.state.mode === 'swing', { timeout: 60000, polling: 200 }); await sleep(1200);
      await page.screenshot({ path: join(root, 'dev/shots/swing-eyes.png') }); const t0 = await page.$eval('#sw-view', b => b.textContent);
      await page.click('#sw-view'); await sleep(1800); await page.screenshot({ path: join(root, 'dev/shots/swing-self.png') });
      const third = await page.evaluate(() => window.__garden.state.thirdPerson), t1 = await page.$eval('#sw-view', b => b.textContent);
      console.log(`  button "${t0}" → "${t1}", watching yourself: ${third}`); if (!third) errors.push('the swing view did not change');
    }
    else if (FLOW === 'lowend') { // an older laptop: the CPU six times slower, a 1280×720 screen; frame times per quality and what Auto picks
      const cdp = await page.target().createCDPSession(); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
      await page.setViewport({ width: 1280, height: 720 });
      await page.click('#enter'); await page.waitForFunction(() => window.__garden.state.mode === 'walk', { timeout: 300000, polling: 500 });
      await sleep(1500); await page.evaluate(() => document.querySelector('#steps-skip')?.click());
      const measure = () => page.evaluate(() => new Promise(res => { const t = []; let last = performance.now(), n = 0; const f = now => { t.push(now - last); last = now; if (++n < 90) requestAnimationFrame(f); else { t.sort((a, b) => a - b); res({ medianMs: +t[45].toFixed(1), fps: +(1000 / t[45]).toFixed(1) }); } }; requestAnimationFrame(f); }));
      for (const q of ['high', 'medium', 'low']) { await page.evaluate(q => window.__garden.chooseQuality(q), q); await sleep(1500); await page.keyboard.down('KeyW'); console.log(`  ${q.padEnd(6)} walking ${JSON.stringify(await measure())}`); await page.keyboard.up('KeyW'); }
      await page.evaluate(() => window.__garden.chooseQuality('auto')); await page.keyboard.down('KeyW'); await sleep(12000); await page.keyboard.up('KeyW');
      console.log(`  Auto settled on: ${await page.evaluate(() => window.__garden.quality.level)}; then ${JSON.stringify(await measure())}`);
    }
    else if (FLOW === 'parasol') { // your figure with a parasol, from behind, at the gate
      await page.click('#enter'); await page.waitForFunction(() => window.__garden.state.mode === 'walk', { timeout: 180000, polling: 300 });
      await sleep(1200); await page.evaluate(() => { document.querySelector('#steps-skip')?.click(); const g = window.__garden; g.setAvatar({ extra: 'parasol', outfit: 'kimono', cloth: '#2c3d6b', accent: '#f2c46a', hairStyle: 'bob' }); g.setThirdPerson(true); });
      await sleep(2500); await page.screenshot({ path: join(root, 'dev/shots/parasol-back.png') });
      await page.keyboard.down('KeyW'); await sleep(1200); await page.screenshot({ path: join(root, 'dev/shots/parasol-walk.png') }); await page.keyboard.up('KeyW');
      await page.evaluate(() => { const g = window.__garden; g.setThirdPerson(false); g.state.mode = 'cinematic'; const p = g.player.pos; g.camera.position.set(p.x + 1.6, 1.3, p.z - 2.2); g.curLook.set(p.x, 1.0, p.z); g.camera.lookAt(g.curLook); }); await sleep(800);
      await page.evaluate(() => { const g = window.__garden; g.setThirdPerson(true); }); await sleep(300); await page.screenshot({ path: join(root, 'dev/shots/parasol-front.png') });
    }
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
    if (v.kinds) await page.evaluate(pose => {
      // a girl, the boy from the owner's picture, a girl with a pink bow, a siamese cat, a tabby, a cockatiel, a blue bird
      window.__garden.lineup([{ kind: 'girl' }, { kind: 'boy', hairStyle: 'messy', outfit: 'jacket', cloth: '#3b3a38', accent: '#c9474a', extra: 'scarf', skin: '#a8744f' }, { kind: 'girl', extra: 'bow', hairStyle: 'twintails', cloth: '#efe6d4' }, { kind: 'cat', coat: 'siamese' }, { kind: 'cat', coat: 'tabby' }, { kind: 'bird', plumage: 'cream' }, { kind: 'bird', plumage: 'blue' }], -1.3, 36.6, pose);
    }, v.kinds === 'walk' ? 'walk' : 'idle');
    if (v.lineup) await page.evaluate(() => {
      const O = [['dress', '#9cc0d6', 'bun', '#1d1a19', '#f3cfb5', 'none'], ['dress', '#e7b7c4', 'twintails', '#5c3f2b', '#fbe3d3', 'parasol'], ['yukata', '#3d4a6b', 'bob', '#1d1a19', '#e2b393', 'none'],
        ['kimono', '#b5603d', 'long', '#8a4f2e', '#c99573', 'none'], ['casual', '#6f8a5a', 'short', '#3a2a20', '#86593b', 'scarf'], ['coat', '#7b5a86', 'tail', '#c49a62', '#f3cfb5', 'hat']];
      window.__garden.lineup(O.map(([outfit, cloth, hairStyle, hairColor, skin, extra], i) => ({ outfit, cloth, hairStyle, hairColor, skin, extra, accent: ['#f3efe6', '#e9c46a', '#c9474a', '#e9c46a', '#c9474a', '#2f3f5c'][i], height: [1, 0.94, 0.97, 1.05, 1.02, 0.92][i] })), -1.25, 36.6);
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
      if (g.SETTINGS.view !== (v.view || 'fuji')) g.setSetting('view', v.view || 'fuji');
      { const L = v.light || 'day'; if (g.SETTINGS.light !== L) g.setSetting('light', L); g.state.dusk = L === 'sunset' ? 1 : 0; g.state.night = L === 'night' ? 1 : 0; }
      g.camera.position.set(...v.pos); g.curLook.set(...v.look); g.camera.lookAt(g.curLook);
      if (v.publicAs) { g.cloud.garden = { is_public: true, name: 'The Garden of Poems' }; g.cloud.profile = { username: v.publicAs }; }
      if (v.links) { g.setSetting('links', v.links); }
      if (v.fan && g.animals) g.animals.forEach(a => { if (a.fanT !== undefined) { a.fanT = 20; } });
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
    // sample in a frame the garden actually drew: an idle garden skips frames (core/power.js), and a
    // WebGL canvas reads back empty in a frame it didn't draw
    const lit = await page.evaluate(() => new Promise(res => {
      const G = window.__garden, last = G ? G.framesDrawn : -1;
      const tick = () => {
        if (G && G.framesDrawn === last) { requestAnimationFrame(tick); return; }
        const c = document.querySelector('canvas'), x = document.createElement('canvas'); x.width = 32; x.height = 32;
        const g = x.getContext('2d'); g.drawImage(c, 0, 0, 32, 32); const d = g.getImageData(0, 0, 32, 32).data;
        let sum = 0; for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2]; res(sum / (32 * 32 * 3));
      };
      requestAnimationFrame(tick);
    }));
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
  await page.evaluate(() => { const g = window.__garden; g.setAvatar({ outfit: 'dress', cloth: '#9cc0d6', accent: '#f3efe6', hairStyle: 'twintails', hairColor: '#1d1a19', skin: '#f3cfb5', extra: 'none', height: 1 }); });
  await step('enter, switch to third person (V)', async () => {
    await page.click('#enter-sample'); await page.waitForFunction(() => window.__garden.state.mode === 'walk' && window.__garden.poems.length >= 10, { timeout: 180000, polling: 500 });
    await page.keyboard.press('KeyV'); await sleep(1500);
    if (!(await page.evaluate(() => window.__garden.state.thirdPerson))) throw new Error('not in third person');
  });
  await step('change your figure in the You box (live preview)', async () => {
    await page.click('#h-you'); await sleep(1200);
    await page.click('[data-av="outfit"] [data-v="dress"]'); await page.click('[data-av="hairStyle"] [data-v="twintails"]'); await page.click('[data-av="cloth"] button:nth-child(1)'); await sleep(1500);
    await page.$eval('#youpanel', e => { e.scrollTop = 0; }); await shot('editor');
    const a = await page.evaluate(() => JSON.parse(localStorage.getItem('garden-of-poems:avatar')));
    if (a.outfit !== 'dress' || a.hairStyle !== 'twintails') throw new Error('not saved: ' + JSON.stringify(a));
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
  await step('click 1: open the map', async () => { await page.keyboard.press('KeyM'); await sleep(900); if (!(await page.$('#mapview.open'))) throw new Error('map did not open'); const n = await page.$$eval('.map-poem', b => b.length), p = await page.$$eval('.map-place', b => b.map(x => x.getAttribute('aria-label'))); await shot('full'); return `${n} poems, places: ${p.join(' | ')}`; });
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

// ---- the poem card: the cover swings open, pages turn like a book ----
async function cardFlow(page, browser, url, errors) {
  const shot = async (n, p = page) => { await p.screenshot({ path: join(root, `dev/shots/card-${n}.png`) }); };
  const title = (p = page) => p.$eval('#r-title', e => e.textContent);
  await step('enter with the sample poems', async () => {
    await page.click('#enter-sample'); await page.waitForFunction(() => window.__garden.state.mode === 'walk' && window.__garden.poems.length >= 10, { timeout: 180000, polling: 500 });
    await page.evaluate(() => document.querySelector('#steps-skip')?.click()); await sleep(800);
  });
  await step('open a poem: the cover swings open', async () => {
    await page.evaluate(() => { const g = window.__garden; g.openPoem([...g.plants.values()][4]); });
    await sleep(500); await shot('cover-1'); await sleep(300); await shot('cover-2'); await sleep(2400); await shot('open');
    return title();
  });
  await step('→ turns the page forward', async () => {
    const t0 = await title(); await page.keyboard.press('ArrowRight'); await sleep(240); await shot('turn-1'); await sleep(200); await shot('turn-2'); await sleep(1700); await shot('turned');
    const t1 = await title(); if (t1 === t0) throw new Error('still on ' + t0); return `${t0} → ${t1}`;
  });
  await step('← turns it back', async () => { const t0 = await title(); await page.keyboard.press('ArrowLeft'); await sleep(330); await shot('back-1'); await sleep(1700); const t1 = await title(); if (t1 === t0) throw new Error('still on ' + t0); return `${t0} → ${t1}`; });
  await step('a private garden shows no hearts or notes', async () => {
    const v = await page.evaluate(() => ['#r-heart', '#r-talk', '#r-likes', '#r-notes'].map(s => document.querySelector(s).hidden));
    if (v.some(x => !x)) throw new Error(JSON.stringify(v)); return 'none shown';
  });
  const ctx = await browser.createBrowserContext(), ph = await ctx.newPage(); ph.on('pageerror', e => errors.push('page error (phone): ' + e.message));
  await ph.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1' });
  await ph.goto(url, { waitUntil: 'load', timeout: 180000 }); await ph.waitForFunction(() => window.__garden && document.querySelector('#loading')?.classList.contains('done'), { timeout: 120000, polling: 500 });
  await ph.evaluate(() => window.__garden.setSetting('light', 'day'));
  await step('phone: the card as a bottom sheet', async () => {
    await ph.tap('#enter-sample'); await ph.waitForFunction(() => window.__garden.state.mode === 'walk' && window.__garden.poems.length >= 10, { timeout: 180000, polling: 500 });
    await ph.evaluate(() => { document.querySelector('#steps-skip')?.click(); const g = window.__garden; g.openPoem([...g.plants.values()][2]); }); await sleep(3200); await shot('phone', ph);
    await ph.tap('#r-next'); await sleep(2000); return title(ph);
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

// ---- battery: what the page costs per second in everyday moments ----
// frames drawn per second (each one is GPU work) and main-thread busy time (CPU), from Chrome's own metrics
async function batteryFlow(page) {
  const results = {}; await page.bringToFront();
  console.log('  window focused: ' + await page.evaluate(() => document.hasFocus()));
  const measure = async (label, ms = 8000) => {
    const d0 = await page.evaluate(() => window.__garden.framesDrawn ?? 0);
    await page.evaluate(() => { window.__frames = 0; const f = () => { window.__frames++; window.__raf = requestAnimationFrame(f); }; cancelAnimationFrame(window.__raf); window.__raf = requestAnimationFrame(f); });
    const a = await page.metrics(); const t0 = Date.now(); await sleep(ms); const b = await page.metrics(); const dt = (Date.now() - t0) / 1000;
    const fr = await page.evaluate(() => window.__frames);
    const drawn = (await page.evaluate(() => window.__garden.framesDrawn ?? null)) ?? null;
    results[label] = { drawnPerSec: drawn === null ? +(fr / dt).toFixed(1) : +((drawn - d0) / dt).toFixed(1), cpuBusyPct: +(100 * (b.TaskDuration - a.TaskDuration) / dt).toFixed(1), scriptPct: +(100 * (b.ScriptDuration - a.ScriptDuration) / dt).toFixed(1) };
    console.log('  ' + label.padEnd(26) + JSON.stringify(results[label]));
  };
  await page.click('#enter-sample'); await page.waitForFunction(() => window.__garden.state.mode === 'walk' && window.__garden.poems.length >= 10, { timeout: 180000, polling: 500 });
  await page.evaluate(() => document.querySelector('#steps-skip')?.click()); await sleep(25000); // past the first shader compiles
  await measure('standing still');
  await page.keyboard.down('KeyW'); await page.keyboard.down('KeyA'); await measure('walking'); await page.keyboard.up('KeyW'); await page.keyboard.up('KeyA');
  await page.evaluate(() => { const g = window.__garden; g.openPoem([...g.plants.values()][1]); }); await sleep(3000); await measure('reading a poem'); await page.keyboard.press('Escape'); await sleep(1500);
  await page.keyboard.press('KeyM'); await sleep(1200); await measure('map open'); await page.keyboard.press('Escape'); await sleep(800);
  return results;
}

// ---- where the CPU goes while standing still: top functions by self time (build with --minify false) ----
async function profileFlow(page) {
  await page.click('#enter-sample'); await page.waitForFunction(() => window.__garden.state.mode === 'walk' && window.__garden.poems.length >= 10, { timeout: 180000, polling: 500 });
  await page.evaluate(() => document.querySelector('#steps-skip')?.click()); await page.bringToFront(); await sleep(28000);
  const cdp = await page.createCDPSession(); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start');
  await sleep(6000); const { profile } = await cdp.send('Profiler.stop');
  const dt = new Map(); const byId = new Map(profile.nodes.map(n => [n.id, n]));
  profile.samples.forEach((id, i) => { const n = byId.get(id), f = n.callFrame, key = `${f.functionName || '(anon)'} ${f.url.split('/').pop()}:${f.lineNumber}`; dt.set(key, (dt.get(key) || 0) + (profile.timeDeltas[i] || 0)); });
  const total = [...dt.values()].reduce((a, b) => a + b, 0);
  [...dt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18).forEach(([k, v]) => console.log('  ' + (100 * v / total).toFixed(1).padStart(5) + '%  ' + k));
}

// ---- are shader programs being created while nothing changes? ----
async function programsFlow(page) {
  await page.click('#enter-sample'); await page.waitForFunction(() => window.__garden.state.mode === 'walk' && window.__garden.poems.length >= 10, { timeout: 180000, polling: 500 });
  await page.evaluate(() => document.querySelector('#steps-skip')?.click()); await sleep(8000);
  const snap = () => page.evaluate(() => { const R = window.__garden.renderer; return { programs: R.info.programs.length, names: R.info.programs.map(p => p.name + ':' + p.usedTimes) }; });
  await sleep(25000); const a = await snap(); await sleep(5000); const b = await snap();
  console.log(`  programs after settling: ${a.programs} → ${b.programs} over 5 s`);
  const before = new Set(a.names.map(n => n.split(':')[0]));
  console.log('  new or changed:', b.names.filter(n => !a.names.includes(n)).slice(0, 12).join(' | '));
  const keys = await page.evaluate(() => window.__garden.renderer.info.programs.slice(-6).map(p => (p.cacheKey || '').split(',').filter(x => x && x !== 'false' && x !== '0' && x !== 'true').slice(-14).join(',')));
  keys.forEach(k => console.log('  key: ' + k.slice(0, 300)));
}
