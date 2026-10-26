import * as THREE from 'three';
import { C, V3, clamp, lerp, rng, smooth } from '../core/util.js';
import { GORGE, JETTY, POOL, gorgeHalf, gorgeJettyH, gorgeLocal, gorgePool, gorgeWorld, groundH } from './terrain.js';
import { scene } from './renderer.js';
import { canvasTex, glowTex, softTex } from './textures.js';
import { GEO, Merge } from './geometry.js';
import { groundMeshH, mountainMeshes, mountainU } from './ground.js';
import { decor } from './paths.js';
import { clearArea } from './grass.js';
import { waterU } from '../water/water.js';
import { addTick, regThing } from '../core/things.js';
import { T, state } from '../core/state.js';
import { late } from '../core/late.js';

/* ================= Takachiho Gorge, beyond the hedge to the east ================= */
// A wide canyon in forested hills: walls of weathered columnar basalt green with moss, a forest along the
// rims with vines trailing down, emerald water, Manai Falls dropping from the left wall, a stone arch bridge
// high over the narrows, rowing boats with paper lanterns drifting on the pool at its mouth, stone lanterns on
// the shore, fireflies at night. A meadow valley runs from a lookout deck in the hedge down to the pool, so
// the gorge is seen straight on from the garden; from the deck you can glide down onto the water
// (ui/gorgeView.js). The gorge's frame and the carved ground are in terrain.js. The sea horizon hides it all.
// Out of the garden's fog, like the temples on the hills (it would wash them to ghosts at this distance).

const R = rng(4242), A0 = GORGE.r0, A1 = GORGE.r1, FLOOR = GORGE.floor;
export const gorge = new THREE.Group(); scene.add(gorge); mountainMeshes.push(gorge);
// never in the pond's reflection
const onLayer2 = o => o.traverse(c => { c.layers.set(2); if (c.isMesh) { c.castShadow = false; c.receiveShadow = false; } });

// smooth noise: 1D for heights along the walls, 3D for moss and stains on the stone
const N1 = Array.from({ length: 256 }, () => R());
const n1 = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(N1[i & 255], N1[(i + 1) & 255], u); };
const h3 = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
function n3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const l = (a, b, t) => a + (b - a) * t, c = (dx, dy, dz) => h3(xi + dx, yi + dy, zi + dz);
  return l(l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v), l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w);
}

// the height of each rim above the water: low where the canyon opens onto the pool, rising into the hills
export const FALLS = { along: 146, side: -1 };
function rimY(u, s) {
  const ramp = 0.22 + 0.78 * smooth(A0 - 2, A0 + 22, u);
  let h = 25 + 8 * n1(u * 0.06 + (s > 0 ? 40 : 0)) + 3 * n1(u * 0.21 + (s > 0 ? 90 : 7));
  if (s === FALLS.side) h -= 2.6 * (1 - smooth(2, 5, Math.abs(u - FALLS.along)));
  return FLOOR + 1.2 + h * ramp;
}

// the arch of the cave behind the falls: 7 m wide, 7.5 m high at its crown
export const CAVE = { along: FALLS.along, half: 3.5, h: 7.5, depth: 11 };
function caveArch(u) { const d = Math.abs(u - CAVE.along) / CAVE.half; return d >= 1 ? FLOOR - 1.2 : FLOOR - 0.3 + CAVE.h * Math.sqrt(1 - d * d); }

/* ---------- light: autumn colour, and the gorge's own night (moon, lanterns, the lit falls) ---------- */
const autumnU = { value: 0 };
const fallsBase = gorgeWorld(FALLS.along, FALLS.side * (gorgeHalf(FALLS.along) - 1.6), FLOOR);
// eight warm lights (three drifting boats, four stone lanterns, your own boat), the falls lit cool white, and how dark it is
const nightU = { uGN: { value: 0 }, uGL: { value: Array.from({ length: 8 }, () => new V3(0, -99, 0)) }, uFallP: { value: fallsBase.clone().setY(FLOOR + 8) } };
const AUTUMN_GLSL = `
  float auH(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float auN(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(auH(i),auH(i+vec2(1,0)),u.x),mix(auH(i+vec2(0,1)),auH(i+vec2(1,1)),u.x),u.y);}
  vec3 autumnOf(vec3 base,vec3 w){
    float n=auN(w.xz*.05)*.4+auN(w.xz*.23+w.y*.05)*.35+auN(w.xz*.7)*.25;
    vec3 c=n<.4?mix(vec3(.70,.14,.07),vec3(.88,.33,.08),n/.4):mix(vec3(.88,.33,.08),vec3(.93,.66,.15),(n-.4)/.6);
    float lum=dot(base,vec3(.3,.59,.11));
    return mix(c*(.5+lum*1.05),base*1.05,smoothstep(.68,.84,auN(w.xz*.55+7.))*.85);
  }`;
const NIGHT_GLSL = `
  uniform float uGN;uniform vec3 uGL[8];uniform vec3 uFallP;
  vec3 gorgeNight(vec3 w){
    vec3 L=vec3(.07,.09,.14);
    for(int i=0;i<8;i++){vec3 d=w-uGL[i];L+=vec3(1.,.6,.28)*1.1/(1.+dot(d,d)*.09);}
    vec3 f=(w-uFallP)*vec3(1.,.4,1.);L+=vec3(.6,.72,.85)*1.2/(1.+dot(f,f)*.025);
    return L*uGN;
  }`;
// a material that turns with the seasons (leaves) and catches the gorge's night light (everything)
function gorgeMat(mat, autumn) {
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, nightU); sh.uniforms.uAutumn = autumnU;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGW=(modelMatrix*vec4(transformed,1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uAutumn;varying vec3 vGW;' + AUTUMN_GLSL + NIGHT_GLSL)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + (autumn ? 'diffuseColor.rgb=mix(diffuseColor.rgb,autumnOf(diffuseColor.rgb,vGW),uAutumn);' : ''))
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance+=diffuseColor.rgb*gorgeNight(vGW);');
  };
  mat.customProgramCacheKey = () => 'gorge-' + mat.type + (autumn ? 'a' : '') + (mat.alphaTest ? 't' : '');
  return mat;
}
const fillMats = [];

