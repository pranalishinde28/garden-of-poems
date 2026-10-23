import * as THREE from 'three';
import { V3, clamp, lerp } from '../core/util.js';

/* ================= a cat and a bird, for people who would rather be one ================= */
// Same contract as the human figure (player/avatar.js): a root that faces -z, joints, and poses eased
// toward every frame. The cat trots on diagonal pairs and bounds when it runs, sits with its tail round
// its paws when it rests. The bird hops on the ground, flaps to climb and glides on spread wings.

export const CAT_SCALE = 1.2, BIRD_SCALE = 1.5;
const mats = new Map();
const mat = c => { if (!mats.has(c)) mats.set(c, new THREE.MeshLambertMaterial({ color: c })); return mats.get(c); };
const ball = (r, c, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), mat(c)); m.scale.set(sx, sy, sz); return m; };
const joint = (p, x, y, z) => { const j = new THREE.Group(); j.position.set(x, y, z); p.add(j); return j; };
function limb(len, r0, r1, c) {
  const g = new THREE.Group(), m = mat(c), cy = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, 10), m); cy.position.y = -len / 2; g.add(cy);
  const a = new THREE.Mesh(new THREE.SphereGeometry(r0, 10, 8), m); g.add(a); const b = new THREE.Mesh(new THREE.SphereGeometry(r1, 10, 8), m); b.position.y = -len; g.add(b);
  return g;
}
// a painted face on the front of a head sphere
function facePatch(r, tex, sx = 1, sy = 1, sz = 1) {
  const g = new THREE.SphereGeometry(r * 1.004, 28, 18, Math.PI * 0.2, Math.PI * 0.6, Math.PI * 0.28, Math.PI * 0.46);
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex, transparent: true, polygonOffset: true, polygonOffsetFactor: -1 }));
  m.scale.set(sx, sy, sz); m.rotation.y = Math.PI; return m;
}
const canvasFace = draw => { const c = document.createElement('canvas'); c.width = 512; c.height = 256; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t; };

