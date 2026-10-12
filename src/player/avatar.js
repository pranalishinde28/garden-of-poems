import * as THREE from 'three';
import { V3, clamp, lerp } from '../core/util.js';

/* ================= the walker's figure ================= */
// A stylised, faceless figure built from simple shapes (no model files), in the same soft Lambert
// look as the garden. Joints are nested groups; poses are target joint angles that the figure eases
// toward every frame, so walking, sitting, swinging and kneeling blend into one another.

export const AVATAR_OPTIONS = {
  skin: ['#f6dcc6', '#ecc4a2', '#d9a77f', '#c38a62', '#a26c47', '#7f5236', '#5e3b27', '#3f2a1f'],
  hairStyle: [['short', 'Short'], ['bob', 'Bob'], ['long', 'Long'], ['bun', 'Bun'], ['tail', 'Ponytail']],
  hairColor: ['#1d1a19', '#3a2a20', '#5c3f2b', '#8a4f2e', '#c49a62', '#e2cfa6', '#9c9893', '#f1eee8'],
  outfit: [['casual', 'Casual'], ['yukata', 'Yukata'], ['kimono', 'Kimono'], ['coat', 'Coat']],
  cloth: ['#3d4a6b', '#e7b7c4', '#6f8a5a', '#efe6d4', '#b5603d', '#3b3a38', '#7b5a86', '#9cc0d6'],
  accent: ['#c9474a', '#e9c46a', '#f3efe6', '#2f3f5c', '#d98fa6', '#5d7a4a'],
  extra: [['none', 'Nothing'], ['scarf', 'Scarf'], ['hat', 'Straw hat'], ['parasol', 'Parasol']],
};
export const DEFAULT_AVATAR = { skin: '#d9a77f', height: 1, hairStyle: 'short', hairColor: '#3a2a20', outfit: 'yukata', cloth: '#3d4a6b', accent: '#e9c46a', extra: 'none' };

// keep only known keys and values, so a stored or shared config can never break the figure
export function cleanAvatar(a) {
  const d = { ...DEFAULT_AVATAR }; if (!a || typeof a !== 'object') return d;
  const pick = (k, list) => { const vals = list.map(x => Array.isArray(x) ? x[0] : x); if (vals.includes(a[k])) d[k] = a[k]; };
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
  const c = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, len, 10), m); c.position.y = -len / 2; g.add(c);
  const s0 = new THREE.Mesh(new THREE.SphereGeometry(r0, 10, 8), m); g.add(s0);
  const s1 = new THREE.Mesh(new THREE.SphereGeometry(r1, 10, 8), m); s1.position.y = -len; g.add(s1);
  return g;
}
const lathe = (pts, color, seg = 20) => new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg), mat(color));
const joint = (parent, x, y, z) => { const j = new THREE.Group(); j.position.set(x, y, z); parent.add(j); return j; };

// sizes for a figure of scale 1 (about 1.66 m tall)
const S = { hip: 0.84, thigh: 0.4, shin: 0.4, spine: 0.27, chest: 0.27, upper: 0.27, fore: 0.25, shoulder: 0.19, head: 0.11 };

