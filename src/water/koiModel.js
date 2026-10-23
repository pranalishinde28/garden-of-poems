import * as THREE from 'three';
import { rng } from '../core/util.js';
import { canvasTex } from '../world/textures.js';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/* ================= koi: a lifelike fish for the pond and the fountain ================= */
// A tapered body (head toward +z) painted with a real variety's pattern, translucent fins and a long
// tail. The body bends as it swims, in the vertex shader: a wave runs from the head to the tail, and a
// turn curves the whole fish. Each fish has its own small uniforms (time, speed, turn), so the CPU only
// sets three numbers per fish per frame.

// the body's half-height along its length, from tail (u = 0) to nose (u = 1)
const PROFILE = [[0, 0.03], [0.08, 0.04], [0.2, 0.068], [0.38, 0.105], [0.58, 0.122], [0.74, 0.115], [0.86, 0.092], [0.94, 0.06], [0.985, 0.03], [1, 0]];
const radiusAt = u => { for (let i = 1; i < PROFILE.length; i++) if (u <= PROFILE[i][0]) { const [u0, r0] = PROFILE[i - 1], [u1, r1] = PROFILE[i], t = (u - u0) / (u1 - u0); return r0 + (r1 - r0) * t * t * (3 - 2 * t); } return 0; };
const bodyGeo = (() => {
  const g = new THREE.CylinderGeometry(1, 1, 1, 22, 40, false).rotateX(Math.PI / 2), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i), u = z + 0.5, r = radiusAt(u), x = p.getX(i), y = p.getY(i);
    // a little wider than tall, a softer belly
    p.setXYZ(i, x * r * 0.86, y * r * (y < 0 ? 0.88 : 1.0), z);
  }
  g.computeVertexNormals(); return g;
})();

// fins: one translucent fan texture with rays, tinted per fish
const finTex = canvasTex(128, 128, g => {
  const grad = g.createLinearGradient(0, 0, 0, 128); grad.addColorStop(0, 'rgba(255,255,255,.95)'); grad.addColorStop(1, 'rgba(255,255,255,.28)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 1.4;
  for (let k = 0; k < 14; k++) { g.beginPath(); g.moveTo(64, 0); g.lineTo(k / 13 * 128, 128); g.stroke(); }
});
function finGeo(shape) {
  // shapes in the fish's own units (length 1); each is a flat fan in the x-z plane or y-z plane
  const s = new THREE.Shape();
  if (shape === 'tail') { s.moveTo(0, 0); s.bezierCurveTo(0.12, 0.05, 0.22, 0.16, 0.26, 0.2); s.bezierCurveTo(0.2, 0.08, 0.2, -0.08, 0.26, -0.2); s.bezierCurveTo(0.22, -0.16, 0.12, -0.05, 0, 0); }
  else if (shape === 'dorsal') { s.moveTo(0, 0); s.bezierCurveTo(0.06, 0.05, 0.2, 0.07, 0.34, 0.03); s.lineTo(0.36, 0); s.lineTo(0, 0); }
  else { s.moveTo(0, 0); s.bezierCurveTo(0.03, 0.06, 0.1, 0.1, 0.15, 0.09); s.bezierCurveTo(0.14, 0.05, 0.08, 0.01, 0, 0); }
  const g = new THREE.ShapeGeometry(s, 10), p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, 0.5 + p.getY(i) * 2.2, 1 - p.getX(i) / 0.36);
  return g;
}
const TAIL = finGeo('tail').rotateY(-Math.PI / 2).rotateZ(Math.PI / 2).translate(0, 0, -0.5); // trailing behind the body, upright
const DORSAL = finGeo('dorsal').rotateY(Math.PI / 2).translate(0, 0.11, 0.2); // along the back
const PECT = finGeo('pect');
// every fin in one geometry, so a fish is two draw calls (body, fins) rather than seven
const FINS = BufferGeometryUtils.mergeBufferGeometries([TAIL, DORSAL, ...[-1, 1].map(s => {
  const g = PECT.clone(), m = new THREE.Matrix4().compose(new THREE.Vector3(s * 0.07, -0.04, 0.24), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, s * 2.4, s * 0.5)), new THREE.Vector3(1, 1, 1));
  return g.applyMatrix4(m);
})]);

