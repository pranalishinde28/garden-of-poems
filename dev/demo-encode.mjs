// Encodes a folder of screencast frames (000000.jpg… and stamps.json, from dev/demo.mjs) into an H.264 MP4 using
// Chrome's own encoder, so no ffmpeg is needed:
//   node dev/demo-encode.mjs --frames <folder> --out dev/shots/demo.mp4 [--limit 300]
// The frames are replayed in real time onto a canvas whose stream MediaRecorder records.
import puppeteer from 'puppeteer';
import http from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const opt = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
export async function encode(FRAMES, OUT, limit = Infinity, W = 1280, H = 720) {
  const server = http.createServer((req, res) => {
    const f = decodeURIComponent(req.url.split('?')[0].slice(1));
    if (f === '' || f === 'index.html') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><body style="margin:0;background:#000"><canvas id=c width=${W} height=${H}></canvas>`); }
    try { const b = readFileSync(join(FRAMES, f)); res.writeHead(200, { 'content-type': f.endsWith('.json') ? 'application/json' : 'image/jpeg' }); res.end(b); } catch (e) { res.writeHead(404); res.end(); }
  }).listen(0);
  const GPU = process.platform === 'darwin' ? ['--use-angle=metal'] : [];
  const browser = await puppeteer.launch({ headless: true, protocolTimeout: 3600000, args: [...GPU, '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
  const page = await browser.newPage(); await page.setViewport({ width: W, height: H });
  page.on('console', m => console.log('  ' + m.text()));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  // the page returns the film in chunks of base64, so no single message is too large
  const total = await page.evaluate(async (limit) => {
    const all = await (await fetch('/stamps.json')).json(), stamps = all.slice(0, Math.min(all.length, limit));
    const c = document.getElementById('c'), x = c.getContext('2d');
    const name = i => String(i).padStart(6, '0') + '.jpg';
    const load = i => fetch('/' + name(i)).then(r => r.blob()).then(b => createImageBitmap(b));
    const ahead = new Map(); const want = i => { for (let k = i; k < Math.min(i + 60, stamps.length); k++) if (!ahead.has(k)) ahead.set(k, load(k)); };
    want(0); x.drawImage(await ahead.get(0), 0, 0, c.width, c.height);
    const stream = c.captureStream(30), rec = new MediaRecorder(stream, { mimeType: 'video/mp4;codecs=avc1', videoBitsPerSecond: 6e6 }), parts = [];
    rec.ondataavailable = e => { if (e.data.size) parts.push(e.data); }; rec.start(1000);
    const t0 = performance.now(), s0 = stamps[0];
    for (let i = 0; i < stamps.length; i++) {
      want(i); const bm = await ahead.get(i); ahead.delete(i);
      const due = t0 + (stamps[i] - s0) * 1000, wait = due - performance.now(); if (wait > 0) await new Promise(r => setTimeout(r, wait));
      x.drawImage(bm, 0, 0, c.width, c.height); bm.close();
      if (i % 900 === 0) console.log(`frame ${i}/${stamps.length}, ${((performance.now() - t0) / 1000).toFixed(0)} s, ${parts.length} chunks`);
    }
    await new Promise(r => setTimeout(r, 1200));
    const blob = await new Promise(r => { rec.onstop = () => r(new Blob(parts, { type: 'video/mp4' })); rec.stop(); });
    window.__u8 = new Uint8Array(await blob.arrayBuffer()); return window.__u8.length;
  }, limit);
  const bufs = [];
  for (let at = 0; at < total; at += 4 << 20) {
    const b64 = await page.evaluate((at) => { const u = window.__u8.subarray(at, at + (4 << 20)); let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode(...u.subarray(i, i + 32768)); return btoa(s); }, at);
    bufs.push(Buffer.from(b64, 'base64'));
  }
  await browser.close(); server.close();
  const buf = Buffer.concat(bufs); mkdirSync(dirname(OUT), { recursive: true }); writeFileSync(OUT, buf);
  console.log(`saved ${OUT} (${(buf.length / 1e6).toFixed(1)} MB)`);
}
if (process.argv[1] && process.argv[1].endsWith('demo-encode.mjs')) await encode(opt('frames'), opt('out', 'dev/shots/demo.mp4'), Number(opt('limit', Infinity)));
