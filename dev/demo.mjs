// A demo film of the garden, recorded in headless Chrome and encoded by Chrome itself (no ffmpeg needed).
//
//   node dev/demo.mjs --url http://localhost:8081/ --frames <empty folder> --out dev/shots/demo.mp4
//
// Needs a dev server with local Supabase (see docs/database.md): the film signs up a fresh poet whose garden holds
// the twelve sample poems, so it can heart its own poem. Nothing touches the live database.
// It records the page with the DevTools screencast (about 28 frames a second), then dev/demo-encode.mjs replays the
// frames in real time into Chrome's own H.264 recorder, and dev/fmp4-to-mp4.py rewrites that as a plain MP4.
import puppeteer from 'puppeteer';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const opt = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = opt('url', 'http://localhost:8081/'), FRAMES = opt('frames'), OUT = opt('out', 'dev/shots/demo.mp4');
const W = 1280, H = 720;
if (!FRAMES) throw new Error('--frames <folder> is required');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const GPU = process.platform === 'darwin' ? ['--use-angle=metal'] : [];

// Sonnet 18, William Shakespeare (1609): public domain
const SONNET = `Shall I compare thee to a summer's day?
Thou art more lovely and more temperate:
Rough winds do shake the darling buds of May,
And summer's lease hath all too short a date;
Sometime too hot the eye of heaven shines,
And often is his gold complexion dimm'd;
And every fair from fair sometime declines,
By chance or nature's changing course untrimm'd;
But thy eternal summer shall not fade,
Nor lose possession of that fair thou ow'st;
Nor shall Death brag thou wander'st in his shade,
When in eternal lines to time thou grow'st:
So long as men can breathe or eyes can see,
So long lives this, and this gives life to thee.`;

