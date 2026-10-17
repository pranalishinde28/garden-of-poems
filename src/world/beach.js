import * as THREE from 'three';
import { C, V3, clamp, rng } from '../core/util.js';
import { SEA_Y, beachH, seaDepth } from './terrain.js';
import { camera, scene } from './renderer.js';
import { GEO, Merge, VC } from './geometry.js';
import { addTick } from '../core/things.js';
import { state, T } from '../core/state.js';
import { late } from '../core/late.js';

/* ================= the beach, when the garden looks out to sea ================= */
// Sandcastles with towers and flags, striped parasols over towels, shells and starfish on the wet sand,
// driftwood, a jetty with a rowing boat and a buoy. You can walk down and wade in: the sea rings out
// round your feet, the waves get louder, and you walk more slowly the deeper it is.
export const beachThings = new THREE.Group(); beachThings.visible = false; scene.add(beachThings);
const R = rng(2024), at = (a, r) => { const x = Math.cos(a) * r, z = Math.sin(a) * r; return new V3(x, beachH(x, z), z); };
const quatY = a => new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), a);
const SAND = ['#e4c995', '#dcbf86', '#e8cf9e'], WET = '#b8a176';

/* ---------- sandcastles ---------- */
const castles = new Merge();
function castle(a, r, s) {
  const c = at(a, r), face = -a + Math.PI / 2, rot = (x, z) => new V3(x, 0, z).applyAxisAngle(new V3(0, 1, 0), face);
  const put = (geo, x, y, z, sx, sy, sz, col, q) => castles.add(geo, c.clone().add(rot(x * s, z * s)).add(new V3(0, y * s, 0)), new V3(sx * s, sy * s, sz * s), C(col), q || quatY(face));
  put(GEO.cylB, 0, -0.05, 0, 1.25, 0.08, 1.25, WET); // the moat's wet ring
  put(GEO.box, 0, 0.18, 0, 1.3, 0.36, 1.3, SAND[0]); // the walls
  for (let k = -2; k <= 2; k++) for (const [dx, dz] of [[k * 0.26, 0.66], [k * 0.26, -0.66], [0.66, k * 0.26], [-0.66, k * 0.26]]) if (k % 2 === 0) put(GEO.box, dx, 0.4, dz, 0.13, 0.1, 0.13, SAND[1]); // crenellations
  for (const [dx, dz] of [[-0.66, -0.66], [0.66, -0.66], [-0.66, 0.66], [0.66, 0.66]]) { // corner towers with pointed roofs
    put(GEO.cylB, dx, 0, dz, 0.22, 0.62, 0.22, SAND[2]);
    put(GEO.cone, dx, 0.62, dz, 0.24, 0.32, 0.24, SAND[1]);
  }
  put(GEO.cylB, 0, 0.36, 0, 0.36, 0.55, 0.36, SAND[0]); put(GEO.cylB, 0, 0.91, 0, 0.22, 0.3, 0.22, SAND[2]); put(GEO.cone, 0, 1.21, 0, 0.26, 0.36, 0.26, SAND[1]);
  put(GEO.box, 0, 0.1, 0.66, 0.3, 0.2, 0.06, '#9b7f55'); // the gate
  for (let k = 0; k < 6; k++) put(GEO.sph, (R() - 0.5) * 1.1, 0.37, (R() - 0.5) * 1.1, 0.05, 0.03, 0.05, ['#f2d7dc', '#fff6ea', '#d9a07a'][k % 3]); // shells pressed into the walls
  put(GEO.cylB, 0, 1.4, 0, 0.012, 0.5, 0.012, '#7a5a3a'); // the flag
  castles.add(GEO.box, c.clone().add(new V3(0, (1.82) * s, 0)).add(rot(0.12 * s, 0)), new V3(0.24 * s, 0.14 * s, 0.01 * s), C('#d9433a'), quatY(face));
  // a bucket and spade beside it
  const b = c.clone().add(rot(1.1 * s, 0.4 * s)); castles.add(new THREE.CylinderGeometry(0.11, 0.08, 0.2, 16).translate(0, 0.1, 0), b, new V3(1, 1, 1), C('#3c86c8'));
  castles.add(GEO.box, b.clone().add(new V3(0.22, 0.03, 0.05)), new V3(0.08, 0.02, 0.32), C('#f2b632'), quatY(0.7));
}
[[1.15, 80, 1.1], [0.3, 82, 0.9], [2.5, 79, 1.2], [-2.5, 81, 1.0], [-0.6, 84, 0.85]].forEach(([a, r, s]) => castle(a, r, s));

