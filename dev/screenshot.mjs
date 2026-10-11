// Headless smoke test and screenshots for The Garden of Poems.
//
//   node dev/screenshot.mjs                    screenshots of the built app (dist/)
//   node dev/screenshot.mjs --check            smoke test: fails on any page error
//   node dev/screenshot.mjs --legacy old.html  screenshots of the old single-file app
//   node dev/screenshot.mjs --check --url http://localhost:8080/   test a running server (npm run dev)
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
  const browser = await puppeteer.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
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

    if (CHECK) await smoke(page);
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
    if (!v.intro) await page.evaluate(v => {
      const g = window.__garden;
      if (!document.querySelector('#hide-ui')) { const s = document.createElement('style'); s.id = 'hide-ui'; s.textContent = '#intro,#loading,#hud,.toast,#toast{display:none!important}'; document.head.append(s); }
      g.state.mode = 'cinematic';
      if (g.SETTINGS.season !== (v.season || 'spring')) g.setSetting('season', v.season || 'spring');
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
