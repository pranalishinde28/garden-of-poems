import * as THREE from 'three';
import { C, V3, clamp, lerp, rng, smooth } from '../core/util.js';
import { state, T } from '../core/state.js';
import { camera, renderer } from './renderer.js';
import { canvasTex, glowTex } from './textures.js';
import { GEO, Merge } from './geometry.js';
import { windify } from './wind.js';
import { worlds } from '../core/worlds.js';
import { addTick, regThing } from '../core/things.js';
import { late } from '../core/late.js';
import { makeBoat } from './gorge.js';

/* ================= the Sunflower Garden, through the light behind Manai Falls ================= */
// A world of its own (its own scene, drawn instead of the garden while you are here; core/worlds.js):
// a summer day, a lake ringed with tulips where you arrive, drifts of forget-me-nots and tulips, a curving
// stone path through bright bedding, then a great field of sunflowers through a green sunflower arch, with
// blue mountains beyond, as at Showa Kinen Park in Tachikawa. A white door stands alone in the field;
// opening it takes you home (ui/worlds.js). It sits 3 km from the garden so nothing of either world touches
// the other (poems, things and creatures are found by distance).

const R = rng(7171), O = new V3(0, 0, 3000);
export const sunScene = new THREE.Scene();
sunScene.background = C('#9cc8ee');
sunScene.fog = new THREE.Fog('#d4e6f4', 170, 1150);
const root = new THREE.Group(); root.position.copy(O); sunScene.add(root);
const at = (x, z, y = 0) => new V3(x, y, z); // local coordinates; root carries them out to the world

/* ---------- the land: lawn, a lake, wooded hills all round ---------- */
const LAKE = { x: 0, z: 48, rx: 24, rz: 10, y: -0.15 };
const lakeE = (x, z) => Math.hypot((x - LAKE.x) / LAKE.rx, (z - LAKE.z) / LAKE.rz);
export function sunH(x, z) {
  const r = Math.hypot(x, z + 50);
  let h = 0.25 * Math.sin(x * 0.05 + 1) * Math.cos(z * 0.04) + 0.1 * Math.sin(x * 0.13 + z * 0.11);
  h = lerp(h, -1.4, 1 - smooth(0.85, 1.12, lakeE(x, z)));
  const a = Math.atan2(z + 50, x);
  h += smooth(150, 270, r) * (20 + 10 * Math.sin(a * 3 + 1) + 6 * Math.sin(a * 7 + 2));
  return h;
}
// the path: a pale stone walk curving from the lake up to the arch, then a straight earth path through the field
const PATH_A = { z0: 35, z1: -41 }, DOOR = { x: 0, z: -112 }, FIELD = { z0: -44, z1: -172 };
const pathX = z => z > PATH_A.z1 ? 6.5 * Math.sin((PATH_A.z0 - z) / (PATH_A.z0 - PATH_A.z1) * Math.PI * 2) : 0;
const pathD = (x, z) => Math.abs(x - pathX(z));