/* ---------- 1. the basalt walls: weathered columns, broken at joints, chipped, stained and mossy ---------- */
// the stone's grain and fractures: a colour map, and a bump map made from the same heights
const STONE_W = 256, STONE_H = 512, stoneH = new Float32Array(STONE_W * STONE_H);
{
  const RS = rng(91), cracks = Array.from({ length: 26 }, () => ({ y: RS() * STONE_H, x0: RS() * STONE_W, len: 30 + RS() * 140, d: 0.4 + RS() * 0.6 }));
  for (let y = 0; y < STONE_H; y++) for (let x = 0; x < STONE_W; x++) {
    const fx = x / STONE_W, fy = y / STONE_H;
    // tile-able: noise on a torus of coordinates
    const t = (a, b, s) => n3(Math.cos(a * 6.283) * s, Math.sin(a * 6.283) * s, b * s * 2 + Math.cos(b * 6.283) * 0.01);
    let h = t(fx, fy, 3) * 0.45 + t(fx, fy, 9) * 0.3 + t(fx + 0.3, fy, 26) * 0.18 + n3(x * 0.9, y * 0.12, 3) * 0.07;
    for (const c of cracks) { const dx = ((x - c.x0) % STONE_W + STONE_W) % STONE_W; if (dx < c.len) { const dy = Math.abs(y - c.y - Math.sin(dx * 0.08) * 3); if (dy < 1.6) h -= c.d * (1 - dy / 1.6) * 0.5; } }
    stoneH[y * STONE_W + x] = h;
  }
}
const stoneTex = canvasTex(STONE_W, STONE_H, g => {
  const im = g.createImageData(STONE_W, STONE_H);
  for (let i = 0; i < stoneH.length; i++) { const v = clamp(110 + stoneH[i] * 120, 40, 235); im.data[i * 4] = v; im.data[i * 4 + 1] = v * 0.99; im.data[i * 4 + 2] = v * 0.95; im.data[i * 4 + 3] = 255; }
  g.putImageData(im, 0, 0);
  // lichen flecks
  const RS = rng(17); for (let i = 0; i < 160; i++) { g.fillStyle = RS() < 0.6 ? 'rgba(190,196,170,.35)' : 'rgba(120,150,80,.3)'; g.beginPath(); g.arc(RS() * STONE_W, RS() * STONE_H, 1 + RS() * 4, 0, 7); g.fill(); }
}, true);
const stoneNorm = canvasTex(STONE_W, STONE_H, g => {
  const im = g.createImageData(STONE_W, STONE_H), at = (x, y) => stoneH[((y + STONE_H) % STONE_H) * STONE_W + ((x + STONE_W) % STONE_W)];
  for (let y = 0; y < STONE_H; y++) for (let x = 0; x < STONE_W; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * 6, dy = (at(x, y + 1) - at(x, y - 1)) * 6, l = Math.hypot(dx, dy, 1), i = (y * STONE_W + x) * 4;
    im.data[i] = (-dx / l * 0.5 + 0.5) * 255; im.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; im.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; im.data[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
}, true);
const wallMat = gorgeMat(new THREE.MeshPhongMaterial({ vertexColors: true, map: stoneTex, normalMap: stoneNorm, normalScale: new THREE.Vector2(1.3, 1.3), shininess: 10, specular: '#1c1d19', fog: false }), false);
fillMats.push([wallMat, [0.07, 0.072, 0.064]]);
{
  const pos = [], nor = [], col = [], uv = [];
  const BASALT = ['#5c574e', '#686253', '#4f4c45', '#736b5b', '#5a5a54', '#625b4f'].map(C), MOSS = ['#5f7f30', '#71913a', '#54702b', '#7d9c45'].map(C);
  const WET = C('#2f3a2b'), STAIN = C('#33302b'), LICHEN = C('#a3a690'), tmp = new THREE.Color(), e1 = new V3(), e2 = new V3(), nn = new V3();
  // the stone's colour at a point: its own shade, darker and greener near the water, dark streaks where water
  // runs down, pale lichen, and moss in patches that spread across several columns
  function colAt(p, base, mossK) {
    tmp.copy(base).multiplyScalar(0.88 + 0.24 * n3(p.x * 1.7, p.y * 0.9, p.z * 1.7));
    tmp.lerp(WET, smooth(FLOOR + 3, FLOOR - 0.2, p.y) * 0.75);
    tmp.lerp(STAIN, smooth(0.62, 0.8, n3(p.x * 2.3, p.y * 0.06, p.z * 2.3)) * 0.55);
    tmp.lerp(LICHEN, smooth(0.74, 0.9, n3(p.x * 0.9 + 9, p.y * 0.5, p.z * 0.9)) * 0.35);
    const patch = smooth(0.52, 0.78, n3(p.x * 0.16, p.y * 0.12, p.z * 0.16)) * (1 - smooth(FLOOR + 2, FLOOR, p.y));
    return tmp.lerp(MOSS[(n3(p.x, p.y, p.z) * 3.99) | 0], clamp(Math.max(mossK, patch * 0.8), 0, 1)).clone();
  }
  const tri = (a, b, d, ca, cb, cd, ua, ub, ud) => {
    e1.subVectors(b, a); e2.subVectors(d, a); nn.crossVectors(e1, e2).normalize();
    for (const [p, c, t] of [[a, ca, ua], [b, cb, ub], [d, cd, ud]]) { pos.push(p.x, p.y, p.z); nor.push(nn.x, nn.y, nn.z); col.push(c.r, c.g, c.b); uv.push(t[0], t[1]); }
  };
  // one weathered prism: rings every metre and a half, each a little out of true, so the faces bow and twist;
  // the top is chipped at some corners and tilted; moss gathers on it
  function prism(cx, cz, y0, y1, r, rot, base, mossTop, mossSide, lean) {
    const rows = Math.max(1, Math.round((y1 - y0) / 1.5)), rad = Array.from({ length: 6 }, () => r * (0.86 + R() * 0.24)), rings = [];
    for (let j = 0; j <= rows; j++) {
      const y = y0 + (y1 - y0) * j / rows, ox = (R() - 0.5) * 0.07 + lean.x * (y - y0), oz = (R() - 0.5) * 0.07 + lean.z * (y - y0), ring = [];
      for (let k = 0; k < 6; k++) {
        const a = rot + (k + (R() - 0.5) * 0.08) / 6 * Math.PI * 2, rr = rad[k] * (0.95 + R() * 0.08) * (j === 0 ? 1 : 1);
        const top = j === rows ? (R() < 0.4 ? -R() * 0.45 * r : 0) : 0;
        ring.push(new V3(cx + ox + Math.cos(a) * rr, y + top, cz + oz + Math.sin(a) * rr));
      }
      rings.push(ring);
    }
    for (let j = 0; j < rows; j++) for (let k = 0; k < 6; k++) {
      const a = rings[j][k], b = rings[j][(k + 1) % 6], c = rings[j + 1][k], d = rings[j + 1][(k + 1) % 6];
      const mk = j + 1 === rows ? mossSide : mossSide * 0.3;
      const ca = colAt(a, base, mossSide * 0.25), cb = colAt(b, base, mossSide * 0.25), cc = colAt(c, base, mk), cd = colAt(d, base, mk);
      const u0 = k / 6, u1 = (k + 1) / 6, va = a.y / 6, vc = c.y / 6;
      tri(a, d, b, ca, cd, cb, [u0, va], [u1, vc], [u1, va]); tri(a, c, d, ca, cc, cd, [u0, va], [u0, vc], [u1, vc]);
    }
    const top = rings[rows], ctr = top.reduce((s, p) => s.add(p), new V3()).multiplyScalar(1 / 6); ctr.y += (R() - 0.6) * 0.12;
    const mc = base.clone().lerp(MOSS[(R() * 4) | 0], mossTop);
    for (let k = 0; k < 6; k++) { const a = top[k], b = top[(k + 1) % 6]; tri(ctr, b, a, mc, mc.clone().multiplyScalar(0.92), mc, [0.5, 0.5], [0.5 + (b.x - ctr.x) / 3, 0.5 + (b.z - ctr.z) / 3], [0.5 + (a.x - ctr.x) / 3, 0.5 + (a.z - ctr.z) / 3]); }
  }
  function column(u, v, top, rr, y0 = FLOOR - 1.2) {
    const base = BASALT[(R() * BASALT.length) | 0].clone().offsetHSL(0, 0, (R() - 0.5) * 0.05), lean = new V3((R() - 0.5) * 0.012, 0, (R() - 0.5) * 0.012);
    let y = y0, d = 0;
    while (y < top - 0.3) {
      const seg = Math.min(top - y, 2.5 + R() * 6.5), y1 = y + seg, w = gorgeWorld(u, v + d);
      const ledge = y1 < top - 0.3 && R() < 0.55; // a broken step: moss gathers on it
      prism(w.x, w.z, y, y1, rr * (0.92 + R() * 0.16), R() * 1.05, base, 0.85, Math.max(ledge ? 0.5 : 0, smooth(top - 7, top, y1) * 0.55), lean);
      y = y1; d = clamp(d + (R() - 0.5) * 0.5, -0.35, 0.35);
    }
  }
  for (const s of [-1, 1]) for (let u = A0 + 1; u < A1 + 0.5; u += 0.5 + R() * 0.1) {
    const half = gorgeHalf(u), rr = 0.34 + R() * 0.12, top = rimY(u, s) + (R() - 0.5) * 1.4;
    // behind the falls the wall opens into a cave: there the columns stand only above its arch
    const y0 = s === FALLS.side ? caveArch(u) : FLOOR - 1.2;
    column(u, s * (half + rr * 0.7 + (R() - 0.5) * 0.3), top, rr, y0);
    // a second rank behind, so no gap shows
    if (R() < 0.5) column(u + 0.3, s * (half + rr * 2.1), top + 0.4 + R(), rr, y0);
  }
  // where the canyon opens, the walls end in a few stepped outcrops
  for (const s of [-1, 1]) for (let k = 0; k < 14; k++) { const u = A0 - 1.5 + R() * 3, v = s * (gorgeHalf(A0) + R() * 4); column(u, v, FLOOR + 1 + R() * 4.5, 0.45); }
  // the far end closes, round the bend where it can't be seen from the pool
  for (let v = -gorgeHalf(A1) - 0.5; v <= gorgeHalf(A1) + 0.5; v += 0.6) column(A1 + 0.4, v, rimY(A1, 1), 0.5);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeBoundingSphere();
  gorge.add(new THREE.Mesh(g, wallMat));
}

/* ---------- 2. the forest on top: wooded ridges rising from each rim, in the same greens as the far hills ---------- */
// Each side is a grid from the rim (f = 0) out to the forest's edge (f = 1), whose outline wanders and narrows
// toward the garden. The canopy rises from about a metre above the meadow at its edge to the rim's height, and
// a skirt row drops it cleanly into the ground (sampled from the ground mesh itself), so the woods meet the
// lawn in a clean line, never a tangent that zigzags. Past the far end the two sides meet over the closed gorge.
const openAt = u => 1 - smooth(A1, A1 + 5, u), innerAt = u => (gorgeHalf(Math.max(u, A0)) + 1.3) * openAt(u) - 0.4;
const edgeAt = (u, s) => (34 + 24 * n1(u * 0.05 + (s > 0 ? 3 : 41))) * smooth(A0 - 28, A0 - 6, u);
function massifAt(u, s, f) {
  const W = edgeAt(u, s), w = f < 0 ? -1.0 : W * Math.min(f, 1) + (f > 1 ? 1.0 : 0);
  const p = gorgeWorld(u, s * (innerAt(u) + w)), ground = groundMeshH(p.x, p.z);
  // the skirts: just past the forest's edge, and on the inner edge beside the pool where there is no wall
  if (f > 1 || (f < 0 && u < A0 + 3)) { p.y = ground - 2.5; return { p, above: -2.5, edge: 1 }; }
  const uc = clamp(u, A0, A1), rim = lerp((rimY(uc, -1) + rimY(uc, 1)) / 2, rimY(uc, s), openAt(u)) - 0.15;
  const ff = clamp(f, 0, 1), swell = 9 * smooth(0.05, 0.5, ff) * (0.35 + 0.65 * n1(u * 0.045 + w * 0.05 + (s > 0 ? 17 : 3))) + 1.6 * n1(u * 0.3 + w * 0.25) * smooth(0, 0.08, ff);
  let above = Math.max(0, rim + swell - ground) * (1 - ff) * (1 - 0.4 * ff);
  // beside the pool the woods come down to the shore
  above *= lerp(smooth(0, 10, w), 1, smooth(A0 - 1, A0 + 3, u));
  // never lower than the trees at a wood's edge
  above = Math.max(above, 0.4);
  p.y = ground + above; return { p, above, edge: smooth(0.75, 1, ff) };
}
{
  const u = Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), { uHor: { value: new THREE.Color() }, uNight: { value: 0 }, uDusk: { value: 0 }, uLight: { value: new V3(0.6, 0.45, 0.6) }, uAutumn: autumnU });
  mountainU.push(u);
  const mat = new THREE.ShaderMaterial({ uniforms: u, fog: true, side: THREE.DoubleSide,
    vertexShader: 'attribute float aFoot;varying float vFoot;varying vec3 vW,vN;void main(){vFoot=aFoot;vW=(modelMatrix*vec4(position,1.)).xyz;vN=normal;gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.);}',
    fragmentShader: `uniform vec3 uHor,uLight,fogColor;uniform float uNight,uDusk,uAutumn,fogNear,fogFar;varying float vFoot;varying vec3 vW,vN;` + AUTUMN_GLSL + `
      void main(){
        vec3 n=normalize(vN),L=normalize(uLight);float lam=max(dot(n,L),0.);
        // a soft canopy: small lit crowns, evenly spread, in the far hills' greens
        vec2 q=vW.xz/1.9,i=floor(q),f=fract(q);float md=9.;vec2 mv=vec2(0.);
        for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(float(x),float(y));vec2 o=vec2(auH(i+g),auH(i+g+17.3))*.8+.1;vec2 r=g+o-f;float d=dot(r,r);if(d<md){md=d;mv=r;}}
        float d=sqrt(md);vec3 dn=normalize(vec3(-mv.x,max(.8-d,.1)*1.5,-mv.y));
        float ca=mix(.16,.28,uAutumn);
        float crown=1.-ca*.5+ca*max(dot(dn,L),0.)-.05*smoothstep(.55,.8,d)+(auN(vW.xz*1.3)-.5)*mix(.08,.16,uAutumn);
        float tone=auN(vW.xz*.08)*.6+auN(vW.xz*.6)*.4;
        vec3 c=mix(vec3(.13,.33,.12),vec3(.29,.55,.19),smoothstep(.2,.8,tone*.7+clamp(vW.y/40.,0.,1.)*.3));
        // autumn on the hills: stands of trees in red, orange and gold, with evergreens among them
        float an=auN(vW.xz*.22)*.75+auN(vW.xz*.05)*.25,am=auN(vW.xz*.19+31.);
        vec3 au=mix(vec3(.6,.12,.06),vec3(.84,.35,.08),smoothstep(.3,.45,an));au=mix(au,vec3(.85,.6,.14),smoothstep(.6,.75,an));
        au=mix(au,vec3(.15,.31,.13),smoothstep(.66,.8,am));au*=.78+.44*auN(vW.xz*.45);
        c=mix(c,au,uAutumn);
        c*=crown;
        c=mix(c,vec3(.36,.37,.3),smoothstep(.4,.18,n.y)*.45*(1.-vFoot));
        c*=.62+.62*lam;
        // where the ridges run out onto the lawn
        // the wood's edge is a little darker, under its own eaves
        c*=1.-vFoot*.4;
        c=mix(c,c*vec3(1.25,.9,.85),uDusk*.6);
        vec3 lit=c*mix(1.,.12,uNight)+c*vec3(.25,.33,.5)*.35*uNight;
        float dist=length(vW.xz-cameraPosition.xz);lit=mix(lit,uHor,smoothstep(120.,500.,dist)*.25);
        lit=mix(lit,fogColor,smoothstep(fogNear,fogFar,length(vW-cameraPosition))*.5);
        gl_FragColor=vec4(lit,1.);
      }` });
  for (const s of [-1, 1]) {
    const US = [], WS = [-1]; for (let x = A0 - 30; x <= A1 + 18; x += 1.5) US.push(x); for (let j = 0; j <= 30; j++) WS.push(Math.pow(j / 30, 1.2)); WS.push(2);
    const pos = [], idx = [], foot = [], ab = [];
    for (const uu of US) for (const f of WS) { const m = massifAt(uu, s, f); pos.push(m.p.x, m.p.y, m.p.z); foot.push(m.edge); ab.push(m.above); }
    const nw = WS.length;
    // quads lying wholly under the lawn are left out, so the ridge simply rises out of the ground
    for (let i = 0; i < US.length - 1; i++) for (let j = 0; j < nw - 1; j++) { const a = i * nw + j, b = a + nw; if (Math.max(ab[a], ab[a + 1], ab[b], ab[b + 1]) < 0) continue; s > 0 ? idx.push(a, b, a + 1, a + 1, b, b + 1) : idx.push(a, a + 1, b, a + 1, b + 1, b); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aFoot', new THREE.Float32BufferAttribute(foot, 1)); g.setIndex(idx); g.computeVertexNormals();
    gorge.add(new THREE.Mesh(g, mat));
  }
}

/* ---------- 3. leaves: crowns along the rims leaning over, vines down the walls, ferns on the ledges ---------- */
const leafTex = canvasTex(256, 256, g => {
  for (let i = 0; i < 150; i++) {
    const a = R() * 6.28, rr = Math.sqrt(R()) * 100, x = 128 + Math.cos(a) * rr, y = 128 + Math.sin(a) * rr * 0.9, sh = 150 + R() * 105 | 0;
    g.save(); g.translate(x, y); g.rotate(R() * 6.28); g.fillStyle = `rgb(${sh * 0.82 | 0},${sh},${sh * 0.7 | 0})`;
    g.beginPath(); g.ellipse(0, 0, 13 + R() * 9, 5 + R() * 3, 0, 0, 7); g.fill(); g.restore();
  }
});
const vineTex = canvasTex(64, 256, g => {
  g.strokeStyle = 'rgba(80,90,60,.9)'; g.lineWidth = 2; g.beginPath(); g.moveTo(32, 0); for (let y = 0; y <= 256; y += 16) g.lineTo(32 + Math.sin(y * 0.05) * 8, y); g.stroke();
  for (let i = 0; i < 70; i++) { const y = R() * 250, x = 32 + Math.sin(y * 0.05) * 8 + (R() - 0.5) * 30 * (0.4 + y / 256), sh = 150 + R() * 105 | 0; g.save(); g.translate(x, y); g.rotate(R() * 6.28); g.fillStyle = `rgb(${sh * 0.8 | 0},${sh},${sh * 0.66 | 0})`; g.beginPath(); g.ellipse(0, 0, 8 + R() * 5, 4, 0, 0, 7); g.fill(); g.restore(); }
});
const LEAF = ['#5a8634', '#6a963c', '#4b742c', '#78a646', '#55802f'].map(C);
{
  const crowns = new Merge(), vines = new Merge(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const card = (m, p, size, rx, ry, rz, col) => { e.set(rx, ry, rz, 'YXZ'); q.setFromEuler(e); m.add(GEO.card, p, new V3(size, size, size), col, q.clone()); };
  function clump(c, rad, n, lean, size = 0.55) {
    for (let k = 0; k < n; k++) {
      const a = R() * 6.28, r = Math.sqrt(R()) * rad, p = c.clone().add(new V3(Math.cos(a) * r, (R() - 0.3) * rad * 0.7, Math.sin(a) * r)).addScaledVector(lean, R() * rad * 0.6);
      card(crowns, p, rad * size * (0.8 + R() * 0.5), (R() - 0.5) * 1.4, R() * 6.28, (R() - 0.5) * 1.4, LEAF[(R() * LEAF.length) | 0].clone().offsetHSL(0, 0, (R() - 0.5) * 0.06));
    }
  }
  const inwardAt = (u, s) => gorgeWorld(u, 0).sub(gorgeWorld(u, s)).normalize();
  // a crown on each rim leaning over the gorge
  for (const s of [-1, 1]) for (let u = A0 + 2; u < A1; u += 1.3 + R() * 0.6) {
    if (Math.abs(u - FALLS.along) < 2 && s === FALLS.side) continue; // the falls' lip stays open
    clump(gorgeWorld(u, s * (gorgeHalf(u) + 0.4 + R() * 1.0), rimY(u, s) + 0.6 + R() * 0.6), 1.3 + R() * 0.7, 16, inwardAt(u, s));
  }
  // the woods just behind each rim, close together
  for (const s of [-1, 1]) for (let u = A0 + 1; u < A1 + 2; u += 2.2 + R() * 1.2) for (let w = 1.5; w < 9; w += 2.4 + R() * 1.6) {
    const uu = u + (R() - 0.5) * 2, m = massifAt(uu, s, clamp((w + (R() - 0.5) * 2) / Math.max(edgeAt(uu, s), 1), 0, 0.6));
    clump(m.p.add(new V3(0, 0.5 + R() * 0.5, 0)), 1.5 + R() * 0.8, 9, new V3(), 0.7);
  }
  // the wood's edge against the meadow: low crowns all along it, so its outline is leafy
  for (const s of [-1, 1]) for (let u = A0 - 24; u < A1 + 14; u += 2.2 + R() * 1.4) {
    if (edgeAt(u, s) < 3) continue;
    const m = massifAt(u, s, 0.97 - R() * 0.06);
    clump(m.p.add(new V3(0, 0.3 + R() * 0.4, 0)), 1.3 + R() * 0.7, 9, new V3(), 0.7);
  }
  // vines down the faces, and ferns tucked into joints
  for (const s of [-1, 1]) for (let u = A0 + 3; u < A1; u += 0.8 + R() * 0.7) {
    if (s === FALLS.side && Math.abs(u - FALLS.along) < 2.4) continue;
    const half = gorgeHalf(u), y = rimY(u, s), inward = inwardAt(u, s), len = 2 + R() * 8;
    if (R() < 0.6) { e.set(0, Math.atan2(inward.x, inward.z), 0, 'YXZ'); q.setFromEuler(e); vines.add(GEO.card, gorgeWorld(u, s * (half - 0.08), y - len / 2 - R() * Math.max(0, y - FLOOR - len) * 0.5), new V3(0.7 + R() * 0.6, len, 1), LEAF[(R() * LEAF.length) | 0], q.clone()); }
    if (R() < 0.4) clump(gorgeWorld(u, s * (half - 0.15), FLOOR + 1.5 + R() * Math.max(0, y - FLOOR - 4)), 0.45 + R() * 0.3, 5, inward, 0.9);
  }
  // reeds and grasses along the pool's shore
  for (let k = 0; k < 90; k++) {
    const a = R() * Math.PI * 2, e0 = 0.98 + R() * 0.1, u = POOL.u + Math.cos(a) * POOL.ru * e0, v = Math.sin(a) * POOL.rv * e0;
    if (u > A0 - 1 || gorgePool(u, v) < 0.95) continue;
    const p = gorgeWorld(u, v); p.y = groundMeshH(p.x, p.z);
    if (p.y < FLOOR - 0.2) continue;
    clump(p.add(new V3(0, 0.35, 0)), 0.55 + R() * 0.3, 4, new V3(), 1.0);
  }
  const lm = gorgeMat(new THREE.MeshLambertMaterial({ vertexColors: true, map: leafTex, alphaTest: 0.45, side: THREE.DoubleSide, fog: false }), true);
  const vm = gorgeMat(new THREE.MeshLambertMaterial({ vertexColors: true, map: vineTex, alphaTest: 0.4, side: THREE.DoubleSide, fog: false }), true);
  fillMats.push([lm, [0.07, 0.1, 0.04]], [vm, [0.07, 0.1, 0.04]]);
  gorge.add(new THREE.Mesh(crowns.build(), lm), new THREE.Mesh(vines.build(), vm));
}

/* ---------- 4. the water: the pool and the canyon, clear emerald, foaming under the falls ---------- */
let waterMat = null;
const gwU = Object.assign({ uTime: waterU.uTime, uNight: waterU.uNight, uLightDir: waterU.uLightDir, uLightCol: waterU.uLightCol, uFall: { value: new THREE.Vector2(fallsBase.x, fallsBase.z) } }, nightU);
{
  const pos = [], gv = [], idx = [], NJ = 16; let n = 0;
  for (let u = POOL.u - POOL.ru * 1.12; u <= A1 + 1; u += 0.9) {
    const half = gorgeHalf(Math.max(u, A0)), du = (u - POOL.u) / POOL.ru, pool = POOL.rv * 1.16 * Math.sqrt(Math.max(0, 1.1 * 1.1 - du * du));
    const wide = Math.max(u > A0 - 4 ? half + 0.9 : 0, u < A0 + 6 ? pool : 0, 1);
    for (let j = 0; j <= NJ; j++) {
      const t = j / NJ * 2 - 1, v = t * wide, p = gorgeWorld(u, v, FLOOR);
      // shade: the cliffs' green gloom near the walls; none out on the open pool
      pos.push(p.x, FLOOR, p.z); gv.push(u, clamp(Math.abs(v) / half, 0, 1) * smooth(A0 - 6, A0 + 8, u));
    }
    if (n) for (let j = 0; j < NJ; j++) { const a = (n - 1) * (NJ + 1) + j, b = n * (NJ + 1) + j; idx.push(a, a + 1, b, a + 1, b + 1, b); }
    n++;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aG', new THREE.Float32BufferAttribute(gv, 2)); g.setIndex(idx);
  const m = new THREE.Mesh(g, waterMat = new THREE.ShaderMaterial({ uniforms: gwU, fog: false, side: THREE.DoubleSide,
    vertexShader: 'attribute vec2 aG;varying vec2 vG;varying vec3 vW;void main(){vG=aG;vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: `uniform float uTime,uNight;uniform vec3 uLightDir,uLightCol;uniform vec2 uFall;varying vec2 vG;varying vec3 vW;` + NIGHT_GLSL + `
      float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float nz(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1,0)),u.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),u.x),u.y);}
      float wv(vec2 p){float t=uTime;return nz(p*.55+vec2(t*.35,0.))*.6+nz(p*1.7+vec2(t*.6,t*.2))*.3+nz(p*4.1-vec2(t*.9,0.))*.1;}
      void main(){
        vec2 p=vW.xz;float e=.25,h0=wv(p);
        vec3 n=normalize(vec3(-(wv(p+vec2(e,0.))-h0)*.9,1.,-(wv(p+vec2(0.,e))-h0)*.9));
        vec3 v=normalize(cameraPosition-vW);float fr=pow(1.-max(dot(n,v),0.),4.);
        float side=vG.y;
        vec3 deep=vec3(.03,.22,.18),jade=vec3(.12,.5,.42);
        vec3 c=mix(jade,deep,smoothstep(.3,1.,side));
        c=mix(c,vec3(.05,.16,.1),smoothstep(.8,1.,side)*.5);
        c=mix(c,vec3(.55,.75,.72),fr*.45);
        vec3 hl=normalize(normalize(uLightDir)+v);c+=uLightCol*pow(max(dot(n,hl),0.),160.)*.9;
        float df=length(p-uFall);
        float foam=smoothstep(3.6,.4,df+(nz(p*2.+uTime)-.5)*1.4)*.9+smoothstep(9.,2.,df)*smoothstep(.62,.8,nz(p*1.6+vec2(uTime*.8,0.)))*.5;
        c=mix(c,vec3(.92,.96,.95),clamp(foam,0.,1.));
        // at night: moonlight on the ripples, the lanterns' warm pools, the lit falls
        vec3 night=c*.14+vec3(.05,.08,.13)*fr*.9;
        for(int i=0;i<8;i++){vec2 d=p-uGL[i].xz;night+=vec3(1.,.6,.28)*(.5+.6*h0)*.9/(1.+dot(d,d)*.35);}
        night+=vec3(.55,.7,.82)*.7/(1.+df*df*.03)+vec3(.9)*foam*.25;
        c=mix(c,night,uGN);
        gl_FragColor=vec4(c,1.);
      }` }));
  gorge.add(m);
}

/* ---------- 5. the falls: Manai Falls over the cave, and slender falls down both walls ---------- */
const fallU = Object.assign({ uTime: waterU.uTime }, nightU), mist = [];
// a ribbon of water leaving the lip of a wall at `along`, spreading as it falls, with mist at its foot
function falls(u0, s, w, out, alpha, speed, mistN) {
  const top = rimY(u0, s) - 0.2, H = top - FLOOR, half = gorgeHalf(u0);
  const g = new THREE.PlaneGeometry(1, 1, 1, 28), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    // t: 0 at the lip, 1 at the water
    const x = p.getX(i), t = 0.5 - p.getY(i);
    const a = gorgeWorld(u0 + x * w * (1 + t * 0.4), s * (half - 0.25 - out * (1 - Math.pow(1 - t, 2.2)) - 0.15), top - t * H);
    p.setXYZ(i, a.x, a.y, a.z);
  }
  gorge.add(new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: fallU, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float uTime,uGN;varying vec2 vUv;
      float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float nz(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1,0)),u.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),u.x),u.y);}
      void main(){
        float t=uTime*${speed.toFixed(2)};
        float n=nz(vec2(vUv.x*11.,vUv.y*4.+t))*.55+nz(vec2(vUv.x*31.,vUv.y*11.+t*1.6))*.45;
        float edge=smoothstep(0.,.22,vUv.x)*smoothstep(1.,.78,vUv.x);
        float a=edge*(.3+.7*smoothstep(.3,.75,n))*smoothstep(0.,.06,vUv.y);
        vec3 c=mix(vec3(.7,.82,.8),vec3(1.),n);c=mix(c,c*vec3(.72,.84,.95),uGN);
        gl_FragColor=vec4(c,a*${alpha.toFixed(2)});
      }` })));
  const base = gorgeWorld(u0, s * (half - out - 0.4), FLOOR);
  for (let k = 0; k < mistN; k++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: '#eef6f4', transparent: true, opacity: 0.3, depthWrite: false, fog: false }));
    const sc = (3 + k * 1.4) * Math.max(0.6, w / 3);
    sp.position.copy(base).add(new V3((R() - 0.5) * w, 1 + k * 1.0, (R() - 0.5) * 2)); sp.scale.setScalar(sc); sp.userData = { ph: R() * 6, sc }; gorge.add(sp); mist.push(sp);
  }
}
// Manai Falls, wide enough at its foot to row through into the cave behind it
falls(FALLS.along, FALLS.side, 3.0, 1.4, 0.95, 1.5, 5); falls(FALLS.along, FALLS.side, 6.0, 1.9, 0.3, 1.1, 0);
// slender falls on both walls, so you row between waterfalls
for (const [u0, s, w] of [[118, 1, 0.9], [126, -1, 1.2], [133, 1, 1.4], [139, -1, 0.8], [152, 1, 1.1], [158, -1, 0.9], [164, 1, 0.7]]) {
  falls(u0, s, w, 0.7, 0.85, 1.4 + R() * 0.3, 2); falls(u0, s, w * 2.2, 1.0, 0.22, 1.0, 0);
}
addTick(() => { if (!gorge.visible) return; mist.forEach(sp => { const w = Math.sin(T * 0.5 + sp.userData.ph); sp.material.opacity = 0.2 + 0.1 * w; sp.scale.setScalar(sp.userData.sc + w * 0.6); }); }, true);

