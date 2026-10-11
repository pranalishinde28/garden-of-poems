import * as THREE from 'three';
import { C, V3, rng, smooth } from '../core/util.js';
import { barkTex } from './textures.js';

/* ---------- geometry helpers ---------- */
function GEO_base(geo) { geo.translate(0, 0.5, 0); return geo; }
function makePetalGeo() {
  const g = new THREE.PlaneGeometry(1, 1, 6, 3), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + 0.5, y = p.getY(i), w = 0.42 * Math.sin(Math.PI * Math.pow(x, 0.7)), yy = y * 2 * w;
    p.setXYZ(i, x, 0.12 * x * x + 0.35 * yy * yy, yy);
  }
  g.computeVertexNormals(); return g;
}
export function rockGeo(seed) {
  const g = new THREE.IcosahedronGeometry(1, 2), p = g.attributes.position, R = rng(seed), cols = [], v = new V3();
  const f = [R() * 9, R() * 9, R() * 9];
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 1 + 0.18 * Math.sin(v.x * 3 + f[0]) * Math.cos(v.z * 2.6 + f[1]) + 0.08 * Math.sin(v.y * 5 + f[2]);
    v.multiplyScalar(k); if (v.y < -0.2) v.y = -0.2 - (v.y + 0.2) * 0.2; p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const n = g.attributes.normal, grey = C('#8d8a82'), moss = C('#5f7a3c'), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { c.copy(grey).offsetHSL(0, 0, (R() - .5) * 0.06); c.lerp(moss, smooth(0.45, 0.85, n.getY(i)) * 0.85); cols.push(c.r, c.g, c.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  return g;
}
export const GEO = {
  sph: new THREE.SphereGeometry(1, 14, 10),
  ico: new THREE.IcosahedronGeometry(1, 2),
  cylB: GEO_base(new THREE.CylinderGeometry(1, 1, 1, 8, 1)),
  hexB: GEO_base(new THREE.CylinderGeometry(1, 1, 1, 6, 1)),
  cone: GEO_base(new THREE.ConeGeometry(1, 1, 7)),
  pyr: GEO_base(new THREE.ConeGeometry(1, 1, 4)),
  pyr6: GEO_base(new THREE.ConeGeometry(1, 1, 6)),
  box: new THREE.BoxGeometry(1, 1, 1),
  dode: new THREE.DodecahedronGeometry(1, 0),
  half: new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  disc: new THREE.CircleGeometry(1, 22).rotateX(-Math.PI / 2),
  petal: makePetalGeo(),
  card: new THREE.PlaneGeometry(1, 1),
  flatPetal: new THREE.PlaneGeometry(0.055, 0.04).rotateX(-Math.PI / 2)
};
export const SHARED = new Set(Object.values(GEO));
const matCache = {};
export function M(color, opts) { const k = color + (opts ? JSON.stringify(opts) : ''); return matCache[k] || (matCache[k] = new THREE.MeshLambertMaterial(Object.assign({ color }, opts || {}))); }
export const VC = new THREE.MeshLambertMaterial({ vertexColors: true });
export const VCP = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#3a1c24' });
export const BARK = new THREE.MeshLambertMaterial({ vertexColors: true, map: barkTex });
export const DS = THREE.DoubleSide;
export function part(parent, geo, mat, p, s, r) {
  const m = new THREE.Mesh(geo, mat);
  if (p) m.position.set(p[0], p[1], p[2]);
  if (s !== undefined) { if (typeof s === 'number') m.scale.setScalar(s); else m.scale.set(s[0], s[1], s[2]); }
  if (r) m.rotation.set(r[0], r[1], r[2]);
  parent.add(m); return m;
}
export const UP = new V3(0, 1, 0);
export function limb(g, a, b, r0, r1, mat) {
  const d = new V3().subVectors(b, a), L = d.length();
  const geo = new THREE.CylinderGeometry(r1, r0, L, 6, 1); geo.translate(0, L / 2, 0);
  const m = new THREE.Mesh(geo, mat); m.position.copy(a); m.quaternion.setFromUnitVectors(UP, d.normalize()); g.add(m); return m;
}
/* merged geometry builder: many parts → one draw call */
export function Merge() { this.parts = []; }
Merge.prototype.limb = function (a, b, r0, r1, color) {
  const d = new V3().subVectors(b, a), L = d.length(); if (L < 1e-4) return;
  const geo = new THREE.CylinderGeometry(r1, r0, L, 7, 2); geo.translate(0, L / 2, 0);
  const m = new THREE.Matrix4().compose(a, new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()), new V3(1, 1, 1));
  this.parts.push({ geo, m, c: color, own: true, uvS: [Math.max(1, Math.round(r0 * 14)), L / 0.9] });
};
Merge.prototype.add = function (geo, pos, scale, color, quat) {
  const m = new THREE.Matrix4().compose(pos, quat || new THREE.Quaternion(), scale);
  this.parts.push({ geo, m, c: color, uvS: [1, 1] });
};
Merge.prototype.build = function () {
  if (!this.parts.length) return null;
  let vc = 0, ic = 0;
  this.parts.forEach(p => { vc += p.geo.attributes.position.count; ic += p.geo.index ? p.geo.index.count : p.geo.attributes.position.count; });
  const pos = new Float32Array(vc * 3), nor = new Float32Array(vc * 3), col = new Float32Array(vc * 3), uvs = new Float32Array(vc * 2), idx = new Uint32Array(ic);
  let vo = 0, io = 0; const v = new V3(), nm = new THREE.Matrix3();
  this.parts.forEach(p => {
    const P = p.geo.attributes.position, N = p.geo.attributes.normal, gc = p.geo.attributes.color, U = p.geo.attributes.uv; nm.getNormalMatrix(p.m);
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(p.m); pos[(vo + i) * 3] = v.x; pos[(vo + i) * 3 + 1] = v.y; pos[(vo + i) * 3 + 2] = v.z;
      v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor[(vo + i) * 3] = v.x; nor[(vo + i) * 3 + 1] = v.y; nor[(vo + i) * 3 + 2] = v.z;
      if (U) { uvs[(vo + i) * 2] = U.getX(i) * p.uvS[0]; uvs[(vo + i) * 2 + 1] = U.getY(i) * p.uvS[1]; }
      const c = p.c; col[(vo + i) * 3] = gc ? gc.getX(i) : c.r; col[(vo + i) * 3 + 1] = gc ? gc.getY(i) : c.g; col[(vo + i) * 3 + 2] = gc ? gc.getZ(i) : c.b;
    }
    if (p.geo.index) { for (let i = 0; i < p.geo.index.count; i++) idx[io + i] = p.geo.index.getX(i) + vo; io += p.geo.index.count; }
    else { for (let i = 0; i < P.count; i++) idx[io + i] = vo + i; io += P.count; }
    vo += P.count; if (p.own) p.geo.dispose();
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeBoundingSphere();
  return g;
};