// the ground
const lawnTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) { const v = 200 + R() * 55 | 0; g.fillStyle = `rgba(${v - 20},${v},${v - 40},.5)`; g.fillRect(R() * w, R() * h, 1, 2 + R() * 4); }
}, true);
{
  const S = 560, N = 200, g = new THREE.PlaneGeometry(S, S, N, N).rotateX(-Math.PI / 2), p = g.attributes.position, col = [], uv = g.attributes.uv, c = new THREE.Color();
  const LAWN = C('#4a8530'), LAWN2 = C('#57953a'), FOREST = C('#2a4f22'), BANK = C('#4d6b35');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i) - 50, y = sunH(x, z); p.setXYZ(i, x, y, z); uv.setXY(i, x / 3, z / 3);
    const r = Math.hypot(x, z + 50);
    // mown stripes on the lawn, darker woods on the hills, a muddy bank at the lake
    c.copy(LAWN).lerp(LAWN2, (Math.sin(x * 0.42) > 0 ? 0.55 : 0.1) * (1 - smooth(60, 120, r))).lerp(FOREST, smooth(130, 190, r) * 0.9);
    c.lerp(BANK, smooth(-0.1, -0.6, y));
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  root.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, map: lawnTex })));
}
// blue mountains beyond, as in the photograph of the arch
{
  const pos = [], idx = [], SEG = 220, RINGS = 10;
  for (let i = 0; i <= RINGS; i++) {
    const r = 430 + i * 55;
    for (let k = 0; k <= SEG; k++) {
      const a = k / SEG * Math.PI * 2, n = Math.sin(a * 4 + 1) * 0.5 + Math.sin(a * 9 + 2) * 0.3 + Math.sin(a * 17) * 0.15;
      const h = (60 + 70 * (0.5 + 0.5 * n)) * Math.sin(i / RINGS * Math.PI) * (a > Math.PI ? 1.3 : 0.9) - 10;
      pos.push(Math.cos(a) * r, h, Math.sin(a) * r - 50);
      if (i < RINGS && k < SEG) { const b = i * (SEG + 1) + k; idx.push(b, b + SEG + 1, b + 1, b + 1, b + SEG + 1, b + SEG + 2); }
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    // flat and hazy, a little darker at the foot
  const col = []; for (let i = 0; i < pos.length; i += 3) { const k = clamp(pos[i + 1] / 120, 0, 1); col.push(0.42 + 0.12 * k, 0.53 + 0.1 * k, 0.66 + 0.08 * k); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  root.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false })));
}
// the sky: summer blue with soft cumulus, a warm sun
const skyU = { uSun: { value: new V3(0.25, 0.62, 0.74).normalize() } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(1300, 32, 16), new THREE.ShaderMaterial({ uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: `uniform vec3 uSun;varying vec3 vD;
    float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float nz(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1,0)),u.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),u.x),u.y);}
    float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=nz(p)*a;p*=2.03;a*=.5;}return s;}
    void main(){vec3 d=normalize(vD);float y=max(d.y,0.);
      vec3 c=mix(vec3(.80,.89,.96),vec3(.22,.5,.88),pow(y,.55));
      vec2 q=d.xz/(d.y+.12)*1.6;float cl=smoothstep(.52,.8,fbm(q+vec2(3.,1.)))*smoothstep(.02,.15,d.y);
      c=mix(c,vec3(1.,.99,.97)*(.92+.08*fbm(q*3.)),cl*.9);
      float s=max(dot(d,uSun),0.);c+=vec3(1.,.93,.75)*(pow(s,600.)*3.+pow(s,12.)*.25);
      gl_FragColor=vec4(c,1.);}` }));
sunScene.add(sky);
sunScene.add(new THREE.HemisphereLight('#e2f1ff', '#4d7a32', 0.62));
{ const sun = new THREE.DirectionalLight('#fff1d8', 0.95); sun.position.set(40, 100, 120); sunScene.add(sun); sunScene.add(new THREE.AmbientLight('#ffffff', 0.12)); }

