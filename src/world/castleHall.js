import * as THREE from 'three';
import { C, V3, clamp, rng, smooth } from '../core/util.js';
import { T, state } from '../core/state.js';
import { canvasTex, glowTex } from './textures.js';
import { GEO, Merge } from './geometry.js';
import { worlds } from '../core/worlds.js';
import { addTick, regThing } from '../core/things.js';
import { late } from '../core/late.js';
import { CASTLE, O, rides, sunScene } from './sunWorld.js';

/* ================= the Starlit Hall, inside the castle ================= */
// Through the castle's gate you step into an indoor wonderland under a starry dome, in the spirit of the
// great indoor parks (an original place with an original mascot, not Sanrio's): pastel candy houses round the
// walls, a glowing wishing tree, a calico cat with a flower crown, and rides you can take: spinning teacups, a
// drop tower, a balloon carousel, a little train round the hall, and bumper cars you drive yourself.
// It is part of the secret world's scene but far below and away from the fair, and shown only while you are
// inside (ui/worlds.js crosses you in and out through the castle gate and the hall's door).

const R = rng(9191);
export const HALL = { x: 420, z: -60, y: -90, r: 46 };
const hall = new THREE.Group(); hall.position.set(O.x + HALL.x, O.y + HALL.y, O.z + HALL.z); hall.visible = false; sunScene.add(hall);
const W = (x, z) => new V3(O.x + HALL.x + x, O.y + HALL.y, O.z + HALL.z + z);
const PASTEL = ['#f7b9cd', '#bfe3f2', '#fde59a', '#c9f0d0', '#e0cdf6', '#ffd2b0', '#ffffff'];
// everything in here is lit from within: soft emissive fill, plus a few warm lights
const toy = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#4a3a4e', emissiveIntensity: 0.35 });
const bulbs = [];
const bulb = (x, y, z, col) => { const c = new THREE.Color(col); bulbs.push(x, y, z, c.r, c.g, c.b); };

