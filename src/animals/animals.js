import * as THREE from 'three';
import { V3, isTouch, rng } from '../core/util.js';
import { WATER_Y, WORLD_R, groundH, riverDist } from '../world/terrain.js';
import { T, state } from '../core/state.js';
import { camera, scene } from '../world/renderer.js';
import { canvasTex } from '../world/textures.js';
import { DS, GEO, M, part } from '../world/geometry.js';
import { decor, featOn } from '../world/paths.js';
import { flowerSpots } from '../world/tulips.js';
import { late } from '../core/late.js';

/* ================= animals ================= */
export const animals = [];
export const SFX = {
  out() { const m = late.Music; if (!m.ctx || m.muted) return null; if (!this.g) { this.g = m.ctx.createGain(); this.g.gain.value = 0.45; this.g.connect(m.ctx.destination); } return this.g; },
  chirp() {
    const o = this.out(); if (!o) return; const ctx = late.Music.ctx, t0 = ctx.currentTime + 0.02, f0 = 3200 + Math.random() * 900;
    for (let i = 0; i < 3; i++) { const os = ctx.createOscillator(), g = ctx.createGain(), t = t0 + i * 0.09; os.frequency.setValueAtTime(f0, t); os.frequency.exponentialRampToValueAtTime(f0 * 1.3, t + 0.06); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07); os.connect(g); g.connect(o); os.start(t); os.stop(t + 0.08); }
  },
  quack() {
    const o = this.out(); if (!o) return; const ctx = late.Music.ctx, t0 = ctx.currentTime + 0.02;
    for (let k = 0; k < 2; k++) { const t = t0 + k * 0.24, os = ctx.createOscillator(), bp = ctx.createBiquadFilter(), g = ctx.createGain(); os.type = 'sawtooth'; os.frequency.setValueAtTime(480, t); os.frequency.exponentialRampToValueAtTime(290, t + 0.17); bp.type = 'bandpass'; bp.frequency.value = 1050; bp.Q.value = 2.5; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.19); os.connect(bp); bp.connect(g); g.connect(o); os.start(t); os.stop(t + 0.2); }
  },
  thump() { const o = this.out(); if (!o) return; const ctx = late.Music.ctx, t = ctx.currentTime + 0.01, os = ctx.createOscillator(), g = ctx.createGain(); os.frequency.setValueAtTime(140, t); os.frequency.exponentialRampToValueAtTime(60, t + 0.08); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1); os.connect(g); g.connect(o); os.start(t); os.stop(t + 0.12); }
};
export function regAnimal(root, a) { a.root = root; root.traverse(o => { o.userData.animal = a; if (o.isMesh) o.castShadow = true; }); scene.add(root); animals.push(a); return a; }
export const okGround = (x, z) => { const r = Math.hypot(x, z); return r > 11.5 && r < WORLD_R - 3 && riverDist(x, z) > 3 && !blockedStatic(x, z) && groundH(x, z) > WATER_Y + 0.15; };
function blockedStatic(x, z) { return decor.some(o => o.collide > 0 && Math.hypot(o.x - x, o.z - z) < o.collide + 0.3); }
export function randomSpot(R, nearX, nearZ, rad) { for (let i = 0; i < 30; i++) { const a = R() * 6.28, r = rad * (0.3 + R() * 0.7), x = nearX + Math.cos(a) * r, z = nearZ + Math.sin(a) * r; if (okGround(x, z)) return { x, z }; } return { x: nearX, z: nearZ }; }

