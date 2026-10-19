import * as THREE from 'three';
import { V3, clamp, lerp } from '../core/util.js';
import { Merge } from '../world/geometry.js';
import { animateCreature, buildBird, buildCat } from './creatures.js';

/* ================= the walker's figure ================= */
// An original, chibi-style figure built from simple shapes (no model files): a large round head with a
// painted face (big glossy eyes, rosy cheeks), full bangs, a small body and short limbs. Joints are
// nested groups; poses are target joint angles the figure eases toward every frame, so walking,
// sitting, swinging and kneeling blend into one another.

export const AVATAR_OPTIONS = {
  kind: [['girl', 'Girl'], ['boy', 'Boy'], ['cat', 'Cat'], ['bird', 'Bird']],
  coat: [['siamese', 'Siamese'], ['tabby', 'Tabby'], ['black', 'Black'], ['white', 'White'], ['grey', 'Grey']],
  plumage: [['cream', 'Cockatiel'], ['grey', 'Grey'], ['blue', 'Blue']],
  skin: ['#fbe3d3', '#f3cfb5', '#e2b393', '#c99573', '#a8744f', '#86593b', '#64402b', '#45302a'],
  hairStyle: [['bun', 'Twin buns'], ['twintails', 'Twintails'], ['bob', 'Bob'], ['long', 'Long'], ['tail', 'Ponytail'], ['short', 'Short'], ['messy', 'Messy']],
  hairColor: ['#1d1a19', '#3a2a20', '#5c3f2b', '#8a4f2e', '#c49a62', '#e2cfa6', '#9c9893', '#f1eee8'],
  outfit: [['dress', 'Dress'], ['casual', 'Casual'], ['jacket', 'Jacket and shorts'], ['yukata', 'Yukata'], ['kimono', 'Kimono'], ['coat', 'Coat']],
  cloth: ['#9cc0d6', '#e7b7c4', '#3d4a6b', '#6f8a5a', '#efe6d4', '#b5603d', '#3b3a38', '#7b5a86'],
  accent: ['#f3efe6', '#e9c46a', '#c9474a', '#2f3f5c', '#d98fa6', '#5d7a4a'],
  extra: [['none', 'Nothing'], ['scarf', 'Scarf'], ['bow', 'Pink bow'], ['hat', 'Straw hat'], ['parasol', 'Parasol']],
};
export const DEFAULT_AVATAR = { kind: 'girl', coat: 'siamese', plumage: 'cream', skin: '#f3cfb5', height: 1, hairStyle: 'bun', hairColor: '#1d1a19', outfit: 'dress', cloth: '#9cc0d6', accent: '#f3efe6', extra: 'none' };

// choosing a kind in the editor starts from a look that suits it (any of it can be changed after)
export const KIND_PRESETS = {
  girl: { hairStyle: 'bun', outfit: 'dress', cloth: '#9cc0d6', accent: '#f3efe6', extra: 'none' },
  boy: { hairStyle: 'messy', outfit: 'jacket', cloth: '#3b3a38', accent: '#c9474a', extra: 'scarf', skin: '#a8744f', hairColor: '#1d1a19' },
  cat: {}, bird: {},
};
// keep only known keys and values, so a stored or shared config can never break the figure
export function cleanAvatar(a) {
  const d = { ...DEFAULT_AVATAR }; if (!a || typeof a !== 'object') return d;
  const pick = (k, list) => { const vals = list.map(x => Array.isArray(x) ? x[0] : x); if (vals.includes(a[k])) d[k] = a[k]; };
  pick('kind', AVATAR_OPTIONS.kind); pick('coat', AVATAR_OPTIONS.coat); pick('plumage', AVATAR_OPTIONS.plumage);
  pick('skin', AVATAR_OPTIONS.skin); pick('hairStyle', AVATAR_OPTIONS.hairStyle); pick('hairColor', AVATAR_OPTIONS.hairColor);
  pick('outfit', AVATAR_OPTIONS.outfit); pick('cloth', AVATAR_OPTIONS.cloth); pick('accent', AVATAR_OPTIONS.accent); pick('extra', AVATAR_OPTIONS.extra);
  if (typeof a.height === 'number' && isFinite(a.height)) d.height = clamp(Math.round(a.height * 100) / 100, 0.9, 1.08);
  return d;
}