/* ---------- the cat ---------- */
const COATS = {
  siamese: { base: '#ead9c1', point: '#6f4f3c', eye: '#58c3dd', light: '#f6eee2' },
  tabby: { base: '#c99256', point: '#8a5a30', eye: '#c7b03a', light: '#efd9b6', stripes: '#7c4f2a' },
  black: { base: '#2b2726', point: '#1e1b1a', eye: '#d8b23a', light: '#3a3533' },
  white: { base: '#f4f1eb', point: '#eecdc8', eye: '#6fb3e0', light: '#ffffff' },
  grey: { base: '#8f8a86', point: '#6d6864', eye: '#d0a640', light: '#b8b3ae' },
};
const catFaces = new Map();
function catFace(coat) {
  if (catFaces.has(coat)) return catFaces.get(coat);
  const C0 = COATS[coat];
  const t = canvasFace(g => {
    g.clearRect(0, 0, 512, 256);
    for (const x of [178, 334]) { // big round eyes with a slit pupil and two highlights
      const y = 118;
      g.fillStyle = '#1b1514'; g.beginPath(); g.ellipse(x, y, 44, 48, 0, 0, 7); g.fill();
      const ir = g.createRadialGradient(x, y + 6, 4, x, y, 42); ir.addColorStop(0, '#ffffff'); ir.addColorStop(0.25, C0.eye); ir.addColorStop(1, new THREE.Color(C0.eye).multiplyScalar(0.55).getStyle());
      g.fillStyle = ir; g.beginPath(); g.ellipse(x, y, 40, 44, 0, 0, 7); g.fill();
      g.fillStyle = '#120d0c'; g.beginPath(); g.ellipse(x, y + 2, 9, 32, 0, 0, 7); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(x - 13, y - 16, 10, 12, 0, 0, 7); g.fill(); g.beginPath(); g.arc(x + 14, y + 18, 5, 0, 7); g.fill();
    }
    g.fillStyle = '#d98a8c'; g.beginPath(); g.moveTo(244, 176); g.lineTo(268, 176); g.lineTo(256, 190); g.closePath(); g.fill(); // nose
    g.strokeStyle = '#5a3a33'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(256, 190); g.lineTo(256, 198); g.arc(244, 198, 12, 0, Math.PI * 0.85); g.moveTo(256, 198); g.arc(268, 198, 12, Math.PI, Math.PI * 0.15, true); g.stroke(); // the 'w' mouth
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2.5; // whiskers
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(256 + s * 40, 192 + k * 8); g.lineTo(256 + s * 150, 176 + k * 22); g.stroke(); }
  });
  catFaces.set(coat, t); return t;
}
export function buildCat(cfg) {
  const C0 = COATS[cfg.coat] || COATS.siamese, root = new THREE.Group(), J = {};
  J.body = joint(root, 0, 0.25, 0);
  const torso = ball(1, C0.base, 0.105, 0.097, 0.2); torso.position.z = 0.02; J.body.add(torso);
  const belly = ball(1, C0.light, 0.085, 0.07, 0.16); belly.position.set(0, -0.035, 0.0); J.body.add(belly);
  const chest = ball(0.093, C0.base); chest.position.set(0, 0.012, -0.14); J.body.add(chest);
  if (C0.stripes) for (let k = 0; k < 5; k++) { const s = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 16, Math.PI), mat(C0.stripes)); s.position.set(0, 0.002, -0.1 + k * 0.06); s.rotation.y = Math.PI / 2; s.scale.set(1, 1, 1.06); J.body.add(s); }
  J.neck = joint(J.body, 0, 0.07, -0.19); J.head = joint(J.neck, 0, 0.06, -0.035);
  const head = ball(0.1, C0.base, 1.14, 0.96, 1); J.head.add(head);
  J.head.add(facePatch(0.1, catFace(cfg.coat), 1.14, 0.96, 1));
  const muzzle = ball(0.042, C0.light, 1.25, 0.8, 0.75); muzzle.position.set(0, -0.032, -0.082); J.head.add(muzzle);
  if (cfg.coat === 'siamese') { const mask = ball(0.06, C0.point, 1.1, 0.8, 0.5); mask.position.set(0, -0.012, -0.072); mask.material = mask.material.clone(); mask.material.transparent = true; mask.material.opacity = 0.55; J.head.add(mask); }
  for (const s of [-1, 1]) { // ears with pink insides
    const e = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.085, 4), mat(C0.point)); e.position.set(s * 0.065, 0.085, 0.005); e.rotation.set(-0.1, Math.PI / 4, s * -0.28); J.head.add(e);
    const ei = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.06, 4), mat('#e9a7ad')); ei.position.set(s * 0.063, 0.08, -0.012); ei.rotation.set(-0.1, Math.PI / 4, s * -0.28); J.head.add(ei);
    J[s < 0 ? 'lEar' : 'rEar'] = e;
  }
  // four legs: shoulder (or hip), elbow (or hock), paw
  [['fl', -1, -0.14], ['fr', 1, -0.14], ['bl', -1, 0.15], ['br', 1, 0.15]].forEach(([k, s, z]) => {
    const top = joint(J.body, s * 0.058, -0.03, z); J[k] = top;
    const lower = cfg.coat === 'siamese' || cfg.coat === 'white' ? C0.point : C0.base;
    top.add(limb(0.115, 0.033, 0.026, C0.base));
    const kn = joint(top, 0, -0.115, 0); J[k + 'K'] = kn; kn.add(limb(0.095, 0.025, 0.022, lower));
    const paw = ball(0.028, lower, 1, 0.7, 1.35); paw.position.set(0, -0.1, -0.012); kn.add(paw);
  });
  // the tail: a chain of segments that curls and sways
  J.tail = []; let parent = joint(J.body, 0, 0.04, 0.2);
  for (let i = 0; i < 9; i++) {
    const seg = joint(parent, 0, 0, 0), r = 0.024 - i * 0.0015, m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r, 0.05, 8), mat(cfg.coat === 'siamese' || cfg.coat === 'white' ? (i > 3 ? C0.point : C0.base) : C0.base));
    m.position.y = 0.025; seg.add(m); const tip = new THREE.Mesh(new THREE.SphereGeometry(r * 0.9, 8, 6), m.material); tip.position.y = 0.05; seg.add(tip);
    J.tail.push(seg); parent = joint(seg, 0, 0.05, 0);
  }
  root.traverse(o => { if (o.isMesh) { o.castShadow = false; o.userData.avatar = true; } });
  root.scale.setScalar(CAT_SCALE); // a little larger than life, so it holds its own in the garden
  return { root, J, cfg, pose: {}, phase: 0, creature: 'cat', idleT: 0 };
}