/* butterflies with painted wings */
function wingTex(kind) {
  return canvasTex(128, 128, (g) => {
    const fore = () => { g.beginPath(); g.moveTo(2, 60); g.bezierCurveTo(26, 22, 78, 4, 124, 8); g.bezierCurveTo(120, 34, 102, 56, 70, 66); g.lineTo(2, 66); g.closePath(); };
    const hind = () => { g.beginPath(); g.moveTo(2, 64); g.bezierCurveTo(40, 62, 98, 70, 100, 96); g.bezierCurveTo(98, 120, 50, 126, 20, 110); g.lineTo(2, 72); g.closePath(); };
    const C2 = { monarch: ['#ec7a1c', '#17110d'], swallow: ['#f5e29a', '#1b1814'], white: ['#f7f5ef', '#56565a'], blue: ['#3f8ee0', '#0f1a32'] }[kind];
    g.fillStyle = C2[0]; fore(); g.fill(); hind(); g.fill();
    if (kind === 'swallow') { g.beginPath(); g.moveTo(58, 116); g.lineTo(66, 127); g.lineTo(76, 114); g.closePath(); g.fill(); }
    g.save(); fore(); hind(); g.clip();
    g.strokeStyle = C2[1];
    if (kind === 'monarch' || kind === 'swallow') {
      g.lineWidth = kind === 'monarch' ? 2 : 6;
      for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(4, 64); g.quadraticCurveTo(40 + i * 8, 30 + i * 6, 128, i * 18); g.stroke(); }
    }
    if (kind === 'blue') { const gr = g.createRadialGradient(10, 64, 10, 10, 64, 120); gr.addColorStop(0, 'rgba(120,200,255,.6)'); gr.addColorStop(1, 'rgba(10,20,50,.0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
    if (kind === 'white') { g.fillStyle = C2[1]; g.beginPath(); g.arc(118, 12, 16, 0, 7); g.fill(); g.beginPath(); g.arc(70, 38, 4, 0, 7); g.fill(); }
    g.restore();
    g.lineWidth = kind === 'white' ? 1.5 : 7; g.strokeStyle = C2[1]; fore(); g.stroke(); hind(); g.stroke();
    if (kind !== 'white') { g.fillStyle = '#fff'; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(30 + i * 10, 10 + i * 1.2 + (i > 6 ? 40 : 0), 1.6, 0, 7); g.fill(); } }
    if (kind === 'swallow') { g.fillStyle = '#4c78d8'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(42 + i * 13, 108 - i * 4, 3, 0, 7); g.fill(); } g.fillStyle = '#e8732a'; g.beginPath(); g.arc(24, 108, 4, 0, 7); g.fill(); }
  });
}
const WING = (() => { const g = new THREE.PlaneGeometry(1, 1); g.translate(0.5, 0, 0); g.rotateX(Math.PI / 2); return g; })();
const BKINDS = ['monarch', 'swallow', 'white', 'blue'], BMATS = {};
BKINDS.forEach(k => { BMATS[k] = new THREE.MeshLambertMaterial({ map: wingTex(k), alphaTest: 0.5, side: DS }); });
(function buildButterflies2() {
  const N = isTouch ? 10 : 18, R = rng(441);
  for (let i = 0; i < N; i++) {
    const kind = BKINDS[i % 4], g = new THREE.Group(), s = kind === 'swallow' ? 0.15 : 0.12;
    const l = new THREE.Mesh(WING, BMATS[kind]), r = new THREE.Mesh(WING, BMATS[kind]); l.scale.set(-s, 1, s); r.scale.set(s, 1, s); g.add(l, r);
    part(g, GEO.sph, M('#231c18'), [0, 0, 0], [0.007, 0.007, 0.04]);
    const sp = flowerSpots.length ? flowerSpots[Math.floor(R() * flowerSpots.length)] : { x: 10, y: 0.6, z: 10 };
    const b = { g, l, r, pos: new V3(sp.x, sp.y + 0.5, sp.z), vel: new V3(), target: null, mode: 'fly', timer: 0, ph: R() * 10 };
    b.target = pickFlower(R); g.position.copy(b.pos);
    b.click = () => flutterAway(b, true);
    b.update = dt => updateButterfly(b, dt);
    regAnimal(g, b);
  }
})();
function pickFlower(R) { if (flowerSpots.length && R() < 0.8) { const f = flowerSpots[Math.floor(R() * flowerSpots.length)]; return new V3(f.x, f.y, f.z); } const a = R() * 6.28, r = 14 + R() * 40, x = Math.cos(a) * r, z = Math.sin(a) * r; return new V3(x, groundH(x, z) + 0.45, z); }
function flutterAway(b, spread) {
  const away = new V3().subVectors(b.pos, camera.position); away.y = 0; if (away.lengthSq() < 0.01) away.set(1, 0, 0); away.normalize();
  b.mode = 'flee'; b.target = b.pos.clone().addScaledVector(away, 5 + Math.random() * 4); b.target.y = b.pos.y + 1.5 + Math.random() * 1.5;
  if (spread) animals.forEach(o => { if (o !== b && o.l && o.pos.distanceTo(b.pos) < 5 && o.mode !== 'flee') flutterAway(o, false); });
}
function updateButterfly(b, dt) {
  const day = state.night < 0.6; b.g.visible = day; if (!day) return;
  if (b.mode !== 'flee' && state.mode === 'walk' && b.pos.distanceTo(camera.position) < 1.8) flutterAway(b, false);
  let flap;
  if (b.mode === 'rest') {
    b.timer -= dt; flap = 0.15 + (Math.sin(T * 1.5 + b.ph) * 0.5 + 0.5) * 1.0;
    if (b.timer <= 0) { b.mode = 'fly'; b.target = pickFlower(Math.random); }
  } else {
    const dir = new V3().subVectors(b.target, b.pos), d = dir.length();
    const speed = b.mode === 'flee' ? 3.2 : 1.3;
    dir.normalize().multiplyScalar(speed);
    dir.x += Math.sin(T * 3.1 + b.ph) * 0.8; dir.y += Math.sin(T * 5.3 + b.ph * 2) * 0.6; dir.z += Math.cos(T * 2.7 + b.ph) * 0.8;
    b.vel.lerp(dir, 1 - Math.exp(-dt * 2.5)); b.pos.addScaledVector(b.vel, dt);
    b.pos.y = Math.max(b.pos.y, groundH(b.pos.x, b.pos.z) + 0.25);
    if (Math.hypot(b.pos.x, b.pos.z) > WORLD_R + 6 || b.pos.y > 30) { b.pos.copy(pickFlower(Math.random)); b.pos.y += 1; b.mode = 'fly'; b.target = pickFlower(Math.random); }
    if (b.mode === 'fly' && d < 0.18 + speed * dt) { b.mode = 'rest'; b.timer = 3 + Math.random() * 7; b.pos.copy(b.target); }
    if (b.mode === 'flee' && d < 1 + speed * dt) { b.mode = 'fly'; b.target = pickFlower(Math.random); }
    if (b.vel.lengthSq() > 1e-4) b.g.rotation.y = Math.atan2(b.vel.x, b.vel.z);
    flap = Math.sin(T * 22 + b.ph) * 1.1 + 0.2;
  }
  b.r.rotation.z = flap; b.l.rotation.z = -flap; b.g.position.copy(b.pos);
}

