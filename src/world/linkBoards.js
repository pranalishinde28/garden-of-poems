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
import { chalk, chalkSprig, chalkboard, fit, garland, roundRect, serif } from './signArt.js';
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

const W = 1024, H = 1280; // half the width of the main sign, the same height
// each platform's name in a light chalk of its own colour, readable on the dark slate
const CHALK = { Instagram: '#ff9ccf', Facebook: '#9cc4ff', Substack: '#ffb486', Goodreads: '#f1d2a2', 'My garden': '#a8e6a1', 'This garden': '#a8e6a1' };
const chalkOf = k => CHALK[k.name] || '#' + new THREE.Color(k.col).lerp(new THREE.Color('#ffffff'), 0.55).getHexString();
function paint(cv, links, own) {
  const g = cv.getContext('2d');
  const { x0, y0, w, h } = chalkboard(g, W, H, 58, 23);
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  // the heading, with a chalk sprig either side
  const head = links.length === 1 && links[0].garden ? 'Visit this garden' : 'Find me here!';
  fit(g, head, w - 220, 700, 150, 90); chalk(g, head, W / 2, y0 + 150);
  chalkSprig(g, x0 + 30, y0 + 150, 0.8, false); chalkSprig(g, x0 + w - 30, y0 + 150, 0.8, true);
  g.strokeStyle = 'rgba(246,243,234,.7)'; g.lineWidth = 4; g.beginPath(); g.moveTo(W / 2 - 230, y0 + 186); g.quadraticCurveTo(W / 2, y0 + 200, W / 2 + 230, y0 + 186); g.stroke();
  if (!links.length) {
    g.font = serif(600, 96, 'italic ');
    // what to say depends on why there is no code yet
    const why = own ? (!Cloud.user ? ['Sign in and make', 'your garden public:', 'its code appears here', 'for anyone to scan.'] : ['Make your garden', 'public in Gardens:', 'its code appears here', 'for anyone to scan.']) : ['No links', 'shared yet.'];
    why.forEach((l, i) => chalk(g, l, W / 2, y0 + 400 + i * 130));
    return;
  }
  // one card fills the board; two or more sit two to a row
  const cols = links.length === 1 ? 1 : 2, rows = Math.ceil(links.length / cols), top = y0 + 212, cw = (w - 30) / cols, ch = (y0 + h - 24 - top) / rows;
  links.forEach((l, i) => {
    const r = Math.floor(i / cols), c = i % cols, cx = x0 + 15 + c * cw + cw / 2, cy = top + r * ch, k = linkKind(l.url, l.label);
    // in the last row a lone card sits in the middle
    const x = (rows > 1 && i === links.length - 1 && links.length % 2) ? W / 2 : cx;
    const namePx = rows === 1 ? 130 : rows === 2 ? 110 : 88, handlePx = rows === 1 ? 80 : rows === 2 ? 68 : 58;
    const npx = fit(g, k.name, cw - 30, 700, namePx, 44); chalk(g, k.name, x, cy + npx * 0.8, chalkOf(k));
    const handle = (l.label && l.label !== k.name ? l.label : handleOf(l.url)).slice(0, 22);
    // the code on a white card, as large as the space allows
    // the name's tails (y, g) hang below its line: the code's white card starts clear of them
    const size = Math.min(cw - 60, (ch - namePx * 1.12 - handlePx * 1.3 - 20) / 1.12), pad = size * 0.06, qx = x - size / 2, qy = cy + namePx * 1.12 + pad + 12;
    g.fillStyle = 'rgba(0,0,0,.35)'; roundRect(g, qx - pad + 6, qy - pad + 8, size + pad * 2, size + pad * 2, 18); g.fill();
    g.fillStyle = '#fbfaf5'; roundRect(g, qx - pad, qy - pad, size + pad * 2, size + pad * 2, 18); g.fill();
    const qr = qrcode(0, 'M'); qr.addData(l.url); qr.make();
    const n = qr.getModuleCount(), cell = size / n, ink = '#' + new THREE.Color(k.col).multiplyScalar(0.6).getHexString(), eye = '#' + new THREE.Color(k.col).multiplyScalar(0.38).getHexString();
    const isEye = (a, b) => (a < 7 && b < 7) || (a < 7 && b >= n - 7) || (a >= n - 7 && b < 7);
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) if (qr.isDark(a, b)) {
      g.fillStyle = isEye(a, b) ? eye : ink;
      if (isEye(a, b)) g.fillRect(qx + b * cell, qy + a * cell, Math.ceil(cell), Math.ceil(cell));
      else { g.beginPath(); g.arc(qx + (b + 0.5) * cell, qy + (a + 0.5) * cell, cell * 0.48, 0, 7); g.fill(); }
    }
    fit(g, handle, cw - 30, 700, handlePx, 30); chalk(g, handle, x, qy + size + pad + handlePx * 1.05);
  });
}

// the board itself: the left sign's frame, mirrored across the path
const board = new THREE.Group(), cv = document.createElement('canvas'); cv.width = W; cv.height = H;
const tex = new THREE.CanvasTexture(cv); tex.anisotropy = Math.min(8, maxAniso);
(function build() {
  const x = 6.3, z = 38.6; board.position.set(x, groundH(x, z), z); board.rotation.y = Math.atan2(0 - x, 49 - z);
  const wood = M('#2f6a45'), dark = M('#24533a');
  for (const sx of [-1.58, 1.58]) part(board, GEO.cylB, wood, [sx, 0, 0], [0.13, 4.5, 0.13]);
  part(board, GEO.box, dark, [0, 2.6, -0.05], [3.12, 3.86, 0.1]);
  const fm = new THREE.MeshLambertMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.15 }); nightGlow.push({ m: fm, day: 0.1, night: 0.5 });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 3.75), fm); face.position.set(0, 2.6, 0.005); board.add(face);
  board.add(garland(3.15, 4.42, 809));
  board.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(board); decor.push({ x, z, r: 1.7, collide: 0.6 });
  regThing(board, 'See the links', () => late.openBoard && late.openBoard(), { x, z, r: 2.6 });
})();

let key = '';
export function drawLinkBoards() {
  const own = !state.visiting, links = ((own ? SETTINGS.links : state.visiting.sign.links) || []).filter(l => l && /^https?:\/\//i.test(l.url)).slice(0, 5);
  // a public garden gets its own code first, so a visitor can come back to it (or share it)
  const user = own ? (Cloud.garden && Cloud.garden.is_public && Cloud.profile && Cloud.profile.username) : state.visiting.username;
  if (user) links.unshift({ label: own ? 'My garden' : 'This garden', url: siteURL() + '?garden=' + encodeURIComponent(user), garden: true });
  const k = JSON.stringify([own, links, !!Cloud.user]); if (k === key) return; key = k;
  paint(cv, links, own); tex.needsUpdate = true;
}
drawLinkBoards();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { key = ''; drawLinkBoards(); });

// the garden going public (or a sign-in) changes the board: check now and then (cheap: it redraws only on change)
addTick((() => { let c = 0; return dt => { c += dt; if (c > 2) { c = 0; drawLinkBoards(); } return true; }; })(), true);