/* ---------- parasols and towels ---------- */
const shade = new Merge();
function parasol(a, r, cols) {
  const p = at(a, r), tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler((R() - 0.5) * 0.2, 0, (R() - 0.5) * 0.2));
  shade.limb(p.clone().add(new V3(0, -0.2, 0)), p.clone().add(new V3(0, 2.25, 0).applyQuaternion(tilt)), 0.025, 0.022, C('#f6f2ea'));
  const canopy = new THREE.ConeGeometry(1.25, 0.45, 16, 1, true), cc = [], P = canopy.attributes.position;
  for (let i = 0; i < P.count; i++) { const k = Math.floor(((Math.atan2(P.getZ(i), P.getX(i)) + Math.PI) / (Math.PI * 2)) * 16 + 0.5) % 2; const c = C(cols[k]); cc.push(c.r, c.g, c.b); }
  canopy.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3));
  shade.add(canopy, p.clone().add(new V3(0, 2.15, 0).applyQuaternion(tilt)), new V3(1, 1, 1), C('#ffffff'), tilt);
  // a striped towel in its shade, and sometimes a low beach chair
  const t = p.clone().add(new V3(Math.cos(a + 1.6) * 0.9, 0.03, Math.sin(a + 1.6) * 0.9));
  for (let k = 0; k < 5; k++) shade.add(GEO.box, t.clone().add(new V3(0, 0, (k - 2) * 0.17).applyAxisAngle(new V3(0, 1, 0), -a)), new V3(0.9, 0.012, 0.17), C(k % 2 ? cols[1] : cols[0]), quatY(-a));
  if (R() < 0.6) {
    const ch = p.clone().add(new V3(Math.cos(a - 1.4) * 1.1, 0, Math.sin(a - 1.4) * 1.1)), q = quatY(-a + Math.PI / 2);
    shade.add(GEO.box, ch.clone().add(new V3(0, 0.25, 0)), new V3(0.6, 0.04, 0.55), C(cols[0]), q);
    shade.add(GEO.box, ch.clone().add(new V3(0, 0.45, 0).add(new V3(-0.28, 0, 0).applyQuaternion(q))), new V3(0.05, 0.45, 0.55), C(cols[1]), q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -0.35))));
    for (const sz of [-0.25, 0.25]) shade.add(GEO.box, ch.clone().add(new V3(0, 0.12, sz).applyQuaternion(q)), new V3(0.6, 0.03, 0.03), C('#cfc6b4'), q);
  }
}
[[0.75, 79, ['#e8574a', '#fbf6ec']], [1.6, 78, ['#2f7fc1', '#fbf6ec']], [2.05, 80, ['#f2b632', '#fbf6ec']], [-1.2, 79, ['#e86d9a', '#fbf6ec']], [-2.0, 80, ['#3aa38b', '#fbf6ec']], [2.9, 79, ['#e8574a', '#f2b632']]].forEach(([a, r, c]) => parasol(a, r, c));

/* ---------- shells, starfish and driftwood ---------- */
const bits = new Merge();
const star = (() => { const s = new THREE.Shape(); for (let k = 0; k <= 10; k++) { const a = k / 10 * Math.PI * 2, rr = k % 2 ? 0.035 : 0.1; k ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } return new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2 }).rotateX(-Math.PI / 2); })();
for (let i = 0; i < 160; i++) {
  const a = R() * Math.PI * 2, r = 84 + R() * 9, p = at(a, r);
  if (R() < 0.18) bits.add(star, p.clone().add(new V3(0, 0.02, 0)), new V3(1, 1, 1), C(['#e8794a', '#d9563f', '#f0a050'][i % 3]), quatY(R() * 6));
  else bits.add(GEO.half, p, new V3(0.05 + R() * 0.04, 0.03, 0.05 + R() * 0.04), C(['#f6e7df', '#f2d0d6', '#fff8ef', '#e9c6a6'][i % 4]), quatY(R() * 6));
}
for (let i = 0; i < 7; i++) { // driftwood, bleached grey, lying along the tide line
  const a = R() * Math.PI * 2, p = at(a, 88 + R() * 3), d = new V3(Math.cos(a + 1.5), 0, Math.sin(a + 1.5)).multiplyScalar(1 + R() * 1.4);
  bits.limb(p.clone().sub(d), p.clone().add(d).add(new V3(0, 0.05, 0)), 0.09 + R() * 0.05, 0.05, C('#a49b8c'));
  bits.limb(p.clone(), p.clone().add(new V3(Math.cos(a) * 0.6, 0.2, Math.sin(a) * 0.6)), 0.04, 0.02, C('#958c7e'));
}
// beach grass on the dunes where the garden ends
for (let i = 0; i < 260; i++) { const a = R() * Math.PI * 2, p = at(a, 72 + R() * 5); for (let k = 0; k < 3; k++) bits.limb(p, p.clone().add(new V3((R() - 0.5) * 0.3, 0.35 + R() * 0.3, (R() - 0.5) * 0.3)), 0.012, 0.002, C(['#a7a467', '#b9b277', '#8f9358'][k])); }

