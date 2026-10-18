import * as THREE from 'three';
import { C, clamp, rng, smooth } from '../core/util.js';
import { groundH } from './terrain.js';
import { scene } from './renderer.js';
import { groundTex } from './textures.js';
import { DS } from './geometry.js';

/* ================= ground ================= */
export const groundMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: groundTex });
groundMat.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#ifdef USE_MAP\n vec4 t1 = texture2D( map, vUv ); vec4 t2 = texture2D( map, vUv * 0.23 + vec2( 0.37, 0.11 ) ); vec4 texelColor = mix( t1, t2, 0.45 ); texelColor = mapTexelToLinear( texelColor ); diffuseColor *= texelColor;\n#endif'); };
groundMat.customProgramCacheKey = () => 'ground2';
export let groundMesh;
(function buildGround() {
  const g = new THREE.PlaneGeometry(120, 120, 230, 230); g.rotateX(-Math.PI / 2);
  const K = 0.000463, remap = u => u * (1 + K * u * u);
  const pos = g.attributes.position, uv = g.attributes.uv, col = new Float32Array(pos.count * 3);
  const cA = C('#5f7843'), cB = C('#7b8a55'), cBank = C('#7a7458'), cMud = C('#4f4a3a'), cD = C('#5a8040') /* the outer lawn stays green (it read as bare earth) */, cHill = C('#5d7440'), t = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = remap(pos.getX(i)), z = remap(pos.getZ(i)), r = Math.hypot(x, z), y = groundH(x, z);
    pos.setXYZ(i, x, y, z); uv.setXY(i, x / 3.2, z / 3.2);
    const n = Math.sin(x * 0.21) * Math.cos(z * 0.17) * 0.5 + 0.5 + Math.sin(x * 0.9 + z * 0.7) * 0.08;
    const dry = smooth(0.55, 0.95, Math.sin(x * 0.047 + 2) * Math.cos(z * 0.061 + 1) * 0.5 + 0.5 + Math.sin(x * 0.17 - z * 0.13) * 0.2), lush = smooth(0.6, 1, Math.cos(x * 0.083 - 1) * Math.sin(z * 0.071 + 3) * 0.5 + 0.5);
    t.copy(cA).lerp(cB, clamp(n, 0, 1) * 0.7).lerp(C('#8d8a5a'), dry * 0.35).lerp(C('#3f6234'), lush * 0.3);
    t.lerp(cD, smooth(40, 75, r) * 0.5).lerp(cHill, smooth(80, 140, r) * 0.6);
    t.lerp(cBank, smooth(0.35, -0.25, y) * 0.85);
    t.lerp(cMud, smooth(-0.3, -0.7, y));
    col[i * 3] = t.r; col[i * 3 + 1] = t.g; col[i * 3 + 2] = t.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  groundMesh = new THREE.Mesh(g, groundMat); groundMesh.receiveShadow = true; scene.add(groundMesh);
})();

/* far mountains, hazed into the sky (the owner preferred these to an alpine range beside Fuji) */
export const mountainU = [], mountainMeshes = [];
(function buildMountains() {
  [{ r: 300, h: 70, col: '#71869b', haze: 0.5, seed: 3 }, { r: 220, h: 42, col: '#4d6457', haze: 0.3, seed: 8 }].forEach(L => {
    const seg = 220, pos = [], vt = [], idx = [], R = rng(L.seed), ph = [R() * 6, R() * 6, R() * 6, R() * 6];
    for (let i = 0; i <= seg; i++) {
      const a = i / seg * Math.PI * 2;
      const hh = L.h * (0.5 + 0.28 * Math.sin(a * 3 + ph[0]) + 0.16 * Math.sin(a * 7 + ph[1]) + 0.07 * Math.sin(a * 17 + ph[2]) + 0.03 * Math.sin(a * 41 + ph[3]));
      pos.push(Math.cos(a) * L.r, -8, Math.sin(a) * L.r, Math.cos(a) * L.r, hh, Math.sin(a) * L.r); vt.push(0, 1);
      if (i < seg) { const b = i * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aT', new THREE.Float32BufferAttribute(vt, 1)); g.setIndex(idx);
    const u = { uCol: { value: C(L.col) }, uHor: { value: new THREE.Color() }, uHaze: { value: L.haze }, uNight: { value: 0 } };
    mountainU.push(u);
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: u, side: DS, fog: false,
      vertexShader: 'attribute float aT;varying float vT;void main(){vT=aT;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'uniform vec3 uCol,uHor;uniform float uHaze,uNight;varying float vT;void main(){vec3 c=uCol*(0.8+0.3*vT)*mix(1.,0.2,uNight);c=mix(c,uHor,clamp(uHaze+(1.-vT)*0.35,0.,1.));gl_FragColor=vec4(c,1.);}' }));
    scene.add(m); mountainMeshes.push(m);
  });
})();

