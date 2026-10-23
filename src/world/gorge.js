import * as THREE from 'three';
import { C, V3, clamp, lerp, rng, smooth } from '../core/util.js';
import { GORGE, gorgeBend, gorgeHalf, gorgeWorld, groundH } from './terrain.js';
import { scene } from './renderer.js';
import { canvasTex, softTex } from './textures.js';
import { GEO, Merge } from './geometry.js';
import { mountainMeshes, mountainU } from './ground.js';
import { decor } from './paths.js';
import { clearArea } from './grass.js';
import { waterU } from '../water/water.js';
import { addTick, regThing } from '../core/things.js';
import { T, state } from '../core/state.js';
import { late } from '../core/late.js';

/* ================= Takachiho Gorge, beyond the hedge to the east ================= */
// A narrow gorge in the hills: walls of columnar basalt green with moss, a forest along the rims with
// vines trailing down, emerald water, Manai Falls dropping from the left wall, a stone arch bridge high
// overhead, and rowing boats drifting in the pool. It sits outside the garden (r 82–180, the gorge's frame
// is in terrain.js) and is seen through an opening in the hedge, where a small lookout deck stands; from
// there you can look into it (ui/gorgeView.js). The sea horizon hides all of it.
// Out of the garden's fog, like the temples on the hills (it would wash them to ghosts at this distance).

const R = rng(4242), A0 = GORGE.r0, A1 = GORGE.r1, FLOOR = GORGE.floor;
export const gorge = new THREE.Group(); scene.add(gorge); mountainMeshes.push(gorge);
const onLayer2 = o => o.traverse(c => { c.layers.set(2); if (c.isMesh) { c.castShadow = false; c.receiveShadow = false; } }); // never in the pond's reflection

// smooth 1D noise for heights along the walls
const N1 = Array.from({ length: 256 }, () => R());
const n1 = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(N1[i & 255], N1[(i + 1) & 255], u); };

// the height of each rim above the water, rising from the mouth into the hills; lower where the falls cut in
export const FALLS = { along: 146, side: -1 };
function rimY(u, s) {
  const ramp = 0.12 + 0.88 * smooth(A0 - 2, A0 + 26, u);
  let h = 20 + 7 * n1(u * 0.06 + (s > 0 ? 40 : 0)) + 3 * n1(u * 0.21 + (s > 0 ? 90 : 7));
  if (s === FALLS.side) h -= 2.4 * (1 - smooth(1.5, 4.5, Math.abs(u - FALLS.along)));
  return FLOOR + 1.2 + h * ramp;
}

// autumn turns the forest red, orange and gold (cedars stay green): shared by every leafy material here
const autumnU = { value: 0 };
const AUTUMN_GLSL = `
  float auH(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float auN(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(auH(i),auH(i+vec2(1,0)),u.x),mix(auH(i+vec2(0,1)),auH(i+vec2(1,1)),u.x),u.y);}
  vec3 autumnOf(vec3 base,vec3 w){
    float n=auN(w.xz*.18+w.y*.05)*.7+auN(w.xz*.9)*.3;
    vec3 c=n<.33?mix(vec3(.62,.13,.07),vec3(.80,.27,.08),n/.33):n<.66?mix(vec3(.85,.38,.09),vec3(.88,.62,.15),(n-.33)/.33):vec3(.86,.66,.2);
    float lum=dot(base,vec3(.3,.59,.11));
    return mix(c*(.45+lum*1.6),base,smoothstep(.62,.82,auN(w.xz*.9+7.)));
  }`;
function leafy(mat) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uAutumn = autumnU;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGW=(modelMatrix*vec4(transformed,1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uAutumn;varying vec3 vGW;' + AUTUMN_GLSL)
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb=mix(diffuseColor.rgb,autumnOf(diffuseColor.rgb,vGW),uAutumn);');
  };
  mat.customProgramCacheKey = () => 'gorge-leafy' + (mat.alphaTest ? 'a' : '');
  return mat;
}

