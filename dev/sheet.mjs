// A contact sheet of screencast frames (from dev/demo.mjs): node dev/sheet.mjs <frames folder> <out.png> <frame numbers…>
import puppeteer from 'puppeteer';
import { readFileSync } from 'node:fs';
const [,, dir, out, ...idx] = process.argv;
const imgs = idx.map(i => 'data:image/jpeg;base64,' + readFileSync(`${dir}/${String(i).padStart(6, '0')}.jpg`).toString('base64'));
const b = await puppeteer.launch(); const p = await b.newPage(); await p.setViewport({ width: 1280, height: Math.ceil(imgs.length / 3) * 240 });
await p.setContent(`<body style="margin:0;display:grid;grid-template-columns:repeat(3,1fr);background:#000">${imgs.map((s, k) => `<div style="position:relative"><img src="${s}" style="width:100%;display:block"><span style="position:absolute;left:4px;top:2px;color:#ff0;font:14px sans-serif">${idx[k]}</span></div>`).join('')}</body>`);
await p.screenshot({ path: out, fullPage: true }); await b.close();
