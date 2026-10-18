import * as THREE from 'three';
import qrcode from 'qrcode-generator';
import { V3 } from '../core/util.js';
import { groundH } from './terrain.js';
import { maxAniso, scene } from './renderer.js';
import { GEO, M, part } from './geometry.js';
import { decor } from './paths.js';
import { SETTINGS } from '../settings/storage.js';
import { state } from '../core/state.js';
import { regThing, unregThing } from '../core/things.js';
import { provide } from '../core/late.js';

/* ================= a board for each link, to the right of the gate ================= */
// Every link on the garden's sign gets its own board: what it is for ("Find me on Instagram"), a QR code
// to scan with a phone, and the handle. Click it (or press E beside it) to open the link. Visitors see
// the host's links. Boards are rebuilt whenever the links change.
provide({ get drawLinkBoards() { return drawLinkBoards; } });

const KINDS = [
  [/instagram\.com/, 'Instagram', '#c13584'], [/github\.com/, 'GitHub', '#24292f'], [/linkedin\.com/, 'LinkedIn', '#0a66c2'],
  [/(^|\.)x\.com|twitter\.com/, 'X', '#111111'], [/youtube\.com|youtu\.be/, 'YouTube', '#d6302a'], [/facebook\.com/, 'Facebook', '#1877f2'],
  [/tiktok\.com/, 'TikTok', '#111111'], [/behance\.net/, 'Behance', '#1769ff'], [/dribbble\.com/, 'Dribbble', '#ea4c89'],
  [/medium\.com/, 'Medium', '#111111'], [/substack\.com/, 'Substack', '#ff6719'], [/spotify\.com/, 'Spotify', '#1db954'],
  [/threads\.net/, 'Threads', '#111111'], [/pinterest\./, 'Pinterest', '#bd081c'],
];
export function linkKind(url, label) {
  let host = ''; try { host = new URL(url).hostname.replace(/^www\./, ''); } catch (e) { /* not a URL */ }
  for (const [re, name, col] of KINDS) if (re.test(host)) return { name, col, host };
  return { name: label || host || 'My website', col: '#5a4634', host };
}
const handleOf = url => { try { const u = new URL(url), p = u.pathname.replace(/\/+$/, '').split('/').filter(Boolean); return p.length ? (p[0].startsWith('@') ? p[0] : '@' + p[0]) : u.hostname.replace(/^www\./, ''); } catch (e) { return url; } };

function paint(cv, link) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height, k = linkKind(link.url, link.label);
  g.fillStyle = '#f7f1e3'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#b89a72'; g.lineWidth = 10; g.strokeRect(14, 14, W - 28, H - 28); g.lineWidth = 3; g.strokeRect(32, 32, W - 64, H - 64);
  g.fillStyle = k.col; g.fillRect(32, 32, W - 64, 120); // a band in the platform's colour
  g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'italic 600 46px "Cormorant Garamond", Georgia, serif'; g.fillText('Find me on', W / 2, 70);
  g.font = '700 58px "Cormorant Garamond", Georgia, serif'; g.fillText(k.name, W / 2, 122);
  // the code: dark modules on white, with a quiet zone, large enough to scan from a phone held up to the screen
  const qr = qrcode(0, 'M'); qr.addData(link.url); qr.make();
  const n = qr.getModuleCount(), size = W - 170, cell = size / n, x0 = (W - size) / 2, y0 = 190;
  g.fillStyle = '#ffffff'; g.fillRect(x0 - 18, y0 - 18, size + 36, size + 36);
  g.fillStyle = '#1d1a17'; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) g.fillRect(x0 + c * cell, y0 + r * cell, Math.ceil(cell), Math.ceil(cell));
  g.fillStyle = '#3b2f24'; g.font = '600 44px "Cormorant Garamond", Georgia, serif'; const h = (link.label && link.label !== k.name ? link.label : handleOf(link.url)).slice(0, 26); g.fillText(h, W / 2, y0 + size + 64);
  g.fillStyle = 'rgba(59,47,36,.7)'; g.font = 'italic 500 32px "Cormorant Garamond", Georgia, serif'; g.fillText('scan, or click the board', W / 2, y0 + size + 110);
}

const group = new THREE.Group(); scene.add(group);
let built = [], key = '';
export function drawLinkBoards() {
  const links = ((state.visiting ? state.visiting.sign.links : SETTINGS.links) || []).filter(l => l && /^https?:\/\//i.test(l.url)).slice(0, 6);
  const k = JSON.stringify(links); if (k === key) return; key = k;
  built.forEach(b => { group.remove(b.g); unregThing(b.thing); b.tex.dispose(); b.decor.forEach(d => { const i = decor.indexOf(d); if (i >= 0) decor.splice(i, 1); }); }); built = [];
  links.forEach((link, i) => {
    // in a gentle arc to the right of the arrival path, each turned toward where you arrive (0, 49)
    const x = 4.4 + i * 2.05, z = 44.6 + i * 0.55, g = new THREE.Group(); g.position.set(x, groundH(x, z), z); g.rotation.y = Math.atan2(0 - x, 52 - z); group.add(g);
    const wood = M('#5e4634'), dark = M('#3e2e22');
    for (const sx of [-0.78, 0.78]) { part(g, GEO.box, wood, [sx, 1.05, 0], [0.1, 2.1, 0.1]); part(g, GEO.box, dark, [sx, 0.06, 0], [0.18, 0.12, 0.18]); }
    part(g, GEO.box, dark, [0, 1.38, -0.03], [1.62, 1.86, 0.06]); part(g, GEO.box, wood, [0, 2.34, 0], [1.8, 0.08, 0.28]);
    const cv = document.createElement('canvas'); cv.width = 640; cv.height = 740; paint(cv, link);
    const tex = new THREE.CanvasTexture(cv); tex.anisotropy = Math.min(8, maxAniso);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.73), new THREE.MeshLambertMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.18 })); face.position.set(0, 1.38, 0.005); g.add(face);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    const name = linkKind(link.url, link.label).name;
    const thing = regThing(g, `Open ${name}`, () => window.open(link.url, '_blank', 'noopener,noreferrer'), { x, z, r: 2.0 });
    const ds = [-0.78, 0.78].map(sx => { const w = new V3(sx, 0, 0).applyAxisAngle(new V3(0, 1, 0), g.rotation.y); const d = { x: x + w.x, z: z + w.z, r: 0.3, collide: 0.15 }; decor.push(d); return d; });
    built.push({ g, thing, tex, decor: ds });
  });
}
drawLinkBoards();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { key = ''; drawLinkBoards(); });