const mats = new Map();
const mat = c => { if (!mats.has(c)) mats.set(c, new THREE.MeshLambertMaterial({ color: c })); return mats.get(c); };
const darker = (c, k) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();

// a limb hanging down from its joint: tapered cylinder with rounded ends
function limb(len, r0, r1, color) {
  const g = new THREE.Group(), m = mat(color);
  const c = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, len, 12), m); c.position.y = -len / 2; g.add(c);
  const s0 = new THREE.Mesh(new THREE.SphereGeometry(r0, 12, 8), m); g.add(s0);
  const s1 = new THREE.Mesh(new THREE.SphereGeometry(r1, 12, 8), m); s1.position.y = -len; g.add(s1);
  return g;
}
const lathe = (pts, color, seg = 24) => new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg), mat(color));
const joint = (parent, x, y, z) => { const j = new THREE.Group(); j.position.set(x, y, z); parent.add(j); return j; };
const ball = (r, color, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat(color)); m.scale.set(sx, sy, sz); return m; };

// chibi sizes for a figure of scale 1 (about 1.2 m tall; the head is a third of it)
const S = { hip: 0.44, thigh: 0.2, shin: 0.2, spine: 0.13, chest: 0.15, upper: 0.14, fore: 0.13, shoulder: 0.11, head: 0.2 };
export const HEAD_Y = S.hip + S.spine + S.chest + 0.05 + S.head * 0.9; // eye height, for the third-person camera
export const HIP_SIT = S.hip - S.thigh * 0.98;                       // hips above the seat's underside when sitting

