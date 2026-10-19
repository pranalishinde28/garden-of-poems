import * as THREE from 'three';
import qrcode from 'qrcode-generator';
import { C, V3, rng } from '../core/util.js';
import { groundH } from './terrain.js';
import { maxAniso, scene } from './renderer.js';
import { GEO, M, Merge, VC, part } from './geometry.js';
import { decor } from './paths.js';
import { SETTINGS } from '../settings/storage.js';
import { state } from '../core/state.js';
import { nightGlow } from '../plants/registry.js';
import { regThing } from '../core/things.js';
import { late, provide } from '../core/late.js';

/* ================= the QR board, to the right of the gate ================= */
// The mirror of the garden's sign on the left of the arch: the same frame and size, holding a QR code for
// each of the garden's links ("Instagram", a code to scan, the handle). Click it to open the links.
provide({ get drawLinkBoards() { return drawLinkBoards; }, get linkKind() { return linkKind; } });

const KINDS = [
  [/instagram\.com/, 'Instagram', '#c13584'], [/facebook\.com/, 'Facebook', '#1877f2'], [/substack\.com/, 'Substack', '#ff6719'], [/goodreads\.com/, 'Goodreads', '#5c4122'],
  [/github\.com/, 'GitHub', '#24292f'], [/linkedin\.com/, 'LinkedIn', '#0a66c2'], [/(^|\.)x\.com|twitter\.com/, 'X', '#111111'], [/youtube\.com|youtu\.be/, 'YouTube', '#d6302a'],
  [/tiktok\.com/, 'TikTok', '#111111'], [/behance\.net/, 'Behance', '#1769ff'], [/dribbble\.com/, 'Dribbble', '#ea4c89'], [/medium\.com/, 'Medium', '#111111'],
  [/spotify\.com/, 'Spotify', '#1db954'], [/threads\.net/, 'Threads', '#111111'], [/pinterest\./, 'Pinterest', '#bd081c'],
];
export function linkKind(url, label) {
  let host = ''; try { host = new URL(url).hostname.replace(/^www\./, ''); } catch (e) { /* not a URL */ }
  for (const [re, name, col] of KINDS) if (re.test(host)) return { name, col, host };
  return { name: label || host || 'My website', col: '#5a4634', host };
}
const handleOf = url => { try { const u = new URL(url); if (/substack\.com$/.test(u.hostname)) return u.hostname.split('.')[0]; const p = u.pathname.replace(/\/+$/, '').split('/').filter(Boolean); return p.length ? (p[0].startsWith('@') ? p[0] : '@' + p[p.length - 1]) : u.hostname.replace(/^www\./, ''); } catch (e) { return url; } };