export function buildAvatar(cfg) {
  cfg = cleanAvatar(cfg);
  const robe = cfg.outfit === 'yukata' || cfg.outfit === 'kimono', coat = cfg.outfit === 'coat';
  const skin = cfg.skin, cloth = cfg.cloth, accent = cfg.accent, trousers = coat ? '#2f2d2b' : cfg.outfit === 'casual' ? darker(cloth, 0.55) : cloth;
  const root = new THREE.Group(), body = joint(root, 0, 0, 0); body.scale.setScalar(cfg.height);
  const J = {};
  J.hips = joint(body, 0, S.hip, 0);
  J.spine = joint(J.hips, 0, 0, 0);
  J.chest = joint(J.spine, 0, S.spine, 0);
  J.neck = joint(J.chest, 0, S.chest, 0);
  J.head = joint(J.neck, 0, 0.07, 0);
  // torso: waist to shoulders, the clothing's colour
  J.spine.add(lathe([[0.001, -0.07], [0.145, -0.06], [0.135, 0.08], [0.13, S.spine]], cloth));
  J.chest.add(lathe([[0.13, 0], [0.16, 0.1], [0.17, 0.18], [0.15, 0.235], [0.06, S.chest - 0.005], [0.001, S.chest + 0.01]], cloth));
  if (robe || coat) { // a crossed collar
    const col = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.018, 6, 16, Math.PI * 1.25), mat(robe ? '#f4efe4' : darker(cloth, 0.8)));
    col.position.set(0, S.chest - 0.01, 0.0); col.rotation.set(Math.PI / 2 + 0.5, 0, Math.PI * 0.62); J.chest.add(col);
  }
  if (robe) { // the obi, wide on a kimono, with a bow at the back
    const w = cfg.outfit === 'kimono' ? 0.11 : 0.07;
    const obi = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.132, w, 20), mat(accent)); obi.position.y = 0.02; J.spine.add(obi);
    if (cfg.outfit === 'kimono') { const bow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.07), mat(accent)); bow.position.set(0, 0.03, 0.14); J.spine.add(bow); }
  }
  // skirt of the robe or coat, hung from the hips; legs move inside it
  if (robe || coat) {
    const L = robe ? S.hip - 0.09 : 0.5, sk = lathe([[0.001, 0.02], [0.15, 0.02], [0.165, -L * 0.35], [robe ? 0.2 : 0.21, -L]], cloth, 24);
    sk.material = sk.material.clone(); sk.material.side = THREE.DoubleSide; J.skirt = joint(J.hips, 0, 0, 0); J.skirt.add(sk);
  }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.09, 10), mat(skin)); neck.position.y = 0.03; J.neck.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(S.head, 18, 14), mat(skin)); head.scale.set(0.92, 1.08, 1); head.position.y = 0.09; J.head.add(head);
  buildHair(J.head, cfg);
  // arms
  for (const side of [-1, 1]) {
    const sh = joint(J.chest, side * (S.shoulder - 0.01), S.chest - 0.065, 0); J[side < 0 ? 'lShoulder' : 'rShoulder'] = sh;
    const sleeveColor = cloth;
    sh.add(limb(S.upper, 0.052, 0.045, sleeveColor));
    const el = joint(sh, 0, -S.upper, 0); J[side < 0 ? 'lElbow' : 'rElbow'] = el;
    el.add(limb(S.fore, 0.043, 0.035, cfg.outfit === 'casual' ? skin : sleeveColor));
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), mat(skin)); hand.scale.set(0.8, 1.15, 0.9); hand.position.y = -S.fore - 0.04; el.add(hand);
    if (robe) { // the wide sleeve hangs below the forearm in a soft pouch, longer on a kimono
      const L = cfg.outfit === 'kimono' ? 0.2 : 0.13;
      const sl = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), mat(cloth)); sl.scale.set(0.05, L, 0.12); sl.position.set(0, -0.06 - L * 0.55, 0.01); el.add(sl);
    }
  }
  // legs
  for (const side of [-1, 1]) {
    const hp = joint(J.hips, side * 0.085, -0.02, 0); J[side < 0 ? 'lHip' : 'rHip'] = hp;
    if (!robe) hp.add(limb(S.thigh, 0.075, 0.06, trousers)); // under a robe the skirt is the thigh
    const kn = joint(hp, 0, -S.thigh, 0); J[side < 0 ? 'lKnee' : 'rKnee'] = kn;
    kn.add(limb(S.shin, robe ? 0.07 : 0.056, robe ? 0.062 : 0.045, trousers));
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.05, 0.2), mat(robe ? '#efe8da' : '#3a2f28')); foot.position.set(0, -S.shin - 0.035, -0.045); kn.add(foot);
  }
  // extras
  if (cfg.extra === 'scarf') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.028, 8, 18), mat(accent)); ring.rotation.x = Math.PI / 2; ring.position.y = S.chest + 0.0; J.chest.add(ring);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.3, 0.025), mat(accent)); tail.position.set(0.05, S.chest - 0.15, -0.13); tail.rotation.z = 0.08; J.chest.add(tail); J.scarf = tail;
  }
  if (cfg.extra === 'hat') {
    const straw = '#d8c08a';
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.25, 0.07, 24), mat(straw)); brim.position.y = S.head * 2 + 0.03; J.head.add(brim);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.11, 0.02, 20), mat(accent)); band.position.y = S.head * 2 + 0.0; J.head.add(band);
  }
  if (cfg.extra === 'parasol') {
    const p = new THREE.Group(); p.position.set(0, -S.fore - 0.04, 0); J.rElbow.add(p); J.parasol = p;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.0, 6), mat('#6b5440')); shaft.position.y = 0.42; p.add(shaft);
    const cg = new THREE.ConeGeometry(0.58, 0.22, 16, 1, true), col = [], ca = new THREE.Color(accent), cb = new THREE.Color(accent).multiplyScalar(0.82);
    for (let i = 0; i < cg.attributes.position.count; i++) { const c = (Math.floor(Math.atan2(cg.attributes.position.getZ(i), cg.attributes.position.getX(i)) / (Math.PI / 8) + 16) % 2) ? ca : cb; col.push(c.r, c.g, c.b); }
    cg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const canopy = new THREE.Mesh(cg, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })); canopy.position.y = 0.92; p.add(canopy);
  }
  root.traverse(o => { if (o.isMesh) { o.castShadow = false; o.userData.avatar = true; } });
  const fig = { root, J, cfg, pose: {}, phase: 0, blob: null };
  for (const k in REST) fig.pose[k] = REST[k];
  applyPose(fig);
  return fig;
}