/* ---------- 5b. the cave behind the falls: wet rock, ferns, and a light at its end ---------- */
// Row through the curtain and the passage runs back into the hill toward a warm, white light; reaching it
// carries you on into the Sunflower Garden (ui/boating.js, ui/worlds.js).
export const PORTAL = gorgeWorld(CAVE.along, FALLS.side * (gorgeHalf(CAVE.along) - 0.3 + CAVE.depth), FLOOR + 2.4);
const caveGlow = { value: 1 };
{
  const half = gorgeHalf(CAVE.along), s = FALLS.side, ND = 14, NT = 18, pos = [], col = [], idx = [], c = new THREE.Color();
  const DARK = C('#2a2b26'), MOSSC = C('#4f6a2c'), GOLD = C('#d9b878');
  for (let i = 0; i <= ND; i++) {
    const d = i / ND * CAVE.depth, k = d / CAVE.depth, rH = CAVE.half * (1 - 0.3 * k) + 0.2, rV = (CAVE.h + 0.3) * (1 - 0.35 * k);
    for (let j = 0; j <= NT; j++) {
      const th = j / NT * Math.PI, jit = 1 + (n3(i * 0.9, j * 0.7, 3) - 0.5) * 0.28;
      const p = gorgeWorld(CAVE.along + Math.cos(th) * rH * jit, s * (half - 0.4 + d), FLOOR - 0.6 + Math.sin(th) * rV * jit);
      pos.push(p.x, p.y, p.z);
      c.copy(DARK).multiplyScalar(0.8 + n3(i, j, 7) * 0.5).lerp(MOSSC, (1 - k) * 0.55 * n3(i * 0.5, j * 0.5, 1)).lerp(GOLD, Math.pow(k, 2.2) * 0.85);
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < ND; i++) for (let j = 0; j < NT; j++) { const a = i * (NT + 1) + j, b = a + NT + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  const vm = gorgeMat(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false, emissive: '#2a2416' }), false);
  gorge.add(new THREE.Mesh(g, vm));
  // the water runs on into the passage
  const wpos = [], wg = [], widx = [];
  for (let i = 0; i <= ND; i++) {
    const d = i / ND * (CAVE.depth + 0.5) - 2.5, rH = CAVE.half * (1 - 0.3 * Math.max(0, d) / CAVE.depth) + 0.4;
    for (const t of [-1, 1]) { const p = gorgeWorld(CAVE.along + t * rH, s * (half - 0.4 + d), FLOOR); wpos.push(p.x, FLOOR, p.z); wg.push(CAVE.along, 0.6); }
    if (i) { const a = (i - 1) * 2; widx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const wgeo = new THREE.BufferGeometry(); wgeo.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3)); wgeo.setAttribute('aG', new THREE.Float32BufferAttribute(wg, 2)); wgeo.setIndex(widx);
  gorge.add(new THREE.Mesh(wgeo, waterMat));
  // ferns hanging at the mouth of the cave
  const fern = new Merge();
  for (let k = 0; k < 26; k++) {
    const t = R() * Math.PI, d = R() * 2.5, p = gorgeWorld(CAVE.along + Math.cos(t) * CAVE.half * 0.95, s * (half - 0.3 + d), FLOOR - 0.6 + Math.sin(t) * (CAVE.h + 0.2) - 0.3);
    const len = 0.6 + R() * 1.6; fern.add(GEO.card, p.setY(p.y - len / 2), new V3(0.5 + R() * 0.4, len, 1), LEAF[(R() * LEAF.length) | 0], new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), R() * 3));
  }
  const fm = gorgeMat(new THREE.MeshLambertMaterial({ vertexColors: true, map: vineTex, alphaTest: 0.4, side: THREE.DoubleSide, fog: false }), true);
  gorge.add(new THREE.Mesh(fern.build(), fm));
  // the light at the end: a soft radiance with slow rays, haloes before it, and motes drifting in it
  const endH = CAVE.half * 0.7 + 0.2, endV = (CAVE.h + 0.3) * 0.65, cp = gorgeWorld(CAVE.along, s * (half - 0.4 + CAVE.depth - 0.2), FLOOR - 0.6);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 48, 0, Math.PI), new THREE.ShaderMaterial({ uniforms: { uTime: waterU.uTime, uOn: caveGlow }, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    vertexShader: 'varying vec2 vP;void main(){vP=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float uTime,uOn;varying vec2 vP;
      void main(){float r=length(vP),a=atan(vP.y,vP.x);
        float rays=.75+.25*sin(a*9.+uTime*.6)*sin(a*5.-uTime*.4);
        vec3 c=mix(vec3(1.,.97,.86),vec3(1.,.82,.5),smoothstep(.15,1.,r));
        gl_FragColor=vec4(c*(1.15-.35*r)*rays,(1.-smoothstep(.75,1.,r)*.8)*uOn);}` }));
  disc.position.copy(cp); disc.scale.set(endH, endV, 1); disc.lookAt(gorgeWorld(CAVE.along, 0, FLOOR - 0.6)); gorge.add(disc);
  for (const [sz, op, dd] of [[9, 0.55, 0.6], [16, 0.32, 2.5], [24, 0.18, 5]]) {
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#fff1cf', transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    gl.position.copy(gorgeWorld(CAVE.along, s * (half - 0.4 + CAVE.depth - dd), FLOOR + 2.4)); gl.scale.setScalar(sz); gorge.add(gl);
  }
  const N = 70, mp = new Float32Array(N * 3), ph = new Float32Array(N);
  for (let i = 0; i < N; i++) { const p = gorgeWorld(CAVE.along + (R() - 0.5) * 5, s * (half - 1 + R() * CAVE.depth), FLOOR + 0.5 + R() * 5); mp.set([p.x, p.y, p.z], i * 3); ph[i] = R() * 100; }
  const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(mp, 3)); mg.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
  gorge.add(new THREE.Points(mg, new THREE.ShaderMaterial({ uniforms: { uTime: waterU.uTime }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: `uniform float uTime;attribute float aPh;varying float vB;void main(){vec3 p=position+vec3(sin(uTime*.2+aPh)*.6,sin(uTime*.3+aPh*1.7)*.5,cos(uTime*.25+aPh)*.6);vB=.5+.5*sin(uTime*1.3+aPh*2.);vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=clamp(60./-mv.z,1.,6.);gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `varying float vB;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,0.,d)*(.35+.65*vB);gl_FragColor=vec4(vec3(1.,.93,.7)*a,a);}` })));
}

