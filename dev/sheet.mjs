// Side-by-side sheet of before/after screenshots:
//   node dev/sheet.mjs dev/shots out.png intro pond swings      before-*/after-* pairs
//   node dev/sheet.mjs --grid out.png a.png b.png c.png ...       any images, two per row
import puppeteer from 'puppeteer';
import { readFileSync, writeFileSync } from 'node:fs';
const argv = process.argv.slice(2), grid = argv[0] === '--grid';
const [dir, outFile, ...names] = grid ? [null, ...argv.slice(1)] : argv;
const img = f => 'data:image/png;base64,' + readFileSync(f).toString('base64');
const rows = grid ? names.reduce((h, f, i) => h + (i % 2 ? '' : '<tr>') + `<td><img src="${img(f)}"><div>${f.split('/').pop().replace('.png', '')}</div></td>` + (i % 2 ? '</tr>' : ''), '') : names.map(n => `<tr><th>${n}</th><td><img src="${img(`${dir}/before-${n}.png`)}"></td><td><img src="${img(`${dir}/after-${n}.png`)}"></td></tr>`).join('');
const html = `<style>body{margin:0;background:#f4efe3;font:20px Georgia,serif;color:#27311f}table{border-spacing:10px}th{writing-mode:vertical-rl;transform:rotate(180deg);font-weight:normal}img{width:700px;display:block}thead th{writing-mode:horizontal-tb;transform:none;text-align:left}</style>
${grid ? '' : '<table><thead><tr><th></th><th>Before</th><th>After</th></tr></thead>'}${grid ? '<table>' + rows + '</table>' : rows + '</table>'}`;
const b = await puppeteer.launch({ headless: true }); const p = await b.newPage();
await p.setViewport({ width: 1460, height: 400 }); await p.setContent(html, { waitUntil: 'load' });
writeFileSync(outFile, await p.screenshot({ fullPage: true })); await b.close(); console.log('saved', outFile);