/* ---------- 1. the basalt walls: columns of six-sided stone, broken at joints, mossy on every ledge ---------- */
const basaltTex = canvasTex(128, 256, (g, w, h) => {
  g.fillStyle = '#8a8a86'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) { const v = 100 + R() * 90 | 0; g.fillStyle = `rgba(${v},${v},${v - 6},.35)`; g.fillRect(R() * w, R() * h, 1 + R() * 3, 2 + R() * 14); }
  g.strokeStyle = 'rgba(40,40,38,.35)'; for (let i = 0; i < 10; i++) { g.lineWidth = 0.6 + R(); g.beginPath(); const x = R() * w; g.moveTo(x, 0); g.lineTo(x + (R() - 0.5) * 8, h); g.stroke(); }
  for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(70,96,40,.28)'; g.beginPath(); g.ellipse(R() * w, R() * h, 6 + R() * 18, 3 + R() * 9, 0, 0, 7); g.fill(); }
}, true);
const wallMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: basaltTex, fog: false, emissive: '#000000' });
{
  const pos = [], nor = [], col = [], uv = [], c = new THREE.Color();
  const BASALT = ['#5c574e', '#686253', '#4f4c45', '#736b5b', '#5a5a54'].map(C), MOSS = ['#5f7f30', '#71913a', '#54702b', '#7d9c45'].map(C), WET = C('#34432f');
  const tri = (a, b, d, n, ca, cb, cd, ua, ub, ud) => { for (const [p, cc, uu] of [[a, ca, ua], [b, cb, ub], [d, cd, ud]]) { pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); col.push(cc.r, cc.g, cc.b); uv.push(uu[0], uu[1]); } };
  const tint = (y, top, base, mossK) => { const t = base.clone(); t.lerp(WET, smooth(FLOOR + 2.6, FLOOR - 0.2, y) * 0.7); return t.lerp(MOSS[(R() * 4) | 0], mossK); };
  // one prism: centre (x, z), from y0 to y1, radius r, turned by rot; the top is a mossy ledge
  function prism(x, z, y0, y1, r, rot, base, mossTop, mossSide) {
    const ring = []; for (let k = 0; k < 6; k++) { const a = rot + k / 6 * Math.PI * 2; ring.push([x + Math.cos(a) * r * (0.9 + R() * 0.2), z + Math.sin(a) * r * (0.9 + R() * 0.2)]); }
    for (let k = 0; k < 6; k++) {
      const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % 6], n = new V3(bz - az, 0, -(bx - ax)).normalize();
      const p00 = new V3(ax, y0, az), p10 = new V3(bx, y0, bz), p01 = new V3(ax, y1, az), p11 = new V3(bx, y1, bz);
      const cb = tint(y0, false, base, mossSide * 0.3), ct = tint(y1, true, base, mossSide), u0 = k / 6, u1 = (k + 1) / 6, v0 = y0 / 6, v1 = y1 / 6;
      tri(p00, p11, p10, n, cb, ct, cb, [u0, v0], [u1, v1], [u1, v0]); tri(p00, p01, p11, n, cb, ct, ct, [u0, v0], [u0, v1], [u1, v1]);
    }
    const up = new V3(0, 1, 0), mc = base.clone().lerp(MOSS[(R() * 4) | 0], mossTop), ctr = new V3(x, y1, z);
    for (let k = 0; k < 6; k++) { const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % 6]; tri(ctr, new V3(bx, y1, bz), new V3(ax, y1, az), up, mc, mc, mc, [0.5, 0.5], [bx - x, bz - z], [ax - x, az - z]); }
  }
  // the columns of one wall, following its line in the gorge's frame
  const toW = (u, v) => gorgeWorld(u, v);
  function column(u, v, top, rr) {
    const base = BASALT[(R() * BASALT.length) | 0].clone().offsetHSL(0, 0, (R() - 0.5) * 0.05);
    let y = FLOOR - 1.2, d = 0;
    while (y < top - 0.3) {
      const seg = Math.min(top - y, 2.5 + R() * 7), y1 = y + seg, w = toW(u, v + d);
      const ledge = y1 < top - 0.3 && R() < 0.55; // a broken step: moss gathers on it
      prism(w.x, w.z, y, y1, rr * (0.92 + R() * 0.16), R() * 1.05, base, 0.85, Math.max(ledge ? 0.5 : 0, smooth(top - 7, top, y1) * 0.55, R() < 0.18 ? 0.25 + R() * 0.3 : 0));
      y = y1; d = clamp(d + (R() - 0.5) * 0.5, -0.35, 0.35);
    }
  }
  for (const s of [-1, 1]) for (let u = A0 + 1; u < A1 + 0.5; u += 0.5 + R() * 0.1) {
    const half = gorgeHalf(u), rr = 0.34 + R() * 0.12, top = rimY(u, s) + (R() - 0.5) * 1.4;
    column(u, s * (half + rr * 0.7 + (R() - 0.5) * 0.3), top, rr);
    if (R() < 0.6) column(u + 0.3, s * (half + rr * 2.1), top + 0.4 + R(), rr); // a second rank behind, so no gap shows
  }
  // the far end closes, round the bend where it can't be seen from the mouth
  for (let v = -gorgeHalf(A1) - 0.5; v <= gorgeHalf(A1) + 0.5; v += 0.6) column(A1 + 0.4, v, rimY(A1, 1), 0.5);
  for (let v = -gorgeHalf(A0) - 0.5; v <= gorgeHalf(A0) + 0.5; v += 0.6) column(A0 + 0.6, v, Math.min(rimY(A0, -1), rimY(A0, 1)), 0.5);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeBoundingSphere();
  gorge.add(new THREE.Mesh(g, wallMat));
}

