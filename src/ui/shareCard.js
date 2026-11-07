import qrcode from 'qrcode-generator';
import { $, gardenURL, siteURL } from '../core/util.js';
import { state } from '../core/state.js';
import { SETTINGS } from '../settings/storage.js';
import { plants } from '../plants/registry.js';
import { Cloud } from '../cloud/cloud.ts';
import { photograph } from './book.js';
import { closePanel, openPanel } from './reading.js';
import { toast } from './helpers.js';

/* ================= share this poem: an image card for Instagram ================= */
// The poem reader's share button makes a picture of the poem to post anywhere: the poem's own tree (photographed
// as the book does), the poem on aged paper, the poet's name, the garden's address and a QR code that opens it.
// Two shapes: a story (1080 × 1920) and a square post (1080 × 1080). Save the image, or share it straight to an
// app on a phone. Every card carries the way back to the garden.
const panel = $('#sharecard'), img = $('#sc-img');
let shape = 'story', poem = null, photo = null, url = '';
const FONT = '"Cormorant Garamond", Georgia, serif', TITLE = '"IM Fell English", "Cormorant Garamond", Georgia, serif';

function paper(g, W, H) {
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#f3e6c8'); gr.addColorStop(1, '#e6d2a8'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  let s = 7; const R = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 60; k++) { const x = R() * W, y = R() * H, r = 40 + R() * 160, rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, `rgba(150,110,60,${0.03 + R() * 0.05})`); rg.addColorStop(1, 'rgba(150,110,60,0)'); g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2); }
  for (let k = 0; k < 2600; k++) { g.fillStyle = `rgba(90,60,30,${R() * 0.12})`; g.fillRect(R() * W, R() * H, 1 + R() * 1.6, 1 + R() * 1.6); }
  const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(90,55,20,.35)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
}
// the poem's lines set as large as they fit in the box; a long poem is cut gently with a pointer to the garden
function setPoem(g, text, x, y, w, h, max) {
  const raw = text.replace(/\r/g, '').split('\n');
  for (let px = max; px >= 26; px -= 2) {
    g.font = `500 ${px}px ${FONT}`;
    const lines = []; for (const l of raw) { if (!l.trim()) { lines.push(''); continue; } let cur = ''; for (const wd of l.split(' ')) { const t = cur ? cur + ' ' + wd : wd; if (g.measureText(t).width > w && cur) { lines.push(cur); cur = wd; } else cur = t; } lines.push(cur); }
    const lh = px * 1.42, fits = Math.floor(h / lh);
    if (lines.length <= fits || px === 26) {
      let shown = lines; if (lines.length > fits) { shown = lines.slice(0, fits - 1); shown.push('…'); }
      const top = y + (h - shown.length * lh) / 2 + lh * 0.75;
      g.fillStyle = '#2e2014'; g.textAlign = 'center'; shown.forEach((l, i) => g.fillText(l, x + w / 2, top + i * lh));
      return lines.length > fits;
    }
  }
}
function render() {
  const W = 1080, H = shape === 'story' ? 1920 : 1080, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  paper(g, W, H);
  // the tree, fading into the paper at its foot
  const ph = shape === 'story' ? 860 : 380, pw = shape === 'story' ? W - 120 : W - 120, px = 60, py = 60;
  if (photo) {
    g.save(); g.beginPath(); g.roundRect(px, py, pw, ph, 26); g.clip();
    const s = Math.max(pw / photo.width, ph / photo.height), sw = pw / s, sh = ph / s; g.drawImage(photo, (photo.width - sw) / 2, (photo.height - sh) / 2, sw, sh, px, py, pw, ph);
    const fade = g.createLinearGradient(0, py + ph * 0.7, 0, py + ph); fade.addColorStop(0, 'rgba(240,226,196,0)'); fade.addColorStop(1, 'rgba(240,226,196,.95)'); g.fillStyle = fade; g.fillRect(px, py, pw, ph);
    g.restore(); g.strokeStyle = 'rgba(120,84,40,.35)'; g.lineWidth = 3; g.beginPath(); g.roundRect(px, py, pw, ph, 26); g.stroke();
  }
  // the title, an ornament, the poem
  const ty = py + ph + (shape === 'story' ? 110 : 80);
  g.fillStyle = '#2a1a0c'; g.textAlign = 'center'; let tp = shape === 'story' ? 76 : 60; do { g.font = `400 ${tp}px ${TITLE}`; tp -= 2; } while (g.measureText(poem.title).width > W - 160 && tp > 34); g.fillText(poem.title, W / 2, ty);
  g.fillStyle = '#b8862e'; g.font = `400 34px ${FONT}`; g.fillText('✿', W / 2, ty + 54);
  const by = H - (shape === 'story' ? 270 : 170), cut = setPoem(g, poem.content, 110, ty + 80, W - 220, by - ty - 110, shape === 'story' ? 50 : 40);
  // the poet, the garden's address, a QR code that opens it
  const poet = poemBy();
  g.fillStyle = '#3a2614'; g.textAlign = 'left'; g.font = `italic 600 ${shape === 'story' ? 44 : 38}px ${FONT}`; g.fillText('— ' + poet, 90, by + 30);
  g.fillStyle = '#5a4630'; g.font = `500 ${shape === 'story' ? 30 : 26}px ${FONT}`; g.fillText(cut ? 'Read the rest in my garden:' : 'Walk my garden:', 90, by + 86);
  g.fillStyle = '#7a3a1a'; g.font = `600 ${shape === 'story' ? 32 : 28}px ${FONT}`; g.fillText(url.replace(/^https?:\/\//, ''), 90, by + 128);
  const qr = qrcode(0, 'M'); qr.addData(url); qr.make(); const n = qr.getModuleCount(), qs = shape === 'story' ? 190 : 150, cell = qs / n, qx = W - 90 - qs, qy = by - 20;
  g.fillStyle = '#fbf5e6'; g.fillRect(qx - 12, qy - 12, qs + 24, qs + 24); g.fillStyle = '#3a2614';
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (qr.isDark(r, k)) g.fillRect(qx + k * cell, qy + r * cell, Math.ceil(cell), Math.ceil(cell));
  g.fillStyle = 'rgba(90,60,30,.7)'; g.textAlign = 'center'; g.font = `500 ${shape === 'story' ? 28 : 24}px ${FONT}`; g.fillText('✿  The Garden of Poems  ✿', W / 2, H - (shape === 'story' ? 60 : 36));
  return c;
}
const poemBy = () => state.visiting ? state.visiting.by : (Cloud.profile && Cloud.profile.display_name) || SETTINGS.byline || 'A poet';
function gardenLink() {
  const u = state.visiting ? state.visiting.username : (Cloud.profile && Cloud.profile.username);
  return u ? gardenURL(u) : siteURL();
}
let canvasNow = null;
function redraw() { canvasNow = render(); img.src = canvasNow.toDataURL('image/png'); panel.querySelectorAll('.sc-shape').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.s === shape))); }
async function openShare() {
  const pl = state.reading && plants.get(state.reading); if (!pl) return;
  poem = pl.poem; url = gardenLink();
  if (poem.private && !state.visiting) toast('This poem is private; the card is yours to keep, but its garden link will not show it to others.', 4200);
  // the tree's picture (taken the way the book takes it), then the card
  photo = null; try { const data = photograph(pl), im = new Image(); await new Promise(r => { im.onload = r; im.onerror = r; im.src = data; }); photo = im; } catch (e) { photo = null; }
  if (document.fonts && document.fonts.load) await Promise.all([document.fonts.load(`400 40px ${TITLE}`), document.fonts.load(`500 40px ${FONT}`), document.fonts.load(`italic 600 40px ${FONT}`)]).catch(() => {});
  redraw(); openPanel(panel);
  $('#sc-share').hidden = !(navigator.canShare && navigator.canShare({ files: [new File([new Blob()], 'a.png', { type: 'image/png' })] }));
}
const fileName = () => (poem.title || 'poem').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) + (shape === 'story' ? '-story' : '-square') + '.png';
$('#sc-save').onclick = () => canvasNow.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = fileName(); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('Saved. Post it with your garden’s link.'); }, 'image/png');
$('#sc-share').onclick = () => canvasNow.toBlob(async b => { try { await navigator.share({ files: [new File([b], fileName(), { type: 'image/png' })], title: poem.title, text: `${poem.title} — from my garden: ${url}` }); } catch (e) { /* the person closed the share sheet */ } }, 'image/png');
$('#sc-copy').onclick = async () => { try { await navigator.clipboard.writeText(url); toast('Your garden’s link is copied.'); } catch (e) { toast(url, 5000); } };
panel.querySelectorAll('.sc-shape').forEach(b => { b.onclick = () => { shape = b.dataset.s; redraw(); }; });
$('#sc-close').onclick = () => closePanel(panel);
$('#r-share').onclick = openShare;