/* a flock of birds overhead */
const flock = [];
(function buildFlock() {
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.05, 0, 0, -0.06, 0.38, 0, -0.1, 0, 0, 0.05, 0.38, 0, -0.1, 0.22, 0, 0.03], 3)); wg.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ color: '#2b2926', side: DS });
  for (let i = 0; i < 15; i++) {
    const g = new THREE.Group(), l = new THREE.Mesh(wg, mat), r = new THREE.Mesh(wg, mat); l.scale.x = -1; g.add(l, r);
    part(g, GEO.sph, mat, [0, 0, 0], [0.04, 0.035, 0.16]); g.scale.setScalar(1.8); scene.add(g);
    flock.push({ g, l, r, off: new V3((Math.random() - .5) * 14, (Math.random() - .5) * 4, (Math.random() - .5) * 14), ph: Math.random() * 10, last: new V3() });
  }
})();
function updateFlock() {
  const vis = state.night < 0.55 && featOn('air'), a = T * 0.03, c = new V3(Math.cos(a) * 70, 36 + Math.sin(T * 0.07) * 5, Math.sin(a) * 70 - 15);
  flock.forEach((b, i) => {
    b.g.visible = vis; if (!vis) return;
    const o = b.off, p = new V3(c.x + o.x + Math.sin(T * 0.4 + b.ph) * 2, c.y + o.y + Math.sin(T * 0.6 + b.ph) * 0.8, c.z + o.z + Math.cos(T * 0.35 + b.ph) * 2);
    const d = new V3().subVectors(p, b.last); if (d.lengthSq() > 1e-6) b.g.rotation.y = Math.atan2(d.x, d.z);
    b.last.copy(p); b.g.position.copy(p);
    const glide = Math.sin(T * 0.5 + b.ph) > 0.3, f = glide ? 0.12 + Math.sin(T * 2 + b.ph) * 0.05 : Math.sin(T * 9 + b.ph) * 0.75;
    b.r.rotation.z = f; b.l.rotation.z = -f;
  });
}