/* ---------- the bird: a cockatiel ---------- */
const PLUMES = {
  cream: { body: '#efe3ad', head: '#f3dc6a', cheek: '#f0863a', wing: '#e6dbb2', bar: '#ffffff', tail: '#d9cf9e', crest: '#f1d65a' },
  grey: { body: '#9a9895', head: '#f1d95e', cheek: '#ee7d38', wing: '#8a8885', bar: '#f1efe9', tail: '#6f6d6a', crest: '#9a9895' },
  blue: { body: '#73a7d8', head: '#8fbde6', cheek: '#e9a26a', wing: '#4f7fb3', bar: '#d7e6f4', tail: '#3f6a99', crest: '#8fbde6' },
};
const birdFaces = new Map();
function birdFace(p) {
  if (birdFaces.has(p)) return birdFaces.get(p);
  const P = PLUMES[p], t = canvasFace(g => {
    g.clearRect(0, 0, 512, 256);
    for (const x of [150, 362]) {
      const ch = g.createRadialGradient(x + (x < 256 ? 10 : -10), 168, 4, x, 168, 52); ch.addColorStop(0, P.cheek); ch.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = ch; g.beginPath(); g.arc(x, 168, 56, 0, 7); g.fill(); // orange cheeks
      g.fillStyle = '#15110f'; g.beginPath(); g.ellipse(x + (x < 256 ? 30 : -30), 108, 26, 30, 0, 0, 7); g.fill(); // glossy dark eyes
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x + (x < 256 ? 22 : -38), 98, 8, 0, 7); g.fill(); g.beginPath(); g.arc(x + (x < 256 ? 38 : -22), 120, 4, 0, 7); g.fill();
    }
  });
  birdFaces.set(p, t); return t;
}
export function buildBird(cfg) {
  const P = PLUMES[cfg.plumage] || PLUMES.cream, root = new THREE.Group(), J = {};
  J.body = joint(root, 0, 0.17, 0);
  const body = ball(1, P.body, 0.085, 0.11, 0.095); body.rotation.x = -0.3; J.body.add(body);
  const breast = ball(1, P.bar === '#ffffff' ? '#f6efcf' : P.body, 0.07, 0.085, 0.06); breast.position.set(0, -0.015, -0.045); J.body.add(breast);
  J.head = joint(J.body, 0, 0.115, -0.03);
  const head = ball(0.07, P.head); J.head.add(head);
  J.head.add(facePatch(0.07, birdFace(cfg.plumage)));
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.04, 10), mat('#b9a39a')); beak.position.set(0, -0.012, -0.075); beak.rotation.x = -Math.PI / 2 - 0.5; J.head.add(beak);
  // the crest: curved plumes rising up and back
  for (let k = 0; k < 5; k++) {
    let p = joint(J.head, (k - 2) * 0.008, 0.055, -0.01 + k * 0.004);
    for (let s = 0; s < 3; s++) { const seg = new THREE.Mesh(new THREE.ConeGeometry(0.009 - s * 0.002, 0.045, 6), mat(P.crest)); seg.position.y = 0.022; p.rotation.x = 0.35 + s * 0.15 + k * 0.03; p.add(seg); p = joint(p, 0, 0.042, 0); }
  }
  // wings along the sides, with a pale bar, hinged at the shoulder so they can open and beat
  for (const s of [-1, 1]) {
    const w = joint(J.body, s * 0.07, 0.05, 0.0); J[s < 0 ? 'lw' : 'rw'] = w;
    const blade = ball(1, P.wing, 0.016, 0.06, 0.13); blade.position.set(s * 0.012, -0.045, 0.04); blade.rotation.x = -0.35; w.add(blade);
    const bar = ball(1, P.bar, 0.017, 0.022, 0.07); bar.position.set(s * 0.013, -0.03, 0.0); bar.rotation.x = -0.35; w.add(bar);
    const tip = ball(1, P.tail, 0.012, 0.03, 0.09); tip.position.set(s * 0.01, -0.07, 0.12); tip.rotation.x = -0.5; w.add(tip);
  }
  // a long tail, and pink feet
  J.tail = joint(J.body, 0, -0.06, 0.07);
  const tl = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.2, 8), mat(P.tail)); tl.scale.set(1, 1, 0.35); tl.position.set(0, -0.08, 0.04); tl.rotation.x = Math.PI - 0.55; J.tail.add(tl);
  for (const s of [-1, 1]) {
    const f = joint(J.body, s * 0.032, -0.1, 0.0); J[s < 0 ? 'lf' : 'rf'] = f;
    f.add(limb(0.06, 0.008, 0.007, '#d9a3a0'));
    for (const a of [-0.5, 0, 0.5]) { const toe = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.03, 5), mat('#d9a3a0')); toe.position.set(Math.sin(a) * 0.012, -0.065, -Math.cos(a) * 0.012); toe.rotation.set(Math.PI / 2, 0, a); f.add(toe); }
  }
  root.traverse(o => { if (o.isMesh) { o.castShadow = false; o.userData.avatar = true; } });
  root.scale.setScalar(BIRD_SCALE);
  return { root, J, cfg, pose: {}, phase: 0, creature: 'bird', idleT: 0, flap: 0 };
}