/* ---------- the jetty, a rowing boat and a buoy ---------- */
const JA = -2.05, wood = new Merge();
for (let r = 84; r <= 110; r += 0.55) { const p = at(JA, r); p.y = Math.max(p.y, SEA_Y) + 0.55; const side = new V3(Math.cos(JA + Math.PI / 2), 0, Math.sin(JA + Math.PI / 2)); wood.add(GEO.box, p, new V3(1.6, 0.06, 0.48), C(['#8a6a4c', '#7c5e43', '#957456'][Math.floor(r) % 3]), quatY(-JA)); if (Math.floor(r) % 3 === 0) for (const s of [-0.75, 0.75]) { const b = p.clone().addScaledVector(side, s); wood.limb(b.clone().setY(beachH(b.x, b.z) - 0.3), b.clone().setY(p.y + 0.6), 0.07, 0.07, C('#6b513b')); } }
const boat = new THREE.Group(), bm = new Merge();
{ const hull = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); bm.add(hull, new V3(0, 0.35, 0), new V3(0.75, 0.42, 1.9), C('#f2efe6')); bm.add(new THREE.TorusGeometry(1, 0.06, 6, 30).rotateX(Math.PI / 2), new V3(0, 0.36, 0), new V3(0.75, 1, 1.9), C('#2f6fa8')); for (const z of [-0.5, 0.4]) bm.add(GEO.box, new V3(0, 0.28, z), new V3(1.3, 0.05, 0.25), C('#9a7656')); bm.limb(new V3(0.3, 0.32, -0.2), new V3(1.4, 0.15, 0.6), 0.025, 0.025, C('#8a6a4c')); }
boat.add(new THREE.Mesh(bm.build(), VC)); { const p = at(JA + 0.03, 102); boat.position.set(p.x, SEA_Y - 0.12, p.z); boat.rotation.y = -JA; } beachThings.add(boat);
const buoy = new THREE.Group(); { const m = new Merge(); m.add(GEO.sph, new V3(0, 0.15, 0), new V3(0.35, 0.3, 0.35), C('#e2463d')); m.add(GEO.cylB, new V3(0, 0.2, 0), new V3(0.36, 0.1, 0.36), C('#ffffff')); m.add(GEO.cylB, new V3(0, 0.3, 0), new V3(0.04, 0.8, 0.04), C('#444')); buoy.add(new THREE.Mesh(m.build(), VC)); const p = at(0.4, 125); buoy.position.set(p.x, SEA_Y, p.z); } beachThings.add(buoy);
[castles, shade, bits, wood].forEach(m => { const mesh = new THREE.Mesh(m.build(), VC); mesh.castShadow = true; mesh.receiveShadow = true; beachThings.add(mesh); });

/* ---------- wading: rings round your feet, and the sound of the waves ---------- */
const ringMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false });
const rings = Array.from({ length: 10 }, () => { const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2), ringMat.clone()); m.visible = false; m.userData.life = 0; beachThings.add(m); return m; });
let ringI = 0, ringT = 0, wet = false;
export function wade(dt, pos, speed) {
  const d = seaDepth(pos.x, pos.z);
  if (d > 0.05 && !wet && beachThings.visible) late.toast && late.toast('The sea is cool round your ankles.', 2600);
  wet = d > 0.05;
  ringT -= dt;
  if (wet && (ringT <= 0)) { ringT = speed > 0.4 ? 0.28 : 1.1; const m = rings[ringI++ % rings.length]; m.position.set(pos.x, SEA_Y + 0.02, pos.z); m.userData.life = 1; m.visible = true; }
  return d;
}
addTick(dt => {
  rings.forEach(m => { if (!m.visible) return; m.userData.life -= dt * 0.7; const l = Math.max(0, m.userData.life); m.scale.setScalar(0.3 + (1 - l) * 1.6); m.material.opacity = l * 0.55; if (l <= 0) m.visible = false; });
  boat.position.y = SEA_Y - 0.12 + Math.sin(T * 1.1) * 0.05; boat.rotation.z = Math.sin(T * 0.8) * 0.04;
  buoy.position.y = SEA_Y + Math.sin(T * 1.4 + 1) * 0.08; buoy.rotation.z = Math.sin(T * 1.1) * 0.1;
  return true;
}, true);
// the waves: louder near the water's edge, and loudest standing in it
let surf = null;
addTick(() => {
  const M = late.Music; if (!M || !M.ctx) return true;
  if (!surf) {
    const ctx = M.ctx, len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), dd = buf.getChannelData(0);
    let b = 0; for (let i = 0; i < len; i++) { b = 0.985 * b + 0.015 * (Math.random() * 2 - 1); const swell = 0.55 + 0.45 * Math.sin(i / len * Math.PI * 2 * 2); dd[i] = ((Math.random() * 2 - 1) * 0.35 + b * 5) * swell; }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; const g = ctx.createGain(); g.gain.value = 0;
    src.connect(lp); lp.connect(g); g.connect(ctx.destination); src.start(); surf = { g, v: -1 };
  }
  const r = Math.hypot(camera.position.x, camera.position.z), near = beachThings.visible ? clamp(1 - Math.abs(r - 94) / 26, 0, 1) : 0;
  const v = M.muted ? 0 : Math.round((0.05 + 0.13 * near) * near * 200) / 200;
  if (v !== surf.v) { surf.v = v; surf.g.gain.setTargetAtTime(v, M.ctx.currentTime, 0.6); }
  return true;
}, true);