/* ---------- 2. the forest on top: hills rising from each rim, a canopy of crowns, in the hills' own light ---------- */
// w runs outward from the rim; the ridges swell behind each rim and slope down to the lawn, sinking just below
// it at their edges (so no seam shows), and past the far end the two sides meet over the closed gorge
const openAt = u => smooth(A0 - 3, A0 + 2, u) * (1 - smooth(A1, A1 + 5, u)), innerAt = u => (gorgeHalf(u) + 1.3) * openAt(u) - 0.4;
function massifAt(u, s, w) {
  const p = gorgeWorld(u, s * (innerAt(u) + w)), ground = groundH(p.x, p.z) - 1.8, uc = clamp(u, A0, A1);
  const rim = lerp((rimY(uc, -1) + rimY(uc, 1)) / 2, rimY(uc, s), openAt(u)); // where the ends close, both sides meet at one height
  const swell = 8 * smooth(4, 36, w) * (0.3 + 0.7 * n1(u * 0.045 + w * 0.05 + (s > 0 ? 17 : 3))) + 1.8 * n1(u * 0.3 + w * 0.25) * smooth(0, 4, w);
  let y = lerp(rim - 0.15 + swell, ground - 4, smooth(20, 92, w));
  y = lerp(Math.min(ground, y), y, smooth(A0 - 26, A0 - 2, u)); // the near end: a saddle sloping down to the lawn
  p.y = y; return p;
}
{
  const u = { uHor: { value: new THREE.Color() }, uNight: { value: 0 }, uDusk: { value: 0 }, uLight: { value: new V3(0.6, 0.45, 0.6) }, uAutumn: autumnU };
  mountainU.push(u);
  const mat = new THREE.ShaderMaterial({ uniforms: u, fog: false, side: THREE.DoubleSide,
    vertexShader: 'attribute float aFoot;varying float vFoot;varying vec3 vW,vN;void main(){vFoot=aFoot;vW=(modelMatrix*vec4(position,1.)).xyz;vN=normal;gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.);}',
    fragmentShader: `uniform vec3 uHor,uLight;uniform float uNight,uDusk,uAutumn;varying float vFoot;varying vec3 vW,vN;` + AUTUMN_GLSL + `
      void main(){
        vec3 n=normalize(vN);float lam=max(dot(n,normalize(uLight)),0.);
        vec3 L=normalize(uLight);
        float lit=0.,gap=0.;
        for(int k=0;k<2;k++){
          float sc=k==0?2.4:5.5;vec2 q=vW.xz/sc,i=floor(q),f=fract(q);float md=9.;vec2 mv=vec2(0.);
          for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(float(x),float(y));vec2 o=vec2(auH(i+g+float(k)*31.),auH(i+g+17.3))*.8+.1;vec2 r=g+o-f;float d=dot(r,r);if(d<md){md=d;mv=r;}}
          float d=sqrt(md);vec3 dn=normalize(vec3(-mv.x,max(.75-d,.05)*1.6,-mv.y));
          lit+=(k==0?.6:.4)*(.35+.65*max(dot(dn,L),0.));gap+=(k==0?.6:.4)*smoothstep(.5,.75,d);
        }
        float crowns=auN(vW.xz*.3)*.6+auN(vW.xz*1.1)*.4;
        vec3 c=mix(vec3(.12,.27,.1),vec3(.30,.50,.18),smoothstep(.25,.85,crowns));
        c*=.55+.75*lit;c*=1.-gap*.45;
        c=mix(c,autumnOf(c,vW),uAutumn*.7*(1.-vFoot));
        c=mix(c,vec3(.34,.36,.3),smoothstep(.45,.2,n.y)*.5);
        c*=.6+.6*lam;
        c=mix(c,vec3(.36,.5,.25)*(.55+.6*lam),vFoot); // the lawn, where the ridges run outc=mix(c,c*vec3(1.25,.9,.85),uDusk*.6);
        c*=mix(1.,.15,uNight);
        float d=length(vW.xz-cameraPosition.xz);c=mix(c,uHor,smoothstep(120.,500.,d)*.25);
        gl_FragColor=vec4(c,1.);
      }` });
  for (const s of [-1, 1]) {
    const US = [], WS = []; for (let x = A0 - 28; x <= A1 + 18; x += 1.6) US.push(x); for (let j = 0; j <= 30; j++) WS.push(92 * Math.pow(j / 30, 1.4));
    const pos = [], idx = [];
    const foot = [];
    for (const uu of US) for (const w of WS) { const p = massifAt(uu, s, w); pos.push(p.x, p.y, p.z); foot.push(Math.max(smooth(56, 84, w), 1 - smooth(A0 - 24, A0 - 8, uu))); }
    const nw = WS.length;
    for (let i = 0; i < US.length - 1; i++) for (let j = 0; j < nw - 1; j++) { const a = i * nw + j, b = a + nw; s > 0 ? idx.push(a, b, a + 1, a + 1, b, b + 1) : idx.push(a, a + 1, b, a + 1, b + 1, b); }
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
const leafMats = [], LEAF = ['#5a8634', '#6a963c', '#4b742c', '#78a646', '#55802f'].map(C);
{
  const crowns = new Merge(), vines = new Merge(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const card = (m, p, size, rx, ry, rz, col) => { e.set(rx, ry, rz, 'YXZ'); q.setFromEuler(e); m.add(GEO.card, p, new V3(size, size, size), col, q.clone()); };
  function clump(c, rad, n, lean, s, size = 0.55) {
    for (let k = 0; k < n; k++) {
      const a = R() * 6.28, r = Math.sqrt(R()) * rad, p = c.clone().add(new V3(Math.cos(a) * r, (R() - 0.3) * rad * 0.7, Math.sin(a) * r)).addScaledVector(lean, R() * rad * 0.6);
      card(crowns, p, rad * size * (0.8 + R() * 0.5), (R() - 0.5) * 1.4, R() * 6.28, (R() - 0.5) * 1.4, LEAF[(R() * LEAF.length) | 0].clone().offsetHSL(0, 0, (R() - 0.5) * 0.06));
    }
  }
  for (const s of [-1, 1]) for (let u = A0 + 2; u < A1; u += 1.3 + R() * 0.6) {
    const half = gorgeHalf(u), y = rimY(u, s), inward = gorgeWorld(u, 0).sub(gorgeWorld(u, s)).normalize();
    if (Math.abs(u - FALLS.along) < 1.6 && s === FALLS.side) continue; // the falls' lip stays open
    // a crown on the rim leaning over the gorge, and a second one further back
    clump(gorgeWorld(u, s * (half + 0.4 + R() * 1.0), y + 0.6 + R() * 0.6), 1.3 + R() * 0.7, 16, inward, s);
    // vines trailing down the face
    if (R() < 0.55) {
      const len = 3 + R() * 9, p = gorgeWorld(u, s * (half - 0.05), y - len / 2 + 0.6);
      const yaw = Math.atan2(inward.x, inward.z);
      e.set(0, yaw, 0, 'YXZ'); q.setFromEuler(e); vines.add(GEO.card, p, new V3(0.9 + R() * 0.6, len, 1), LEAF[(R() * LEAF.length) | 0], q.clone());
    }
    // ferns and moss tufts on a few ledges down the wall
  }
  // the forest over the ridges: crowns close together, so from the garden the hills read as woodland
  for (const s of [-1, 1]) for (let u = A0 + 1; u < A1 + 2; u += 2.2 + R() * 1.2) for (let w = 1.5; w < 9; w += 2.4 + R() * 1.6) {
    const uu = u + (R() - 0.5) * 2, p = massifAt(uu, s, w + (R() - 0.5) * 2), gp = groundH(p.x, p.z);
    if (p.y < gp + 0.6) continue;
    clump(p.add(new V3(0, 0.5 + R() * 0.5, 0)), 1.5 + R() * 0.8, 9, new V3(), s, 0.7);
  }
  // vines down the faces, more of them, and ferns tucked into joints
  for (const s of [-1, 1]) for (let u = A0 + 4; u < A1; u += 0.9 + R() * 0.8) {
    if (s === FALLS.side && Math.abs(u - FALLS.along) < 2) continue;
    const half = gorgeHalf(u), y = rimY(u, s), inward = gorgeWorld(u, 0).sub(gorgeWorld(u, s)).normalize(), len = 2 + R() * 7;
    if (R() < 0.5) { e.set(0, Math.atan2(inward.x, inward.z), 0, 'YXZ'); q.setFromEuler(e); vines.add(GEO.card, gorgeWorld(u, s * (half - 0.08), y - len / 2 - R() * (y - FLOOR - len) * 0.5), new V3(0.7 + R() * 0.6, len, 1), LEAF[(R() * LEAF.length) | 0], q.clone()); }
    if (R() < 0.35) clump(gorgeWorld(u, s * (half - 0.15), FLOOR + 1.5 + R() * (y - FLOOR - 4)), 0.45 + R() * 0.3, 5, inward, s, 0.9);
  }
  const lm = leafy(new THREE.MeshLambertMaterial({ vertexColors: true, map: leafTex, alphaTest: 0.45, side: THREE.DoubleSide, fog: false })); leafMats.push(lm);
  const vm = leafy(new THREE.MeshLambertMaterial({ vertexColors: true, map: vineTex, alphaTest: 0.4, side: THREE.DoubleSide, fog: false })); leafMats.push(vm);
  gorge.add(new THREE.Mesh(crowns.build(), lm), new THREE.Mesh(vines.build(), vm));
}

/* ---------- 4. the water: clear emerald, brighter down the middle, foaming under the falls ---------- */
const fallsBase = gorgeWorld(FALLS.along, FALLS.side * (gorgeHalf(FALLS.along) - 1.4), FLOOR);
const gwU = { uTime: waterU.uTime, uNight: waterU.uNight, uLightDir: waterU.uLightDir, uLightCol: waterU.uLightCol, uFall: { value: new THREE.Vector2(fallsBase.x, fallsBase.z) } };
{
  const pos = [], gv = [], idx = []; let n = 0;
  for (let u = A0 + 0.5; u <= A1 + 1; u += 0.8) {
    const half = gorgeHalf(u) + 0.6;
    for (let j = 0; j <= 8; j++) { const t = j / 8 * 2 - 1, p = gorgeWorld(u, t * half, FLOOR); pos.push(p.x, FLOOR, p.z); gv.push(u, t); }
    if (n) for (let j = 0; j < 8; j++) { const a = (n - 1) * 9 + j, b = n * 9 + j; idx.push(a, a + 1, b, a + 1, b + 1, b); }
    n++;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aG', new THREE.Float32BufferAttribute(gv, 2)); g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: gwU, fog: false, side: THREE.DoubleSide,
    vertexShader: 'attribute vec2 aG;varying vec2 vG;varying vec3 vW;void main(){vG=aG;vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: `uniform float uTime,uNight;uniform vec3 uLightDir,uLightCol;uniform vec2 uFall;varying vec2 vG;varying vec3 vW;
      float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float nz(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1,0)),u.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),u.x),u.y);}
      float wv(vec2 p){float t=uTime;return nz(p*.55+vec2(t*.35,0.))*.6+nz(p*1.7+vec2(t*.6,t*.2))*.3+nz(p*4.1-vec2(t*.9,0.))*.1;}
      void main(){
        vec2 p=vW.xz;float e=.25,h0=wv(p);
        vec3 n=normalize(vec3(-(wv(p+vec2(e,0.))-h0)*.9,1.,-(wv(p+vec2(0.,e))-h0)*.9));
        vec3 v=normalize(cameraPosition-vW);float fr=pow(1.-max(dot(n,v),0.),4.);
        float side=abs(vG.y);
        vec3 deep=vec3(.03,.22,.18),jade=vec3(.12,.5,.42);
        vec3 c=mix(jade,deep,smoothstep(.25,1.,side));              // the cliffs' green shade near the walls
        c=mix(c,vec3(.05,.16,.1),smoothstep(.75,1.,side)*.6);
        c=mix(c,vec3(.55,.75,.72),fr*.45);
        vec3 hl=normalize(normalize(uLightDir)+v);c+=uLightCol*pow(max(dot(n,hl),0.),160.)*.9;
        float df=length(p-uFall);
        float foam=smoothstep(3.6,.4,df+(nz(p*2.+uTime)-.5)*1.4)*.9+smoothstep(9.,2.,df)*smoothstep(.62,.8,nz(p*1.6+vec2(uTime*.8,0.)))*.5;
        c=mix(c,vec3(.92,.96,.95),clamp(foam,0.,1.));
        c*=mix(1.,.2,uNight);
        gl_FragColor=vec4(c,1.);
      }` }));
  gorge.add(m);
}

/* ---------- 5. Manai Falls: a ribbon of water leaving the lip of the left wall, mist at its foot ---------- */
const fallU = { uTime: waterU.uTime, uNight: waterU.uNight };
{
  const top = rimY(FALLS.along, FALLS.side) - 0.2, H = top - FLOOR, s = FALLS.side, half = gorgeHalf(FALLS.along);
  const mk = (w, out, alpha, speed) => {
    const g = new THREE.PlaneGeometry(1, 1, 1, 28), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), t = 0.5 - p.getY(i); // 0 at the lip, 1 at the water
      const a = gorgeWorld(FALLS.along + x * w, s * (half - 0.25 - out * (1 - Math.pow(1 - t, 2.2)) - 0.15), top - t * H);
      p.setXYZ(i, a.x, a.y, a.z);
    }
    return new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: fallU, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `uniform float uTime,uNight;varying vec2 vUv;
        float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float nz(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1,0)),u.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),u.x),u.y);}
        void main(){
          float t=uTime*${speed.toFixed(2)};
          float n=nz(vec2(vUv.x*11.,vUv.y*4.+t))*.55+nz(vec2(vUv.x*31.,vUv.y*11.+t*1.6))*.45;
          float edge=smoothstep(0.,.22,vUv.x)*smoothstep(1.,.78,vUv.x);
          float a=edge*(.3+.7*smoothstep(.3,.75,n))*smoothstep(0.,.06,vUv.y);
          vec3 c=mix(vec3(.7,.82,.8),vec3(1.),n);c*=mix(1.,.25,uNight);
          gl_FragColor=vec4(c,a*${alpha.toFixed(2)});
        }` }));
  };
  gorge.add(mk(2.2, 1.4, 0.95, 1.5), mk(4.2, 1.8, 0.3, 1.1));
  // mist rising where it lands
  const mist = [];
  for (let k = 0; k < 4; k++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: '#eef6f4', transparent: true, opacity: 0.32, depthWrite: false, fog: false }));
    sp.position.copy(fallsBase).add(new V3((R() - 0.5) * 2, 1 + k * 0.9, (R() - 0.5) * 2)); sp.scale.setScalar(4 + k * 1.2); sp.userData.ph = R() * 6; gorge.add(sp); mist.push(sp);
  }
  addTick(() => { if (!gorge.visible) return; mist.forEach((sp, k) => { const w = Math.sin(T * 0.5 + sp.userData.ph); sp.material.opacity = 0.22 + 0.1 * w; sp.scale.setScalar(4 + k * 1.2 + w * 0.6); }); }, true);
}

/* ---------- 6. the stone arch bridge, high across the gorge ---------- */
{
  const U = 156, c = gorgeWorld(U, 0), tg = gorgeWorld(U + 1, 0).sub(gorgeWorld(U - 1, 0)).normalize();
  const span = gorgeHalf(U) + 0.9, deck = Math.min(rimY(U, -1), rimY(U, 1)) + 0.6, spring = deck - 3.4 - span;
  const b = new THREE.Group(); b.position.set(c.x, 0, c.z); b.rotation.y = Math.atan2(tg.x, tg.z); // local z runs along the gorge, x across it
  const m = new Merge(), STONE = ['#8d887b', '#7e796d', '#979284', '#86826f'].map(C), MOSSY = C('#6a7a48');
  const st = () => STONE[(R() * STONE.length) | 0].clone().lerp(MOSSY, R() < 0.25 ? 0.35 : 0.05);
  const W = 3.4, q = new THREE.Quaternion(), Z = new V3(0, 0, 1);
  // the arch ring
  const NV = 21;
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
  b.add(new THREE.Mesh(m.build(), new THREE.MeshLambertMaterial({ vertexColors: true, map: basaltTex, fog: false })));
  // ivy hanging from the arch
  const iv = new Merge(); for (let k = 0; k < 9; k++) { const x = (R() - 0.5) * 2 * span * 0.9, y = spring + Math.sqrt(Math.max(0, span * span - x * x)) - 0.4, len = 1.5 + R() * 3; iv.add(GEO.card, new V3(x, y - len / 2, (R() - 0.5) * W), new V3(0.9, len, 1), LEAF[k % LEAF.length], new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), R() * 3)); }
  b.add(new THREE.Mesh(iv.build(), leafy(new THREE.MeshLambertMaterial({ vertexColors: true, map: vineTex, alphaTest: 0.4, side: THREE.DoubleSide, fog: false }))));
  gorge.add(b);
}

/* ---------- 7. rowing boats drifting in the pool below the falls ---------- */
const boats = [];
{
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false });
  const HULLS = [['#efeadf', '#3b6f9a'], ['#e8e2d2', '#b0452f'], ['#efeadf', '#3b6f9a']];
  HULLS.forEach(([hull, rim], i) => {
    const bm = new Merge(), hg = new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    bm.add(hg, new V3(0, 0.32, 0), new V3(0.62, 0.36, 1.65), C(hull));
    bm.add(GEO.disc, new V3(0, 0.2, 0), new V3(0.5, 1, 1.4), C('#8b6b4c'));
    bm.add(new THREE.TorusGeometry(1, 0.05, 6, 30).rotateX(Math.PI / 2), new V3(0, 0.33, 0), new V3(0.62, 1, 1.65), C(rim));
    for (const z of [-0.55, 0.45]) bm.add(GEO.box, new V3(0, 0.27, z), new V3(1.1, 0.05, 0.24), C('#9a7656'));
    for (const sx of [-1, 1]) bm.limb(new V3(sx * 0.45, 0.36, -0.05), new V3(sx * 1.35, 0.02, 0.35), 0.022, 0.022, C('#8a6a4c'));
    const g = new THREE.Group(); g.add(new THREE.Mesh(bm.build(), mat)); gorge.add(g);
    boats.push({ g, u0: 128 + i * 7, ph: R() * 6.28, sp: 0.02 + R() * 0.015 });
  });
  addTick(() => {
    if (!gorge.visible) return;
    for (const b of boats) {
      const t = T * b.sp + b.ph, u = b.u0 + Math.sin(t) * 4, v = Math.sin(t * 1.7 + b.ph) * (gorgeHalf(u) - 1.6) * 0.75;
      const p = gorgeWorld(u, v, FLOOR - 0.12 + Math.sin(T * 1.2 + b.ph) * 0.03), q = gorgeWorld(u + Math.cos(t) * 4 * 0.05, Math.sin((t + 0.05) * 1.7 + b.ph) * (gorgeHalf(u) - 1.6) * 0.75);
      b.g.position.copy(p); b.g.rotation.set(0, Math.atan2(q.x - p.x, q.z - p.z) || b.g.rotation.y, Math.sin(T * 0.9 + b.ph) * 0.03);
    }
  }, true);
}

// rocks where the gorge opens: the water ends at a shingle of mossy stones below the lawn
{
  const m = new Merge();
  for (let k = 0; k < 26; k++) {
    const u = A0 + 2 + R() * (A1 - A0 - 4), v = (R() < 0.5 ? -1 : 1) * (gorgeHalf(u) - R() * 0.8), p = gorgeWorld(u, v), s = 0.3 + R() * 0.7;
    m.add(GEO.dode, new V3(p.x, FLOOR - s * 0.35, p.z), new V3(s * 1.3, s * 0.7, s), C(['#6e6a5f', '#5f5c52', '#77735f'][k % 3]).lerp(C('#5b7a33'), R() * 0.4), new THREE.Quaternion().setFromEuler(new THREE.Euler(R(), R() * 6, R())));
  }
  gorge.add(new THREE.Mesh(m.build(), new THREE.MeshLambertMaterial({ vertexColors: true, fog: false })));
}
onLayer2(gorge);

/* ---------- 8. the lookout: a small cedar deck in the gap of the hedge ---------- */
export const LOOKOUT = (() => { const p = gorgeWorld(71.6, 0); return { x: p.x, z: p.z }; })();
export const gorgeDeck = new THREE.Group();
{
  const c = gorgeWorld(72.6, 0), out = gorgeWorld(73.6, 0).sub(c).normalize();
  gorgeDeck.position.set(c.x, groundH(c.x, c.z) + 0.06, c.z); gorgeDeck.rotation.y = Math.atan2(out.x, out.z); // local +z looks into the gorge
  const m = new Merge(), WOOD = ['#7d5c40', '#86654a', '#71533a'].map(C), dark = C('#5e4532');
  for (let x = -3.4; x <= 3.4; x += 0.34) m.add(GEO.box, new V3(x, 0.05, 0), new V3(0.3, 0.07, 4.2), WOOD[(R() * 3) | 0]);
  for (const x of [-3.5, -1.75, 0, 1.75, 3.5]) m.limb(new V3(x, 0, 2.0), new V3(x, 1.05, 2.0), 0.07, 0.065, dark);
  for (const x of [-3.5, 3.5]) m.limb(new V3(x, 0, -2.0), new V3(x, 1.05, -2.0), 0.065, 0.06, dark);
  m.add(GEO.box, new V3(0, 1.08, 2.0), new V3(7.2, 0.09, 0.16), C('#8a6a4c'));
  m.add(GEO.box, new V3(0, 0.6, 2.0), new V3(7.0, 0.06, 0.08), dark);
  for (const x of [-3.5, 3.5]) { m.add(GEO.box, new V3(x, 1.08, 0), new V3(0.14, 0.09, 4.0), C('#8a6a4c')); m.add(GEO.box, new V3(x, 0.6, 0), new V3(0.07, 0.06, 4.0), dark); }
  const mesh = new THREE.Mesh(m.build(), new THREE.MeshLambertMaterial({ vertexColors: true })); mesh.castShadow = true; mesh.receiveShadow = true; gorgeDeck.add(mesh);
  scene.add(gorgeDeck); mountainMeshes.push(gorgeDeck);
  clearArea(c.x, c.z, 3.6);
  for (const v of [-3.5, 0, 3.5]) { const p = gorgeWorld(74.7, v); decor.push({ x: p.x, z: p.z, r: 1.2, collide: 0.3 }); }
  regThing(gorgeDeck, 'Look out over Takachiho Gorge', () => late.lookIntoGorge && late.lookIntoGorge(), { x: LOOKOUT.x, z: LOOKOUT.z, r: 4.2 });
}

// a soft fill on the stone by day (the gorge is lit from above, the walls mostly by the sky), none at night
addTick(() => { if (!gorge.visible) return; const d = 1 - state.night; wallMat.emissive.setRGB(0.07, 0.072, 0.064).multiplyScalar(d); leafMats.forEach(m => m.emissive.setRGB(0.07, 0.1, 0.04).multiplyScalar(d)); }, true);

// autumn turns the gorge's forest; spring and the monsoon keep it green
export function setGorgeSeason(season) { autumnU.value = season === 'autumn' ? 1 : 0; }