// where the "Secret Garden" sign stands, in the water beside the falls (built further down)
export const SECRET_SIGN = gorgeWorld(FALLS.along - 6, FALLS.side * (gorgeHalf(FALLS.along) - 1.6), FLOOR);

/* ---------- 5c. shafts of sunlight slanting down into the canyon by day ---------- */
const beamU = { uOp: { value: 0 }, uTime: waterU.uTime };
{
  const mat = new THREE.ShaderMaterial({ uniforms: beamU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: 'varying vec2 vUv;varying float vD;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.);vD=-mv.z;gl_Position=projectionMatrix*mv;}',
    fragmentShader: `uniform float uOp,uTime;varying vec2 vUv;varying float vD;void main(){float e=sin(vUv.x*3.1416);float a=e*e*smoothstep(0.,.35,vUv.y)*smoothstep(1.,.6,vUv.y)*(.75+.25*sin(uTime*.3+vUv.x*6.))*smoothstep(5.,18.,vD);gl_FragColor=vec4(vec3(1.,.95,.8)*a*uOp,a*uOp);}` });
  for (const [u0, v0, w, tilt] of [[122, 3, 3.5, 0.35], [137, -4, 4.5, 0.3], [150, 2, 3, 0.4], [129, 6, 2.5, 0.32]]) {
    const top = rimY(u0, 1) + 2, h = top - FLOOR;
    for (const yaw of [0, Math.PI / 2]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h * 1.15), mat);
      const c = gorgeWorld(u0, v0, FLOOR + h / 2); m.position.copy(c); m.rotation.set(0, GORGE.a + yaw, 0); m.rotateX(tilt); gorge.add(m);
    }
  }
}

