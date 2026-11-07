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
// Two shapes: a story (1080 × 1920) and a square post (1080 × 1080). Every card carries the way back to the garden.
// Sharing: a web page cannot hand a picture straight to Instagram (its story and feed sharing is for native apps),
// so where the browser can share files (phones, Safari) every app button opens the system share sheet with the
// picture, where Instagram, WhatsApp and the rest appear; the garden's link is copied at the same time, for a link
// sticker or a caption. Where it cannot (most desktop browsers), Instagram saves the picture and opens instagram.com,
// and WhatsApp, Facebook, X and email share the garden's link through their own share pages.
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
  for (let px = max; px >= 32; px -= 2) {
    g.font = `500 ${px}px ${FONT}`;
    const lines = []; for (const l of raw) { if (!l.trim()) { lines.push(''); continue; } let cur = ''; for (const wd of l.split(' ')) { const t = cur ? cur + ' ' + wd : wd; if (g.measureText(t).width > w && cur) { lines.push(cur); cur = wd; } else cur = t; } lines.push(cur); }
    const lh = px * 1.42, fits = Math.floor(h / lh);
    if (lines.length <= fits || px === 32) {
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
  const ph = shape === 'story' ? 720 : 240, pw = shape === 'story' ? W - 120 : W - 120, px = 60, py = 60;
  if (photo) {
    g.save(); g.beginPath(); g.roundRect(px, py, pw, ph, 26); g.clip();
    const s = Math.max(pw / photo.width, ph / photo.height), sw = pw / s, sh = ph / s; g.drawImage(photo, (photo.width - sw) / 2, (photo.height - sh) / 2, sw, sh, px, py, pw, ph);
    const fade = g.createLinearGradient(0, py + ph * 0.7, 0, py + ph); fade.addColorStop(0, 'rgba(240,226,196,0)'); fade.addColorStop(1, 'rgba(240,226,196,.95)'); g.fillStyle = fade; g.fillRect(px, py, pw, ph);
    g.restore(); g.strokeStyle = 'rgba(120,84,40,.35)'; g.lineWidth = 3; g.beginPath(); g.roundRect(px, py, pw, ph, 26); g.stroke();
  }
  // the title, an ornament, the poem
  const ty = py + ph + (shape === 'story' ? 120 : 82);
  g.fillStyle = '#2a1a0c'; g.textAlign = 'center'; let tp = shape === 'story' ? 96 : 66; do { g.font = `400 ${tp}px ${TITLE}`; tp -= 2; } while (g.measureText(poem.title).width > W - 160 && tp > 34); g.fillText(poem.title, W / 2, ty);
  g.fillStyle = '#b8862e'; g.font = `400 38px ${FONT}`; g.fillText('✿', W / 2, ty + 58);
  const by = H - (shape === 'story' ? 300 : 180), cut = setPoem(g, poem.content, 90, ty + 80, W - 180, by - ty - (shape === 'story' ? 150 : 120), shape === 'story' ? 66 : 48);
  // the poet, the garden's address, a QR code that opens it
  const poet = poemBy();
  g.fillStyle = '#3a2614'; g.textAlign = 'left'; g.font = `italic 700 ${shape === 'story' ? 56 : 46}px ${FONT}`; g.fillText('— ' + poet, 80, by + 34);
  g.fillStyle = '#5a4630'; g.font = `600 ${shape === 'story' ? 38 : 32}px ${FONT}`; g.fillText(cut ? 'Read the rest in my garden:' : 'Walk my garden:', 80, by + 100);
  g.fillStyle = '#7a3a1a'; g.font = `700 ${shape === 'story' ? 40 : 34}px ${FONT}`; { const u = url.replace(/^https?:\/\//, '').replace(/\/$/, ''); let f = shape === 'story' ? 40 : 34; while (g.measureText(u).width > W - 80 - (shape === 'story' ? 260 : 220) - 40 && f > 24) { f -= 2; g.font = `700 ${f}px ${FONT}`; } g.fillText(u, 80, by + 150); }
  const qr = qrcode(0, 'M'); qr.addData(url); qr.make(); const n = qr.getModuleCount(), qs = shape === 'story' ? 230 : 180, cell = qs / n, qx = W - 80 - qs, qy = by - 30;
  g.fillStyle = '#fbf5e6'; g.fillRect(qx - 12, qy - 12, qs + 24, qs + 24); g.fillStyle = '#3a2614';
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (qr.isDark(r, k)) g.fillRect(qx + k * cell, qy + r * cell, Math.ceil(cell), Math.ceil(cell));
  g.fillStyle = 'rgba(90,60,30,.7)'; g.textAlign = 'center'; g.font = `600 ${shape === 'story' ? 34 : 28}px ${FONT}`; g.fillText('✿  The Garden of Poems  ✿', W / 2, H - (shape === 'story' ? 56 : 30));
  return c;
}
const poemBy = () => state.visiting ? state.visiting.by : (Cloud.profile && Cloud.profile.display_name) || SETTINGS.byline || 'A poet';
function gardenLink() {
  const u = state.visiting ? state.visiting.username : (Cloud.profile && Cloud.profile.username);
  return u ? gardenURL(u) : siteURL();
}
let canvasNow = null, fileNow = null;
// the file is made ahead, so a press can open the share sheet at once (Safari allows it only straight from the press)
function redraw() { canvasNow = render(); img.src = canvasNow.toDataURL('image/png'); fileNow = null; canvasNow.toBlob(b => { fileNow = new File([b], fileName(), { type: 'image/png' }); }, 'image/png'); panel.querySelectorAll('.sc-shape').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.s === shape))); }
async function openShare() {
  const pl = state.reading && plants.get(state.reading); if (!pl) return;
  poem = pl.poem; url = gardenLink();
  if (poem.private && !state.visiting) toast('This poem is private; the card is yours to keep, but its garden link will not show it to others.', 4200);
  // the tree's picture (taken the way the book takes it), then the card
  photo = null; try { const data = photograph(pl), im = new Image(); await new Promise(r => { im.onload = r; im.onerror = r; im.src = data; }); photo = im; } catch (e) { photo = null; }
  if (document.fonts && document.fonts.load) await Promise.all([document.fonts.load(`400 40px ${TITLE}`), document.fonts.load(`500 40px ${FONT}`), document.fonts.load(`italic 600 40px ${FONT}`)]).catch(() => {});
  redraw(); openPanel(panel);
  canFiles = !!(navigator.canShare && navigator.canShare({ files: [new File([new Blob(['x'])], 'a.png', { type: 'image/png' })] }));
  buildApps();
}
const fileName = () => (poem.title || 'poem').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) + (shape === 'story' ? '-story' : '-square') + '.png';
const save = (said) => { const a = document.createElement('a'); a.href = img.src; a.download = fileName(); a.click(); toast(said, 6000); };
$('#sc-save').onclick = () => save('Saved. Post it with your garden’s link.');
const copyLink = () => { try { navigator.clipboard.writeText(url).catch(() => {}); } catch (e) { /* no clipboard */ } };
const caption = () => `“${poem.title}”, from my garden of poems: ${url}`;
// the system share sheet with the picture; the link goes to the clipboard at the same moment, for a sticker or caption
function sheet(said) {
  if (!fileNow) { toast('The picture is still being made. Try again in a moment.'); return; }
  copyLink();
  navigator.share({ files: [fileNow], title: poem.title }).then(() => said && toast(said, 6000)).catch(() => { /* closed the sheet */ });
}
const openTab = u => window.open(u, '_blank', 'noopener');
let canFiles = false;
const ICON = {
  instagram: '<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r=".6" fill="currentColor"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24"><path d="M4 20l1.2-3.8A8 8 0 1 1 8 19z"/><path d="M9 8.6c0 3 2.4 6.2 6 6.6l1-1.3-1.8-1-1 .8c-1-.4-2-1.4-2.4-2.4l.8-1-1-1.8z" fill="currentColor" stroke="none"/></svg>',
  facebook: '<svg class="f" viewBox="0 0 24 24"><path d="M13.5 21v-7.2h2.4l.4-2.9h-2.8V9.1c0-.8.3-1.4 1.4-1.4h1.5V5.1c-.3 0-1.1-.1-2.1-.1-2.1 0-3.6 1.3-3.6 3.7v2.2H8.3v2.9h2.4V21z"/></svg>',
  x: '<svg class="f" viewBox="0 0 24 24"><path d="M17.8 3.5h3l-6.6 7.5 7.8 9.5h-6.1l-4.8-5.9-5.4 5.9h-3l7-7.8-7.4-9.2h6.2l4.3 5.4zm-1 15.3h1.7L7.3 5.2H5.5z"/></svg>',
  email: '<svg viewBox="0 0 24 24"><rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/></svg>',
  more: '<svg viewBox="0 0 24 24"><circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="M8.2 10.8l7.6-4M8.2 13.2l7.6 4"/></svg>',
};
const APPS = [
  ['instagram', 'Instagram', 'linear-gradient(45deg,#f9a03f,#e1306c 50%,#7b3fbf)', () => {
    if (canFiles) sheet('Choose Instagram, then Story or Post. Your garden’s link is copied: add it as a link sticker.');
    else { copyLink(); save('The picture is saved and your link copied. On Instagram, choose Create (+) and pick the picture.'); openTab('https://www.instagram.com/'); }
  }],
  ['whatsapp', 'WhatsApp', '#25d366', () => canFiles ? sheet() : openTab('https://wa.me/?text=' + encodeURIComponent(caption()))],
  ['facebook', 'Facebook', '#1877f2', () => canFiles ? sheet() : openTab('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url))],
  ['x', 'X', '#111', () => canFiles ? sheet() : openTab('https://x.com/intent/post?text=' + encodeURIComponent(`“${poem.title}”, from my garden of poems`) + '&url=' + encodeURIComponent(url))],
  ['email', 'Email', '#8a5a2b', () => { location.href = 'mailto:?subject=' + encodeURIComponent(poem.title) + '&body=' + encodeURIComponent(caption()); }],
  ['more', 'More apps', '#5a3e24', () => sheet()],
];
function buildApps() {
  const box = $('#sc-apps'); box.innerHTML = '';
  APPS.forEach(([k, name, bg, go]) => {
    if (k === 'more' && !canFiles) return;
    const b = document.createElement('button'); b.className = 'sc-app'; b.type = 'button';
    b.innerHTML = `<i style="background:${bg}">${ICON[k]}</i><span>${name}</span>`; b.onclick = go; box.append(b);
  });
  $('#sc-hint').textContent = canFiles ? 'Each one opens your share sheet with the picture; pick the app there.' : 'On a phone, these send the picture itself. Here, WhatsApp, Facebook, X and email share your garden’s link.';
}
$('#sc-copy').onclick = async () => { try { await navigator.clipboard.writeText(url); toast('Your garden’s link is copied.'); } catch (e) { toast(url, 5000); } };
panel.querySelectorAll('.sc-shape').forEach(b => { b.onclick = () => { shape = b.dataset.s; redraw(); }; });
$('#sc-close').onclick = () => closePanel(panel);
$('#r-share').onclick = openShare;
