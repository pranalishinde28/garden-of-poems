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
  const cA = C('#5f7843'), cB = C('#7b8a55'), cBank = C('#7a7458'), cMud = C('#4f4a3a'), cD = C('#3d5634'), cHill = C('#5d7440'), t = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = remap(pos.getX(i)), z = remap(pos.getZ(i)), r = Math.hypot(x, z), y = groundH(x, z);
    pos.setXYZ(i, x, y, z); uv.setXY(i, x / 3.2, z / 3.2);
    const n = Math.sin(x * 0.21) * Math.cos(z * 0.17) * 0.5 + 0.5 + Math.sin(x * 0.9 + z * 0.7) * 0.08;
    const dry = smooth(0.55, 0.95, Math.sin(x * 0.047 + 2) * Math.cos(z * 0.061 + 1) * 0.5 + 0.5 + Math.sin(x * 0.17 - z * 0.13) * 0.2), lush = smooth(0.6, 1, Math.cos(x * 0.083 - 1) * Math.sin(z * 0.071 + 3) * 0.5 + 0.5);
    t.copy(cA).lerp(cB, clamp(n, 0, 1) * 0.7).lerp(C('#8d8a5a'), dry * 0.35).lerp(C('#3f6234'), lush * 0.3);
    t.lerp(cD, smooth(40, 75, r) * 0.6).lerp(cHill, smooth(80, 140, r) * 0.6);
    t.lerp(cBank, smooth(0.35, -0.25, y) * 0.85);
    t.lerp(cMud, smooth(-0.3, -0.7, y));
    col[i * 3] = t.r; col[i * 3 + 1] = t.g; col[i * 3 + 2] = t.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  groundMesh = new THREE.Mesh(g, groundMat); groundMesh.receiveShadow = true; scene.add(groundMesh);
})();

/* far mountains: an alpine range all round, low where Fuji stands so it rises behind them */
// Ridged noise gives sharp crests and steep faces; snow lies on the high, gentler slopes; the range fades
// into the sky with distance (its own haze, out of the garden's fog) and turns rose at sunset.
export const mountainU = [], mountainMeshes = [];
(function buildAlps() {
  const R = rng(17), perm = new Uint8Array(512); { const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) perm[i] = p[i & 255]; }
  const fade = t => t * t * (3 - 2 * t), hsh = (x, y) => perm[(perm[x & 255] + y) & 255] / 255;
  const vn = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = fade(xf), v = fade(yf); return (hsh(xi, yi) * (1 - u) + hsh(xi + 1, yi) * u) * (1 - v) + (hsh(xi, yi + 1) * (1 - u) + hsh(xi + 1, yi + 1) * u) * v; };
  const ridged = (x, y) => { let s = 0, a = 0.55, f = 1, w = 1; for (let o = 0; o < 6; o++) { let n = 1 - Math.abs(vn(x * f, y * f) * 2 - 1); n *= n; n *= w; w = Math.min(1, n * 2); s += n * a; a *= 0.5; f *= 2.05; } return s; };
  const FUJI_A = Math.atan2(-1000, -210); // the direction Fuji stands in
  const R0 = 240, R1 = 560, SEG = 420, RINGS = 56, pos = [], idx = [];
  for (let i = 0; i <= RINGS; i++) {
    const r = R0 + (R1 - R0) * Math.pow(i / RINGS, 0.9);
    for (let k = 0; k <= SEG; k++) {
      const a = k / SEG * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const env = THREE.MathUtils.smoothstep(r, R0, R0 + 90) * (1 - THREE.MathUtils.smoothstep(r, R1 - 110, R1));
      const da = Math.atan2(Math.sin(a - FUJI_A), Math.cos(a - FUJI_A)), low = 0.22 + 0.78 * THREE.MathUtils.smoothstep(Math.abs(da), 0.42, 0.85);
      const h = (Math.pow(ridged(x / 190, z / 190), 1.35) * 260 + vn(x / 55, z / 55) * 16) * env * low - 6; // sharper, higher crests
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
        // rock: blue-grey granite with darker gullies; meadow green low down
        float g=nz(vW.xz*.06)*.6+nz(vW.xz*.25)*.4;
        vec3 rock=mix(vec3(.33,.36,.41),vec3(.48,.5,.54),g);rock=mix(vec3(.3,.38,.27),rock,smoothstep(8.,40.,vW.y));
        // snow where it is high and not too steep, with a ragged snowline and streaks down the couloirs
        float line=46.+(nz(vW.xz*.03)-.5)*30.;float snow=smoothstep(line-5.,line+8.,vW.y+(g-.5)*24.)*smoothstep(.1,.36,n.y+.14*sin(vW.x*.2+vW.z*.17)+(g-.5)*.25);
        snow=max(snow,smoothstep(line+60.,line+90.,vW.y)*.9); // the summits are white
        vec3 snowC=mix(vec3(.62,.7,.86),vec3(.97,.98,1.),lam);snowC=mix(snowC,vec3(1.,.72,.68)*(.65+.45*lam),uDusk*.85);
        // faces turned from the sun drop into cool blue shadow, which gives the range its depth
        vec3 c=mix(rock*(.28+.95*lam)*mix(vec3(.82,.88,1.05),vec3(1.),lam),snowC*(.72+.32*lam),snow);
        c*=mix(1.,.16,uNight);
        // distance: the range fades into the sky's haze
        float d=length(vW.xz-cameraPosition.xz);c=mix(c,uHor,clamp(smoothstep(260.,700.,d)*.55+.04,0.,1.));
        gl_FragColor=vec4(c,1.);
      }` }));
  m.renderOrder = -0.5; scene.add(m); mountainMeshes.push(m);
})();