/* ---------- 6. the stone arch bridge, high across the narrows ---------- */
{
  const U = 172, c = gorgeWorld(U, 0), tg = gorgeWorld(U + 1, 0).sub(gorgeWorld(U - 1, 0)).normalize();
  const span = gorgeHalf(U) + 0.9, deck = Math.min(rimY(U, -1), rimY(U, 1)) + 0.6, spring = deck - 3.4 - span;
  // local z runs along the gorge, x across it
  const b = new THREE.Group(); b.position.set(c.x, 0, c.z); b.rotation.y = Math.atan2(tg.x, tg.z);
  const m = new Merge(), STONE = ['#8d887b', '#7e796d', '#979284', '#86826f'].map(C), MOSSY = C('#6a7a48');
  const st = () => STONE[(R() * STONE.length) | 0].clone().lerp(MOSSY, R() < 0.25 ? 0.35 : 0.05);
  const W = 3.4, q = new THREE.Quaternion(), Z = new V3(0, 0, 1);
  // the arch ring
  const NV = 23;
  for (let i = 0; i < NV; i++) { const a0 = Math.PI * i / NV, a1 = Math.PI * (i + 1) / NV, am = (a0 + a1) / 2, rr = span + 0.55; q.setFromAxisAngle(Z, am - Math.PI / 2); m.add(GEO.box, new V3(Math.cos(am) * rr, spring + Math.sin(am) * rr, 0), new V3(2 * rr * Math.sin((a1 - a0) / 2) * 0.96, 1.1, W), st(), q.clone()); }
  // the spandrels above it, laid in courses, and the abutments running back onto each rim
  const ext = span + 8;
  for (let y = spring - 2; y < deck - 0.25; y += 0.62) for (let x = -ext; x < ext; x += 0.9 + R() * 0.5) {
    const xm = x + 0.45, arch = Math.abs(xm) < span + 1.1 ? spring + Math.sqrt(Math.max(0, (span + 1.1) ** 2 - xm * xm)) : -1e9;
    if (y < arch - 0.1) continue;
    m.add(GEO.box, new V3(xm, y + 0.31, 0), new V3(0.92, 0.6, W - 0.15), st());
  }
  m.add(GEO.box, new V3(0, deck, 0), new V3(2 * ext, 0.4, W + 0.3), C('#7a766b'));
  for (const z of [-1, 1]) { m.add(GEO.box, new V3(0, deck + 0.55, z * (W / 2)), new V3(2 * ext, 0.8, 0.32), C('#8a8578')); m.add(GEO.box, new V3(0, deck + 1.0, z * (W / 2)), new V3(2 * ext, 0.14, 0.44), C('#9b9688')); }
  const bm = gorgeMat(new THREE.MeshPhongMaterial({ vertexColors: true, map: stoneTex, normalMap: stoneNorm, shininess: 8, specular: '#1c1d19', fog: false }), false);
  fillMats.push([bm, [0.06, 0.06, 0.055]]);
  b.add(new THREE.Mesh(m.build(), bm));
  // ivy hanging from the arch
  const iv = new Merge(); for (let k = 0; k < 11; k++) { const x = (R() - 0.5) * 2 * span * 0.9, y = spring + Math.sqrt(Math.max(0, span * span - x * x)) - 0.4, len = 1.5 + R() * 3; iv.add(GEO.card, new V3(x, y - len / 2, (R() - 0.5) * W), new V3(0.9, len, 1), LEAF[k % LEAF.length], new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), R() * 3)); }
  b.add(new THREE.Mesh(iv.build(), gorgeMat(new THREE.MeshLambertMaterial({ vertexColors: true, map: vineTex, alphaTest: 0.4, side: THREE.DoubleSide, fog: false }), true)));
  gorge.add(b);
}

