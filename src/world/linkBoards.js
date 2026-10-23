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
import { siteURL } from '../core/util.js';
import { Cloud } from '../cloud/cloud.ts';
import { addTick } from '../core/things.js';

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
  if ((label === 'My garden' || label === 'This garden') && /[?&]garden=/.test(url)) return { name: label, col: '#1f5a3a', host };
  for (const [re, name, col] of KINDS) if (re.test(host)) return { name, col, host };
  return { name: label || host || 'My website', col: '#5a4634', host };
}
const handleOf = url => { try { const u = new URL(url); if (u.searchParams.get('garden')) return '@' + u.searchParams.get('garden'); if (/substack\.com$/.test(u.hostname)) return u.hostname.split('.')[0]; const p = u.pathname.replace(/\/+$/, '').split('/').filter(Boolean); return p.length ? (p[0].startsWith('@') ? p[0] : '@' + p[p.length - 1]) : u.hostname.replace(/^www\./, ''); } catch (e) { return url; } };

const W = 768, H = 960; // half the width of the main sign, the same height
function paint(cv, links, own) {
  const g = cv.getContext('2d'), R = rng(23);
  g.fillStyle = '#6f553f'; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(35,22,14,.22)'; g.lineWidth = 3; for (let i = 0; i < 30; i++) { const y = R() * H; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(W * .3, y + (R() - .5) * 40, W * .7, y + (R() - .5) * 40, W, y + (R() - .5) * 18); g.stroke(); }
  g.strokeStyle = 'rgba(240,226,200,.55)'; g.lineWidth = 5; g.strokeRect(32, 32, W - 64, H - 64);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#f5ead6';
  { let fs = 124; do { g.font = `700 ${fs}px "Cormorant Garamond", Georgia, serif`; fs -= 4; } while (g.measureText('Find me here!').width > W - 110); } g.fillText('Find me here!', W / 2, 112);
  if (!links.length) {
    g.font = 'italic 500 66px "Cormorant Garamond", Georgia, serif';
    g.font = 'italic 600 72px "Cormorant Garamond", Georgia, serif';
    (own ? ['Add your links', 'in Your garden,', 'and their codes', 'grow here.'] : ['No links', 'shared yet.']).forEach((l, i) => g.fillText(l, W / 2, 330 + i * 110));
    return;
  }
  // one row of up to three cards, or two rows; each a paper card: the place's name, its code, the handle
  // one card fills the board; two or more sit two to a row
  const cols = links.length === 1 ? 1 : 2, rows = Math.ceil(links.length / cols), top = 196, cw = (W - 80) / cols, ch = (H - top - 46) / rows;
  links.forEach((l, i) => {
    const r = Math.floor(i / cols), c = i % cols, x0 = 40 + c * cw + 10, y0 = top + r * ch + 8, w = cw - 20, h = ch - 16, k = linkKind(l.url, l.label);
    g.fillStyle = '#f7f1e3'; g.fillRect(x0, y0, w, h);
    // a tall band in the platform's colour, so the name reads from the path
    const big = rows === 1, band = big ? 140 : rows === 2 ? 108 : 84; g.fillStyle = k.col; g.fillRect(x0, y0, w, band);
    g.fillStyle = '#ffffff'; { let fs = big ? 104 : rows === 2 ? 84 : 66; do { g.font = `700 ${fs}px "Cormorant Garamond", Georgia, serif`; fs -= 4; } while (g.measureText(k.name).width > w - 24 && fs > 30); } g.fillText(k.name, x0 + w / 2, y0 + band / 2 + 3);
    const handle = (l.label && l.label !== k.name ? l.label : handleOf(l.url)).slice(0, 22), hh = big ? 72 : rows === 2 ? 58 : 46;
    const size = Math.min(w - 60, h - band - hh - 30), qr = qrcode(0, 'M'); qr.addData(l.url); qr.make();
    const n = qr.getModuleCount(), cell = size / n, qx = x0 + (w - size) / 2, qy = y0 + band + 14;
    // a colourful code: the platform's colour, deepened so phones still read it, the three corner eyes darker
    const ink = new THREE.Color(k.col).multiplyScalar(0.72), eye = new THREE.Color(k.col).multiplyScalar(0.45);
    const isEye = (a, b) => (a < 7 && b < 7) || (a < 7 && b >= n - 7) || (a >= n - 7 && b < 7);
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) if (qr.isDark(a, b)) {
      g.fillStyle = '#' + (isEye(a, b) ? eye : ink).getHexString();
      if (isEye(a, b)) g.fillRect(qx + b * cell, qy + a * cell, Math.ceil(cell), Math.ceil(cell));
      else { g.beginPath(); g.arc(qx + (b + 0.5) * cell, qy + (a + 0.5) * cell, cell * 0.48, 0, 7); g.fill(); }
    }
    g.fillStyle = '#3b2f24'; { let fs = big ? 60 : rows === 2 ? 48 : 38; do { g.font = `700 ${fs}px "Cormorant Garamond", Georgia, serif`; fs -= 2; } while (g.measureText(handle).width > w - 16 && fs > 20); } g.fillText(handle, x0 + w / 2, y0 + h - hh / 2 - 4);
  });
}

