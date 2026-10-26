import * as THREE from 'three';
import { C, clamp, rng, smooth } from '../core/util.js';
import { groundH, riverDist } from './terrain.js';
import { scene } from './renderer.js';
import { groundTex } from './textures.js';
import { DS } from './geometry.js';

/* ================= ground ================= */
export const groundMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: groundTex });
groundMat.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#ifdef USE_MAP\n vec4 t1 = texture2D( map, vUv ); vec4 t2 = texture2D( map, vUv * 0.23 + vec2( 0.37, 0.11 ) ); vec4 texelColor = mix( t1, t2, 0.45 ); texelColor = mapTexelToLinear( texelColor ); diffuseColor *= texelColor;\n#endif'); };
groundMat.customProgramCacheKey = () => 'ground2';
export let groundMesh;
// the ground's grid is squeezed toward the centre (fine in the garden, coarse far out) and reaches r ≈ 208,
// where it dips under the hills, so no gap shows between them even from high above
const GSEG = 260, K = 0.000688, remap = u => u * (1 + K * u * u);
let gH0 = null;
// the exact height of the ground mesh as drawn (its triangles, not groundH), for things laid on it far out
export function groundMeshH(x, z) {
  const inv = v => { let u = v; for (let k = 0; k < 8; k++) u -= (u + K * u * u * u - v) / (1 + 3 * K * u * u); return u; };
  const ux = inv(x), uz = inv(z), cs = 120 / GSEG, gx = (ux + 60) / cs, gz = (uz + 60) / cs;
  if (gx < 0 || gz < 0 || gx >= GSEG || gz >= GSEG) return groundH(x, z);
  const ix = Math.floor(gx), iz = Math.floor(gz), X0 = remap(ix * cs - 60), X1 = remap((ix + 1) * cs - 60), Z0 = remap(iz * cs - 60), Z1 = remap((iz + 1) * cs - 60);
  const fx = (x - X0) / (X1 - X0), fz = (z - Z0) / (Z1 - Z0), W = GSEG + 1;
  const ha = gH0[iz * W + ix], hb = gH0[(iz + 1) * W + ix], hc = gH0[(iz + 1) * W + ix + 1], hd = gH0[iz * W + ix + 1];
  return fx + fz <= 1 ? ha + (hd - ha) * fx + (hb - ha) * fz : hc + (hb - hc) * (1 - fx) + (hd - hc) * (1 - fz);
}
(function buildGround() {
  const g = new THREE.PlaneGeometry(120, 120, GSEG, GSEG); g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position, uv = g.attributes.uv, col = new Float32Array(pos.count * 3);
  const cA = C('#68834a'), cB = C('#7b8a55'), cBank = C('#7a7458'), cMud = C('#4f4a3a'), cD = C('#729c4b') /* the outer lawn stays green (it read as bare earth) */, cHill = C('#5d7440'), t = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = remap(pos.getX(i)), z = remap(pos.getZ(i)), r = Math.hypot(x, z), y = groundH(x, z);
    pos.setXYZ(i, x, y, z); uv.setXY(i, x / 3.2, z / 3.2);
    const n = Math.sin(x * 0.21) * Math.cos(z * 0.17) * 0.5 + 0.5 + Math.sin(x * 0.9 + z * 0.7) * 0.08;
    const dry = smooth(0.55, 0.95, Math.sin(x * 0.047 + 2) * Math.cos(z * 0.061 + 1) * 0.5 + 0.5 + Math.sin(x * 0.17 - z * 0.13) * 0.2), lush = smooth(0.6, 1, Math.cos(x * 0.083 - 1) * Math.sin(z * 0.071 + 3) * 0.5 + 0.5);
    t.copy(cA).lerp(cB, clamp(n, 0, 1) * 0.7).lerp(C('#7f8f52'), dry * 0.15).lerp(C('#5a7d3e'), lush * 0.3);
    t.lerp(cD, smooth(34, 56, r) * 0.8).lerp(cHill, smooth(80, 140, r) * 0.6);
    // banks and mud only by the water (low dips in the lawn stay lawn; they read as dark patches)
    const wet = Math.max(1 - smooth(9, 13, r), 1 - smooth(3, 6, riverDist(x, z)), smooth(95, 110, r));
    t.lerp(cBank, smooth(0.35, -0.25, y) * 0.85 * wet);
    t.lerp(cMud, smooth(-0.3, -0.7, y) * wet);
    col[i * 3] = t.r; col[i * 3 + 1] = t.g; col[i * 3 + 2] = t.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  gH0 = new Float32Array(pos.count); for (let i = 0; i < pos.count; i++) gH0[i] = pos.getY(i);
  g.computeVertexNormals();
  groundMesh = new THREE.Mesh(g, groundMat); groundMesh.receiveShadow = true; scene.add(groundMesh);
})();