/* ---------- 7. rowing boats with paper lanterns: three drifting, and yours at the jetty ---------- */
const boats = [], glows = [];
const glowSprite = (col, size) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); sp.scale.setScalar(size); glows.push(sp); return sp; };
const lampMat = new THREE.MeshLambertMaterial({ color: '#f3e3c4', emissive: '#ffb45c', emissiveIntensity: 0.15, fog: false });
const boatMat = gorgeMat(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false }), false);
// a rowing boat, bow toward local +z; its oars are separate so yours can row
export function makeBoat(hull, rim, mat = boatMat, bow = false) {
  const bm = new Merge(), hg = new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  bm.add(hg, new V3(0, 0.32, 0), new V3(0.62, 0.36, 1.65), C(hull));
  bm.add(GEO.disc, new V3(0, 0.2, 0), new V3(0.5, 1, 1.4), C('#8b6b4c'));
  bm.add(new THREE.TorusGeometry(1, 0.05, 6, 30).rotateX(Math.PI / 2), new V3(0, 0.33, 0), new V3(0.62, 1, 1.65), C(rim));
  for (const z of [-0.55, 0.45]) bm.add(GEO.box, new V3(0, 0.27, z), new V3(1.1, 0.05, 0.24), C('#9a7656'));
  // a pole with a paper lantern, at the stern (or the bow of your own boat, lighting the way)
  // (your own boat's sits low at the bow's port side, below your eye line)
  const lz = bow ? 1 : -1, lx = bow ? -0.3 : 0, ly = bow ? 0.95 : 1.4;
  bm.limb(new V3(lx, 0.3, lz * 1.2), new V3(lx, ly, lz * 1.38), 0.022, 0.018, C('#4a3828'));
  const g = new THREE.Group(); g.add(new THREE.Mesh(bm.build(), mat));
  const lamp = new THREE.Mesh(GEO.cylB, lampMat); lamp.position.set(lx, ly - 0.32, lz * 1.38); lamp.scale.set(0.1, 0.24, 0.1); g.add(lamp);
  const gl = glowSprite('#ffb866', 2.2); gl.position.copy(lamp.position).setY(ly - 0.2); g.add(gl);
  const oars = [-1, 1].map(sx => {
    const om = new Merge(); om.limb(new V3(0, 0, 0), new V3(sx * 1.25, 0, 0), 0.024, 0.022, C('#8a6a4c')); om.add(GEO.box, new V3(sx * 1.32, 0, 0), new V3(0.28, 0.02, 0.13), C('#7d5f44'));
    const pv = new THREE.Group(); pv.position.set(sx * 0.5, 0.42, -0.05); pv.add(new THREE.Mesh(om.build(), mat)); g.add(pv); return pv;
  });
  return { g, lamp, oars };
}
{
  [['#efeadf', '#3b6f9a'], ['#e8e2d2', '#b0452f'], ['#efeadf', '#3b6f9a']].forEach(([hull, rim], i) => {
    const b = makeBoat(hull, rim); b.oars.forEach((o, k) => { o.rotation.set(0, (k ? -1 : 1) * 0.5, (k ? 1 : -1) * 0.35); }); gorge.add(b.g);
    boats.push({ ...b, u0: A0 - 4 + i * 9, ph: R() * 6.28, sp: 0.018 + R() * 0.012 });
  });
}
// your own boat, moored at the end of the jetty; ui/boating.js rows it
export const myBoat = (() => {
  const b = makeBoat('#f4efe2', '#6f8f4a', boatMat, true), home = gorgeWorld(JETTY.u1 + 1.6, 1.25, FLOOR - 0.12);
  const yaw = Math.atan2(gorgeWorld(JETTY.u1 + 3, 1.25).x - home.x, gorgeWorld(JETTY.u1 + 3, 1.25).z - home.z);
  b.g.position.copy(home); b.g.rotation.y = yaw; gorge.add(b.g);
  return Object.assign(b, { home, homeYaw: yaw, pos: home.clone(), yaw, moored: true });
})();