/* ---------- the room: a starry dome, painted walls, a checkered floor ---------- */
{
  const dome = new THREE.Mesh(new THREE.SphereGeometry(HALL.r, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.ShaderMaterial({ side: THREE.BackSide, fog: false, uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float uTime;varying vec3 vP;
      float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){vec3 d=normalize(vP);float y=d.y;
        vec3 c=mix(vec3(.55,.42,.72),vec3(.12,.12,.34),smoothstep(.0,.9,y));
        c=mix(c,vec3(.95,.62,.78),smoothstep(.35,0.,y)*.55);
        vec2 q=d.xz/(y+.35)*40.;vec2 i=floor(q);float st=step(.985,h2(i))*smoothstep(.22,0.,length(fract(q)-.5));
        c+=vec3(1.,.95,.85)*st*(.6+.4*sin(uTime*2.+h2(i+3.)*20.))*smoothstep(.1,.4,y);
        float band=sin(atan(d.z,d.x)*3.+y*6.+uTime*.15)*.5+.5;c+=vec3(.5,.3,.6)*band*smoothstep(.5,.2,abs(y-.45))*.18;
        gl_FragColor=vec4(c,1.);}` }));
  dome.position.y = 8; hall.add(dome); hall.userData.dome = dome;
  const wallTex = canvasTex(1024, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#f6c7d8'); gr.addColorStop(1, '#fbe3ea'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 8; k++) { const x = 64 + k * 128; g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(x - 34, h - 30); g.lineTo(x - 34, 110); g.arc(x, 110, 34, Math.PI, 0); g.lineTo(x + 34, h - 30); g.closePath(); g.fill(); g.fillStyle = '#ffe6a8'; g.beginPath(); g.moveTo(x - 26, h - 36); g.lineTo(x - 26, 112); g.arc(x, 112, 26, Math.PI, 0); g.lineTo(x + 26, h - 36); g.closePath(); g.fill(); }
    g.fillStyle = '#e88fb0'; for (let x = 0; x < w; x += 32) { g.beginPath(); g.arc(x + 16, 26, 10, 0, Math.PI); g.fill(); }
  }, true);
  wallTex.repeat.set(6, 1);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(HALL.r, HALL.r, 8, 64, 1, true), new THREE.MeshBasicMaterial({ map: wallTex, color: '#d8c4cc', side: THREE.BackSide, fog: false }));
  wall.position.y = 4; hall.add(wall);
  const floorTex = canvasTex(256, 256, (g, w, h) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#e7b4c6' : '#c98aa4'; g.fillRect(x * 32, y * 32, 32, 32); } }, true);
  floorTex.repeat.set(12, 12);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(HALL.r, 64).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: floorTex, color: '#a88a96', emissive: '#1a0e14', emissiveIntensity: 1 }));
  hall.add(floor);
  // warm lights inside; their reach stays within the hall
  for (const [x, z] of [[0, 0], [-24, -10], [24, -10], [0, 28]]) { const l = new THREE.PointLight('#ffe2ec', 0.45, 60, 1.6); l.position.set(x, 18, z); hall.add(l); }
  // the door out, on the south wall
  const d = new Merge();
  d.add(GEO.box, new V3(0, 2.4, HALL.r - 0.3), new V3(4.4, 4.8, 0.3), C('#fffaf0'));
  d.add(GEO.box, new V3(0, 2.2, HALL.r - 0.5), new V3(3.4, 4.2, 0.2), C('#c56b8e'));
  d.add(new THREE.TorusGeometry(2.2, 0.25, 8, 24, Math.PI), new V3(0, 4.8, HALL.r - 0.45), new V3(1, 1, 1), C('#f2c12e'));
  const door = new THREE.Mesh(d.build(), toy); hall.add(door); hall.userData.door = door;
  for (let k = 0; k <= 12; k++) { const a = Math.PI * k / 12; bulb(Math.cos(a) * 2.6, 4.8 + Math.sin(a) * 2.6, HALL.r - 0.7, '#ffe08a'); }
}

/* ---------- candy houses round the walls ---------- */
{
  const m = new Merge();
  for (let k = 0; k < 18; k++) {
    const a = k / 18 * Math.PI * 2 + 0.17; if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.3) continue;
    const s = 1.5 + R() * 0.6, r = HALL.r - 0.4 - s * 1.05, x = Math.cos(a) * r, z = Math.sin(a) * r, q = new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), -a - Math.PI / 2);
    m.add(GEO.box, new V3(x, s * 1.1, z), new V3(s * 2.4, s * 2.2, s * 2), C(PASTEL[k % 6]), q);
    m.add(GEO.pyr, new V3(x, s * 2.2 + s * 0.8, z), new V3(s * 1.9, s * 1.6, s * 1.6), C(['#e8463a', '#d95aa8', '#3b8fe0', '#7a5cc8', '#f08a1c'][k % 5]), q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), Math.PI / 4)));
    const fx = x - Math.cos(a) * s * 1.01, fz = z - Math.sin(a) * s * 1.01;
    m.add(GEO.box, new V3(fx, s * 0.6, fz), new V3(s * 0.6, s * 1.1, 0.06), C('#8a5a3a'), q);
    for (const o of [-0.7, 0.7]) { m.add(GEO.box, new V3(fx - Math.sin(a) * o * s, s * 1.5, fz + Math.cos(a) * o * s), new V3(s * 0.45, s * 0.45, 0.06), C('#ffe6a8'), q); bulb(fx - Math.sin(a) * o * s - Math.cos(a) * 0.1, s * 1.5, fz + Math.cos(a) * o * s - Math.sin(a) * 0.1, '#ffd890'); }
    // candy canes either side of each door
    for (const o of [-1.4, 1.4]) { const cx = fx - Math.sin(a) * o * s - Math.cos(a) * 0.5, cz = fz + Math.cos(a) * o * s - Math.sin(a) * 0.5; for (let y = 0; y < 2.2; y += 0.35) m.add(GEO.cylB, new V3(cx, y, cz), new V3(0.12, 0.35, 0.12), C(Math.round(y / 0.35) % 2 ? '#ffffff' : '#e8463a')); }
  }
  hall.add(new THREE.Mesh(m.build(), toy));
}

/* ---------- the wishing tree in the middle, hung with lights ---------- */
{
  const m = new Merge(), bark = C('#a77a9a');
  m.add(new THREE.CylinderGeometry(3.6, 4, 0.8, 32), new V3(0, 0.4, 0), new V3(1, 1, 1), C('#fffaf0'));
  m.limb(new V3(0, 0, 0), new V3(0, 7, 0), 1.1, 0.7, bark);
  const tips = [];
  for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2, e = new V3(Math.cos(a) * (4 + R() * 2), 9 + R() * 4, Math.sin(a) * (4 + R() * 2)); m.limb(new V3(0, 6.5, 0), e, 0.45, 0.18, bark); tips.push(e); }
  hall.add(new THREE.Mesh(m.build(), toy));
  // a crown of glowing blossom: soft pink and white lights all through it
  for (const e of tips) for (let k = 0; k < 40; k++) { const d = new V3(R() - 0.5, R() - 0.4, R() - 0.5).multiplyScalar(4.5); bulb(e.x + d.x, e.y + d.y, e.z + d.z, ['#ffb8d0', '#ffffff', '#ffd6e6', '#e8c8ff'][k % 4]); }
  for (let k = 0; k < 60; k++) { const a = R() * Math.PI * 2, r = 2 + R() * 6; bulb(Math.cos(a) * r, 2 + R() * 9, Math.sin(a) * r, '#fff1b0'); }
}

/* ---------- Mimi, the calico cat with a flower crown (an original mascot) ---------- */
// a tortoiseshell-and-white calico with big amber eyes, a smile, a bell on a green collar and a crown of flowers
{
  const m = new Merge(), WHITE = C('#fffaf3'), ORANGE = C('#e8913a'), BLACK = C('#3a3236'), PINK = C('#f4a0b8'), AMBER = C('#e8b23a');
  const cx = -9, cz = 30, S = 1.6, at = (x, y, z) => new V3(cx + x * S, y * S, cz + z * S);
  m.add(new THREE.CylinderGeometry(2.6 * S, 2.8 * S, 0.6 * S, 24), at(0, 0.3, 0), new V3(1, 1, 1), C('#c9f0d0'));
  // body, sitting, with big calico patches
  m.add(GEO.sph, at(0, 2.0, 0), new V3(1.45 * S, 1.6 * S, 1.3 * S), WHITE);
  m.add(GEO.sph, at(-0.55, 2.4, -0.35), new V3(1.05 * S, 1.0 * S, 0.95 * S), ORANGE);
  m.add(GEO.sph, at(0.7, 1.9, -0.45), new V3(0.85 * S, 0.9 * S, 0.8 * S), BLACK);
  // head: a broad cat's head with cheeks
  m.add(GEO.sph, at(0, 4.15, 0.1), new V3(1.5 * S, 1.2 * S, 1.25 * S), WHITE);
  m.add(GEO.sph, at(-0.7, 4.6, -0.05), new V3(0.95 * S, 0.75 * S, 0.9 * S), ORANGE);
  m.add(GEO.sph, at(0.75, 4.65, -0.05), new V3(0.8 * S, 0.7 * S, 0.85 * S), BLACK);
  for (const s of [-1, 1]) {
    m.add(GEO.cone, at(s * 0.85, 5.25, -0.05), new V3(0.48 * S, 0.85 * S, 0.42 * S), s < 0 ? ORANGE : BLACK, new THREE.Quaternion().setFromAxisAngle(new V3(0, 0, 1), -s * 0.35));
    m.add(GEO.cone, at(s * 0.83, 5.18, 0.08), new V3(0.26 * S, 0.5 * S, 0.1 * S), PINK, new THREE.Quaternion().setFromAxisAngle(new V3(0, 0, 1), -s * 0.35));
    // big round amber eyes with dark pupils and two highlights
    m.add(GEO.sph, at(s * 0.5, 4.2, 1.12), new V3(0.3 * S, 0.32 * S, 0.12 * S), AMBER);
    m.add(GEO.sph, at(s * 0.5, 4.18, 1.2), new V3(0.17 * S, 0.24 * S, 0.08 * S), C('#2a2228'));
    m.add(GEO.sph, at(s * 0.56, 4.3, 1.26), new V3(0.07 * S, 0.07 * S, 0.03 * S), WHITE);
    m.add(GEO.sph, at(s * 0.44, 4.1, 1.26), new V3(0.035 * S, 0.035 * S, 0.02 * S), WHITE);
    for (const dy of [0, 0.16]) m.limb(at(s * 0.4, 3.82 + dy, 1.22), at(s * 1.6, 3.95 + dy * 1.6, 1.1), 0.015 * S, 0.012 * S, C('#8a7a80'));
    m.add(GEO.sph, at(s * 0.95, 3.85, 1.0), new V3(0.2 * S, 0.12 * S, 0.06 * S), PINK);
    m.add(GEO.sph, at(s * 0.7, 0.9, 1.0), new V3(0.5 * S, 0.4 * S, 0.55 * S), s < 0 ? WHITE : ORANGE);
    // a little smiling mouth either side of the nose
    m.limb(at(0, 3.82, 1.31), at(s * 0.16, 3.72, 1.28), 0.02 * S, 0.02 * S, C('#5a3a40'));
  }
  m.add(GEO.sph, at(0, 3.92, 1.32), new V3(0.13 * S, 0.09 * S, 0.07 * S), PINK);
  // a ringed orange-and-black tail curling round
  for (let k = 0; k < 7; k++) { const t = k / 6, a = 0.2 + t * 2.1; m.add(GEO.sph, at(1.2 + Math.sin(a) * 0.9, 0.7 + t * 1.6, -0.6 - Math.cos(a) * 0.5), new V3(0.28 * S, 0.28 * S, 0.28 * S), k % 2 ? ORANGE : BLACK); }
  // a green collar with a gold bell, and her flower crown
  m.add(new THREE.TorusGeometry(1.05 * S, 0.1 * S, 8, 28).rotateX(Math.PI / 2), at(0, 3.15, 0.1), new V3(1, 1, 1), C('#4fb35a'));
  m.add(GEO.sph, at(0, 2.95, 1.2), new V3(0.22 * S, 0.22 * S, 0.22 * S), C('#f2c12e'));
  for (let k = 0; k < 11; k++) { const a = Math.PI * (0.05 + 0.9 * k / 10); m.add(GEO.sph, at(Math.cos(a) * 1.15, 5.05 + Math.sin(a) * 0.25, Math.sin(a) * 0.6 - 0.15), new V3(0.2 * S, 0.2 * S, 0.2 * S), C(['#ff8fb4', '#ffffff', '#ffd54a', '#b89cf0'][k % 4])); }
  hall.add(new THREE.Mesh(m.build(), toy));
}

/* ---------- the rides ---------- */
const hallRides = [];
const exitAt = (x, z) => W(x, z);
function ride(def, root, near) { hallRides.push(def); rides.push(def); regThing(root, def.label, () => late.startRide && late.startRide(def), near); }

// spinning teacups: a turning floor, three smaller turntables, two cups on each spinning on its own
const TEA = { x: -24, z: -6, r: 9 }, teaTop = new THREE.Group(), teaSubs = [], cups = [];
{
  teaTop.position.set(TEA.x, 0, TEA.z); hall.add(teaTop);
  const base = new Merge(); base.add(new THREE.CylinderGeometry(TEA.r, TEA.r + 0.3, 0.5, 48), new V3(0, 0.25, 0), new V3(1, 1, 1), C('#fffaf0'));
  for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; base.add(GEO.box, new V3(Math.cos(a) * (TEA.r - 0.1), 0.52, Math.sin(a) * (TEA.r - 0.1)), new V3(2.3, 0.05, 0.4), C(k % 2 ? '#f7b9cd' : '#bfe3f2'), new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), -a + Math.PI / 2)); }
  teaTop.add(new THREE.Mesh(base.build(), toy));
  const CUP = ['#f7b9cd', '#bfe3f2', '#fde59a', '#c9f0d0', '#e0cdf6', '#ffd2b0'];
  for (let i = 0; i < 3; i++) {
    const sub = new THREE.Group(), a = i / 3 * Math.PI * 2; sub.position.set(Math.cos(a) * 5, 0.5, Math.sin(a) * 5); teaTop.add(sub); teaSubs.push(sub);
    const pm = new Merge(); pm.add(new THREE.CylinderGeometry(3.2, 3.2, 0.2, 32), new V3(0, 0.1, 0), new V3(1, 1, 1), C('#e8d6f6')); sub.add(new THREE.Mesh(pm.build(), toy));
    for (let j = 0; j < 2; j++) {
      const cup = new THREE.Group(); cup.position.set(j ? 1.6 : -1.6, 0.2, 0); sub.add(cup);
      const cm = new Merge(), c = C(CUP[(i * 2 + j) % 6]);
      cm.add(new THREE.CylinderGeometry(1.2, 0.8, 1.3, 20, 1, true), new V3(0, 0.75, 0), new V3(1, 1, 1), c);
      cm.add(new THREE.CylinderGeometry(0.8, 0.8, 0.1, 20), new V3(0, 0.12, 0), new V3(1, 1, 1), c);
      cm.add(new THREE.TorusGeometry(1.2, 0.08, 6, 24).rotateX(Math.PI / 2), new V3(0, 1.4, 0), new V3(1, 1, 1), C('#ffffff'));
      cm.add(new THREE.TorusGeometry(0.4, 0.1, 6, 12), new V3(1.3, 0.85, 0), new V3(1, 1, 1), c);
      for (let k = 0; k < 6; k++) { const b = k / 6 * Math.PI * 2; cm.add(GEO.sph, new V3(Math.cos(b) * 1.05, 0.85, Math.sin(b) * 1.05), new V3(0.18, 0.18, 0.05), C('#ffffff'), new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), -b + Math.PI / 2)); }
      cup.add(new THREE.Mesh(cm.build(), toy)); cups.push(cup);
    }
  }
  for (let k = 0; k < 40; k++) { const a = k / 40 * Math.PI * 2; bulb(TEA.x + Math.cos(a) * (TEA.r + 0.2), 0.7, TEA.z + Math.sin(a) * (TEA.r + 0.2), k % 2 ? '#ffd0e0' : '#ffe8a0'); }
  ride({ key: 'teacups', label: 'Ride the teacups', name: 'In a spinning teacup', follow: true, exit: exitAt(TEA.x + TEA.r + 2, TEA.z),
    seat(v) { cups[0].getWorldPosition(v); v.y += 2.0; } }, teaTop, { x: W(TEA.x, TEA.z).x, z: W(TEA.x, TEA.z).z, r: TEA.r + 2.5 });
}

// the drop tower: a slender pastel tower; the ring of seats climbs slowly, waits, and drops
const TOWER = { x: 25, z: -20, h: 30 }, ringSeat = new THREE.Group();
let dropY = 2;
{
  const m = new Merge();
  m.add(new THREE.CylinderGeometry(3.4, 3.8, 0.8, 32), new V3(TOWER.x, 0.4, TOWER.z), new V3(1, 1, 1), C('#fffaf0'));
  for (let y = 0; y < TOWER.h; y += 2) m.add(new THREE.CylinderGeometry(0.9, 0.9, 2, 16), new V3(TOWER.x, y + 1, TOWER.z), new V3(1, 1, 1), C(PASTEL[(y / 2) % 6]));
  m.add(GEO.cone, new V3(TOWER.x, TOWER.h, TOWER.z), new V3(1.8, 3, 1.8), C('#e8508a'));
  m.add(GEO.sph, new V3(TOWER.x, TOWER.h + 3.2, TOWER.z), new V3(0.5, 0.5, 0.5), C('#f2c12e'));
  hall.add(new THREE.Mesh(m.build(), toy));
  for (let y = 2; y < TOWER.h; y += 1.4) for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + y; bulb(TOWER.x + Math.cos(a) * 1, y, TOWER.z + Math.sin(a) * 1, PASTEL[k]); }
  ringSeat.position.set(TOWER.x, dropY, TOWER.z); hall.add(ringSeat);
  const r = new Merge(); r.add(new THREE.TorusGeometry(2.4, 0.35, 8, 32).rotateX(Math.PI / 2), new V3(0, 0, 0), new V3(1, 1, 1), C('#7a5cc8'));
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; r.add(GEO.box, new V3(Math.cos(a) * 2.9, -0.2, Math.sin(a) * 2.9), new V3(0.9, 0.2, 0.8), C('#fde59a'), new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), -a)); r.add(GEO.box, new V3(Math.cos(a) * 2.5, 0.4, Math.sin(a) * 2.5), new V3(0.9, 1.1, 0.15), C('#fde59a'), new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), -a + Math.PI / 2)); }
  ringSeat.add(new THREE.Mesh(r.build(), toy));
  ride({ key: 'drop', label: 'Ride the drop tower', name: 'On the drop tower', exit: exitAt(TOWER.x - 6, TOWER.z + 2),
    seat(v) { ringSeat.localToWorld(v.set(3.1, 0.95, 0)); }, fwd(v) { const r = ringSeat.rotation.y; v.set(Math.cos(r), -0.3, -Math.sin(r)); } }, ringSeat, { x: W(TOWER.x, TOWER.z).x, z: W(TOWER.x, TOWER.z).z, r: 6 });
}

// the balloon carousel: little hot-air balloons on arms, turning and rising and falling
const BAL = { x: 24, z: 16 }, balTop = new THREE.Group(), balloons = [];
{
  const m = new Merge();
  m.add(new THREE.CylinderGeometry(3, 3.4, 0.6, 32), new V3(BAL.x, 0.3, BAL.z), new V3(1, 1, 1), C('#fffaf0'));
  m.limb(new V3(BAL.x, 0, BAL.z), new V3(BAL.x, 11, BAL.z), 0.5, 0.4, C('#bfe3f2'));
  m.add(GEO.cone, new V3(BAL.x, 12, BAL.z), new V3(2.2, 2.2, 2.2), C('#3b8fe0'));
  hall.add(new THREE.Mesh(m.build(), toy));
  balTop.position.set(BAL.x, 10, BAL.z); hall.add(balTop);
  const ENV = ['#e8463a', '#f7d433', '#4fb35a', '#3b8fe0', '#d95aa8', '#f08a1c'];
  for (let k = 0; k < 6; k++) {
    const arm = new THREE.Group(); arm.rotation.y = k / 6 * Math.PI * 2; balTop.add(arm);
    const am = new Merge(); am.limb(new V3(0, 0, 0), new V3(6.5, 0, 0), 0.08, 0.08, C('#e4b23a')); arm.add(new THREE.Mesh(am.build(), toy));
    const b = new THREE.Group(); b.position.set(6.5, 0, 0); arm.add(b);
    const bm = new Merge(), c = C(ENV[k]);
    bm.add(GEO.sph, new V3(0, -1.8, 0), new V3(1.5, 1.8, 1.5), c);
    for (let s = 0; s < 6; s++) { const a = s / 6 * Math.PI * 2; bm.add(GEO.box, new V3(Math.cos(a) * 1.46, -1.8, Math.sin(a) * 1.46), new V3(0.25, 3.2, 0.04), C('#ffffff'), new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), -a + Math.PI / 2)); }
    for (const [x, z] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) bm.limb(new V3(x * 1.5, -3.2, z * 1.5), new V3(x, -4.3, z), 0.02, 0.02, C('#8a6a4c'));
    bm.add(GEO.box, new V3(0, -4.7, 0), new V3(1.3, 0.8, 1.3), C('#a8794a'));
    b.add(new THREE.Mesh(bm.build(), toy)); balloons.push({ b, ph: k * 1.1 });
  }
  ride({ key: 'balloons', label: 'Ride a balloon', name: 'In a hot-air balloon', follow: true, exit: exitAt(BAL.x - 9, BAL.z),
    seat(v) { balloons[0].b.localToWorld(v.set(0, -3.8, 0)); } }, balTop, { x: W(BAL.x, BAL.z).x, z: W(BAL.x, BAL.z).z, r: 8 });
}

// the little train round the hall
const TRACK = 39.5, train = [];
{
  const m = new Merge();
  for (let k = 0; k < 160; k++) { const a = k / 160 * Math.PI * 2; m.add(GEO.box, new V3(Math.cos(a) * TRACK, 0.08, Math.sin(a) * TRACK), new V3(0.3, 0.12, 2.2), C('#8a6a4c'), new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), -a)); }
  for (const rr of [TRACK - 0.7, TRACK + 0.7]) m.add(new THREE.TorusGeometry(rr, 0.07, 4, 160).rotateX(Math.PI / 2), new V3(0, 0.22, 0), new V3(1, 1, 1), C('#c9c3b5'));
  hall.add(new THREE.Mesh(m.build(), toy));
  const CAR = ['#e8463a', '#f7b9cd', '#bfe3f2', '#fde59a', '#c9f0d0'];
  CAR.forEach((col, k) => {
    const g = new THREE.Group(), cm = new Merge(), c = C(col);
    if (k === 0) { cm.add(GEO.box, new V3(0, 1, 0), new V3(1.8, 1.4, 2.6), c); cm.add(new THREE.CylinderGeometry(0.7, 0.7, 2.2, 16).rotateX(Math.PI / 2), new V3(0, 1.3, 1.6), new V3(1, 1, 1), c); cm.add(GEO.cylB, new V3(0, 1.9, 2.2), new V3(0.25, 0.9, 0.25), C('#3a3236')); cm.add(GEO.box, new V3(0, 2.3, -0.6), new V3(1.9, 0.15, 1.6), C('#f2c12e')); }
    // open carriages, so whoever rides sees the whole hall go by
    else { cm.add(GEO.box, new V3(0, 0.75, 0), new V3(1.8, 0.9, 2.4), c); cm.add(GEO.box, new V3(0, 1.25, 0), new V3(1.9, 0.12, 2.5), C('#ffffff')); }
    for (const z of [-0.8, 0.8]) for (const s of [-1, 1]) cm.add(new THREE.CylinderGeometry(0.35, 0.35, 0.15, 12).rotateZ(Math.PI / 2), new V3(s * 0.95, 0.35, z), new V3(1, 1, 1), C('#3a3236'));
    g.add(new THREE.Mesh(cm.build(), toy)); hall.add(g); train.push(g);
  });
  ride({ key: 'train', label: 'Ride the little train', name: 'On the little train', follow: true, exit: exitAt(0, TRACK - 4),
    seat(v) { train[2].localToWorld(v.set(0, 2.1, 0)); } }, train[0], { x: W(0, TRACK).x, z: W(0, TRACK).z, r: 3.2 });
}

// bumper cars: an arena under a starry roof; your own car (car 0) you drive while riding
const ARENA = { x: -12, z: -24, hw: 9, hd: 6 }, cars = [];
let driving = false;
{
  const m = new Merge();
  m.add(GEO.box, new V3(ARENA.x, 0.1, ARENA.z), new V3(ARENA.hw * 2 + 1, 0.2, ARENA.hd * 2 + 1), C('#3a3a6a'));
  for (const [x, z, w, d] of [[0, -ARENA.hd - 0.4, ARENA.hw * 2 + 1.6, 0.6], [0, ARENA.hd + 0.4, ARENA.hw * 2 + 1.6, 0.6], [-ARENA.hw - 0.4, 0, 0.6, ARENA.hd * 2 + 1.6], [ARENA.hw + 0.4, 0, 0.6, ARENA.hd * 2 + 1.6]]) m.add(GEO.box, new V3(ARENA.x + x, 0.5, ARENA.z + z), new V3(w, 0.8, d), C('#f2c12e'));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.limb(new V3(ARENA.x + sx * (ARENA.hw + 0.4), 0, ARENA.z + sz * (ARENA.hd + 0.4)), new V3(ARENA.x + sx * (ARENA.hw + 0.4), 6, ARENA.z + sz * (ARENA.hd + 0.4)), 0.15, 0.15, C('#e8508a'));
  m.add(GEO.box, new V3(ARENA.x, 6.1, ARENA.z), new V3(ARENA.hw * 2 + 1.4, 0.3, ARENA.hd * 2 + 1.4), C('#2c2c5a'));
  hall.add(new THREE.Mesh(m.build(), toy));
  for (let x = -ARENA.hw, k = 0; x <= ARENA.hw; x += 1.2, k++) for (const z of [-ARENA.hd - 0.4, ARENA.hd + 0.4]) bulb(ARENA.x + x, 6.4, ARENA.z + z, ['#ff8fb4', '#8ad0ff', '#ffe08a'][k % 3]);
  for (let x = -ARENA.hw + 1; x < ARENA.hw; x += 2) for (let z = -ARENA.hd + 1; z < ARENA.hd; z += 2) bulb(ARENA.x + x, 5.9, ARENA.z + z, '#fff6d0');
  const COL = ['#e8463a', '#3b8fe0', '#4fb35a', '#f7d433', '#d95aa8', '#f08a1c', '#7a5cc8'];
  COL.forEach((col, k) => {
    const g = new THREE.Group(), cm = new Merge(), c = C(col);
    cm.add(new THREE.CylinderGeometry(1.15, 1.2, 0.5, 20), new V3(0, 0.45, 0), new V3(1.2, 1, 1.45), C('#2c2c2c'));
    cm.add(GEO.box, new V3(0, 0.85, -0.1), new V3(1.8, 0.5, 2.2), c);
    cm.add(GEO.box, new V3(0, 1.3, -0.75), new V3(1.6, 0.6, 0.3), c);
    cm.limb(new V3(0, 1.0, -0.6), new V3(0, 5.9, -0.6), 0.03, 0.03, C('#c9c3b5'));
    cm.add(new THREE.TorusGeometry(0.28, 0.05, 6, 16).rotateX(-0.9), new V3(0, 1.35, 0.4), new V3(1, 1, 1), C('#2c2c2c'));
    g.add(new THREE.Mesh(cm.build(), toy)); hall.add(g);
    cars.push({ g, x: ARENA.x + (R() - 0.5) * ARENA.hw * 1.6, z: ARENA.z + (R() - 0.5) * ARENA.hd * 1.6, h: R() * 6.28, v: 2 + R() * 1.5, turn: 0 });
  });
  ride({ key: 'bumper', label: 'Drive a bumper car', name: 'Bumper cars: W to drive, A D to steer', exit: exitAt(ARENA.x + ARENA.hw + 2.5, ARENA.z + 4),
    board() { driving = true; cars[0].v = 0; }, leave() { driving = false; },
    seat(v) { cars[0].g.localToWorld(v.set(0, 1.75, 0.35)); }, fwd(v) { v.set(Math.sin(cars[0].h), 0, Math.cos(cars[0].h)); },
    drive(dt, ix, iz) { const c = cars[0]; c.v += (iz * 5 - c.v) * Math.min(1, dt * 2.2); c.h -= ix * dt * 2.2 * (0.4 + Math.min(1, Math.abs(c.v) / 3)); } },
    cars[0].g, { x: W(ARENA.x + ARENA.hw + 1.5, ARENA.z).x, z: W(ARENA.x + ARENA.hw + 1.5, ARENA.z).z, r: 3.4 });
}

// every bulb in the hall, gently twinkling
{
  const n = bulbs.length / 6, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), ph = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos.set(bulbs.slice(i * 6, i * 6 + 3), i * 3); col.set(bulbs.slice(i * 6 + 3, i * 6 + 6), i * 3); ph[i] = R() * 100; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
  const pts = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true, fog: false,
    vertexShader: 'uniform float uTime;attribute float aPh;varying vec3 vC;void main(){vC=color*(.75+.25*sin(uTime*2.+aPh));vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(300./-mv.z,2.,20.);gl_Position=projectionMatrix*mv;}',
    fragmentShader: 'varying vec3 vC;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,.0,d)*.6+smoothstep(.18,.0,d);gl_FragColor=vec4(vC*a,a);}' }));
  hall.add(pts); hall.userData.pts = pts;
}

/* ---------- every frame while you are inside ---------- */
addTick(dt => {
  if (!hall.visible) return;
  hall.userData.dome.material.uniforms.uTime.value = T; hall.userData.pts.material.uniforms.uTime.value = T;
  teaTop.rotation.y = T * 0.35; teaSubs.forEach((s, i) => { s.rotation.y = -T * 0.9 + i; }); cups.forEach((c, i) => { c.rotation.y = T * (1.4 + (i % 3) * 0.3); });
  // the drop tower: up slowly for 9 s, a breath at the top, a sudden fall, bounce, rest
  { const t = T % 18; dropY = t < 9 ? 2 + smooth(0, 9, t) * 24 : t < 11 ? 26 : t < 12 ? 26 - 24 * Math.pow(t - 11, 2) : 2 + Math.abs(Math.sin((t - 12) * 6)) * Math.exp(-(t - 12) * 2.5) * 1.5; ringSeat.position.y = dropY; ringSeat.rotation.y = T * 0.1; }
  balTop.rotation.y = T * 0.45; balloons.forEach(b => { b.b.position.y = Math.sin(T * 0.8 + b.ph) * 1.4; });
  train.forEach((c, k) => { const a = T * 0.11 - k * 0.075, a2 = a + 0.01; c.position.set(Math.cos(a) * TRACK, 0, Math.sin(a) * TRACK); c.lookAt(hall.position.x + Math.cos(a2) * TRACK, hall.position.y, hall.position.z + Math.sin(a2) * TRACK); });
  // bumper cars: the others wander, everyone bounces off the walls and off each other
  cars.forEach((c, k) => {
    if (!(k === 0 && driving)) { c.turn += (R() - 0.5) * dt * 3; c.turn = clamp(c.turn, -1, 1); c.h += c.turn * dt * 1.2; c.v += (2.6 - c.v) * dt; }
    // your car: ui/worlds.js puts the keys (or joystick) on the ride as ix, iz
    if (k === 0 && driving) { const d = hallRides.find(r => r.key === 'bumper'); d.drive(dt, d.ix || 0, d.iz || 0); }
    c.x += Math.sin(c.h) * c.v * dt; c.z += Math.cos(c.h) * c.v * dt;
    if (c.x < ARENA.x - ARENA.hw + 1.2) { c.x = ARENA.x - ARENA.hw + 1.2; c.h = -c.h; c.v *= 0.6; }
    if (c.x > ARENA.x + ARENA.hw - 1.2) { c.x = ARENA.x + ARENA.hw - 1.2; c.h = -c.h; c.v *= 0.6; }
    if (c.z < ARENA.z - ARENA.hd + 1.2) { c.z = ARENA.z - ARENA.hd + 1.2; c.h = Math.PI - c.h; c.v *= 0.6; }
    if (c.z > ARENA.z + ARENA.hd - 1.2) { c.z = ARENA.z + ARENA.hd - 1.2; c.h = Math.PI - c.h; c.v *= 0.6; }
  });
  for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
    const a = cars[i], b = cars[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
    if (d < 2.4 && d > 0.01) { const push = (2.4 - d) / 2, nx = dx / d, nz = dz / d; a.x -= nx * push; a.z -= nz * push; b.x += nx * push; b.z += nz * push; a.h += Math.PI * 0.6; b.h -= Math.PI * 0.6; a.v *= 0.5; b.v *= 0.5; }
  }
  cars.forEach(c => { c.g.position.set(c.x, 0, c.z); c.g.rotation.y = c.h; });
});

/* ---------- going in and out ---------- */
// the castle's gate, out at the fair, and the hall's door
// a soft shimmer of light fills the castle's gate: walk up to it to go in
{
  const gate = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 5.6), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float uTime;varying vec2 vUv;void main(){vec2 q=vUv-vec2(.5,.35);float d=length(q*vec2(1.,.8));
      float a=smoothstep(.62,.0,d)*(.65+.2*sin(uTime*1.6+d*14.));vec3 c=mix(vec3(1.,.82,.92),vec3(.85,.78,1.),vUv.y);gl_FragColor=vec4(c,a*.9);}` }));
  const y = worlds.sun.floorH(O.x + CASTLE.x, O.z + CASTLE.z + 12);
  gate.position.set(O.x + CASTLE.x, y + 2.8, O.z + CASTLE.z + 10.6); sunScene.add(gate);
  addTick(() => { gate.material.uniforms.uTime.value = T; }, true);
  regThing(gate, 'Enter the castle', () => late.enterHall && late.enterHall(), { x: O.x + CASTLE.x, z: O.z + CASTLE.z + 13, r: 4.5 });
}
regThing(hall.userData.door, 'Back out to the fair', () => late.leaveHall && late.leaveHall(), { x: W(0, HALL.r - 2).x, z: W(0, HALL.r - 2).z, r: 3.4 });
export const hallArrive = { pos: W(0, HALL.r - 7), yaw: 0 };
export const castleFront = { pos: O.clone().add(new V3(CASTLE.x, 0, CASTLE.z + 16)), yaw: 0 };
export function showHall(on) { hall.visible = on; }
export const inHall = (x, z) => Math.hypot(x - (O.x + HALL.x), z - (O.z + HALL.z)) < HALL.r + 4;
// standing and walking inside: the floor is level; the walls, rides and houses stop you
{
  const f = worlds.sun.floorH, b = worlds.sun.blocked;
  worlds.sun.floorH = (x, z) => inHall(x, z) ? O.y + HALL.y : f(x, z);
  worlds.sun.blocked = (x, z) => {
    if (!inHall(x, z)) return b(x, z);
    const lx = x - O.x - HALL.x, lz = z - O.z - HALL.z, r = Math.hypot(lx, lz);
    if (r > HALL.r - 5.5) return true;
    if (r < 4.2) return true;
    if (Math.hypot(lx - TEA.x, lz - TEA.z) < TEA.r + 0.5 || Math.hypot(lx - TOWER.x, lz - TOWER.z) < 4.2 || Math.hypot(lx - BAL.x, lz - BAL.z) < 8.2) return true;
    if (Math.abs(lx - ARENA.x) < ARENA.hw + 0.8 && Math.abs(lz - ARENA.z) < ARENA.hd + 0.8) return true;
    if (Math.hypot(lx + 9, lz - 30) < 4.6) return true;
    return false;
  };
}