// the varieties, painted onto a canvas wrapped round the body: x runs round it (0.5 = the spine), y runs
// from the nose (top) to the tail (bottom)
const VARIETIES = {
  kohaku: { base: '#f6f2ea', fin: '#f3eee6', paint: (g, R) => patches(g, R, '#d6361c', 3, 0.3) },
  sanke: { base: '#f6f2ea', fin: '#f3eee6', paint: (g, R) => { patches(g, R, '#d43a20', 3, 0.28); spots(g, R, '#1d1b1a', 7, 7); } },
  showa: { base: '#1d1b1a', fin: '#2a2725', paint: (g, R) => { patches(g, R, '#f4f0e8', 3, 0.36); patches(g, R, '#d2381e', 3, 0.26); } },
  tancho: { base: '#f7f4ee', fin: '#f3eee6', paint: g => { g.fillStyle = '#d8301c'; g.beginPath(); g.ellipse(128, 22, 26, 18, 0, 0, Math.PI * 2); g.fill(); } },
  ogon: { base: '#e7b23c', fin: '#efc560', metal: true, paint: (g, R) => scales(g, 'rgba(255,240,190,.35)') },
  chagoi: { base: '#c98a52', fin: '#d7a070', paint: (g, R) => scales(g, 'rgba(90,50,20,.25)') },
  asagi: { base: '#8aa0b4', fin: '#e6c9b3', paint: (g, R) => { scales(g, 'rgba(40,60,80,.45)'); g.fillStyle = 'rgba(224,106,44,.9)'; g.fillRect(0, 0, 40, 256); g.fillRect(216, 0, 40, 256); g.fillRect(0, 0, 256, 18); } },
  yamabuki: { base: '#f0c43a', fin: '#f5d466', metal: true, paint: (g, R) => scales(g, 'rgba(255,245,200,.3)') },
};
function patches(g, R, col, n, size) {
  g.fillStyle = col;
  for (let k = 0; k < n; k++) {
    const cy = 30 + k * (190 / n) + R() * 30, rx = 50 + R() * 50 * size * 3, ry = 20 + R() * 40 * size * 3, cx = 128 + (R() - 0.5) * 40;
    g.beginPath();
    for (let a = 0; a <= 24; a++) { const t = a / 24 * Math.PI * 2, w = 1 + (R() - 0.5) * 0.35; const x = cx + Math.cos(t) * rx * w, y = cy + Math.sin(t) * ry * w; a ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.closePath(); g.fill();
  }
}
function spots(g, R, col, n, r) { g.fillStyle = col; for (let k = 0; k < n; k++) { g.beginPath(); g.arc(128 + (R() - 0.5) * 110, 40 + R() * 180, r * (0.6 + R()), 0, Math.PI * 2); g.fill(); } }
function scales(g, col) { g.strokeStyle = col; g.lineWidth = 1.5; for (let y = 0; y < 256; y += 9) for (let x = (y / 9) % 2 ? 0 : 6; x < 256; x += 12) { g.beginPath(); g.arc(x, y, 6, 0.2, Math.PI - 0.2); g.stroke(); } }
const texCache = {};
function bodyTex(kind, seed) {
  const key = kind + seed; if (texCache[key]) return texCache[key];
  const V = VARIETIES[kind], R = rng(seed);
  return (texCache[key] = canvasTex(256, 256, g => {
    g.fillStyle = V.base; g.fillRect(0, 0, 256, 256);
    V.paint(g, R);
    // a paler belly and a darker spine line, then a faint net of scales over everything
    const b = g.createLinearGradient(0, 0, 256, 0); b.addColorStop(0, 'rgba(255,250,240,.55)'); b.addColorStop(0.3, 'rgba(255,250,240,0)'); b.addColorStop(0.7, 'rgba(255,250,240,0)'); b.addColorStop(1, 'rgba(255,250,240,.55)');
    g.fillStyle = b; g.fillRect(0, 0, 256, 256);
    scales(g, 'rgba(0,0,0,.06)');
    // the eyes, painted low on each side of the head (round the body: 0.25 and 0.75; along it: near the nose)
    for (const x of [64, 192]) { g.fillStyle = '#121212'; g.beginPath(); g.ellipse(x, 22, 7, 5, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(x - 2, 20, 2, 0, 7); g.fill(); }
  }));
}

// the swimming bend, shared by body and fins: a wave from head to tail, stronger toward the tail
function swimify(mat, u) {
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uT,uSpeed,uTurn;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float w=smoothstep(0.35,-0.75,transformed.z);
        transformed.x+=sin(transformed.z*7.5-uT*(5.0+uSpeed*7.0))*(0.025+0.05*uSpeed)*w+uTurn*transformed.z*transformed.z*0.9;`);
  };
  mat.customProgramCacheKey = () => 'koi-swim';
  return mat;
}

export const KOI_KINDS = Object.keys(VARIETIES);
// a fish about `len` metres long; returns its group and a swim(t, speed, turn) to call each frame
export function makeKoi(kind, len, seed = 1) {
  const V = VARIETIES[kind] || VARIETIES.kohaku, u = { uT: { value: 0 }, uSpeed: { value: 0.3 }, uTurn: { value: 0 } };
  const g = new THREE.Group(); g.scale.setScalar(len);
  const body = new THREE.Mesh(bodyGeo, swimify(new THREE.MeshPhongMaterial({ map: bodyTex(kind, seed), shininess: V.metal ? 90 : 45, specular: V.metal ? '#8a7440' : '#3a3a3a' }), u));
  const fm = swimify(new THREE.MeshLambertMaterial({ map: finTex, color: V.fin, transparent: true, opacity: 0.78, side: THREE.DoubleSide, depthWrite: false }), u);
  g.add(body, new THREE.Mesh(FINS, fm));
  g.traverse(o => { if (o.isMesh) o.castShadow = false; });
  return {
    g, u,
    swim(t, speed, turn) { u.uT.value = t; u.uSpeed.value = speed; u.uTurn.value = turn; },
  };
}