// where your boat may go: the pool, the canyon short of the narrows, and the cave behind the falls
export function boatWater(x, z) {
  const g = gorgeLocal(x, z), u = g.along, v = g.across;
  if (gorgeJettyH(x, z) !== null || Math.abs(u - (JETTY.u0 + JETTY.u1) / 2) < (JETTY.u1 - JETTY.u0) / 2 + 0.6 && Math.abs(v) < JETTY.half + 0.7) return false;
  if (Math.hypot(x - SECRET_SIGN.x, z - SECRET_SIGN.z) < 2.4) return false;
  if (gorgePool(u, v) < 0.88) return true;
  if (u > A0 - 4 && u < A1 - 10 && Math.abs(v) < gorgeHalf(u) - 1.4) return true;
  if (Math.abs(u - CAVE.along) < CAVE.half - 1.2 && v * FALLS.side > 0 && Math.abs(v) < gorgeHalf(u) + CAVE.depth - 0.5) return true;
  return false;
}
// how far into the cave a point is (0 at the wall's face), for the light at its end
export function caveDepth(x, z) { const g = gorgeLocal(x, z); return Math.abs(g.along - CAVE.along) < CAVE.half && g.across * FALLS.side > 0 ? Math.abs(g.across) - gorgeHalf(g.along) : -99; }

/* ---------- 8. stone lanterns on the pool's shore, lit at dusk ---------- */
const shoreLamps = [];
{
  const m = new Merge(), stone = C('#8a877d');
  for (const [a, side] of [[2.05, 1], [2.6, 1], [2.05, -1], [2.6, -1]]) {
    const u = POOL.u + Math.cos(a) * POOL.ru * 1.14, v = side * Math.sin(a) * POOL.rv * 1.14, p = gorgeWorld(u, v); p.y = groundMeshH(p.x, p.z);
    m.add(GEO.box, new V3(p.x, p.y + 0.15, p.z), new V3(0.75, 0.3, 0.75), stone);
    m.add(GEO.cylB, new V3(p.x, p.y + 0.3, p.z), new V3(0.16, 0.9, 0.16), stone);
    m.add(GEO.box, new V3(p.x, p.y + 1.25, p.z), new V3(0.55, 0.12, 0.55), stone);
    m.add(GEO.pyr, new V3(p.x, p.y + 1.85, p.z), new V3(0.62, 0.42, 0.62), stone);
    m.add(GEO.sph, new V3(p.x, p.y + 2.1, p.z), new V3(0.08, 0.1, 0.08), stone);
    for (const [dx, dz] of [[-0.21, -0.21], [0.21, -0.21], [-0.21, 0.21], [0.21, 0.21]]) m.add(GEO.box, new V3(p.x + dx, p.y + 1.55, p.z + dz), new V3(0.08, 0.5, 0.08), stone);
    const box = new THREE.Mesh(GEO.box, lampMat); box.position.set(p.x, p.y + 1.55, p.z); box.scale.set(0.36, 0.42, 0.36); gorge.add(box);
    const gl = glowSprite('#ffc27a', 2.6); gl.position.copy(box.position); gorge.add(gl);
    shoreLamps.push(box.position.clone());
  }
  gorge.add(new THREE.Mesh(m.build(), gorgeMat(new THREE.MeshLambertMaterial({ vertexColors: true, fog: false }), false)));
}
shoreLamps.forEach((p, i) => nightU.uGL.value[3 + i].copy(p));