function buildHair(headJ, cfg) {
  const c = cfg.hairColor, h = mat(c), R = S.head;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(R * 1.07, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), h);
  cap.scale.set(0.95, 1.08, 1.04); cap.position.set(0, 0.1, 0.012); cap.rotation.x = 0.42; headJ.add(cap); // tilted back: covers the crown and the back, leaves the face
  if (cfg.hairStyle === 'bob') { const b = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.02, R * 1.12, R * 1.15, 18, 1, true, Math.PI * 0.35, Math.PI * 1.3), h); b.position.set(0, 0.07, 0.01); b.rotation.y = Math.PI; headJ.add(b); }
  if (cfg.hairStyle === 'long') { const b = new THREE.Mesh(new THREE.BoxGeometry(R * 1.8, 0.36, 0.06), h); b.position.set(0, -0.06, 0.085); b.rotation.x = 0.12; headJ.add(b); }
  if (cfg.hairStyle === 'bun') { const b = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), h); b.position.set(0, 0.2, 0.06); headJ.add(b); }
  if (cfg.hairStyle === 'tail') { const b = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.3, 10), h); b.position.set(0, 0.0, 0.12); b.rotation.x = Math.PI - 0.35; headJ.add(b); }
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
  if (parasol && kind !== 'swing') { p.rShX = 0.55; p.rShZ = -0.25; p.rElX = 1.25; }
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
  if (J.parasol) J.parasol.rotation.set(-1.25, 0, 0.25);
  if (J.skirt) { // follow the thighs: hang straight when standing, fold forward over the lap when sitting
    const fold = clamp((p.lHipX + p.rHipX) / 2, -0.4, 1.6), sit = clamp(fold / 1.45, 0, 1);
    J.skirt.rotation.x = fold * 0.92; J.skirt.scale.set(1 + sit * 0.15, 1 - sit * 0.45, 1 + sit * 0.1);
  }
  if (J.scarf) J.scarf.rotation.x = Math.sin(fig.phase) * 0.15;
}
// ease the figure toward a pose; speed is in m/s for the walk cycle
export function animateAvatar(fig, kind, dt, t, a = {}) {
  if (kind === 'walk') { fig.phase += dt * a.speed / 0.62; if (a.speed < 0.25) kind = 'idle'; }
  const tp = target(fig, kind, t, a), k = 1 - Math.exp(-dt * (kind === 'walk' || kind === 'swing' ? 14 : 6));
  for (const key in tp) fig.pose[key] += (tp[key] - fig.pose[key]) * k;
  applyPose(fig);
}
