// Compare before/after screenshot pairs: node dev/compare.mjs dev/shots intro pond ...
// Prints the mean per-pixel difference (0–255) and the share of pixels that changed a lot.
import puppeteer from 'puppeteer';
import { readFileSync } from 'node:fs';
const dir = process.argv[2], names = process.argv.slice(3);
const b = await puppeteer.launch({ headless: true }); const p = await b.newPage();
for (const n of names) {
  const a = 'data:image/png;base64,' + readFileSync(`${dir}/before-${n}.png`).toString('base64');
  const c = 'data:image/png;base64,' + readFileSync(`${dir}/after-${n}.png`).toString('base64');
  const r = await p.evaluate(async (a, c) => {
    const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s; });
    const [A, B] = await Promise.all([load(a), load(c)]); const w = A.width, h = A.height;
    const px = img => { const cv = new OffscreenCanvas(w, h), g = cv.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, w, h).data; };
    const d1 = px(A), d2 = px(B); let sum = 0, big = 0;
    for (let i = 0; i < d1.length; i += 4) { const d = (Math.abs(d1[i] - d2[i]) + Math.abs(d1[i + 1] - d2[i + 1]) + Math.abs(d1[i + 2] - d2[i + 2])) / 3; sum += d; if (d > 40) big++; }
    return { mean: +(sum / (w * h)).toFixed(2), bigPct: +(100 * big / (w * h)).toFixed(2) };
  }, a, c);
  console.log(n.padEnd(15), 'mean diff', r.mean, '/255  pixels changed a lot:', r.bigPct + '%');
}
await b.close();