// the board itself: the left sign's frame, mirrored across the path
const board = new THREE.Group(), cv = document.createElement('canvas'); cv.width = W; cv.height = H;
const tex = new THREE.CanvasTexture(cv); tex.anisotropy = Math.min(8, maxAniso);
(function build() {
  const x = 6.3, z = 38.6; board.position.set(x, groundH(x, z), z); board.rotation.y = Math.atan2(0 - x, 49 - z);
  const wood = M('#5a4535'), dark = M('#3f2f24');
  for (const sx of [-0.86, 0.86]) part(board, GEO.cylB, wood, [sx, 0, 0], [0.1, 3.35, 0.1]);
  part(board, GEO.box, dark, [0, 2.05, -0.05], [1.87, 2.3, 0.1]);
  part(board, GEO.box, wood, [0, 3.28, 0], [2.1, 0.12, 0.4]);
  const fm = new THREE.MeshLambertMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.15 }); nightGlow.push({ m: fm, day: 0.12, night: 0.55 });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 2.1875), fm); face.position.set(0, 2.05, 0.005); board.add(face);
  const vm = new Merge(), R = rng(809);
  for (let i = 0; i < 38; i++) { const p = new V3(-0.98 + R() * 1.96, 3.36 + R() * 0.08, (R() - .5) * 0.36); vm.add(GEO.ico, p, new V3(0.09, 0.075, 0.09), C(['#567a3a', '#668c45'][i % 2])); if (i % 3 === 0) vm.add(GEO.ico, p.clone().add(new V3(0, 0.06, 0.07)), new V3(0.055, 0.055, 0.055), C(['#f4b6c8', '#ffffff'][i % 2])); }
  board.add(new THREE.Mesh(vm.build(), VC));
  board.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(board); decor.push({ x, z, r: 1.2, collide: 0.5 });
  regThing(board, 'See the links', () => late.openBoard && late.openBoard(), { x, z, r: 2.6 });
})();

let key = '';
export function drawLinkBoards() {
  const own = !state.visiting, links = ((own ? SETTINGS.links : state.visiting.sign.links) || []).filter(l => l && /^https?:\/\//i.test(l.url)).slice(0, 5);
  // a public garden gets its own code first, so a visitor can come back to it (or share it)
  const user = own ? (Cloud.garden && Cloud.garden.is_public && Cloud.profile && Cloud.profile.username) : state.visiting.username;
  if (user) links.unshift({ label: own ? 'My garden' : 'This garden', url: siteURL() + '?garden=' + encodeURIComponent(user), garden: true });
  const k = JSON.stringify([own, links]); if (k === key) return; key = k;
  paint(cv, links, own); tex.needsUpdate = true;
}
drawLinkBoards();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { key = ''; drawLinkBoards(); });

// the garden going public (or a sign-in) changes the board: check now and then (cheap: it redraws only on change)
addTick((() => { let c = 0; return dt => { c += dt; if (c > 2) { c = 0; drawLinkBoards(); } return true; }; })(), true);