/* far mountains: green, forested hills all round, in 3D and lit by the sun, lower where Fuji stands */
// Smooth rolling ranges (not the sharp alpine peaks the owner turned down): deep forest green in the
// folds, fresher green on the ridges, a little meadow and rock, and only a light haze with distance.
export const mountainU = [], mountainMeshes = [];
(function buildHills() {
  const R = rng(31), perm = new Uint8Array(512); { const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) perm[i] = p[i & 255]; }
  const sm = t => t * t * (3 - 2 * t), hs = (x, y) => perm[(perm[x & 255] + y) & 255] / 255;
  const vn = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), u = sm(x - xi), v = sm(y - yi); return (hs(xi, yi) * (1 - u) + hs(xi + 1, yi) * u) * (1 - v) + (hs(xi, yi + 1) * (1 - u) + hs(xi + 1, yi + 1) * u) * v; };
  const fbm = (x, y) => { let s = 0, a = 0.5, f = 1; for (let o = 0; o < 5; o++) { s += vn(x * f, y * f) * a; a *= 0.5; f *= 2.02; } return s; };
  const FUJI_A = Math.atan2(-1000, -210), R0 = 190, R1 = 520, SEG = 360, RINGS = 48, pos = [], idx = [];
  for (let i = 0; i <= RINGS; i++) {
    const r = R0 + (R1 - R0) * Math.pow(i / RINGS, 0.85);
    for (let k = 0; k <= SEG; k++) {
      const a = k / SEG * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const env = THREE.MathUtils.smoothstep(r, R0, R0 + 70) * (1 - THREE.MathUtils.smoothstep(r, R1 - 90, R1));
      const da = Math.atan2(Math.sin(a - FUJI_A), Math.cos(a - FUJI_A)), low = 0.3 + 0.7 * THREE.MathUtils.smoothstep(Math.abs(da), 0.35, 0.8);
      const h = Math.pow(fbm(x / 170, z / 170), 1.5) * 190 * env * low * (0.55 + 0.45 * THREE.MathUtils.smoothstep(r, R0, R1)) - 6;
      pos.push(x, h, z);
      if (i < RINGS && k < SEG) { const b = i * (SEG + 1) + k; idx.push(b, b + SEG + 1, b + 1, b + 1, b + SEG + 1, b + SEG + 2); }
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const u = { uHor: { value: new THREE.Color() }, uNight: { value: 0 }, uDusk: { value: 0 }, uLight: { value: new THREE.Vector3(0.6, 0.45, 0.6) } };
  mountainU.push(u);
  const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: u, fog: false,
    vertexShader: 'varying vec3 vW,vN;void main(){vW=(modelMatrix*vec4(position,1.)).xyz;vN=normal;gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.);}',
    fragmentShader: `uniform vec3 uHor,uLight;uniform float uNight,uDusk;varying vec3 vW,vN;
      float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float nz(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1,0)),u.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),u.x),u.y);}
      void main(){
        vec3 n=normalize(vN);float lam=max(dot(n,normalize(uLight)),0.);
        // forest: a dappled canopy of tree crowns, darker in the folds, fresher on the ridges
        float trees=nz(vW.xz*.35)*.55+nz(vW.xz*1.3)*.45,hgt=clamp(vW.y/110.,0.,1.);
        vec3 deep=vec3(.12,.34,.12),fresh=vec3(.34,.62,.2),meadow=vec3(.52,.72,.3);
        vec3 c=mix(deep,fresh,smoothstep(.25,.85,trees*.6+hgt*.5));
        c=mix(c,meadow,smoothstep(.62,.8,nz(vW.xz*.02)+hgt*.25)*.45); // open meadows on some high slopes
        c=mix(c,vec3(.4,.42,.34),smoothstep(.3,.12,n.y)*.35);           // a little rock on the very steepest faces
        c*=.55+.85*lam;c=mix(c,c*vec3(1.25,.9,.85),uDusk*.6);
        c*=mix(1.,.15,uNight);
        float d=length(vW.xz-cameraPosition.xz);c=mix(c,uHor,clamp(smoothstep(260.,700.,d)*.3,0.,.3)); // a light haze only
        gl_FragColor=vec4(c,1.);
      }` }));
  scene.add(m); mountainMeshes.push(m);
})();