const W = 1536, H = 960;
function paint(cv, links, own) {
  const g = cv.getContext('2d'), R = rng(23);
  g.fillStyle = '#6f553f'; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(35,22,14,.22)'; g.lineWidth = 3; for (let i = 0; i < 30; i++) { const y = R() * H; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(W * .3, y + (R() - .5) * 40, W * .7, y + (R() - .5) * 40, W, y + (R() - .5) * 18); g.stroke(); }
  g.strokeStyle = 'rgba(240,226,200,.55)'; g.lineWidth = 5; g.strokeRect(32, 32, W - 64, H - 64);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#f5ead6';
  g.font = '600 112px "Cormorant Garamond", Georgia, serif'; g.fillText('Find me', W / 2, 118);
  if (!links.length) {
    g.font = 'italic 500 66px "Cormorant Garamond", Georgia, serif';
    (own ? ['Add your Instagram, Facebook,', 'Substack or Goodreads in Your garden,', 'and their codes appear here.'] : ['This poet has not shared', 'any links yet.']).forEach((l, i) => g.fillText(l, W / 2, 330 + i * 96));
    return;
  }
  // one row of up to three cards, or two rows; each a paper card: the place's name, its code, the handle
  const rows = links.length > 4 ? 2 : 1, cols = Math.ceil(links.length / rows), top = 200, cw = (W - 120) / cols, ch = (H - top - 50) / rows;
  links.forEach((l, i) => {
    const r = Math.floor(i / cols), c = i % cols, x0 = 60 + c * cw + 14, y0 = top + r * ch + 10, w = cw - 28, h = ch - 20, k = linkKind(l.url, l.label);
    g.fillStyle = '#f7f1e3'; g.fillRect(x0, y0, w, h);
    const band = rows === 1 ? 92 : 66; g.fillStyle = k.col; g.fillRect(x0, y0, w, band);
    g.fillStyle = '#ffffff'; g.font = `700 ${rows === 1 ? 64 : 50}px "Cormorant Garamond", Georgia, serif`; g.fillText(k.name, x0 + w / 2, y0 + band / 2 + 3);
    const handle = (l.label && l.label !== k.name ? l.label : handleOf(l.url)).slice(0, 22), hh = rows === 1 ? 64 : 48;
    const size = Math.min(w - 60, h - band - hh - 30), qr = qrcode(0, 'M'); qr.addData(l.url); qr.make();
    const n = qr.getModuleCount(), cell = size / n, qx = x0 + (w - size) / 2, qy = y0 + band + 14;
    g.fillStyle = '#1d1a17'; for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) if (qr.isDark(a, b)) g.fillRect(qx + b * cell, qy + a * cell, Math.ceil(cell), Math.ceil(cell));
    g.fillStyle = '#3b2f24'; g.font = `600 ${rows === 1 ? 50 : 40}px "Cormorant Garamond", Georgia, serif`; g.fillText(handle, x0 + w / 2, y0 + h - hh / 2 - 4);
  });
}

// the board itself: the left sign's frame, mirrored across the path
const board = new THREE.Group(), cv = document.createElement('canvas'); cv.width = W; cv.height = H;
const tex = new THREE.CanvasTexture(cv); tex.anisotropy = Math.min(8, maxAniso);
(function build() {
  const x = 6.3, z = 38.6; board.position.set(x, groundH(x, z), z); board.rotation.y = Math.atan2(0 - x, 49 - z);
  const wood = M('#5a4535'), dark = M('#3f2f24');
  for (const sx of [-1.72, 1.72]) part(board, GEO.cylB, wood, [sx, 0, 0], [0.1, 3.35, 0.1]);
  part(board, GEO.box, dark, [0, 2.05, -0.05], [3.62, 2.3, 0.1]);
  part(board, GEO.box, wood, [0, 3.28, 0], [3.95, 0.12, 0.4]);
  const fm = new THREE.MeshLambertMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.15 }); nightGlow.push({ m: fm, day: 0.12, night: 0.55 });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 2.1875), fm); face.position.set(0, 2.05, 0.005); board.add(face);
  const vm = new Merge(), R = rng(809);
  for (let i = 0; i < 70; i++) { const p = new V3(-1.9 + R() * 3.8, 3.36 + R() * 0.08, (R() - .5) * 0.36); vm.add(GEO.ico, p, new V3(0.09, 0.075, 0.09), C(['#567a3a', '#668c45'][i % 2])); if (i % 3 === 0) vm.add(GEO.ico, p.clone().add(new V3(0, 0.06, 0.07)), new V3(0.055, 0.055, 0.055), C(['#f4b6c8', '#ffffff'][i % 2])); }
  board.add(new THREE.Mesh(vm.build(), VC));
  board.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(board); decor.push({ x, z, r: 2.0, collide: 0.6 });
  regThing(board, 'See the links', () => late.openBoard && late.openBoard(), { x, z, r: 2.6 });
})();

let key = '';
export function drawLinkBoards() {
  const own = !state.visiting, links = ((own ? SETTINGS.links : state.visiting.sign.links) || []).filter(l => l && /^https?:\/\//i.test(l.url)).slice(0, 6);
  const k = JSON.stringify([own, links]); if (k === key) return; key = k;
  paint(cv, links, own); tex.needsUpdate = true;
}
drawLinkBoards();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { key = ''; drawLinkBoards(); });