// the painted face: big glossy eyes with two highlights, lashes, soft brows, rosy cheeks, a small smile
const faces = new Map();
function faceTexture(skin, hair, boy) {
  const key = skin + hair + (boy ? 'b' : ''); if (faces.has(key)) return faces.get(key);
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = skin; g.fillRect(0, 0, 512, 256);
  for (const x of [190, 322]) {
    const y = 136;
    const iris = g.createLinearGradient(0, y - 38, 0, y + 38); iris.addColorStop(0, '#2b1d18'); iris.addColorStop(0.55, '#5a3a2c'); iris.addColorStop(1, '#a7744e');
    g.fillStyle = '#fbf8f4'; g.beginPath(); g.ellipse(x, y + 2, 34, 46, 0, 0, 7); g.fill();
    g.fillStyle = iris; g.beginPath(); g.ellipse(x, y + 5, 30, 41, 0, 0, 7); g.fill();
    g.fillStyle = '#140d0b'; g.beginPath(); g.ellipse(x, y + 8, 14, 20, 0, 0, 7); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(x - 10, y - 13, 11, 14, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(x + 12, y + 20, 6, 6.5, 0, 0, 7); g.fill();
    g.strokeStyle = '#1b1210'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.ellipse(x, y + 2, 36, 48, 0, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
    if (!boy) { g.lineWidth = 4; g.beginPath(); g.moveTo(x + (x < 256 ? -32 : 32), y - 28); g.lineTo(x + (x < 256 ? -44 : 44), y - 38); g.stroke(); } // a flick of lash
    g.strokeStyle = darker(hair, 1.15); g.lineWidth = boy ? 8 : 5; g.beginPath(); if (boy) { g.moveTo(x - 30, y - 62); g.lineTo(x + 30, y - 58 - (x < 256 ? 4 : -4)); } else g.arc(x, y - 26, 40, Math.PI * 1.3, Math.PI * 1.7); g.stroke(); // a brow: straight and firmer for a boy
    if (boy) continue;
    const blush = g.createRadialGradient(x + (x < 256 ? -14 : 14), y + 58, 2, x + (x < 256 ? -14 : 14), y + 58, 28);
    blush.addColorStop(0, 'rgba(240,120,130,.55)'); blush.addColorStop(1, 'rgba(240,120,130,0)'); g.fillStyle = blush; g.fillRect(x - 60, y + 20, 100, 80);
  }
  g.strokeStyle = '#a2564f'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.arc(256, 188, 10, Math.PI * 0.18, Math.PI * 0.82); g.stroke();
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; faces.set(key, t); return t;
}

export function buildAvatar(cfg) {
  cfg = cleanAvatar(cfg);
  if (cfg.kind === 'cat') return buildCat(cfg);
  if (cfg.kind === 'bird') return buildBird(cfg);
  const boy = cfg.kind === 'boy';
  const o = cfg.outfit, robe = o === 'yukata' || o === 'kimono', coat = o === 'coat', dress = o === 'dress', jacket = o === 'jacket';
  const skin = cfg.skin, cloth = cfg.cloth, accent = cfg.accent;
  const legColor = robe ? cloth : coat ? '#2f2d2b' : o === 'casual' ? darker(cloth, 0.55) : jacket ? darker(cloth, 0.85) : skin;
  const bareShin = dress || o === 'casual' || jacket;
  const root = new THREE.Group(), body = joint(root, 0, 0, 0); body.scale.setScalar(cfg.height);
  const J = {};
  J.hips = joint(body, 0, S.hip, 0);
  J.spine = joint(J.hips, 0, 0, 0);
  J.chest = joint(J.spine, 0, S.spine, 0);
  J.neck = joint(J.chest, 0, S.chest, 0);
  J.head = joint(J.neck, 0, 0.05, 0);
  // a small, rounded body in the outfit's colour
  J.spine.add(lathe([[0.001, -0.05], [0.1, -0.045], [0.105, 0.03], [0.095, S.spine]], dress || o === 'casual' ? cloth : cloth));
  J.chest.add(lathe([[0.095, 0], [0.108, 0.06], [0.1, 0.11], [0.06, S.chest - 0.01], [0.001, S.chest + 0.005]], cloth));
  if (dress) { // a round collar and a sash in the accent colour
    const col = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.016, 8, 20), mat(accent)); col.rotation.x = Math.PI / 2; col.position.y = S.chest - 0.015; J.chest.add(col);
    const sash = new THREE.Mesh(new THREE.CylinderGeometry(0.103, 0.104, 0.03, 24), mat(accent)); sash.position.y = 0.02; J.spine.add(sash);
  }
  if (robe || coat) {
    const col = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.014, 6, 16, Math.PI * 1.25), mat(robe ? '#f4efe4' : darker(cloth, 0.8)));
    col.position.set(0, S.chest - 0.01, 0); col.rotation.set(Math.PI / 2 + 0.5, 0, Math.PI * 0.62); J.chest.add(col);
  }
  if (jacket) { // a zip jacket: a stand collar, a silver zip down the front, a darker hem
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.066, 0.04, 20, 1, true), mat(darker(cloth, 0.75))); col.material = col.material.clone(); col.material.side = THREE.DoubleSide; col.position.y = S.chest + 0.005; J.chest.add(col);
    const zip = new THREE.Mesh(new THREE.BoxGeometry(0.006, S.chest + S.spine * 0.9, 0.006), mat('#c9c9c6')); zip.position.set(0, S.chest / 2 - 0.06, -0.107); J.chest.add(zip);
    const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.107, 0.107, 0.025, 24), mat(darker(cloth, 0.7))); hem.position.y = -0.03; J.spine.add(hem);
  }
  if (robe) {
    const w = o === 'kimono' ? 0.07 : 0.045;
    const obi = new THREE.Mesh(new THREE.CylinderGeometry(0.106, 0.105, w, 24), mat(accent)); obi.position.y = 0.02; J.spine.add(obi);
    if (o === 'kimono') { const bow = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.05), mat(accent)); bow.position.set(0, 0.025, 0.1); J.spine.add(bow); }
  }
  // the skirt: a dress to mid-thigh, a robe to the ankle, a coat to the knee; it folds forward when sitting
  if (dress || robe || coat || o === 'casual') { // (a jacket comes with shorts instead, below)
    const L = robe ? S.hip - 0.05 : coat ? 0.3 : dress ? 0.19 : 0.11, flare = dress ? 0.2 : robe ? 0.15 : coat ? 0.16 : 0.12;
    const c = o === 'casual' ? darker(cloth, 0.55) : cloth;
    const sk = lathe([[0.001, 0.02], [0.105, 0.02], [0.12 + (flare - 0.12) * 0.3, -L * 0.35], [flare, -L]], c, 28);
    sk.material = sk.material.clone(); sk.material.side = THREE.DoubleSide; J.skirt = joint(J.hips, 0, 0, 0); J.skirt.add(sk);
    if (dress) { const hem = new THREE.Mesh(new THREE.TorusGeometry(flare, 0.008, 6, 40), mat(accent)); hem.rotation.x = Math.PI / 2; hem.position.y = -L; sk.add(hem); }
  }
  // the head: round, with the painted face on the front and the hair around it
  const H = S.head;
  const head = ball(H, skin, 1.04, 0.96, 0.98); head.position.y = H * 0.9; J.head.add(head);
  const faceGeo = new THREE.SphereGeometry(H * 1.004, 32, 20, Math.PI * 0.18, Math.PI * 0.64, Math.PI * 0.32, Math.PI * 0.42); // front patch
  const face = new THREE.Mesh(faceGeo, new THREE.MeshLambertMaterial({ map: faceTexture(skin, cfg.hairColor, boy), polygonOffset: true, polygonOffsetFactor: -1 }));
  face.scale.set(1.04, 0.96, 0.98); face.position.y = H * 0.9; face.rotation.y = Math.PI; J.head.add(face); // the patch faces -z, the figure's front
  const ear = side => { const e = ball(0.03, skin, 0.7, 1, 0.5); e.position.set(side * H * 1.02, H * 0.86, 0.01); J.head.add(e); };
  ear(-1); ear(1);
  buildHair(J.head, cfg, H);
  // arms: short and soft; bare in a dress, sleeved otherwise
  for (const side of [-1, 1]) {
    const sh = joint(J.chest, side * S.shoulder, S.chest - 0.04, 0); J[side < 0 ? 'lShoulder' : 'rShoulder'] = sh;
    sh.add(limb(S.upper, 0.038, 0.034, dress ? skin : cloth));
    if (dress) { const puff = ball(0.05, cloth, 1, 0.8, 1); puff.position.y = -0.01; sh.add(puff); } // a little puffed shoulder
    const el = joint(sh, 0, -S.upper, 0); J[side < 0 ? 'lElbow' : 'rElbow'] = el;
    el.add(limb(S.fore, 0.033, 0.028, dress || o === 'casual' ? skin : cloth));
    if (jacket) { const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.022, 12), mat(darker(cloth, 0.7))); cuff.position.y = -S.fore + 0.01; el.add(cuff); }
    const hand = ball(0.034, skin, 0.85, 1.1, 0.9); hand.position.y = -S.fore - 0.03; el.add(hand);
    if (robe) { const L = o === 'kimono' ? 0.13 : 0.08; const sl = ball(1, cloth, 0.035, L, 0.08); sl.position.set(0, -0.04 - L * 0.55, 0.01); el.add(sl); }
  }
  // legs: short; white socks and round shoes with a dress or casual clothes
  for (const side of [-1, 1]) {
    const hp = joint(J.hips, side * 0.055, -0.02, 0); J[side < 0 ? 'lHip' : 'rHip'] = hp;
    if (!robe) hp.add(limb(S.thigh, 0.05, 0.042, legColor));
    if (jacket) { // cargo shorts to the knee, with a pocket on the side
      const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.055, S.thigh * 0.95, 14), mat(legColor)); sh.position.y = -S.thigh * 0.45; hp.add(sh);
      const pk = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.06, 0.05), mat(darker(legColor, 0.85))); pk.position.set(side * 0.058, -S.thigh * 0.55, 0); hp.add(pk);
    }
    const kn = joint(hp, 0, -S.thigh, 0); J[side < 0 ? 'lKnee' : 'rKnee'] = kn;
    kn.add(limb(S.shin, robe ? 0.048 : 0.04, robe ? 0.044 : 0.034, bareShin ? skin : legColor));
    if (bareShin) { const sock = limb(0.08, 0.037, 0.035, '#fbfaf7'); sock.position.y = -S.shin + 0.08; kn.add(sock); }
    const shoe = ball(0.05, robe ? '#efe8da' : dress ? darker(cloth, 0.8) : jacket ? '#f4f2ee' : '#3a2f28', 0.8, 0.55, 1.25);
    if (jacket) { const sole = ball(0.051, '#b9b6b0', 0.82, 0.25, 1.27); sole.position.set(0, -S.shin - 0.04, -0.02); kn.add(sole); } // white sneakers on a grey sole shoe.position.set(0, -S.shin - 0.02, -0.02); kn.add(shoe);
  }
  // extras
  if (cfg.extra === 'scarf') { // a thick knitted wrap, its two ends hanging in front with a fringe
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.03, 10, 20), mat(accent)); ring.rotation.x = Math.PI / 2; ring.scale.set(1, 1, 1.2); ring.position.y = S.chest + 0.005; J.chest.add(ring);
    for (const [x, l, rz] of [[0.03, 0.17, 0.08], [0.065, 0.13, -0.05]]) {
      const end = new THREE.Mesh(new THREE.BoxGeometry(0.05, l, 0.022), mat(accent)); end.position.set(x, S.chest - l / 2 - 0.01, -0.1); end.rotation.z = rz; J.chest.add(end);
      const fr = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.012), mat(darker(accent, 0.8))); fr.position.set(x + Math.sin(rz) * l / 2, S.chest - l - 0.01, -0.1); J.chest.add(fr);
    }
    J.scarf = ring;
  }
  if (cfg.extra === 'bow') { // a pink bow at the collar: two soft loops, two short tails and a knot
    const pink = '#f39ab8', deep = '#e2789c';
    for (const s of [-1, 1]) {
      const loop = ball(0.04, pink, 1.1, 0.75, 0.45); loop.position.set(s * 0.042, S.chest - 0.02, -0.105); loop.rotation.z = s * 0.25; J.chest.add(loop);
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.06, 0.008), mat(deep)); t.position.set(s * 0.018, S.chest - 0.065, -0.105); t.rotation.z = s * 0.3; J.chest.add(t);
    }
    const knot = ball(0.018, deep, 1, 1, 0.8); knot.position.set(0, S.chest - 0.02, -0.112); J.chest.add(knot);
  }
  if (cfg.extra === 'hat') {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.3, 0.06, 28), mat('#d8c08a')); brim.position.y = H * 1.82; J.head.add(brim);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.16, 0.025, 24), mat(accent)); band.position.y = H * 1.76; J.head.add(band);
  }
  if (cfg.extra === 'parasol') {
    // a wagasa: an oiled-paper dome on forty fine ribs with a coloured ring, carried over the shoulder on
    // the side away from the camera (it sits behind and to the right), so your head and the path stay in view
    const p = new THREE.Group(); p.position.set(-0.12, S.chest + 0.02, -0.03); J.chest.add(p); J.parasol = p;
    const wood = new THREE.Color('#6b5440'), base = new THREE.Color(accent), ring = new THREE.Color(accent).lerp(new THREE.Color('#9b3b2c'), 0.75);
    const m = new Merge();
    m.limb(new V3(0, -0.1, 0), new V3(0, 1.08, 0), 0.009, 0.009, wood);
    const dome = new THREE.LatheGeometry([[0.001, 0.17], [0.07, 0.165], [0.17, 0.14], [0.27, 0.105], [0.36, 0.055], [0.43, 0.0]].map(([r, y]) => new THREE.Vector2(r, y)), 40);
    const col = [], P = dome.attributes.position;
    for (let k = 0; k < P.count; k++) { const x = P.getX(k), z = P.getZ(k), r = Math.hypot(x, z), seg = Math.floor((Math.atan2(z, x) + Math.PI) / (Math.PI * 2) * 40 + 0.5) % 2; const c = (r > 0.13 && r < 0.2 ? ring : base).clone().multiplyScalar(seg ? 1 : 0.9); col.push(c.r, c.g, c.b); }
    dome.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); dome.computeVertexNormals();
    for (let k = 0; k < 20; k++) { const a = k / 20 * Math.PI * 2; m.limb(new V3(0, 0.74, 0), new V3(Math.cos(a) * 0.38, 0.93, Math.sin(a) * 0.38), 0.004, 0.003, wood); }
    m.limb(new V3(0, 1.08, 0), new V3(0, 1.15, 0), 0.02, 0.012, ring);
    const frame = new THREE.Mesh(m.build(), new THREE.MeshLambertMaterial({ vertexColors: true })); p.add(frame);
    const canopy = new THREE.Mesh(dome, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.94 })); canopy.position.y = 0.92; p.add(canopy);
  }
  root.traverse(m => { if (m.isMesh) { m.castShadow = false; m.userData.avatar = true; } });
  const fig = { root, J, cfg, pose: {}, phase: 0, blob: null };
  for (const k in REST) fig.pose[k] = REST[k];
  applyPose(fig);
  return fig;
}