// fireflies over the water and along the walls, after dusk
const fly = (() => {
  const N = 140, pos = new Float32Array(N * 3), ph = new Float32Array(N);
  for (let i = 0; i < N; i++) { const u = A0 - 14 + R() * 70, v = (R() - 0.5) * 2 * Math.min(gorgeHalf(Math.max(u, A0)), 16), p = gorgeWorld(u, v, FLOOR + 0.6 + R() * 4); pos.set([p.x, p.y, p.z], i * 3); ph[i] = R() * 100; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
  return new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: { uTime: waterU.uTime, uGN: nightU.uGN }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: `uniform float uTime;attribute float aPh;varying float vB;
      void main(){float t=uTime;vec3 p=position+vec3(sin(t*.31+aPh)*1.6,sin(t*.53+aPh*2.)*.7,cos(t*.27+aPh*1.3)*1.6);
        vB=pow(max(sin(t*1.7+aPh*3.),0.),3.);vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=clamp(90./-mv.z,1.,9.);gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `uniform float uGN;varying float vB;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,0.,d)*(.25+.75*vB)*uGN;gl_FragColor=vec4(vec3(1.,.9,.5)*a,a);}` }));
})();
gorge.add(fly);

addTick(() => {
  if (!gorge.visible) return;
  for (const [k, b] of boats.entries()) {
    const t = T * b.sp + b.ph, u = b.u0 + Math.sin(t) * 8, amp = Math.min(gorgeHalf(Math.max(u, A0)) - 3, 13) * 0.75, v = Math.sin(t * 1.3 + b.ph) * amp;
    const p = gorgeWorld(u, v, FLOOR - 0.12 + Math.sin(T * 1.2 + b.ph) * 0.03), q = gorgeWorld(u + Math.cos(t) * 0.4, Math.sin((t + 0.05) * 1.3 + b.ph) * amp);
    b.g.position.copy(p); b.g.rotation.set(0, Math.atan2(q.x - p.x, q.z - p.z) || b.g.rotation.y, Math.sin(T * 0.9 + b.ph) * 0.03);
    nightU.uGL.value[k].copy(p).add(new V3(0, 1.2, 0));
  }
  myBoat.lamp.getWorldPosition(nightU.uGL.value[7]);
}, true);

// rocks at the walls' feet and on the shore
{
  const m = new Merge();
  for (let k = 0; k < 40; k++) {
    const u = A0 + 2 + R() * (A1 - A0 - 4), v = (R() < 0.5 ? -1 : 1) * (gorgeHalf(u) - R() * 0.8), p = gorgeWorld(u, v), s = 0.3 + R() * 0.7;
    m.add(GEO.dode, new V3(p.x, FLOOR - s * 0.35, p.z), new V3(s * 1.3, s * 0.7, s), C(['#6e6a5f', '#5f5c52', '#77735f'][k % 3]).lerp(C('#5b7a33'), R() * 0.4), new THREE.Quaternion().setFromEuler(new THREE.Euler(R(), R() * 6, R())));
  }
  for (let k = 0; k < 30; k++) {
    const a = R() * Math.PI * 2, u = POOL.u + Math.cos(a) * POOL.ru * 0.98, v = Math.sin(a) * POOL.rv * 0.98, p = gorgeWorld(u, v), s = 0.25 + R() * 0.5;
    if (u > A0 - 1) continue;
    m.add(GEO.dode, new V3(p.x, groundMeshH(p.x, p.z) - s * 0.3, p.z), new V3(s * 1.3, s * 0.6, s), C(['#7a766a', '#6a675d', '#85816f'][k % 3]).lerp(C('#5b7a33'), R() * 0.3), new THREE.Quaternion().setFromEuler(new THREE.Euler(R(), R() * 6, R())));
  }
  const rm = gorgeMat(new THREE.MeshLambertMaterial({ vertexColors: true, fog: false }), false);
  gorge.add(new THREE.Mesh(m.build(), rm));
}
/* ---------- 5b'. the sign at the falls: "Secret Garden", on posts in the water beside Manai Falls ---------- */
// It faces the boats coming up the canyon, and glows softly after dusk so it can be read from the water.
const signMat = new THREE.MeshLambertMaterial({ emissive: '#ffffff', emissiveIntensity: 0.05 });
{
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 384; const g = cv.getContext('2d'), RS = rng(33);
  g.fillStyle = '#4a3426'; g.fillRect(0, 0, 1024, 384);
  g.strokeStyle = 'rgba(25,14,8,.35)'; g.lineWidth = 3; for (let i = 0; i < 24; i++) { const y = RS() * 384; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(340, y + (RS() - .5) * 30, 680, y + (RS() - .5) * 30, 1024, y + (RS() - .5) * 14); g.stroke(); }
  g.strokeStyle = 'rgba(232,206,150,.75)'; g.lineWidth = 6; g.strokeRect(22, 22, 980, 340);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#f6e3b4';
  g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = 12; g.shadowOffsetY = 5;
  g.font = '700 168px "Cormorant Garamond", Georgia, serif'; g.fillText('Secret Garden', 512, 168);
  g.font = 'italic 600 70px "Cormorant Garamond", Georgia, serif'; g.fillText('through the falls', 512, 300);
  // leaf sprigs in the corners
  g.shadowColor = 'transparent'; for (const [x, y, fl] of [[70, 70, 1], [954, 70, -1], [70, 314, 1], [954, 314, -1]]) { g.save(); g.translate(x, y); g.scale(fl, 1); for (let k = 0; k < 5; k++) { g.fillStyle = ['#5d8a34', '#4b742c', '#78a646'][k % 3]; g.save(); g.rotate(-0.9 + k * 0.45); g.beginPath(); g.ellipse(26, 0, 26, 9, 0, 0, 7); g.fill(); g.restore(); } g.fillStyle = '#f7b9cd'; g.beginPath(); g.arc(0, 0, 9, 0, 7); g.fill(); g.restore(); }
  const tex = new THREE.CanvasTexture(cv); signMat.map = tex; signMat.emissiveMap = tex;
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { tex.needsUpdate = true; });
  const s = new THREE.Group(); s.position.copy(SECRET_SIGN);
  const look = gorgeWorld(FALLS.along - 20, 0, FLOOR); s.rotation.y = Math.atan2(look.x - SECRET_SIGN.x, look.z - SECRET_SIGN.z);
  const m = new Merge(), wood = C('#5a4030');
  for (const x of [-1.55, 1.55]) m.limb(new V3(x, -1.2, 0), new V3(x, 3.4, 0), 0.09, 0.08, wood);
  m.add(GEO.box, new V3(0, 2.4, -0.05), new V3(3.3, 1.3, 0.08), C('#3a2a1e'));
  m.add(GEO.box, new V3(0, 3.12, 0), new V3(3.5, 0.1, 0.3), wood);
  s.add(new THREE.Mesh(m.build(), gorgeMat(new THREE.MeshLambertMaterial({ vertexColors: true, fog: false }), false)));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.2), signMat); face.position.set(0, 2.4, 0.0); s.add(face);
  // painted on both sides, so it reads coming and going
  const back = face.clone(); back.rotation.y = Math.PI; back.position.z = -0.1; s.add(back);
  // a little lantern hanging from one post
  const lp = new THREE.Mesh(GEO.cylB, lampMat); lp.position.set(1.55, 2.95, 0.25); lp.scale.set(0.09, 0.2, 0.09); s.add(lp);
  const gl = glowSprite('#ffc77a', 1.6); gl.position.set(1.55, 3.05, 0.25); s.add(gl);
  gorge.add(s);
}

onLayer2(gorge);

/* ---------- 9. the lookout: a small cedar deck in the gap of the hedge ---------- */
export const LOOKOUT = (() => { const p = gorgeWorld(71.6, 0); return { x: p.x, z: p.z }; })();
export const gorgeDeck = new THREE.Group();
{
  const c = gorgeWorld(72.6, 0), out = gorgeWorld(73.6, 0).sub(c).normalize();
  // local +z looks into the gorge
  gorgeDeck.position.set(c.x, groundH(c.x, c.z) + 0.06, c.z); gorgeDeck.rotation.y = Math.atan2(out.x, out.z);
  const m = new Merge(), WOOD = ['#7d5c40', '#86654a', '#71533a'].map(C), dark = C('#5e4532');
  for (let x = -3.4; x <= 3.4; x += 0.34) m.add(GEO.box, new V3(x, 0.05, 0), new V3(0.3, 0.07, 4.2), WOOD[(R() * 3) | 0]);
  // the rail opens in the middle onto the stepping stones down to the pool
  for (const x of [-3.5, -2.2, -0.9, 0.9, 2.2, 3.5]) m.limb(new V3(x, 0, 2.0), new V3(x, 1.05, 2.0), 0.07, 0.065, dark);
  for (const x of [-3.5, 3.5]) m.limb(new V3(x, 0, -2.0), new V3(x, 1.05, -2.0), 0.065, 0.06, dark);
  for (const sx of [-1, 1]) { m.add(GEO.box, new V3(sx * 2.2, 1.08, 2.0), new V3(2.8, 0.09, 0.16), C('#8a6a4c')); m.add(GEO.box, new V3(sx * 2.2, 0.6, 2.0), new V3(2.6, 0.06, 0.08), dark); }
  for (const x of [-3.5, 3.5]) { m.add(GEO.box, new V3(x, 1.08, 0), new V3(0.14, 0.09, 4.0), C('#8a6a4c')); m.add(GEO.box, new V3(x, 0.6, 0), new V3(0.07, 0.06, 4.0), dark); }
  const mesh = new THREE.Mesh(m.build(), new THREE.MeshLambertMaterial({ vertexColors: true })); mesh.castShadow = true; mesh.receiveShadow = true; gorgeDeck.add(mesh);
  scene.add(gorgeDeck); mountainMeshes.push(gorgeDeck);
  clearArea(c.x, c.z, 3.6);
  for (const v of [-3.5, -2.2, 2.2, 3.5]) { const p = gorgeWorld(74.7, v); decor.push({ x: p.x, z: p.z, r: 0.8, collide: 0.3 }); }
}
// stepping stones down the meadow, and a cedar jetty out over the pool where your boat waits
{
  const m = new Merge();
  for (let u = 75.6, k = 0; u < JETTY.u0 + 0.2; u += 0.95, k++) {
    const v = Math.sin(u * 0.35) * 0.9 + (k % 2 ? 0.25 : -0.25), p = gorgeWorld(u, v), s = 0.42 + R() * 0.1;
    m.add(GEO.dode, new V3(p.x, groundMeshH(p.x, p.z) - 0.02, p.z), new V3(s * 1.2, 0.08, s), C(['#9a968a', '#8c887c', '#a5a194'][k % 3]), new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), R() * 3));
  }
  // (the jetty now starts at the deck, so there may be no stones at all)
  const pathMat = gorgeMat(new THREE.MeshLambertMaterial({ vertexColors: true }), false), sg = m.build(), stones = sg ? new THREE.Mesh(sg, pathMat) : new THREE.Group(); stones.receiveShadow = true;
  const j = new Merge();
  const WOOD = ['#7d5c40', '#86654a', '#71533a'].map(C), dark = C('#5e4532'), yaw = Math.atan2(gorgeWorld(JETTY.u1, 0).x - gorgeWorld(JETTY.u0, 0).x, gorgeWorld(JETTY.u1, 0).z - gorgeWorld(JETTY.u0, 0).z), q = new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), yaw);
  for (let u = JETTY.u0 + 0.15; u < JETTY.u1; u += 0.32) { const p = gorgeWorld(u, 0, JETTY.y - 0.04); j.add(GEO.box, p, new V3(JETTY.half * 2, 0.07, 0.28), WOOD[(R() * 3) | 0], q); }
  for (let u = JETTY.u0 + 0.6; u <= JETTY.u1; u += 2.5) for (const v of [-JETTY.half + 0.08, JETTY.half - 0.08]) { const p = gorgeWorld(u, v); j.limb(new V3(p.x, FLOOR - 1.2, p.z), new V3(p.x, JETTY.y + 0.5, p.z), 0.08, 0.07, dark); }
  // a mooring post and a coil of rope where the boat is tied
  { const p = gorgeWorld(JETTY.u1 - 0.3, JETTY.half - 0.1); j.limb(new V3(p.x, JETTY.y, p.z), new V3(p.x, JETTY.y + 0.75, p.z), 0.09, 0.08, dark); j.add(new THREE.TorusGeometry(0.2, 0.04, 6, 16).rotateX(Math.PI / 2), new V3(p.x, JETTY.y + 0.05, p.z), new V3(1, 1, 1), C('#c9b48a')); }
  const mesh = new THREE.Mesh(j.build(), pathMat); mesh.receiveShadow = true;
  // a group of its own (the deck's is turned and placed at the deck), hidden with the hills for the sea
  const path = new THREE.Group(); path.add(stones, mesh); scene.add(path); mountainMeshes.push(path);
  const end = gorgeWorld(JETTY.u1 - 0.5, 0);
  regThing(mesh, 'Row a boat', () => late.rowBoat && late.rowBoat(), { x: end.x, z: end.z, r: 2.2 });
  regThing(gorgeDeck, 'Look out over Takachiho Gorge', () => late.lookIntoGorge && late.lookIntoGorge(), { x: LOOKOUT.x, z: LOOKOUT.z, r: 4.2 });
}

// a soft fill on stone and leaves by day (the gorge is lit from above, its walls mostly by the sky); at
// dusk the lanterns wake, and at night the moon, the lanterns and the lit falls take over
addTick(() => {
  if (!gorge.visible) return;
  const d = 1 - state.night, k = Math.max(state.night, (state.dusk || 0) * 0.45);
  fillMats.forEach(([m, c]) => m.emissive.setRGB(c[0], c[1], c[2]).multiplyScalar(d));
  nightU.uGN.value = state.night; lampMat.emissiveIntensity = 0.15 + k * 1.6; signMat.emissiveIntensity = 0.05 + k * 0.5;
  beamU.uOp.value = 0.2 * (1 - state.night) * (1 - (state.dusk || 0) * 0.6) * (1 - (state.rain || 0));
  glows.forEach(g => { g.material.opacity = k * 0.85; });
}, true);

// autumn turns the gorge's forest; spring and the monsoon keep it green
export function setGorgeSeason(season) { autumnU.value = season === 'autumn' ? 1 : 0; }
