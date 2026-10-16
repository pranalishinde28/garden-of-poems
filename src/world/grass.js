import * as THREE from 'three';
import { C, V3, isTouch, rng } from '../core/util.js';
import { RIVER, WATER_Y, bridgeH, groundH, riverDist } from './terrain.js';
import { scene } from './renderer.js';
import { windify } from './wind.js';
import { GEO } from './geometry.js';
import { BENCH, inTulip, stoneNear } from './paths.js';

/* ================= grass ================= */
export const grassChunks = [];
const wildflowers = { m: null };
export const trampleU = { uPlayer: { value: new V3(0, 0, -999) } };
export let grassMat;
(function buildGrass() {
  const R0 = rng(5), pos = [], col = [], nrm = [], idx = [];
  const base = C('#3f5a2c'), mid = C('#71894a'), tip = C('#bcc48e'), dry = C('#b9ae78'); let vo = 0;
  for (let b = 0; b < 5; b++) {
    const ang = R0() * 6.28, lean = 0.12 + R0() * 0.42, h = 0.75 + R0() * 0.35, w = 0.034 + R0() * 0.018;
    const ox = (R0() - .5) * 0.16, oz = (R0() - .5) * 0.16, dx = Math.cos(ang), dz = Math.sin(ang), sx = -dz, sz = dx, tint = R0();
    for (let i = 0; i <= 4; i++) {
      const v = i / 4, bend = lean * v * v, cx = ox + dx * bend, cz = oz + dz * bend, y = h * v * (1 - 0.22 * lean * v), ww = w * Math.pow(1 - v, 0.7);
      pos.push(cx - sx * ww, y, cz - sz * ww, cx + sx * ww, y, cz + sz * ww);
      const c = (v < 0.5 ? base.clone().lerp(mid, v * 2) : mid.clone().lerp(tip, (v - 0.5) * 2)).lerp(dry, tint * 0.3 * v);
      col.push(c.r, c.g, c.b, c.r, c.g, c.b); nrm.push(0, 1, 0, 0, 1, 0);
    }
    for (let i = 0; i < 4; i++) { const a = vo + 2 * i; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2, a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    vo += 10;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx); g.boundingSphere = new THREE.Sphere(new V3(0, 0.5, 0), 17);
  grassMat = windify(new THREE.MeshLambertMaterial({ vertexColors: true }), 0.12, 'blade');
  // the grass bends down where you walk (trampleU.uPlayer follows you; core/loop.js)
  const wind = grassMat.onBeforeCompile;
  grassMat.onBeforeCompile = sh => {
    wind(sh); sh.uniforms.uPlayer = trampleU.uPlayer;
    sh.vertexShader = 'uniform vec3 uPlayer;\n' + sh.vertexShader.replace('transformed.z+=wv', 'float press=smoothstep(1.4,0.25,length(ip-uPlayer.xz));transformed.y*=1.0-press*0.7;transformed.z+=wv');
  };
  grassMat.customProgramCacheKey = () => 'grass-trample';
  const total = isTouch ? 8500 : 23000, CELL = 22, R = rng(3), chunks = new Map();
  const tints = ['#ffffff', '#eef3dd', '#dfe8cc', '#f6efcf', '#d9e4d4'].map(C);
  for (let i = 0; i < total; i++) {
    const a = R() * Math.PI * 2, r = 7.8 + Math.sqrt(R()) * 66, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (groundH(x, z) < WATER_Y + 0.12) continue;
    if (stoneNear(x, z, 0.5) || inTulip(x, z, 0.15)) continue;
    if (Math.hypot(x - BENCH.x, z - BENCH.z) < 1.4) continue;
    const key = Math.floor(x / CELL) + ',' + Math.floor(z / CELL);
    if (!chunks.has(key)) chunks.set(key, { cx: (Math.floor(x / CELL) + 0.5) * CELL, cz: (Math.floor(z / CELL) + 0.5) * CELL, items: [] });
    const meadow = Math.abs(Math.atan2(Math.sin(a - 0.25), Math.cos(a - 0.25))) < 0.7 && r > 14;
    // ankle-high: it was knee-high and filled the view when walking
    chunks.get(key).items.push({ x, z, h: (0.15 + R() * 0.13) * (meadow ? 1.15 : 1) * (r > 40 ? 1.15 : 1), w: 0.9 + R() * 0.6, ry: R() * 6.28, c: tints[Math.floor(R() * tints.length)] });
  }
  const d = new THREE.Object3D();
  chunks.forEach(ch => {
    const m = new THREE.InstancedMesh(g, grassMat, ch.items.length);
    m.position.set(ch.cx, 0, ch.cz);
    ch.items.forEach((it, i) => {
      d.position.set(it.x - ch.cx, groundH(it.x, it.z) - 0.03, it.z - ch.cz); d.rotation.set(0, it.ry, 0); d.scale.set(it.w, it.h, it.w);
      d.updateMatrix(); m.setMatrixAt(i, d.matrix); m.setColorAt(i, it.c);
    });
    m.receiveShadow = true; m.layers.set(2); scene.add(m);
    grassChunks.push({ m, cx: ch.cx, cz: ch.cz, items: ch.items });
  });

  // wildflowers
  const FN = isTouch ? 500 : 1300;
  const fm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.04, 1), windify(new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x1a1a1a }), 0.06, 'const'), FN);
  const fc = ['#f6f1e6', '#f2c4d2', '#c6b6e6', '#bfd2ea', '#f3e19c', '#ffffff'].map(C);
  for (let i = 0; i < FN; i++) {
    let x, z, r, a, tries = 0;
    do { a = R() * 6.28; r = 10 + Math.sqrt(R()) * 58; x = Math.cos(a) * r; z = Math.sin(a) * r; tries++; } while ((stoneNear(x, z, 0.6) || inTulip(x, z, 0.3) || riverDist(x, z) < 2.4) && tries < 6);
    d.position.set(x, groundH(x, z) + 0.22 + R() * 0.25, z); d.rotation.set(R(), R(), R()); d.scale.set(1, 0.6, 1).multiplyScalar(0.7 + R() * 0.7);
    d.updateMatrix(); fm.setMatrixAt(i, d.matrix); fm.setColorAt(i, fc[Math.floor(R() * fc.length)]);
  }
  fm.frustumCulled = false; fm.layers.set(2); scene.add(fm); wildflowers.m = fm;

  // reeds along the pond and river
  // fewer, leaning every way and of every height, a deeper green, and cattails on some (they were even rows of sticks)
  const RN = 170, rm = new THREE.InstancedMesh(GEO.cone, windify(new THREE.MeshLambertMaterial({ color: '#58703a' }), 0.1, 'blade'), RN);
  const cat = new THREE.InstancedMesh(GEO.sph, new THREE.MeshLambertMaterial({ color: '#6a4a2c' }), RN); let ci = 0;
  let ri = 0;
  for (let i = 0; i < RN * 3 && ri < RN; i++) {
    let x, z;
    if (R() < 0.55) { const a = R() * 6.28, r = 7.0 + R() * 1.5; x = Math.cos(a) * r; z = Math.sin(a) * r; }
    else { const p = RIVER[5 + Math.floor(R() * 60)], side = R() < .5 ? -1 : 1, o = 1.3 + R() * 0.9; const a = R() * 6.28; x = p.x + Math.cos(a) * o * side; z = p.z + Math.sin(a) * o; }
    const y = groundH(x, z); if (y > WATER_Y + 0.35 || y < WATER_Y - 0.45 || stoneNear(x, z, 0.6) || bridgeH(x, z) !== null) continue;
    const tx = (R() - .5) * 0.4, tz = (R() - .5) * 0.4, hgt = 0.6 + Math.pow(R(), 1.6) * 1.3;
    d.position.set(x, y - 0.05, z); d.rotation.set(tx, R() * 6.28, tz); d.scale.set(0.016, hgt, 0.016);
    d.updateMatrix(); rm.setMatrixAt(ri++, d.matrix);
    if (R() < 0.22) { const top = new THREE.Vector3(0, hgt * 0.82, 0).applyEuler(new THREE.Euler(tx, 0, tz)); d.position.set(x + top.x, y - 0.05 + top.y, z + top.z); d.scale.set(0.03, 0.11, 0.03); d.updateMatrix(); cat.setMatrixAt(ci++, d.matrix); }
  }
  rm.count = ri; rm.frustumCulled = false; scene.add(rm);
  cat.count = ci; cat.frustumCulled = false; scene.add(cat);
})();
// nothing grows inside a pool, a court or a floor: grass and wildflowers within rad go (modules built later
// call this for what they lay down, since the grass is planted first)
export function clearArea(x, z, rad) {
  const d = new THREE.Object3D(), zero = new THREE.Matrix4().makeScale(0, 0, 0), v = new THREE.Vector3();
  grassChunks.forEach(ch => {
    if (Math.abs(ch.cx - x) > 12 + rad || Math.abs(ch.cz - z) > 12 + rad) return;
    let changed = false;
    ch.items.forEach((it, i) => { if (Math.hypot(it.x - x, it.z - z) < rad) { ch.m.setMatrixAt(i, zero); it.cut = true; changed = true; } });
    if (changed) ch.m.instanceMatrix.needsUpdate = true;
  });
  const fm = wildflowers.m; if (!fm) return;
  for (let i = 0; i < fm.count; i++) { fm.getMatrixAt(i, d.matrix); v.setFromMatrixPosition(d.matrix); if (Math.hypot(v.x - x, v.z - z) < rad) fm.setMatrixAt(i, zero); }
  fm.instanceMatrix.needsUpdate = true;
}
// the same for a rectangle w × d centred at (x, z), turned by ry (a court or a gravel yard)
export function clearRect(x, z, w, d, ry) {
  const c = Math.cos(ry), s = Math.sin(ry), zero = new THREE.Matrix4().makeScale(0, 0, 0), m4 = new THREE.Matrix4(), v = new THREE.Vector3();
  const inside = (px, pz) => { const dx = px - x, dz = pz - z, lx = dx * c - dz * s, lz = dx * s + dz * c; return Math.abs(lx) < w / 2 && Math.abs(lz) < d / 2; };
  grassChunks.forEach(ch => { let changed = false; ch.items.forEach((it, i) => { if (inside(it.x, it.z)) { ch.m.setMatrixAt(i, zero); it.cut = true; changed = true; } }); if (changed) ch.m.instanceMatrix.needsUpdate = true; });
  const fm = wildflowers.m; if (fm) { for (let i = 0; i < fm.count; i++) { fm.getMatrixAt(i, m4); v.setFromMatrixPosition(m4); if (inside(v.x, v.z)) fm.setMatrixAt(i, zero); } fm.instanceMatrix.needsUpdate = true; }
}
export function clearGrass(x, z, rad) {
  const d = new THREE.Object3D();
  grassChunks.forEach(ch => {
    if (Math.abs(ch.cx - x) > 12 + rad || Math.abs(ch.cz - z) > 12 + rad) return;
    let changed = false;
    ch.items.forEach((it, i) => {
      const q = Math.hypot(it.x - x, it.z - z); if (q > rad || it.cut) return;
      it.cut = true; changed = true;
      d.position.set(it.x - ch.cx, groundH(it.x, it.z) - 0.03, it.z - ch.cz); d.rotation.set(0, it.ry, 0); d.scale.set(it.w, it.h * (0.25 + 0.5 * q / rad), it.w);
      d.updateMatrix(); ch.m.setMatrixAt(i, d.matrix);
    });
    if (changed) ch.m.instanceMatrix.needsUpdate = true;
  });
}