/* sparrows that hop, peck and take off */
const sparrowSpots = [[6, 15], [-15, 6], [17, -19], [-21, -29], [29, 11], [-8, 42], [40, -20]].filter(([x, z]) => okGround(x, z));
(function buildSparrows() {
  const R = rng(509), wingG = GEO.petal;
  sparrowSpots.forEach((s, si) => {
    const n = isTouch ? 2 : 3;
    for (let i = 0; i < n; i++) {
      const g = new THREE.Group();
      part(g, GEO.sph, M('#8b6b4b'), [0, 0.05, 0], [0.045, 0.04, 0.07]);
      part(g, GEO.sph, M('#ddd0b4'), [0, 0.035, 0.01], [0.038, 0.032, 0.055]);
      const head = new THREE.Group(); head.position.set(0, 0.085, 0.055); g.add(head);
      part(head, GEO.sph, M('#6e5038'), [0, 0, 0], 0.031); part(head, GEO.sph, M('#e8e0d0'), [0, -0.008, 0.012], [0.026, 0.02, 0.022]);
      part(head, GEO.cone, M('#3a3028'), [0, 0, 0.026], [0.007, 0.022, 0.007], [Math.PI / 2, 0, 0]);
      for (const sx of [-1, 1]) part(head, GEO.sph, M('#111111'), [sx * 0.022, 0.006, 0.014], 0.005);
      part(g, GEO.box, M('#5a4532'), [0, 0.06, -0.085], [0.03, 0.006, 0.06], [0.3, 0, 0]);
      const wl = new THREE.Group(), wr = new THREE.Group(); wl.position.set(-0.03, 0.065, 0); wr.position.set(0.03, 0.065, 0); g.add(wl, wr);
      part(wl, wingG, M('#7a5b3f', { side: DS }), [0, 0, 0], [0.1, 0.06, 0.05], [0, Math.PI, 0]); part(wr, wingG, M('#7a5b3f', { side: DS }), [0, 0, 0], [0.1, 0.06, 0.05]);
      const sp = randomSpot(R, s[0], s[1], 1.5);
      const b = { g, head, wl, wr, home: si, pos: new V3(sp.x, groundH(sp.x, sp.z), sp.z), mode: 'ground', timer: R() * 2, hop: null, fly: null, ph: R() * 10 };
      b.click = () => takeOff(b, true); b.update = dt => updateSparrow(b, dt);
      regAnimal(g, b); g.scale.setScalar(1.25);
    }
  });
})();
function takeOff(b, group) {
  if (b.mode === 'fly') return;
  let ni = b.home; for (let k = 0; k < 5 && ni === b.home; k++) ni = Math.floor(Math.random() * sparrowSpots.length);
  const s = sparrowSpots[ni], to = randomSpot(Math.random, s[0], s[1], 1.5), end = new V3(to.x, groundH(to.x, to.z), to.z);
  const mid = b.pos.clone().lerp(end, 0.5); mid.y += 3 + b.pos.distanceTo(end) * 0.12;
  b.fly = { a: b.pos.clone(), m: mid, b: end, t: 0, dur: Math.max(1.4, b.pos.distanceTo(end) / 7) }; b.mode = 'fly'; b.home = ni;
  if (group) { SFX.chirp(); animals.forEach(o => { if (o !== b && o.wl && o.pos.distanceTo(b.pos) < 3) setTimeout(() => takeOff(o, false), Math.random() * 300); }); }
}
function updateSparrow(b, dt) {
  if (b.mode === 'ground') {
    b.wl.rotation.z = 0.15; b.wr.rotation.z = -0.15;
    if (state.mode === 'walk' && camera.position.distanceTo(b.pos) < 3.6) { takeOff(b, true); return; }
    if (b.hop) {
      b.hop.t += dt / 0.22; const t = Math.min(1, b.hop.t);
      b.pos.lerpVectors(b.hop.a, b.hop.b, t); b.pos.y = groundH(b.pos.x, b.pos.z) + Math.sin(Math.PI * t) * 0.07;
      if (t >= 1) b.hop = null;
    } else {
      b.timer -= dt; b.head.rotation.x = Math.max(0, Math.sin(T * 9 + b.ph)) * 0.6 * (b.timer % 1.5 < 0.7 ? 1 : 0);
      if (b.timer <= 0) {
        b.timer = 0.4 + Math.random() * 1.6;
        const a = Math.random() * 6.28, to = new V3(b.pos.x + Math.cos(a) * 0.25, 0, b.pos.z + Math.sin(a) * 0.25);
        if (okGround(to.x, to.z)) { b.hop = { a: b.pos.clone(), b: to, t: 0 }; b.g.rotation.y = Math.atan2(to.x - b.pos.x, to.z - b.pos.z); }
      }
    }
  } else {
    const f = b.fly; f.t += dt / f.dur; const t = Math.min(1, f.t), u = 1 - t;
    const p = new V3(u * u * f.a.x + 2 * u * t * f.m.x + t * t * f.b.x, u * u * f.a.y + 2 * u * t * f.m.y + t * t * f.b.y, u * u * f.a.z + 2 * u * t * f.m.z + t * t * f.b.z);
    b.g.rotation.y = Math.atan2(p.x - b.pos.x, p.z - b.pos.z) || b.g.rotation.y; b.pos.copy(p);
    const fl = Math.sin(T * 34 + b.ph) * 1.1; b.wl.rotation.z = fl; b.wr.rotation.z = -fl;
    if (t >= 1) { b.mode = 'ground'; b.timer = 1 + Math.random(); b.pos.y = groundH(b.pos.x, b.pos.z); }
  }
  b.g.position.copy(b.pos);
}

