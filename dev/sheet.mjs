// Side-by-side sheet of before/after screenshots:
//   node dev/sheet.mjs dev/shots out.png intro pond swings
import puppeteer from 'puppeteer';
import { readFileSync, writeFileSync } from 'node:fs';
const [dir, outFile, ...names] = process.argv.slice(2);
const img = f => 'data:image/png;base64,' + readFileSync(f).toString('base64');
const rows = names.map(n => `<tr><th>${n}</th><td><img src="${img(`${dir}/before-${n}.png`)}"></td><td><img src="${img(`${dir}/after-${n}.png`)}"></td></tr>`).join('');
const html = `<style>body{margin:0;background:#f4efe3;font:20px Georgia,serif;color:#27311f}table{border-spacing:10px}th{writing-mode:vertical-rl;transform:rotate(180deg);font-weight:normal}img{width:700px;display:block}thead th{writing-mode:horizontal-tb;transform:none;text-align:left}</style>
<table><thead><tr><th></th><th>Before</th><th>After</th></tr></thead>${rows}</table>`;
const b = await puppeteer.launch({ headless: true }); const p = await b.newPage();
await p.setViewport({ width: 1460, height: 400 }); await p.setContent(html, { waitUntil: 'load' });
writeFileSync(outFile, await p.screenshot({ fullPage: true })); await b.close(); console.log('saved', outFile);