// hair: a cap over the crown and back, full bangs over the forehead, locks beside the face, and the style
function buildHair(headJ, cfg, H) {
  const c = cfg.hairColor, y0 = H * 0.9;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(H * 1.07, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.58), mat(c));
  cap.scale.set(1.04, 0.98, 1.02); cap.position.y = y0 + 0.004; cap.rotation.x = 0.32; headJ.add(cap);
  const back = new THREE.Mesh(new THREE.SphereGeometry(H * 1.06, 24, 14, Math.PI * 1.1 - Math.PI, Math.PI * 0.8, Math.PI * 0.4, Math.PI * 0.4), mat(c));
  back.scale.set(1.04, 0.98, 1.02); back.position.y = y0; headJ.add(back); // centred on +z: the back of the head
  // bangs: soft strands across the forehead, ending just above the eyes
  for (let i = 0; i < 9; i++) {
    const a = -0.62 + i * 0.155, x = Math.sin(a) * H * 0.98, z = -Math.cos(a) * H * 0.98;
    const s = ball(1, c, H * 0.2, H * (0.42 - Math.abs(a) * 0.12), H * 0.12); s.position.set(x, y0 + H * 0.48, z * 1.01); s.rotation.set(0.35, -a, 0); headJ.add(s);
  }
  for (const side of [-1, 1]) { // locks beside the face
    const l = ball(1, c, H * 0.16, H * 0.55, H * 0.14); l.position.set(side * H * 0.92, y0 - H * 0.2, -H * 0.3); l.rotation.z = side * 0.08; headJ.add(l);
  }
  const st = cfg.hairStyle;
  if (st === 'messy') { // tousled tufts all over the crown and a few falling over the brow
    const R = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(7);
    for (let i = 0; i < 26; i++) {
      const a = R() * Math.PI * 2, el = 0.15 + R() * 0.95, dir = new V3(Math.cos(a) * Math.sin(el), Math.cos(el), Math.sin(a) * Math.sin(el));
      if (dir.z < -0.55 && dir.y < 0.5) continue; // keep the face clear
      const t = new THREE.Mesh(new THREE.ConeGeometry(H * 0.2, H * (0.55 + R() * 0.35), 7), mat(c));
      t.position.set(dir.x * H * 0.92, y0 + dir.y * H * 0.9, dir.z * H * 0.92); t.quaternion.setFromUnitVectors(new V3(0, 1, 0), dir.clone().add(new V3((R() - .5) * 0.6, 0.25, (R() - .5) * 0.6)).normalize()); headJ.add(t);
    }
    for (let i = 0; i < 5; i++) { const x = (i - 2) * H * 0.3, t = new THREE.Mesh(new THREE.ConeGeometry(H * 0.13, H * 0.5, 6), mat(c)); t.position.set(x, y0 + H * 0.42, -H * 0.9); t.rotation.set(Math.PI - 0.35, 0, (i - 2) * 0.18); headJ.add(t); }
  }
  if (st === 'bun' || st === 'twintails') for (const side of [-1, 1]) {
    const b = ball(H * 0.36, c); b.position.set(side * H * 0.78, y0 + H * 0.78, H * 0.22); headJ.add(b);
    if (st === 'twintails') { const t = new THREE.Mesh(new THREE.ConeGeometry(H * 0.26, H * 1.9, 14), mat(c)); t.position.set(side * H * 1.32, y0 - H * 0.2, H * 0.12); t.rotation.set(Math.PI, 0, -side * 0.28); headJ.add(t); }
  }
  if (st === 'bob') { const b = new THREE.Mesh(new THREE.CylinderGeometry(H * 1.05, H * 1.15, H * 0.95, 26, 1, true, Math.PI * 0.32, Math.PI * 1.36), mat(c)); b.material = b.material.clone(); b.material.side = THREE.DoubleSide; b.position.y = y0 - H * 0.3; b.rotation.y = Math.PI; headJ.add(b); }
  if (st === 'long') { const b = ball(1, c, H * 0.95, H * 1.5, H * 0.32); b.position.set(0, y0 - H * 1.05, H * 0.62); headJ.add(b); }
  if (st === 'tail') { const b = new THREE.Mesh(new THREE.ConeGeometry(H * 0.22, H * 1.6, 14), mat(c)); b.position.set(0, y0 - H * 0.1, H * 1.05); b.rotation.x = Math.PI - 0.5; headJ.add(b); const tie = ball(H * 0.16, cfg.accent); tie.position.set(0, y0 + H * 0.4, H * 0.95); headJ.add(tie); }
}