const browser = await puppeteer.launch({ headless: true, protocolTimeout: 900000, args: [...GPU, '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage(); await page.setViewport({ width: W, height: H });
page.on('pageerror', e => console.log('page error:', e.message));
page.on('dialog', d => d.accept());
const go = async () => { await page.goto(URL_ + (URL_.includes('?') ? '&' : '?') + 'debug', { waitUntil: 'load', timeout: 120000 }); await page.waitForFunction(() => window.__garden && document.querySelector('#enter'), { timeout: 120000, polling: 300 }); };
const g = (f, ...a) => page.evaluate(f, ...a);

// ---------- off camera: a fresh poet with the sample garden ----------
await go();
await page.click('#enter-sample'); await page.waitForFunction(() => window.__garden.state.mode === 'walk' && window.__garden.poems.length >= 10, { timeout: 180000, polling: 500 });
const email = `demo${Date.now() % 1e7}@grove.test`;
await g(async (email) => { const c = window.__garden.cloud; await c.sb.auth.signUp({ email, password: 'garden-demo-1', options: { data: { username: 'deep' + String(Date.now() % 1e5), display_name: 'Deep' } } }); }, email);
await page.waitForFunction(() => window.__garden.cloud.user, { timeout: 60000, polling: 500 });
await page.waitForFunction(async () => { const c = window.__garden.cloud; const { count } = await c.sb.from('poems').select('id', { count: 'exact', head: true }).eq('owner', c.user.id); return count >= 10; }, { timeout: 120000, polling: 1500 });
await g(async () => { const c = window.__garden.cloud; await c.sb.from('gardens').update({ name: 'The Garden of Poems', is_public: true, settings: Object.assign({}, window.__garden.SETTINGS, { light: 'day', season: 'spring', weather: 'clear', view: 'fuji' }) }).eq('owner', c.user.id); try { localStorage.setItem('garden-of-poems:seen-steps', '1'); sessionStorage.setItem('garden-of-poems:offered', '1'); } catch (e) { /* none */ } });
await go();
// a clear spring morning whatever the clock says (auto light and season follow the real time); the account's own
// settings arrive a moment after the page loads, so wait for them first
await page.waitForFunction(() => window.__garden.cloud.user && window.__garden.cloud.garden, { timeout: 60000, polling: 300 }); await sleep(1500);
await g(() => { const gg = window.__garden; gg.chooseQuality && gg.chooseQuality('high'); gg.setSetting('light', 'day'); gg.setSetting('season', 'spring'); gg.setSetting('weather', 'clear'); gg.setSetting('view', 'fuji'); });
console.log('poet ready:', email);

// a caption in the garden's own hand, part of the page so the screencast records it
await g(() => {
  const s = document.createElement('style'); s.textContent = `#demo-cap{position:fixed;left:50%;bottom:122px;transform:translate(-50%,8px);z-index:99999;padding:.55rem 1.6rem .65rem;border-radius:14px;background:rgba(246,235,210,.92);color:#2e2014;font:500 1.5rem/1.3 "Cormorant Garamond",Georgia,serif;font-style:italic;box-shadow:0 8px 26px rgba(30,20,10,.3);border:1px solid rgba(120,84,40,.4);opacity:0;transition:opacity .7s,transform .7s;pointer-events:none;text-align:center;max-width:80vw}
#demo-cap.show{opacity:1;transform:translate(-50%,0)} #demo-cap.left{left:23%;bottom:46%} #demo-cap b{font-family:"IM Fell English",serif;font-style:normal;font-weight:400;display:block;font-size:1.05rem;letter-spacing:.06em;color:#7a5532}
#demo-end{position:fixed;inset:0;z-index:99998;display:grid;place-items:center;background:radial-gradient(circle at 50% 45%,rgba(40,28,16,.55),rgba(10,8,6,.92));opacity:0;transition:opacity 1.6s;pointer-events:none;text-align:center;color:#f3e6c8;font:italic 1.6rem "Cormorant Garamond",serif}
#demo-end.show{opacity:1} #demo-end h1{font:400 3.6rem "IM Fell English",serif;letter-spacing:.12em;margin:0 0 .6rem}`;
  document.head.append(s); const c = document.createElement('div'); c.id = 'demo-cap'; document.body.append(c);
  const e = document.createElement('div'); e.id = 'demo-end'; e.innerHTML = '<div><h1>THE GARDEN OF POEMS</h1>Every poem you write leaves something growing here.</div>'; document.body.append(e);
});
const cap = async (title, line, ms = 0, where = '') => { await g((t, l, w) => { const c = document.querySelector('#demo-cap'); if (!t && !l) { c.classList.remove('show'); return; } c.innerHTML = (t ? `<b>${t}</b>` : '') + (l || ''); c.classList.toggle('left', w === 'left'); c.classList.add('show'); }, title, line, where); if (ms) await sleep(ms); };
const uncap = () => cap('', '');

// walk with the real keys: hold W and steer toward each point in turn (forward is -sin(yaw), -cos(yaw))
async function walk(points, { near = 1.3, max = 25000 } = {}) {
  await blur(); await page.keyboard.down('KeyW');
  for (const [tx, tz] of points) {
    const t0 = Date.now();
    while (Date.now() - t0 < max) {
      const d = await g((tx, tz) => { const p = window.__garden.player, want = Math.atan2(p.pos.x - tx, p.pos.z - tz); let dy = want - p.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); p.yaw += dy * 0.22; p.pitch += (-0.04 - p.pitch) * 0.1; return Math.hypot(p.pos.x - tx, p.pos.z - tz); }, tx, tz);
      if (d < near) break; await sleep(40);
    }
  }
  await page.keyboard.up('KeyW');
}
// turn the head slowly toward a point (and pitch), standing still
async function look(tx, tz, pitch = 0, ms = 1600) {
  const n = Math.round(ms / 40);
  for (let i = 0; i < n; i++) { await g((tx, tz, pitch) => { const p = window.__garden.player, want = Math.atan2(p.pos.x - tx, p.pos.z - tz); let dy = want - p.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); p.yaw += dy * 0.08; p.pitch += (pitch - p.pitch) * 0.08; }, tx, tz, pitch); await sleep(40); }
}
// keys must reach the garden, not a button that kept focus after a click (Space would press that button)
const blur = () => g(() => { const a = document.activeElement; if (a && a !== document.body) a.blur(); });
const key = async (k, ms = 120) => { await blur(); await page.keyboard.down(k); await sleep(ms); await page.keyboard.up(k); };
const press = async k => { await blur(); await page.keyboard.press(k); };
const place = (x, z, yaw, pitch = -0.04) => g((x, z, yaw, pitch) => { const p = window.__garden.player; p.pos.set(x, 0, z); p.yaw = yaw; p.pitch = pitch; }, x, z, yaw, pitch);
const setting = (k, v) => g((k, v) => window.__garden.setSetting(k, v), k, v);

// ---------- recording ----------
rmSync(FRAMES, { recursive: true, force: true }); mkdirSync(FRAMES, { recursive: true });
const cdp = await page.createCDPSession(); const stamps = []; let n = 0;
cdp.on('Page.screencastFrame', f => { const i = n++; writeFileSync(join(FRAMES, `${String(i).padStart(6, '0')}.jpg`), Buffer.from(f.data, 'base64')); stamps.push(f.metadata.timestamp); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: W, maxHeight: H });
const scene = async (name, f) => { const t = Date.now(); try { await blur(); await f(); } catch (e) { console.log(`scene ${name} failed: ${e.message}`); } console.log(`scene ${name}: ${((Date.now() - t) / 1000).toFixed(1)} s`); };

await scene('welcome', async () => {
  await sleep(5000);
  await page.click('#enter'); await page.waitForFunction(() => window.__garden.state.mode === 'walk', { timeout: 60000, polling: 200 }); await sleep(1500);
});
await scene('gate', async () => {
  await cap('Arrive', 'Your garden’s name is over the gate.'); await look(0, 20, 0.04, 2400); await sleep(1200);
  await cap('Walk in', 'Through the gate and under the wisteria.'); await walk([[0, 40], [0, 33]]); await uncap();
  await walk([[0.3, 26], [0, 19]]);
});
await scene('bench', async () => {
  const B = await g(() => window.__garden.BENCH);
  const fx = B.x + Math.sin(B.face) * 2.2, fz = B.z + Math.cos(B.face) * 2.2;
  const a0 = Math.PI / 2, a1 = Math.atan2(fz, fx), pts = [];
  for (let k = 1; k <= 4; k++) { const a = a0 + (a1 - a0) * k / 4; pts.push([Math.cos(a) * 11.5, Math.sin(a) * 11.5]); }
  await cap('The writing bench', 'Every poem begins on this white bench.'); await walk([...pts, [fx, fz]], { near: 1.0 });
  await look(B.x, B.z, -0.15, 1200);
  await press('KeyE'); await page.waitForFunction(() => window.__garden.state.mode === 'writing', { timeout: 15000, polling: 200 }); await sleep(1800);
});
await scene('write', async () => {
  await cap('Write', 'Sonnet 18 by Shakespeare, which is public domain.');
  await page.click('#e-title'); await page.keyboard.type('Shall I compare thee', { delay: 45 });
  await page.click('#e-body'); const lines = SONNET.split('\n');
  for (const [i, l] of lines.entries()) { if (i < 4) await page.keyboard.type(l, { delay: 16 }); else await page.evaluate(t => { const b = document.querySelector('#e-body'); b.value += t; b.dispatchEvent(new Event('input', { bubbles: true })); }, l); if (i < lines.length - 1) { await page.keyboard.press('Enter'); if (i >= 4) await sleep(160); } }
  await sleep(600);
  await g(() => { const m = [...document.querySelectorAll('#e-moods button')].find(b => /love/i.test(b.textContent)) || document.querySelector('#e-moods button'); m && m.click(); });
  await sleep(1200); await g(() => document.querySelector('#editor').scrollTo({ top: 1e5, behavior: 'smooth' })); await sleep(1400);
  await cap('Plant it', 'The poem becomes a seed.'); await page.click('#e-go');
  await sleep(1500); await cap('Watch it grow', 'The seed flies across the garden and grows into a cherry tree.'); await sleep(9000); await uncap();
});
await scene('read', async () => {
  await page.waitForFunction(() => window.__garden.state.mode === 'walk', { timeout: 30000, polling: 300 }).catch(() => {});
  await g(() => { const gg = window.__garden, pl = [...gg.plants.values()].find(p => p.poem.title === 'Shall I compare thee'); if (pl) gg.openPoem(pl); });
  await page.waitForFunction(() => window.__garden.state.mode === 'focus', { timeout: 15000, polling: 200 }); await sleep(2500);
  await cap('Read', 'Walk up to any tree to read the poem it grew from.', 0, 'left'); await sleep(3500);
  await page.waitForFunction(() => !document.querySelector('#r-heart').hidden, { timeout: 15000, polling: 300 }).catch(() => {});
  await cap('Love it', 'A heart for the poem.', 0, 'left'); await page.click('#r-heart').catch(() => {}); await sleep(3000);
  await uncap(); await press('Escape'); await sleep(2200);
});
await scene('swing', async () => {
  await cap('The Swing Garden', 'Swing as high as you like, with Mount Fuji ahead.');
  await g(() => window.__garden.sit(2)); await page.waitForFunction(() => window.__garden.state.mode === 'swing', { timeout: 30000, polling: 200 }); await sleep(2000);
  await blur(); await page.keyboard.down('KeyW'); await sleep(4200); await page.keyboard.up('KeyW');
  await press('KeyK'); await sleep(5500);
  await cap('Keep swinging', 'K keeps the swing going at this height.'); await sleep(5000);
  await uncap(); await press('Escape'); await page.waitForFunction(() => window.__garden.state.mode === 'walk', { timeout: 15000, polling: 200 }).catch(() => {}); await sleep(1500);
});
await scene('avatars', async () => {
  await place(-2, 30, Math.atan2(-2 - 0, 30 - 0), -0.08); await g(() => window.__garden.setThirdPerson(true)); await sleep(900);
  await cap('Choose who you are', 'A girl…'); await g(() => window.__garden.setAvatar({ kind: 'girl', hairStyle: 'twintails', extra: 'bow', cloth: '#efe6d4' })); await walk([[-1, 24]], { max: 4000 }); await sleep(600);
  await cap('Choose who you are', '…a boy…'); await g(() => window.__garden.setAvatar({ kind: 'boy', hairStyle: 'messy', outfit: 'jacket', cloth: '#3b3a38', accent: '#c9474a', extra: 'scarf', skin: '#a8744f' })); await walk([[-0.5, 19]], { max: 4000 }); await key('Space'); await sleep(1400);
  await cap('Choose who you are', '…a cat, who pounces…'); await g(() => window.__garden.setAvatar({ kind: 'cat' })); await walk([[3, 15.5]], { max: 4000 }); await key('Space'); await sleep(1600);
  await cap('Choose who you are', '…or a bird.'); await g(() => window.__garden.setAvatar({ kind: 'bird', plumage: 'cream' })); await sleep(1400);
});
await scene('fly', async () => {
  // pressing Space takes off, and keeping it held climbs (the bird cruises at 6 m otherwise, below the treetops);
  // a second, fresh press would land it
  await cap('Fly', 'Press Space to take off, and hold it to climb over the trees.'); await blur(); await page.keyboard.down('Space'); await sleep(3600); await page.keyboard.up('Space');
  await walk([[-10, -8], [-24, -22], [-12, -38]], { near: 4, max: 9000 });
  await cap('A bird’s eye', 'Press V to see the garden through the bird’s eyes.'); await press('KeyV');
  await walk([[14, -34], [30, -6]], { near: 4, max: 9000 }); await press('KeyV');
  await cap('Fly', 'Over the pond, and back.'); await walk([[18, 10], [6, 22]], { near: 4, max: 9000 });
  await key('Space'); await sleep(3500); await uncap();
  await g(() => { window.__garden.setAvatar({ kind: 'girl', hairStyle: 'twintails', extra: 'bow', cloth: '#efe6d4' }); window.__garden.setThirdPerson(false); }); await sleep(800);
});
await scene('light', async () => {
  await place(9, 16, Math.atan2(9 - (-210), 16 - (-1000)), 0.05); await sleep(800);
  await cap('The sky', 'Mount Fuji, with the pagodas in the hills.'); await sleep(3500);
  await cap('Sunset', 'Light: day, sunset or night.'); await setting('light', 'sunset'); await sleep(4500);
  await cap('Night', 'Lanterns, fireflies and the Milky Way.'); await setting('light', 'night'); await sleep(5000);
  await cap('Seasons', 'Autumn turns every tree red and gold.'); await setting('light', 'day'); await setting('season', 'autumn'); await sleep(4500);
  await uncap(); await setting('season', 'spring'); await sleep(1500);
});
await scene('beach', async () => {
  await cap('The horizon', 'Or trade the mountains for the sea.'); await setting('view', 'sea'); await place(0, 58, Math.PI, -0.02); await sleep(2500);
  await walk([[0, 72], [2, 82]], { max: 9000 }); await cap('The beach', 'Walk onto the sand and into the waves.'); await walk([[3, 90]], { max: 6000 }); await look(-20, 120, -0.05, 2200); await sleep(1800);
  await setting('view', 'fuji'); await uncap(); await sleep(800);
});
await scene('gorge', async () => {
  await place(70.1, 8.4, Math.atan2(70.1 - 120, 8.4 - 14.4), 0.04); await sleep(1500);
  await cap('Takachiho Gorge', 'Beyond the hedge, a canyon with a waterfall.'); await sleep(2500);
  await press('KeyE'); await sleep(7500); await page.click('#gv-back').catch(() => {}); await sleep(3500);
  await g(() => { const gg = window.__garden, p = gg.gorgeWorld(83.5, 0), q = gg.gorgeWorld(100, 0); gg.player.pos.set(p.x, 0, p.z); gg.player.yaw = Math.atan2(p.x - q.x, p.z - q.z); gg.player.pitch = -0.05; }); await sleep(1500);
  await cap('Row a boat', 'Take a boat from the jetty, out between the falls.'); await press('KeyE'); await sleep(2600);
  await page.keyboard.down('KeyW'); await sleep(5500); await page.keyboard.up('KeyW');
  await g(() => { const gg = window.__garden, b = gg.myBoat, p = gg.gorgeWorld(140, 1), q = gg.gorgeWorld(146, -10); b.pos.set(p.x, b.pos.y, p.z); b.yaw = Math.atan2(q.x - p.x, q.z - p.z); gg.player.yaw = b.yaw + Math.PI; gg.player.pitch = 0.1; }); await sleep(1500);
  await cap('Manai Falls', 'Row into the falls…'); await page.keyboard.down('KeyW'); await sleep(3000);
  await g(() => { const gg = window.__garden, b = gg.myBoat, p = gg.gorgeWorld(146, -6), q = gg.gorgeWorld(146, -14); b.pos.set(p.x, b.pos.y, p.z); b.yaw = Math.atan2(q.x - p.x, q.z - p.z); gg.player.yaw = b.yaw + Math.PI; gg.player.pitch = 0.08; });
  await page.waitForFunction(() => window.__garden.state.world === 'sun', { timeout: 30000, polling: 300 }).catch(() => {}); await page.keyboard.up('KeyW');
  await cap('The secret garden', '…and come out into a sunflower world.'); await sleep(5500);
});
await scene('end', async () => { await uncap(); await sleep(600); await g(() => document.querySelector('#demo-end').classList.add('show')); await sleep(5000); });

await cdp.send('Page.stopScreencast'); await sleep(500);
console.log(`recorded ${stamps.length} frames over ${(stamps.at(-1) - stamps[0]).toFixed(1)} s`);
writeFileSync(join(FRAMES, 'stamps.json'), JSON.stringify(stamps));
await g(() => window.__garden.cloud.sb.auth.signOut()).catch(() => {});
await browser.close();

// ---------- encoding: Chrome's own H.264 encoder, then a plain MP4 with its length (dev/demo-encode.mjs) ----------
const { encode } = await import('./demo-encode.mjs');
const frag = OUT.replace(/\.mp4$/, '') + '-fragmented.mp4';
console.log('encoding (takes as long as the film)…');
await encode(FRAMES, frag, Infinity, W, H);
execFileSync('python3', [fileURLToPath(new URL('./fmp4-to-mp4.py', import.meta.url)), frag, OUT], { stdio: 'inherit' });
rmSync(frag, { force: true });