/* ---------- the lake, its jetty and your boat, tied up where you arrive ---------- */
const lakeU = { uTime: { value: 0 }, uSun: skyU.uSun };
{
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ uniforms: lakeU, fog: false,
    vertexShader: 'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: `uniform float uTime;uniform vec3 uSun;varying vec3 vW;
      float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float nz(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1,0)),u.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),u.x),u.y);}
      float wv(vec2 p){return nz(p*.7+uTime*.25)*.6+nz(p*2.1-uTime*.4)*.4;}
      void main(){vec2 p=vW.xz;float e=.2,h=wv(p);vec3 n=normalize(vec3(-(wv(p+vec2(e,0.))-h)*.6,1.,-(wv(p+vec2(0.,e))-h)*.6));
        vec3 v=normalize(cameraPosition-vW);float fr=pow(1.-max(dot(n,v),0.),3.);
        vec3 c=mix(vec3(.22,.36,.26),vec3(.62,.8,.92),fr*.9+.1);
        c+=vec3(1.,.95,.8)*pow(max(dot(reflect(-v,n),uSun),0.),220.)*1.5;
        gl_FragColor=vec4(c,1.);}` }));
  m.scale.set(LAKE.rx * 1.06, 1, LAKE.rz * 1.1); m.position.set(LAKE.x, LAKE.y, LAKE.z); root.add(m);
  const j = new Merge(), WOOD = ['#8a6a4c', '#7d5c40', '#94744f'].map(C), dark = C('#5e4532');
  for (let z = 35.4; z < 43.5; z += 0.32) j.add(GEO.box, at(0, z, 0.22), new V3(1.8, 0.07, 0.28), WOOD[(R() * 3) | 0]);
  for (let z = 36; z < 44; z += 2.5) for (const x of [-0.82, 0.82]) j.limb(at(x, z, -1.2), at(x, z, 0.65), 0.07, 0.06, dark);
  root.add(new THREE.Mesh(j.build(), new THREE.MeshLambertMaterial({ vertexColors: true })));
  const b = makeBoat('#f4efe2', '#6f8f4a', new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  b.g.position.set(1.7, LAKE.y - 0.12, 42.2); b.g.rotation.y = 0.15; b.oars.forEach((o, k) => o.rotation.set(0, (k ? -1 : 1) * 0.5, (k ? 1 : -1) * 0.35)); root.add(b.g);
  b.g.traverse(o => { if (o.material === b.lamp.material) o.visible = false; if (o.isSprite) o.visible = false; });
}

/* ---------- flowers: cards painted with each kind, set in instanced drifts ---------- */
// every kind is a pair of crossed cards (so it looks full from any side), swaying a little in the breeze
function flowerTex(draw) { const t = canvasTex(128, 128, draw); return t; }
const leafGreen = (g, n, w, top) => { for (let i = 0; i < n; i++) { const x = 64 + (R() - 0.5) * w, y = 128 - R() * top; g.fillStyle = `rgb(${50 + R() * 30 | 0},${110 + R() * 50 | 0},${40 + R() * 25 | 0})`; g.beginPath(); g.ellipse(x, y, 4 + R() * 6, 10 + R() * 10, (R() - 0.5) * 1.2, 0, 7); g.fill(); } };
const blossom = (g, x, y, r, col, eye, petals = 5) => { g.fillStyle = col; for (let k = 0; k < petals; k++) { const a = k / petals * 6.283 + R(); g.beginPath(); g.ellipse(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.62, r * 0.45, a, 0, 7); g.fill(); } if (eye) { g.fillStyle = eye; g.beginPath(); g.arc(x, y, r * 0.3, 0, 7); g.fill(); } };
const mound = (cols, eye, r0, n, petals) => flowerTex(g => { leafGreen(g, 30, 110, 70); for (let i = 0; i < n; i++) { const a = R() * 3.1416, d = Math.sqrt(R()), x = 64 + Math.cos(a) * d * 56, y = 120 - Math.sin(a) * d * 70; blossom(g, x, y, r0 * (0.8 + R() * 0.4), cols[(R() * cols.length) | 0], eye, petals); } });
const tulipTex = (c1, c2) => flowerTex(g => {
  g.strokeStyle = '#4f8a36'; g.lineWidth = 4; g.beginPath(); g.moveTo(64, 128); g.quadraticCurveTo(62, 80, 64, 46); g.stroke();
  g.fillStyle = '#5c9a40'; g.beginPath(); g.ellipse(52, 100, 7, 26, -0.3, 0, 7); g.fill(); g.beginPath(); g.ellipse(76, 106, 6, 22, 0.35, 0, 7); g.fill();
  const gr = g.createLinearGradient(0, 14, 0, 52); gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr;
  g.beginPath(); g.moveTo(46, 30); g.quadraticCurveTo(44, 54, 64, 54); g.quadraticCurveTo(84, 54, 82, 30); g.lineTo(76, 18); g.lineTo(70, 28); g.lineTo(64, 14); g.lineTo(58, 28); g.lineTo(52, 18); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.ellipse(58, 34, 4, 12, 0.2, 0, 7); g.fill();
});
const KINDS = {
  forget: { tex: mound(['#6fa4ec', '#5d93e0', '#86b6f2'], '#f4e27a', 7, 70, 5), w: 0.6, h: 0.32 },
  pansy: { tex: mound(['#6b3fa0', '#8a5cc4', '#4d2f86', '#c9b2ec'], '#f2d44a', 13, 16, 5), w: 0.5, h: 0.26 },
  daisy: { tex: mound(['#fbfbf6'], '#f2c53a', 10, 18, 9), w: 0.5, h: 0.32 },
  alyssum: { tex: mound(['#ffffff', '#f4f2ee'], null, 5, 110, 4), w: 0.55, h: 0.2 },
  marigold: { tex: mound(['#f08a1c', '#f5a02a', '#e8761a'], '#b85a10', 12, 22, 10), w: 0.55, h: 0.36 },
  yellow: { tex: mound(['#f7d433', '#fbe055', '#efc423'], '#d89a1a', 11, 24, 8), w: 0.55, h: 0.36 },
  magenta: { tex: mound(['#d6327a', '#e8478e', '#c22168'], '#f6d36a', 9, 34, 5), w: 0.55, h: 0.34 },
  red: { tex: mound(['#d42a2a', '#e8463a', '#bf1e24'], '#f3c84a', 10, 26, 5), w: 0.55, h: 0.36 },
  purple: { tex: flowerTex(g => { leafGreen(g, 20, 100, 50); for (let i = 0; i < 9; i++) { const x = 20 + i * 11 + (R() - 0.5) * 6, top = 20 + R() * 30; for (let y = top; y < 100; y += 5) { g.fillStyle = ['#6a49b8', '#7d5cc8', '#5a3ba6'][(R() * 3) | 0]; g.beginPath(); g.ellipse(x + (R() - 0.5) * 4, y, 4, 3, 0, 0, 7); g.fill(); } } }), w: 0.55, h: 0.55 },
  tulipPink: { tex: tulipTex('#ffb3c6', '#e85d8a'), w: 0.32, h: 0.62 },
  tulipWhite: { tex: tulipTex('#ffffff', '#efe6dc'), w: 0.32, h: 0.62 },
  tulipYellow: { tex: tulipTex('#fff2a0', '#f2c832'), w: 0.32, h: 0.6 },
  tulipRed: { tex: tulipTex('#ff5a4a', '#c41e2a'), w: 0.32, h: 0.62 },
  tulipPurple: { tex: tulipTex('#c58ce8', '#7d3fb0'), w: 0.32, h: 0.64 },
  tulipCoral: { tex: tulipTex('#ffc0a0', '#f07a5a'), w: 0.32, h: 0.6 },
};
const plantings = Object.fromEntries(Object.keys(KINDS).map(k => [k, []]));
const plant = (kind, x, z, s = 1) => plantings[kind].push([x, z, s * (0.8 + R() * 0.45), R() * 3.1416]);
const crossCard = (() => { const a = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), b = a.clone().rotateY(Math.PI / 2); const m = new Merge(); m.add(a, new V3(), new V3(1, 1, 1), C('#ffffff')); m.add(b, new V3(), new V3(1, 1, 1), C('#ffffff')); return m.build(); })();

// the drifts: forget-me-nots with tulips by the lake, bright bands along the path, tulip rows round the shore
const TULIPS = ['tulipPink', 'tulipWhite', 'tulipYellow', 'tulipCoral', 'tulipPink', 'tulipRed', 'tulipPurple'];
for (let z = 33; z > 6; z -= 0.42) for (const s of [-1, 1]) {
  const edge = 9.5 + 2.5 * Math.sin(z * 0.27 + s), px = pathX(z);
  for (let d = 1.5; d < edge; d += 0.42) {
    const x = px + s * (d + (R() - 0.5) * 0.3), zz = z + (R() - 0.5) * 0.3;
    if (lakeE(x, zz) < 1.25) continue;
    const pan = Math.sin(x * 0.4 + zz * 0.3) + Math.sin(x * 0.17 - zz * 0.5) > 1.1;
    plant(pan ? 'pansy' : 'forget', x, zz);
    if (R() < 0.17) plant(TULIPS[(R() * TULIPS.length) | 0], x + (R() - 0.5) * 0.3, zz + (R() - 0.5) * 0.3);
    else if (R() < 0.03) plant('daisy', x, zz);
  }
}
const BANDS = [[1.3, 'alyssum'], [2.0, 'red'], [3.6, 'marigold'], [5.4, 'magenta'], [7.2, 'yellow'], [9.0, 'purple'], [10.6, null]];
for (let z = 4; z > -36; z -= 0.4) for (const s of [-1, 1]) {
  const px = pathX(z), wob = Math.sin(z * 0.21 + s * 2) * 0.8;
  for (let d = 1.3; d < 10.6 + wob; d += 0.4) {
    let kind = 'alyssum'; for (let b = 0; b < BANDS.length - 1; b++) if (d >= BANDS[b][0] + (b ? wob * 0.6 : 0)) kind = BANDS[b][1];
    plant(kind, px + s * (d + (R() - 0.5) * 0.25), z + (R() - 0.5) * 0.25);
  }
}
for (const [e, kind] of [[1.18, 'tulipRed'], [1.26, 'tulipPink'], [1.34, 'tulipPurple'], [1.42, 'tulipPink'], [1.5, 'forget']]) {
  const n = Math.round(2 * Math.PI * LAKE.rx * e / 0.3);
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, x = LAKE.x + Math.cos(a) * LAKE.rx * e, z = LAKE.z + Math.sin(a) * LAKE.rz * e;
    if (Math.abs(x) < 2.2 && z < LAKE.z) continue; // the way onto the jetty
    plant(kind, x + (R() - 0.5) * 0.15, z + (R() - 0.5) * 0.15);
  }
}
// white flowers in a ring round the door
for (let i = 0; i < 260; i++) { const a = R() * 6.283, r = 2.2 + R() * 2.4, x = DOOR.x + Math.cos(a) * r, z = DOOR.z + Math.sin(a) * r; if (Math.abs(x) < 1.4) continue; plant(R() < 0.7 ? 'alyssum' : 'daisy', x, z); }
for (const [kind, list] of Object.entries(plantings)) {
  if (!list.length) continue;
  const K = KINDS[kind], mat = windify(new THREE.MeshLambertMaterial({ map: K.tex, alphaTest: 0.5, side: THREE.DoubleSide }), 0.05, 'blade');
  const im = new THREE.InstancedMesh(crossCard, mat, list.length), d = new THREE.Object3D(), c = new THREE.Color();
  list.forEach(([x, z, s, rot], i) => { d.position.set(x, sunH(x, z) - 0.03, z); d.rotation.set(0, rot, 0); d.scale.set(K.w * s, K.h * s, K.w * s); d.updateMatrix(); im.setMatrixAt(i, d.matrix); im.setColorAt(i, c.setScalar(0.85 + R() * 0.2)); });
  root.add(im);
}

/* ---------- the paths ---------- */
const paveTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#8f887b'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 40) { let x = -(R() * 40); while (x < w) { const pw = 40 + R() * 50; const v = 160 + R() * 28 | 0; g.fillStyle = `rgb(${v},${v - 6},${v - 16})`; g.fillRect(x + 2, y + 2, pw - 4, 36); x += pw; } }
}, true);
const earthTex = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#9a7552'; g.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { const v = R(); g.fillStyle = v < 0.5 ? 'rgba(80,58,38,.4)' : 'rgba(180,150,110,.35)'; g.fillRect(R() * w, R() * h, 2, 2); } }, true);
function ribbon(z0, z1, half, tex, lift) {
  const pos = [], uv = [], idx = []; let n = 0, len = 0, prev = null;
  for (let z = z0; z >= z1; z -= 0.5) {
    const x = pathX(z), dx = (pathX(z - 0.1) - pathX(z + 0.1)) / 0.2, nl = Math.hypot(1, dx), nx = 1 / nl, nz = dx / nl;
    if (prev) len += Math.hypot(x - prev[0], z - prev[1]); prev = [x, z];
    for (const s of [-1, 1]) { const px = x + s * half * nx, pz = z + s * half * nz; pos.push(px, sunH(px, pz) + lift, pz); uv.push((s + 1) / 2 * half * 2 / 3, len / 3); }
    if (n) { const a = (n - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    n++;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); root.add(m);
}
ribbon(PATH_A.z0 + 0.5, PATH_A.z1, 1.3, paveTex, 0.04);
ribbon(PATH_A.z1, FIELD.z1 + 4, 1.0, earthTex, 0.03);

/* ---------- the sunflower field ---------- */
const sunTex = canvasTex(256, 256, g => {
  for (let k = 0; k < 2; k++) for (let i = 0; i < 26; i++) {
    const a = i / 26 * 6.283 + k * 0.12, r0 = k ? 70 : 82;
    g.save(); g.translate(128, 128); g.rotate(a); g.fillStyle = k ? '#f5b81c' : '#ffd12a';
    g.beginPath(); g.moveTo(34, -9); g.quadraticCurveTo(r0 * 0.7, -15, r0 + 30, 0); g.quadraticCurveTo(r0 * 0.7, 15, 34, 9); g.closePath(); g.fill(); g.restore();
  }
  const gr = g.createRadialGradient(128, 128, 4, 128, 128, 46); gr.addColorStop(0, '#3a2412'); gr.addColorStop(0.7, '#5a3818'); gr.addColorStop(1, '#7a4e1e');
  g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 46, 0, 7); g.fill();
  for (let i = 0; i < 160; i++) { const a = i * 2.39996, r = Math.sqrt(i) * 3.4; g.fillStyle = 'rgba(30,18,8,.6)'; g.beginPath(); g.arc(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 1.4, 0, 7); g.fill(); }
});
const sunLeafGeo = (() => { const s = new THREE.Shape(); s.moveTo(0, 0); s.bezierCurveTo(0.12, 0.06, 0.16, 0.2, 0, 0.32); s.bezierCurveTo(-0.16, 0.2, -0.12, 0.06, 0, 0); return new THREE.ShapeGeometry(s, 4); })();
const stemGeo = (() => {
  const m = new Merge(); m.limb(new V3(0, 0, 0), new V3(0, 1, 0), 0.028, 0.02, C('#4f7f2e'));
  for (const [y, a] of [[0.35, 0.3], [0.55, 2.6], [0.75, 4.4]]) m.add(sunLeafGeo, new V3(0, y, 0), new V3(1.1, 1.1, 1.1), C('#4c8a30'), new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.0, a, 0, 'YXZ')));
  return m.build();
})();
const headGeo = new THREE.CircleGeometry(0.2, 20);
{
  const spots = [];
  for (let z = FIELD.z0; z > FIELD.z1; z -= 0.6) for (let x = -27; x < 27; x += 0.6) {
    const px = x + (R() - 0.5) * 0.35, pz = z + (R() - 0.5) * 0.35;
    if (Math.abs(px) < 1.5 || Math.hypot(px - DOOR.x, pz - DOOR.z) < 5) continue;
    spots.push([px, pz, 1.55 + R() * 0.75]);
  }
  const stemMat = windify(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), 0.012, 'blade');
  const headMat = new THREE.MeshLambertMaterial({ map: sunTex, alphaTest: 0.4, side: THREE.DoubleSide });
  const stems = new THREE.InstancedMesh(stemGeo, stemMat, spots.length), heads = new THREE.InstancedMesh(headGeo, headMat, spots.length), d = new THREE.Object3D();
  spots.forEach(([x, z, h], i) => {
    d.position.set(x, sunH(x, z), z); d.rotation.set(0, (R() - 0.5) * 0.8, 0); d.scale.set(1, h, 1); d.updateMatrix(); stems.setMatrixAt(i, d.matrix);
    // heads face south, toward the path you come up, nodding a little
    d.position.set(x + (R() - 0.5) * 0.06, sunH(x, z) + h + 0.02, z + 0.06); d.rotation.set(-0.25 - R() * 0.25, (R() - 0.5) * 0.7, (R() - 0.5) * 0.5); const s = 0.85 + R() * 0.45; d.scale.set(s, s, s); d.updateMatrix(); heads.setMatrixAt(i, d.matrix);
  });
  root.add(stems, heads);
  // the field beyond, painted on crossed cards: a sea of sunflowers to the hills
  const far = canvasTex(512, 256, g => {
    for (let i = 0; i < 70; i++) { const x = R() * 512, y = 120 + R() * 136; g.fillStyle = `rgb(${60 + R() * 20 | 0},${110 + R() * 40 | 0},${40 + R() * 20 | 0})`; g.beginPath(); g.ellipse(x, y, 14 + R() * 12, 22 + R() * 20, R() * 2, 0, 7); g.fill(); }
    for (let i = 0; i < 90; i++) { const x = 10 + R() * 492, y = 30 + R() * 110, r = 10 + R() * 9; g.drawImage(sunTex.image, x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4); }
  });
  const card = (() => { const a = new THREE.PlaneGeometry(4, 2.3).translate(0, 1.15, 0), b = a.clone().rotateY(Math.PI / 2); const m = new Merge(); m.add(a, new V3(), new V3(1, 1, 1), C('#ffffff')); m.add(b, new V3(), new V3(1, 1, 1), C('#ffffff')); return m.build(); })();
  const list = []; for (let z = FIELD.z0 - 1; z > FIELD.z1 - 6; z -= 2.6) for (const s of [-1, 1]) for (let x = 26; x < 100; x += 2.8) list.push([s * (x + R()), z + R()]);
  for (let z = FIELD.z1; z > FIELD.z1 - 22; z -= 2.6) for (let x = -26; x < 26; x += 2.8) list.push([x + R(), z + R()]);
  const im = new THREE.InstancedMesh(card, new THREE.MeshLambertMaterial({ map: far, alphaTest: 0.45, side: THREE.DoubleSide }), list.length);
  list.forEach(([x, z], i) => { d.position.set(x, sunH(x, z) - 0.2, z); d.rotation.set(0, R() * 0.6 - 0.3 + Math.PI / 4, 0); d.scale.setScalar(0.9 + R() * 0.3); d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
  root.add(im);
}

/* ---------- the sunflower arch at the field's gate ---------- */
{
  const g = new THREE.Group(); g.position.set(0, sunH(0, PATH_A.z1 - 1), PATH_A.z1 - 1); root.add(g);
  const metal = new THREE.MeshLambertMaterial({ color: '#3f6a3a' }), RA = 1.75, LEG = 1.7;
  for (const z of [-0.3, 0.3]) {
    const pts = [new V3(-RA, 0, z)]; for (let k = 0; k <= 24; k++) { const a = Math.PI - k / 24 * Math.PI; pts.push(new V3(Math.cos(a) * RA, LEG + Math.sin(a) * RA, z)); } pts.push(new V3(RA, 0, z));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.04, 6), metal));
  }
  for (let k = 0; k <= 10; k++) { const a = Math.PI - k / 10 * Math.PI, p = new V3(Math.cos(a) * RA, LEG + Math.sin(a) * RA, 0); const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.6, 6).rotateX(Math.PI / 2), metal); bar.position.copy(p); g.add(bar); }
  for (const y of [0.5, 1.1]) for (const sx of [-1, 1]) { const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.6, 6).rotateX(Math.PI / 2), metal); bar.position.set(sx * RA, y, 0); g.add(bar); }
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.6, 6), metal); fin.position.set(0, LEG + RA + 0.3, 0); g.add(fin);
  // sunflowers and leaves wound round it
  const hm = new THREE.MeshLambertMaterial({ map: sunTex, alphaTest: 0.4, side: THREE.DoubleSide }), lm = new THREE.MeshLambertMaterial({ color: '#4c8a30', side: THREE.DoubleSide });
  for (let k = 0; k < 15; k++) {
    const a = Math.PI * (0.04 + 0.92 * k / 14), p = new V3(Math.cos(a) * RA, LEG + Math.sin(a) * RA, 0.32);
    if (k % 3 === 1 && Math.abs(Math.cos(a)) > 0.95) continue;
    const h = new THREE.Mesh(headGeo, hm); h.position.copy(p); h.scale.setScalar(1.0 + R() * 0.6); h.rotation.set(0, (R() - 0.5) * 0.4, R() * 3); g.add(h);
    for (let l = 0; l < 2; l++) { const lf = new THREE.Mesh(sunLeafGeo, lm); lf.position.copy(p).add(new V3((R() - 0.5) * 0.4, (R() - 0.5) * 0.4, -0.05)); lf.rotation.set(R() * 3, R() * 3, R() * 3); lf.scale.setScalar(1.2); g.add(lf); }
  }
  for (const sx of [-1, 1]) for (let y = 0.3; y < LEG; y += 0.45) { const h = new THREE.Mesh(headGeo, hm); h.position.set(sx * RA + sx * 0.05, y, 0.32); h.scale.setScalar(0.9 + R() * 0.4); g.add(h); }
}

/* ---------- the white door, standing alone in the field ---------- */
const door = new THREE.Group(), leaf = new THREE.Group();
const doorLight = new THREE.Mesh(new THREE.PlaneGeometry(1.02, 2.2).translate(0, 1.1, 0), new THREE.MeshBasicMaterial({ color: '#fffaf0', transparent: true, opacity: 0 }));
export const DOOR_AT = O.clone().add(new V3(DOOR.x, 0, DOOR.z));
{
  door.position.set(DOOR.x, sunH(DOOR.x, DOOR.z), DOOR.z); root.add(door);
  const white = new THREE.MeshLambertMaterial({ color: '#fbfaf6' }), trim = new THREE.MeshLambertMaterial({ color: '#efece4' }), brass = new THREE.MeshLambertMaterial({ color: '#d4a64a', emissive: '#3a2a08' }), stone = new THREE.MeshLambertMaterial({ color: '#c9c3b6' });
  const box = (w, h, d, x, y, z, m, p = door) => { const b = new THREE.Mesh(GEO.box, m); b.scale.set(w, h, d); b.position.set(x, y, z); p.add(b); return b; };
  box(1.7, 0.16, 0.9, 0, 0.08, 0, stone);
  box(0.14, 2.5, 0.2, -0.6, 1.25 + 0.16, 0, white); box(0.14, 2.5, 0.2, 0.6, 1.25 + 0.16, 0, white); box(1.42, 0.16, 0.24, 0, 2.66 + 0.08, 0, white); box(1.58, 0.06, 0.3, 0, 2.86, 0, trim);
  // the leaf hangs on the left post and swings away from you
  leaf.position.set(-0.53, 0.16, 0); door.add(leaf);
  box(1.04, 2.24, 0.06, 0.53, 1.12, 0, white, leaf);
  for (const [y, h] of [[0.58, 0.82], [1.6, 0.9]]) for (const x of [0.29, 0.77]) { box(0.36, h, 0.02, x, y, 0.035, trim, leaf); box(0.36, h, 0.02, x, y, -0.035, trim, leaf); }
  for (const z of [0.07, -0.07]) { const k = new THREE.Mesh(GEO.sph, brass); k.scale.setScalar(0.045); k.position.set(0.94, 1.08, z); leaf.add(k); }
  doorLight.position.set(0, 0.16, -0.02); door.add(doorLight);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#fff3d6', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); halo.position.set(0, 1.4, 0.1); halo.scale.setScalar(5); door.add(halo); door.userData.halo = halo;
  regThing(door, 'Open the white door', () => late.leaveSunWorld && late.leaveSunWorld(), { x: DOOR_AT.x, z: DOOR_AT.z + 1.2, r: 2.6 });
}
let doorT = -1;
export function openDoor() { doorT = 0; }
function closeDoor() { doorT = -1; leaf.rotation.y = 0; doorLight.material.opacity = 0; door.userData.halo.material.opacity = 0; }

/* ---------- life: butterflies over the flowers, pollen in the sunlight ---------- */
const flies = [];
{
  const wingTex = canvasTex(64, 64, g => { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(32, 24, 26, 18, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(30, 48, 16, 12, 0.3, 0, 7); g.fill(); g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(44, 18, 4, 0, 7); g.fill(); });
  const wg = new THREE.PlaneGeometry(0.1, 0.1).translate(0.05, 0, 0).rotateX(-Math.PI / 2);
  for (let i = 0; i < 18; i++) {
    const m = new THREE.MeshLambertMaterial({ map: wingTex, color: ['#ffffff', '#fff3a0', '#ffd27a', '#cfe6ff'][i % 4], alphaTest: 0.5, side: THREE.DoubleSide });
    const g = new THREE.Group(), l = new THREE.Mesh(wg, m), r = new THREE.Mesh(wg, m); r.scale.x = -1; g.add(l, r); root.add(g);
    flies.push({ g, l, r, c: new V3((R() - 0.5) * 20, 0, 20 - R() * 60), ph: R() * 6.28, sp: 0.3 + R() * 0.3 });
  }
}
const pollen = (() => {
  const N = 400, p = new Float32Array(N * 3), ph = new Float32Array(N);
  for (let i = 0; i < N; i++) { p.set([(R() - 0.5) * 60, 0.4 + R() * 3, 30 - R() * 150], i * 3); ph[i] = R() * 100; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
  return new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: lakeU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'uniform float uTime;attribute float aPh;varying float vB;void main(){vec3 q=position+vec3(sin(uTime*.2+aPh)*1.2,sin(uTime*.31+aPh*1.7)*.5,cos(uTime*.17+aPh)*1.2);vB=.5+.5*sin(uTime*1.1+aPh*3.);vec4 mv=modelViewMatrix*vec4(q,1.);gl_PointSize=clamp(40./-mv.z,1.,4.);gl_Position=projectionMatrix*mv;}',
    fragmentShader: 'varying float vB;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,0.,d)*.6*vB;gl_FragColor=vec4(vec3(1.,.95,.75)*a,a);}' }));
})();
root.add(pollen);

addTick(dt => {
  if (state.world !== 'sun') return;
  lakeU.uTime.value = T; sky.position.copy(camera.position);
  for (const f of flies) {
    const t = T * f.sp + f.ph, x = f.c.x + Math.sin(t) * 4 + Math.sin(t * 2.3) * 1.2, z = f.c.z + Math.cos(t * 0.8) * 4;
    f.g.position.set(x, sunH(x, z) + 0.7 + Math.sin(t * 3) * 0.25, z); f.g.rotation.y = -t * 0.8;
    const flap = Math.sin(T * 14 + f.ph) * 0.9; f.l.rotation.z = flap; f.r.rotation.z = -flap;
  }
  if (doorT >= 0) {
    doorT += dt; const k = smooth(0, 1.4, doorT);
    leaf.rotation.y = -1.7 * k; doorLight.material.opacity = smooth(0.2, 1.2, doorT); door.userData.halo.material.opacity = smooth(0.3, 1.6, doorT) * 0.9;
  }
});

/* ---------- standing here: the ground, what stops you, where you arrive ---------- */
const local = (x, z) => [x - O.x, z - O.z];
worlds.sun = {
  scene: sunScene,
  arrive: { pos: O.clone().add(new V3(0, 0, 34.8)), yaw: 0 },
  floorH(x, z) { const [lx, lz] = local(x, z); if (Math.abs(lx) < 0.9 && lz > 35.2 && lz < 43.5) return 0.26; return Math.max(sunH(lx, lz), LAKE.y); },
  blocked(x, z) {
    const [lx, lz] = local(x, z);
    if (Math.abs(lx) > 95 || lz > 70 || lz < FIELD.z1 - 6) return true;
    if (lakeE(lx, lz) < 1.02 && !(Math.abs(lx) < 0.9 && lz < 43.5)) return true;
    // the door itself: walk round it, or open it
    if (Math.abs(lx - DOOR.x) < 0.85 && Math.abs(lz - DOOR.z) < 0.5) return true;
    return false;
  },
  enter() { closeDoor(); renderer.setClearColor(sunScene.background); },
  leave() { closeDoor(); },
  openDoor,
};