/* ---------- moving them ---------- */
const ease = (o, k, v, s) => { o[k] = (o[k] ?? v) + (v - (o[k] ?? v)) * s; return o[k]; };
export function animateCreature(fig, kind, dt, t, a = {}) {
  const J = fig.J, s = 1 - Math.exp(-dt * 10), p = fig.pose, alt = (a.alt || 0) / fig.root.scale.x; // heights are in the scaled figure's units
  const moving = kind === 'walk' && (a.speed || 0) > 0.25;
  fig.idleT = moving || a.fly ? 0 : fig.idleT + dt;
  if (fig.creature === 'cat') {
    const sp = a.speed || 0, run = clamp((sp - 4) / 2, 0, 1), amp = clamp(sp / 3, 0, 1);
    if (moving) fig.phase += dt * sp / 0.24;
    const ph = fig.phase, sitting = !moving && (kind !== 'walk' || fig.idleT > 3.5) && kind !== 'pond';
    // the body: level when walking, rocking when bounding, rear down when sitting, low when crouching
    ease(p, 'bodyX', sitting ? -0.55 : kind === 'pond' ? 0.12 : Math.sin(ph * 2) * 0.08 * run, s); ease(p, 'bodyY', sitting ? 0.2 : kind === 'pond' ? 0.17 : 0.25 + Math.abs(Math.sin(ph)) * 0.015 * amp + alt, s);
    J.body.rotation.x = p.bodyX; J.body.position.y = p.bodyY;
    const legs = { fl: 0, fr: Math.PI, bl: Math.PI, br: 0 }; // a trot moves diagonal pairs together
    if (run > 0.5) { legs.fr = 0.3; legs.bl = Math.PI; legs.br = Math.PI + 0.3; } // a bound: the front pair, then the back
    for (const k in legs) {
      const front = k[0] === 'f', sw = moving ? Math.sin(ph + legs[k]) * lerp(0.5, 0.9, run) * amp : 0;
      let hip = sw, knee = moving ? Math.max(0, Math.cos(ph + legs[k])) * 0.7 * amp * (front ? -1 : 1) : 0;
      if (sitting) { hip = front ? 0.55 : -1.1; knee = front ? 0 : 1.9; } else if (kind === 'pond') { hip = front ? -0.5 : 0.4; knee = front ? 0.6 : -0.6; }
      if (a.vy > 0.2) { hip = front ? -0.7 : 0.8; knee = 0; } // in the air on a pounce: stretched out
      J[k].rotation.x = ease(p, k, hip, s); J[k + 'K'].rotation.x = ease(p, k + 'K', knee, s);
    }
    // head: looks about when resting, forward when moving; the ears twitch now and then
    J.neck.rotation.x = ease(p, 'neck', sitting ? 0.45 : kind === 'pond' ? 0.5 : -0.1, s);
    J.head.rotation.y = ease(p, 'headY', moving ? 0 : Math.sin(t * 0.4) * 0.5, s * 0.5);
    const tw = Math.sin(t * 1.3) > 0.97 ? 0.4 : 0; J.lEar.rotation.z = 0.28 + tw; J.rEar.rotation.z = -0.28;
    // tail: up and gently curving while walking, wrapped round the paws when sitting, swishing otherwise
    J.tail.forEach((seg, i) => {
      const k = i / J.tail.length;
      const up = sitting ? (i === 0 ? 1.75 : 0.32) : moving ? (i === 0 ? -0.6 : 0.12) : (i === 0 ? 0.9 : 0.15);
      seg.rotation.x = ease(seg.userData, 'x', up, s);
      seg.rotation.z = ease(seg.userData, 'z', sitting ? 0.22 : Math.sin(t * (moving ? 3 : 1.4) - i * 0.5) * (moving ? 0.12 : 0.22) * (0.4 + k), s);
    });
  } else { // the bird
    const sp = a.speed || 0, fly = !!a.fly;
    if (moving && !fly) fig.phase += dt * sp / 0.12;
    const hop = moving && !fly ? Math.abs(Math.sin(fig.phase)) * 0.06 : 0;
    J.body.position.y = 0.17 + hop + alt;
    J.body.rotation.x = ease(p, 'pitch', fly ? -0.5 - clamp(sp / 8, 0, 0.5) * 0.4 : kind === 'pond' ? 0.35 : 0, s);
    // wings: beating to climb, spread and still to glide, folded on the ground
    fig.flap += dt * (fly && a.vy > -0.3 ? 22 : 6);
    const open = fly ? (a.vy > -0.3 ? 1.1 + Math.sin(fig.flap) * 0.9 : 1.45 + Math.sin(t * 2) * 0.05) : (Math.sin(t * 0.7) > 0.985 ? 0.6 : 0.05);
    J.lw.rotation.z = -ease(p, 'w', open, 1 - Math.exp(-dt * 25)); J.rw.rotation.z = p.w;
    J.tail.rotation.x = ease(p, 'tail', fly ? -0.35 : 0, s);
    // feet tuck up in flight; the head bobs and tilts while resting
    for (const f of [J.lf, J.rf]) f.rotation.x = ease(f.userData, 'x', fly ? -1.2 : 0, s);
    J.head.rotation.z = ease(p, 'tilt', moving || fly ? 0 : Math.sin(t * 0.9) * 0.35, s * 0.4);
    J.head.rotation.y = ease(p, 'look', moving || fly ? 0 : Math.sin(t * 0.37) * 0.6, s * 0.4);
  }
}