/* mallard ducks on the pond */
(function buildDucks() {
  for (let i = 0; i < 3; i++) {
    const male = i !== 1, g = new THREE.Group();
    part(g, GEO.sph, M(male ? '#a69d92' : '#8a7058'), [0, 0, 0], [0.16, 0.1, 0.27]);
    if (male) part(g, GEO.sph, M('#6b3b28'), [0, 0.02, 0.17], [0.12, 0.09, 0.1]);
    part(g, GEO.sph, M(male ? '#2c2a28' : '#6e5844'), [0, 0.05, -0.24], [0.07, 0.05, 0.08], [-0.4, 0, 0]);
    part(g, GEO.sph, M(male ? '#5a5048' : '#735c47'), [0, 0.07, -0.02], [0.13, 0.05, 0.2]);
    const head = new THREE.Group(); head.position.set(0, 0.17, 0.22); g.add(head);
    part(head, GEO.sph, M(male ? '#1d5b3c' : '#7c6550'), [0, 0, 0], [0.07, 0.07, 0.08]);
    if (male) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.008, 6, 16), M('#f2f0ea')); ring.rotation.x = Math.PI / 2; ring.position.y = -0.065; head.add(ring); }
    part(head, GEO.box, M('#e2b53a'), [0, -0.01, 0.085], [0.04, 0.016, 0.07]);
    for (const sx of [-1, 1]) part(head, GEO.sph, M('#0d0d0d'), [sx * 0.05, 0.015, 0.03], 0.008);
    part(g, GEO.cylB, M(male ? '#2c4f3a' : '#6e5844'), [0, 0.06, 0.14], [0.03, 0.12, 0.03], [0.4, 0, 0]);
    const a = i * 2.1, b = { g, head, pos: new V3(Math.cos(a) * 3, WATER_Y, Math.sin(a) * 3), target: new V3(), vel: new V3(), fast: 0, ph: i * 3, heading: 0 };
    b.target.set(Math.cos(a + 1) * 4, WATER_Y, Math.sin(a + 1) * 4);
    b.click = () => { SFX.quack(); const away = new V3().subVectors(b.pos, camera.position); away.y = 0; away.normalize(); const t = b.pos.clone().addScaledVector(away, 3.5); const r = Math.hypot(t.x, t.z); if (r > 5.8) t.multiplyScalar(5.8 / r); b.target.copy(t); b.fast = 3; };
    b.update = dt => {
      const dir = new V3().subVectors(b.target, b.pos); dir.y = 0; const d = dir.length();
      if (d < 0.3) { const aa = Math.random() * 6.28, rr = 1.5 + Math.random() * 4.2; b.target.set(Math.cos(aa) * rr, WATER_Y, Math.sin(aa) * rr); }
      b.fast = Math.max(0, b.fast - dt);
      const sp = b.fast > 0 ? 0.9 : 0.22; dir.normalize().multiplyScalar(sp);
      b.vel.lerp(dir, 1 - Math.exp(-dt * 1.5)); b.pos.addScaledVector(b.vel, dt);
      const want = Math.atan2(b.vel.x, b.vel.z); let dh = want - b.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); b.heading += dh * (1 - Math.exp(-dt * 3));
      b.g.position.set(b.pos.x, WATER_Y + 0.02 + Math.sin(T * 1.6 + b.ph) * 0.012, b.pos.z); b.g.rotation.y = b.heading;
      b.head.rotation.x = Math.sin(T * 0.9 + b.ph) * 0.12;
    };
    regAnimal(g, b); g.scale.setScalar(1.15);
  }
})();