// ---- poses ----
// angles in radians; a positive hip or shoulder x swings the limb forward, a negative knee x bends it back.
// hipsY is the drop of the hips below standing height (metres, before height scaling).
const REST = { hipsY: 0, hipsX: 0, spineX: 0, chestX: 0, chestY: 0, neckX: 0, headY: 0, lShX: 0.04, lShZ: 0.11, rShX: 0.04, rShZ: -0.11, lElX: 0.18, rElX: 0.18, lHipX: 0, lHipZ: 0, rHipX: 0, rHipZ: 0, lKnX: 0, rKnX: 0, bob: 0 };
function target(fig, kind, t, a) {
  const p = { ...REST };
  const parasol = fig.cfg.extra === 'parasol';
  if (kind === 'walk') {
    const s = a.speed, run = clamp((s - 3.2) / 2, 0, 1), amp = clamp(s / 3, 0, 1);
    const ph = fig.phase, sw = Math.sin(ph), cw = Math.cos(ph);
    const legA = lerp(0.45, 0.8, run) * amp, armA = lerp(0.35, 0.9, run) * amp;
    p.lHipX = sw * legA; p.rHipX = -sw * legA;
    p.lKnX = -Math.max(0, -cw) * lerp(0.7, 1.4, run) * amp - 0.05; p.rKnX = -Math.max(0, cw) * lerp(0.7, 1.4, run) * amp - 0.05;
    p.lShX = -sw * armA; p.rShX = sw * armA; p.lElX = 0.15 + run * 0.9; p.rElX = 0.15 + run * 0.9;
    p.spineX = run * 0.18; p.bob = Math.abs(Math.sin(ph)) * 0.03 * amp - 0.01 * amp; p.chestY = sw * 0.08 * amp;
  } else if (kind === 'idle') {
    p.chestX = Math.sin(t * 1.4) * 0.015; p.headY = Math.sin(t * 0.23) * 0.25; p.neckX = Math.sin(t * 0.31) * 0.05;
  } else if (kind === 'sit' || kind === 'write' || kind === 'swing') {
    p.hipsY = S.thigh * 0.98; p.lHipX = p.rHipX = 1.45; p.lKnX = p.rKnX = -1.45; p.lHipZ = 0.05; p.rHipZ = -0.05; p.spineX = -0.05;
    if (kind === 'write') { p.rShX = 0.75; p.rElX = 1.1; p.lShX = 0.5; p.lElX = 0.9; p.neckX = 0.45; p.headY = Math.sin(t * 0.5) * 0.08; }
    if (kind === 'swing') {
      const o = a.omega || 0; p.lShX = p.rShX = 2.75; p.lShZ = 0.12; p.rShZ = -0.12; p.lElX = p.rElX = 0.15;
      p.lKnX = p.rKnX = -1.45 + clamp(o, -1.2, 1.2) * 0.6; p.lHipX = p.rHipX = 1.45 + clamp(o, -1.2, 1.2) * 0.25; p.spineX = -clamp(o, -1.2, 1.2) * 0.18;
    }
    if (kind === 'sit') { p.lShX = p.rShX = 0.55; p.lElX = p.rElX = 0.6; p.headY = Math.sin(t * 0.25) * 0.3; }
  } else if (kind === 'kneel') {
    p.hipsY = S.shin * 0.92; p.lHipX = 1.5; p.lKnX = -1.5; p.rHipX = -0.05; p.rKnX = -1.55;
    p.spineX = 0.32; p.neckX = 0.35; p.lShX = 0.6; p.lElX = 0.4; p.rShX = 0.35; p.rElX = 0.3;
  } else if (kind === 'pond') {
    p.spineX = 0.45; p.chestX = 0.15; p.neckX = 0.55; p.hipsY = 0.06; p.lHipX = p.rHipX = -0.2; p.lKnX = p.rKnX = -0.35;
    p.lShX = p.rShX = 0.55; p.lElX = p.rElX = 0.35; p.lShZ = 0.15; p.rShZ = -0.15;
  }
  if (a.air) { p.lHipX = 0.75; p.rHipX = 0.45; p.lKnX = -1.1; p.rKnX = -0.8; p.lShX = -0.9; p.rShX = -0.9; p.lShZ = 0.5; p.rShZ = -0.5; p.bob = 0; } // knees tucked, arms up
  if (parasol && kind !== 'swing') { p.lShX = 0.35; p.lShZ = 0.55; p.lElX = 1.5; } // the left hand up at the shaft
  return p;
}
function applyPose(fig) {
  const J = fig.J, p = fig.pose;
  J.hips.position.y = S.hip - p.hipsY + p.bob; J.hips.rotation.x = p.hipsX;
  // upward chains tilt back for positive x, so negate: a positive spineX or neckX leans forward or looks down
  J.spine.rotation.x = -p.spineX; J.chest.rotation.set(-p.chestX, p.chestY, 0); J.neck.rotation.x = -p.neckX; J.head.rotation.y = p.headY;
  J.lShoulder.rotation.set(p.lShX, 0, p.lShZ); J.rShoulder.rotation.set(p.rShX, 0, p.rShZ);
  J.lElbow.rotation.x = p.lElX; J.rElbow.rotation.x = p.rElX;
  J.lHip.rotation.set(p.lHipX, 0, p.lHipZ); J.rHip.rotation.set(p.rHipX, 0, p.rHipZ);
  J.lKnee.rotation.x = p.lKnX; J.rKnee.rotation.x = p.rKnX;
  if (J.parasol) J.parasol.rotation.set(0.1, 0, 0.34); // tipped out over the left shoulder, a little back
  if (J.skirt) { // follow the thighs: hang straight when standing, fold forward over the lap when sitting
    const fold = clamp((p.lHipX + p.rHipX) / 2, -0.4, 1.6), sit = clamp(fold / 1.45, 0, 1);
    J.skirt.rotation.x = fold * 0.92; J.skirt.scale.set(1 + sit * 0.15, 1 - sit * 0.45, 1 + sit * 0.1);
  }
  if (J.scarf) J.scarf.rotation.x = Math.sin(fig.phase) * 0.15;
}
// ease the figure toward a pose; speed is in m/s for the walk cycle
export function animateAvatar(fig, kind, dt, t, a = {}) {
  if (fig.creature) { animateCreature(fig, kind, dt, t, a); return; }
  if (kind === 'walk') { fig.phase += dt * a.speed / 0.4; if (a.speed < 0.25) kind = 'idle'; } // short legs, quicker steps
  const tp = target(fig, kind, t, a), k = 1 - Math.exp(-dt * (kind === 'walk' || kind === 'swing' ? 14 : 6));
  for (const key in tp) fig.pose[key] += (tp[key] - fig.pose[key]) * k;
  applyPose(fig);
}

// how each kind stands in the world: eye height (first person), the point the camera follows, how far
// behind it sits, and how far the root drops when sitting on a seat
export function figureMetrics(cfg) {
  if (cfg.kind === 'cat') return { eye: 0.6, head: 0.5, cam: 2.0, sit: 0 };
  if (cfg.kind === 'bird') return { eye: 0.5, head: 0.45, cam: 1.8, sit: 0 };
  return { eye: 1.6, head: HEAD_Y * cfg.height, cam: 2.7, sit: HIP_SIT * cfg.height };
}