/* rabbits */
(function buildRabbits() {
  const R = rng(613), homes = [[18, 4], [-17, 20], [22, -32], [-34, -10], [40, 30], [14, 30], [-26, 30], [48, -14], [-12, -50], [34, 22]].filter(([x, z]) => okGround(x, z));
  homes.forEach(([hx, hz], i) => {
    const whiteFur = i % 3 !== 2, g = new THREE.Group(), fur = M(whiteFur ? '#f6f3ee' : (i % 2 ? '#a8927a' : '#8f7a64')), light = M('#ffffff');
    part(g, GEO.sph, fur, [0, 0.12, -0.02], [0.12, 0.11, 0.17]);
    part(g, GEO.sph, fur, [0, 0.1, -0.1], [0.115, 0.1, 0.11]);
    const head = new THREE.Group(); head.position.set(0, 0.2, 0.12); g.add(head);
    part(head, GEO.sph, fur, [0, 0, 0], [0.07, 0.068, 0.08]);
    for (const sx of [-1, 1]) {
      part(head, GEO.sph, fur, [sx * 0.028, 0.09, -0.02], [0.02, 0.085, 0.011], [-0.3, 0, sx * 0.15]);
      part(head, GEO.sph, M('#d9a9a4'), [sx * 0.028, 0.09, -0.012], [0.012, 0.07, 0.004], [-0.3, 0, sx * 0.15]);
      part(head, GEO.sph, M(whiteFur ? '#8a2a35' : '#0c0a09'), [sx * 0.05, 0.015, 0.035], 0.011);
    }
    part(head, GEO.sph, M('#c98d8a'), [0, -0.005, 0.078], 0.01);
    part(g, GEO.sph, light, [0, 0.13, -0.2], 0.035);
    for (const sx of [-1, 1]) part(g, GEO.sph, fur, [sx * 0.05, 0.03, 0.08], [0.02, 0.03, 0.03]);
    const sp = randomSpot(R, hx, hz, 3);
    const b = { g, head, pos: new V3(sp.x, groundH(sp.x, sp.z), sp.z), home: { x: hx, z: hz }, mode: 'idle', timer: R() * 3, hops: 0, hop: null, flee: false, ph: R() * 6 };
    b.click = () => { SFX.thump(); startRun(b, true); };
    b.update = dt => updateRabbit(b, dt);
    regAnimal(g, b); g.scale.setScalar(1.25);
  });
})();
function startRun(b, flee) {
  let to;
  if (flee) { const away = new V3().subVectors(b.pos, camera.position); away.y = 0; away.normalize(); for (let k = 0; k < 10; k++) { const a = Math.atan2(away.z, away.x) + (Math.random() - .5) * 1.2, r = 6 + Math.random() * 5; const x = b.pos.x + Math.cos(a) * r, z = b.pos.z + Math.sin(a) * r; if (okGround(x, z)) { to = { x, z }; break; } } }
  if (!to) to = randomSpot(Math.random, b.home.x, b.home.z, 4);
  b.dest = new V3(to.x, 0, to.z); b.mode = 'run'; b.flee = flee; b.hop = null;
}
function updateRabbit(b, dt) {
  if (b.mode !== 'run' && state.mode === 'walk' && camera.position.distanceTo(b.pos) < 3.4) startRun(b, true);
  if (b.mode === 'idle') {
    b.timer -= dt; b.head.rotation.x = 0.35 + Math.sin(T * 7 + b.ph) * 0.05 * (Math.sin(T * 0.7 + b.ph) > 0 ? 1 : 0);
    if (b.timer <= 0) { b.timer = 2 + Math.random() * 5; if (Math.random() < 0.6) startRun(b, false); }
  } else {
    if (!b.hop) {
      const dir = new V3().subVectors(b.dest, b.pos); dir.y = 0; const d = dir.length();
      if (d < 0.3) { b.mode = 'idle'; b.flee = false; b.head.rotation.x = 0; }
      else { const step = Math.min(d, b.flee ? 0.75 : 0.42); dir.normalize(); const to = b.pos.clone().addScaledVector(dir, step); if (!okGround(to.x, to.z)) { b.mode = 'idle'; return; } b.hop = { a: b.pos.clone(), b: to, t: 0, dur: b.flee ? 0.24 : 0.34 }; b.g.rotation.y = Math.atan2(dir.x, dir.z); b.head.rotation.x = 0; }
    }
    if (b.hop) {
      b.hop.t += dt / b.hop.dur; const t = Math.min(1, b.hop.t);
      b.pos.lerpVectors(b.hop.a, b.hop.b, t); b.pos.y = groundH(b.pos.x, b.pos.z) + Math.sin(Math.PI * t) * (b.flee ? 0.18 : 0.11);
      b.g.rotation.x = -Math.sin(Math.PI * t * 2) * 0.15;
      if (t >= 1) { b.hop = null; b.g.rotation.x = 0; }
    }
  }
  b.g.position.copy(b.pos);
}
export function updateAnimals(dt) { animals.forEach(a => { if (!featOn(a.cat)) { a.root.visible = false; return; } a.root.visible = true; a.update(dt); }); updateFlock(); }

