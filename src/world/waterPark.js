import * as THREE from 'three';
import { $, C, V3, clamp, lerp, rng, smooth } from '../core/util.js';
import { state, T } from '../core/state.js';
import { canvasTex } from './textures.js';
import { GEO, Merge } from './geometry.js';
import { nightLit } from './architecture.js';
import { worlds } from '../core/worlds.js';
import { addTick, regThing } from '../core/things.js';
import { late, provide } from '../core/late.js';
import { BOWL, LAGOON, O, SUN_PLAN, WP, lagoonE, rides, skyU, sun, sunH, sunScene, waterU, wpE } from './sunWorld.js';

/* ================= Splash Cove: the water park in the secret world ================= */
// East of the sunflowers: a wave pool with a sandy beach, a slide tower whose long yellow flume twists down into
// a splash pool, and jet skis out on the fair's lagoon. Three rides: slide down (the speed is real, from the
// flume's slope; the end takes you under the water for a moment), float on a ring in the waves, or drive a jet
// ski yourself (W, A, D) with spray and a wake. The pools' water moves: waves lift the surface, light ripples
// over the pool floor, foam rides the crests, and at night the pools glow from lights beneath.

const R = rng(4848), root = new THREE.Group(); root.position.copy(O); sunScene.add(root);
const toy = nightLit(new THREE.MeshLambertMaterial({ vertexColors: true }), 0.5);
const WATER = -0.12, G = 9.8, up = new V3(0, 1, 0);
const W3 = (x, y, z) => O.clone().add(new V3(x, y, z));

/* ---------- the water: one shader for both pools ---------- */
// A wave train rolls in from the north and breaks gently on the wave pool's beach (south); the splash pool only
// ripples. waveH() is the same sum of waves the shader uses, so a floating ring rides exactly on the surface.
const WAVE = { a: 0.42 };
export function waveH(x, z, t) {
  const e = wpE(x, z, WP.wave), damp = 1 - smooth(0.55, 1.0, e);
  return WAVE.a * damp * (0.62 * Math.sin(0.55 * z + 1.6 * t) + 0.26 * Math.sin(0.9 * z + 0.35 * x + 2.3 * t) + 0.12 * Math.sin(1.7 * (0.7 * z + 0.7 * x) + 3.1 * t));
}
const poolShared = { uTime: waterU.uTime, uNight: skyU.uNight, uDusk: skyU.uDusk, uSun: { value: new V3(0.3, 0.7, 0.6) } };
function poolMat(p, waves) {
  const u = Object.assign({ uC: { value: new THREE.Vector2(p.x + O.x, p.z + O.z) }, uR: { value: new THREE.Vector2(p.rx, p.rz) }, uA: { value: waves ? WAVE.a : 0 } }, poolShared);
  return new THREE.ShaderMaterial({ uniforms: u, fog: false,
    vertexShader: `uniform float uTime,uA;uniform vec2 uC,uR;varying vec3 vW,vN;varying float vE,vH;
      float wv(vec2 q,float t){return .62*sin(.55*q.y+1.6*t)+.26*sin(.9*q.y+.35*q.x+2.3*t)+.12*sin(1.7*(.7*q.y+.7*q.x)+3.1*t);}
      void main(){vec4 w=modelMatrix*vec4(position,1.);vec2 q=w.xz-vec2(${O.x.toFixed(1)},${O.z.toFixed(1)});
        vE=length((w.xz-uC)/uR);float damp=1.-smoothstep(.55,1.,vE),t=uTime;
        float h=uA*damp*wv(q,t);float e=.25;
        float hx=uA*damp*wv(q+vec2(e,0.),t),hz=uA*damp*wv(q+vec2(0.,e),t);
        vN=normalize(vec3(-(hx-h)/e,1.,-(hz-h)/e));vH=h/max(uA,.001);w.y+=h;vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: `uniform float uTime,uNight,uDusk,uA;uniform vec3 uSun;varying vec3 vW,vN;varying float vE,vH;
      float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float nz(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1,0)),u.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),u.x),u.y);}
      void main(){if(vE>1.)discard;
        vec2 p=vW.xz;float t=uTime;
        // small ripples on top of the waves
        float e=.15,r0=nz(p*1.6+t*.6)+.5*nz(p*3.7-t*.9);vec3 n=normalize(vN+vec3((nz(p*1.6+vec2(e,0.)+t*.6)-r0)*.9,0.,(nz(p*1.6+vec2(0.,e)+t*.6)-r0)*.9));
        vec3 v=normalize(cameraPosition-vW);float fr=pow(1.-max(dot(n,v),0.),4.);
        // the pool: pale and bright in the shallows, deep blue in the middle; light rippling across its floor
        vec3 deep=vec3(.03,.42,.62),shal=vec3(.36,.86,.9);vec3 c=mix(deep,shal,smoothstep(.35,1.,vE));
        float cau=pow(1.-abs(sin((nz(p*1.1+t*.35)+nz(p*2.3-t*.28))*3.6)),8.);c+=vec3(.75,1.,1.)*cau*.28*(1.-uNight*.5);
        // the sky in it, the sun's glint, foam on the crests and along the rim
        vec3 sky=mix(mix(vec3(.6,.8,.95),vec3(1.,.7,.6),uDusk),vec3(.05,.07,.15),uNight);
        c=mix(c,sky,fr*.6);
        c+=vec3(1.,.95,.85)*pow(max(dot(reflect(-v,n),normalize(uSun)),0.),180.)*1.6*(1.-uNight);
        float foam=smoothstep(.62,.95,vH)*step(.001,uA)*(.6+.4*nz(p*4.+t))+smoothstep(.93,1.,vE)*.55*(.5+.5*nz(p*6.+t*1.5));c=mix(c,vec3(.97,.99,1.),clamp(foam,0.,1.));
        c=mix(c,c*vec3(1.1,.8,.75),uDusk*.35);
        // at night the pool glows from lights set beneath the water
        c=mix(c*.25,vec3(.05,.55,.66)*(.55+.6*cau)+sky*fr*.4,uNight*.85);
        gl_FragColor=vec4(c,1.);}` });
}
const pool = (p, waves, seg) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(p.rx * 2, p.rz * 2, seg[0], seg[1]).rotateX(-Math.PI / 2), poolMat(p, waves)); m.position.set(p.x, WATER, p.z); root.add(m); return m; };
pool(WP.wave, true, [90, 60]); pool(WP.splash, false, [24, 18]);

/* ---------- the deck: pale tiles all round, with the pools cut out; a sandy beach on the wave pool ---------- */
const tileTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#e9e4d8'; g.fillRect(0, 0, w, h); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const v = 228 + (R() * 18 | 0); g.fillStyle = `rgb(${v},${v - 4},${v - 14})`; g.fillRect(x * 32 + 1, y * 32 + 1, 30, 30); } g.fillStyle = 'rgba(80,150,180,.35)'; for (let x = 0; x < 8; x++) g.fillRect(x * 32 + 1, 0, 30, 4); }, true);
tileTex.repeat.set(1 / 4, 1 / 4);
{
  const sh = new THREE.Shape(); sh.moveTo(WP.x0, -WP.z0); sh.lineTo(WP.x1, -WP.z0); sh.lineTo(WP.x1, -WP.z1); sh.lineTo(WP.x0, -WP.z1); sh.closePath();
  for (const p of [WP.wave, WP.splash]) { const h = new THREE.Path(); h.absellipse(p.x, -p.z, p.rx * 1.01, p.rz * 1.01, 0, Math.PI * 2, true); sh.holes.push(h); }
  const g = new THREE.ShapeGeometry(sh, 64).rotateX(-Math.PI / 2), uv = g.attributes.uv, ps = g.attributes.position;
  for (let i = 0; i < ps.count; i++) uv.setXY(i, ps.getX(i), ps.getZ(i));
  const deck = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tileTex, color: '#ffffff' })); deck.position.y = 0.06; root.add(deck);
  // the white coping round each pool, and the wave pool's beach of sand on its south side
  const m = new Merge();
  for (const p of [WP.wave, WP.splash]) { const N = Math.round((p.rx + p.rz) * 4); for (let k = 0; k < N; k++) { const a = k / N * Math.PI * 2, a2 = (k + 1) / N * Math.PI * 2, x = p.x + Math.cos(a) * p.rx * 1.02, z = p.z + Math.sin(a) * p.rz * 1.02, x2 = p.x + Math.cos(a2) * p.rx * 1.02, z2 = p.z + Math.sin(a2) * p.rz * 1.02, L = Math.hypot(x2 - x, z2 - z); m.add(GEO.box, new V3((x + x2) / 2, 0.12, (z + z2) / 2), new V3(L + 0.05, 0.16, 0.6), C('#f8f6f0'), new THREE.Quaternion().setFromAxisAngle(up, -Math.atan2(z2 - z, x2 - x))); } }
  root.add(new THREE.Mesh(m.build(), toy));
  const sand = new THREE.Mesh(new THREE.RingGeometry(0.97, 1.32, 96, 1, Math.PI * 0.08, Math.PI * 0.84).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#efd9a6' }));
  sand.scale.set(WP.wave.rx, 1, WP.wave.rz); sand.position.set(WP.wave.x, 0.085, WP.wave.z); sand.rotation.y = 0; root.add(sand);
}

/* ---------- loungers and striped parasols round the wave pool; a lifeguard's chair ---------- */
{
  const m = new Merge(), STR = ['#e8463a', '#3b78d0', '#f2c12e', '#2fa88a', '#ef7fb0'];
  const spots = [];
  for (let k = 0; k < 14; k++) { const a = Math.PI * (1.12 + k / 13 * 0.76), x = WP.wave.x + Math.cos(a) * WP.wave.rx * 1.22, z = WP.wave.z + Math.sin(a) * WP.wave.rz * 1.22; spots.push([x, z, a]); }
  for (let k = 0; k < 8; k++) spots.push([WP.x1 - 2.6, WP.wave.z - 8 + k * 2.6, 0]);
  spots.forEach(([x, z, a], i) => {
    const q = new THREE.Quaternion().setFromAxisAngle(up, -a);
    m.add(GEO.box, new V3(x, 0.38, z), new V3(0.7, 0.08, 1.9), C('#f8f6f0'), q);
    for (const [dx, dz] of [[-0.3, -0.85], [0.3, -0.85], [-0.3, 0.85], [0.3, 0.85]]) { const o = new V3(dx, 0, dz).applyQuaternion(q); m.add(GEO.box, new V3(x + o.x, 0.2, z + o.z), new V3(0.06, 0.36, 0.06), C('#d8d4ca')); }
    if (i % 2 === 0) { const col = C(STR[(i / 2) % STR.length]); m.limb(new V3(x + 0.9, 0.06, z), new V3(x + 0.9, 2.6, z), 0.05, 0.05, C('#f4f1ea')); for (let s = 0; s < 8; s++) { const b = s / 8 * Math.PI * 2; m.add(GEO.cone, new V3(x + 0.9 + Math.cos(b + 0.2) * 0.55, 2.42, z + Math.sin(b + 0.2) * 0.55), new V3(0.75, 0.45, 0.38), s % 2 ? col : C('#ffffff'), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -b, 1.15, 'YXZ'))); } }
  });
  const lx = WP.wave.x + WP.wave.rx * 0.6, lz = WP.wave.z - WP.wave.rz * 1.15;
  for (const [dx, dz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) m.limb(new V3(lx + dx, 0.06, lz + dz), new V3(lx + dx * 0.6, 2.4, lz + dz * 0.6), 0.06, 0.06, C('#f4f1ea'));
  m.add(GEO.box, new V3(lx, 2.45, lz), new V3(0.9, 0.12, 0.8), C('#e8463a')); m.add(GEO.box, new V3(lx, 2.95, lz - 0.35), new V3(0.9, 0.9, 0.1), C('#e8463a'));
  root.add(new THREE.Mesh(m.build(), toy));
}

/* ---------- the slide tower and its flume ---------- */
const TW = WP.tower;
const flume = new THREE.CatmullRomCurve3([
  [TW.x - 1.5, TW.h + 0.4, TW.z], [TW.x - 6, TW.h - 0.4, TW.z], [TW.x - 12, TW.h - 1.4, TW.z + 4], [TW.x - 14, TW.h - 2.6, TW.z + 12], [TW.x - 9, TW.h - 3.6, TW.z + 18],
  [TW.x - 2, TW.h - 4.6, TW.z + 16], [TW.x, TW.h - 5.7, TW.z + 9], [TW.x - 4, TW.h - 6.8, TW.z + 4], [TW.x - 12, TW.h - 8.2, TW.z - 3], [TW.x - 20, TW.h - 9.8, TW.z - 6],
  [TW.x - 26, TW.h - 11.6, TW.z - 3.5], [TW.x - 30, TW.h - 13.3, TW.z - 0.8], [WP.splash.x + 5.5, 1.2, WP.splash.z - 0.4], [WP.splash.x + 3, 0.55, WP.splash.z - 0.2],
].map(([x, y, z]) => new V3(x, y, z)), false, 'catmullrom', 0.5);
const FL = { N: 520, R: 0.85 }, fs = [];
{
  // a frame at every step: centre, tangent, a banked side and up, and how sharply the flume turns there
  FL.L = flume.getLength();
  for (let i = 0; i <= FL.N; i++) {
    const u = i / FL.N, c = flume.getPointAt(u), t = flume.getTangentAt(u).normalize();
    const t2 = flume.getTangentAt(Math.min(1, u + 1 / FL.N)), h1 = Math.atan2(t.x, t.z), h2 = Math.atan2(t2.x, t2.z);
    let dh = h2 - h1; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); const k = dh / (FL.L / FL.N);
    fs.push({ c, t, k });
  }
  // smooth the turning, then bank into it
  for (let pass = 0; pass < 6; pass++) for (let i = 1; i < FL.N; i++) fs[i].k = (fs[i - 1].k + fs[i].k * 2 + fs[i + 1].k) / 4;
  fs.forEach(f => { const side = new V3().crossVectors(f.t, up).normalize(), upv = new V3().crossVectors(side, f.t).normalize(), bank = clamp(f.k * 5, -0.7, 0.7); f.side = side.applyAxisAngle(f.t, bank); f.up = upv.applyAxisAngle(f.t, bank); f.bank = bank; });
  // the half-pipe, its water and its supports
  const tube = (r, a0, a1, NA, colorAt) => { const pos = [], col = [], uv = [], idx = [], c = new THREE.Color(); fs.forEach((f, i) => { for (let j = 0; j <= NA; j++) { const a = a0 + (a1 - a0) * j / NA, p = f.c.clone().addScaledVector(f.side, Math.sin(a) * r).addScaledVector(f.up, -Math.cos(a) * r); pos.push(p.x, p.y, p.z); colorAt(c, j / NA, i); col.push(c.r, c.g, c.b); uv.push(i / FL.N * FL.L, j / NA); if (i < FL.N && j < NA) { const b = i * (NA + 1) + j; idx.push(b, b + NA + 1, b + 1, b + 1, b + NA + 1, b + NA + 2); } } }); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g; };
  const YEL = C('#f6c22a'), RIM = C('#f39a1e'), BLUE = C('#2f86d6');
  root.add(new THREE.Mesh(tube(FL.R, -1.95, 1.95, 22, (c, s, i) => { c.copy(s < 0.06 || s > 0.94 ? RIM : YEL); if (Math.floor(i / 26) % 2 && (s < 0.12 || s > 0.88)) c.copy(BLUE); }), nightLit(new THREE.MeshPhongMaterial({ vertexColors: true, side: THREE.DoubleSide, shininess: 70, specular: '#ffffff' }), 0.4)));
  // the water running down it: a thin sheet with streaks flowing downhill
  const flowU = { uTime: waterU.uTime, uNight: skyU.uNight };
  root.add(new THREE.Mesh(tube(FL.R - 0.06, -0.62, 0.62, 6, c => c.setRGB(1, 1, 1)), new THREE.ShaderMaterial({ uniforms: flowU, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float uTime,uNight;varying vec2 vUv;float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){float s=vUv.x*.9-uTime*5.,w=vUv.y;float st=smoothstep(.75,1.,fract(s+h2(vec2(floor(w*7.),0.))*.7))*smoothstep(.0,.2,w)*smoothstep(1.,.8,w);
        vec3 c=mix(vec3(.35,.82,.95),vec3(1.),st*.8);c*=mix(1.,.45,uNight);gl_FragColor=vec4(c,.55+st*.35);}` })));
  // white supports every few metres, and the tower: four legs, a stair, a platform under a striped canopy
  const m = new Merge();
  for (let i = 10; i < FL.N - 30; i += 22) { const f = fs[i], b = f.c.clone().addScaledVector(f.up, -FL.R - 0.05), gy = sunH(b.x, b.z); m.limb(new V3(b.x, gy, b.z), b, 0.13, 0.11, C('#f4f1ea')); m.add(GEO.box, b, new V3(0.4, 0.12, 0.4), C('#d8d4ca')); }
  for (const [dx, dz] of [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]]) m.limb(new V3(TW.x + dx, 0, TW.z + dz), new V3(TW.x + dx, TW.h + 3.2, TW.z + dz), 0.22, 0.2, C('#3b78d0'));
  for (let y = 2; y < TW.h; y += 2.2) { m.add(GEO.box, new V3(TW.x, y, TW.z + 2.2), new V3(4.6, 0.12, 0.12), C('#f4f1ea')); m.add(GEO.box, new V3(TW.x + 2.2, y, TW.z), new V3(0.12, 0.12, 4.6), C('#f4f1ea')); }
  for (let k = 0; k < 24; k++) { const y = k * (TW.h / 24), a = k * 0.5; m.add(GEO.box, new V3(TW.x + Math.cos(a) * 1.4, y + 0.3, TW.z + Math.sin(a) * 1.4), new V3(1.4, 0.12, 0.5), C('#e8463a'), new THREE.Quaternion().setFromAxisAngle(up, -a)); }
  m.add(GEO.box, new V3(TW.x, TW.h, TW.z), new V3(5.2, 0.3, 5.2), C('#f2c12e'));
  for (const [dx, dz, w, d] of [[0, 2.5, 5.2, 0.08], [0, -2.5, 5.2, 0.08], [2.5, 0, 0.08, 5.2]]) m.add(GEO.box, new V3(TW.x + dx, TW.h + 0.6, TW.z + dz), new V3(w, 1.0, d), C('#f4f1ea'));
  for (let s = 0; s < 12; s++) { const b = s / 12 * Math.PI * 2; m.add(GEO.cone, new V3(TW.x + Math.cos(b) * 1.6, TW.h + 3.6, TW.z + Math.sin(b) * 1.6), new V3(2.2, 1.2, 1.1), s % 2 ? C('#e8463a') : C('#ffffff'), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -b, 1.2, 'YXZ'))); }
  root.add(new THREE.Mesh(m.build(), toy));
}
const flumeAt = s => { const f = clamp(s / FL.L, 0, 1) * FL.N, i = Math.min(FL.N - 1, Math.floor(f)), k = f - i, a = fs[i], b = fs[i + 1]; return { c: a.c.clone().lerp(b.c, k), t: a.t.clone().lerp(b.t, k).normalize(), side: a.side.clone().lerp(b.side, k).normalize(), up: a.up.clone().lerp(b.up, k).normalize(), k: lerp(a.k, b.k, k), dy: (b.c.y - a.c.y) / (FL.L / FL.N) }; };

/* ---------- the sign at the way in, and the path to it from the fair ---------- */
{
  const tex = canvasTex(1024, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2fa8d6'); gr.addColorStop(1, '#1f78b8'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 6; for (let k = 0; k < 3; k++) { g.beginPath(); for (let x = 0; x <= w; x += 8) g.lineTo(x, 200 + k * 18 + Math.sin(x / 40 + k) * 6); g.stroke(); } g.fillStyle = '#fffaf0'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = 'rgba(0,40,80,.55)'; g.shadowBlur = 10; g.shadowOffsetY = 4; g.font = '700 132px "Cormorant Garamond", Georgia, serif'; g.fillText('Splash Cove', w / 2, 112); });
  const sx = WP.x0 + 1, sz = WP.z1 + 3, m = new Merge();
  for (const dz of [-3.6, 3.6]) m.limb(new V3(sx, 0, sz + dz), new V3(sx, 5.2, sz + dz), 0.18, 0.16, C('#f4f1ea'));
  root.add(new THREE.Mesh(m.build(), toy));
  for (const r of [-Math.PI / 2, Math.PI / 2]) { const b = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 1.9), new THREE.MeshLambertMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.25, polygonOffset: true, polygonOffsetFactor: -1 })); b.position.set(sx + (r < 0 ? -0.06 : 0.06), 4.4, sz); b.rotation.y = r; root.add(b); }
  // a paved way from the fair's plaza, past the sunflower arch, to the water park's gate
  const p = new Merge(), pts = [[6, -46], [18, -44], [30, -41], [36, -40], [WP.x0 - 1, WP.z1 + 3]];
  for (let k = 0; k < pts.length - 1; k++) { const [x0, z0] = pts[k], [x1, z1] = pts[k + 1], L = Math.hypot(x1 - x0, z1 - z0); for (let s = 0; s < L; s += 1.1) { const x = x0 + (x1 - x0) * s / L, z = z0 + (z1 - z0) * s / L; p.add(GEO.box, new V3(x, sunH(x, z) + 0.05, z), new V3(1.05, 0.08, 2.6), C(['#e6d8c2', '#dccdb4', '#ece0cc'][(R() * 3) | 0]), new THREE.Quaternion().setFromAxisAngle(up, -Math.atan2(z1 - z0, x1 - x0))); } }
  root.add(new THREE.Mesh(p.build(), new THREE.MeshLambertMaterial({ vertexColors: true })));
}

/* ---------- jet skis on the lagoon ---------- */
// the dock on the lagoon's north shore, where it is wide, east of the bridge
const DOCK = { x: 28, z0: -90, z1: -97.5 };
const jetMat = nightLit(new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 90, specular: '#ffffff' }), 0.35);
function makeJet(col) {
  const g = new THREE.Group(), m = new Merge(), c = C(col), W = C('#f8f8f6'), K = C('#1e2226');
  m.add(GEO.sph, new V3(0, 0.32, 0.1), new V3(0.62, 0.32, 1.45), W);
  m.add(GEO.sph, new V3(0, 0.46, 0.35), new V3(0.5, 0.22, 1.1), c);
  m.add(GEO.cone, new V3(0, 0.36, 1.45), new V3(0.42, 0.7, 0.26), c, new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), Math.PI / 2));
  m.add(GEO.box, new V3(0, 0.66, -0.45), new V3(0.42, 0.16, 1.05), K);
  m.limb(new V3(0, 0.62, 0.42), new V3(0, 0.98, 0.32), 0.05, 0.05, K); m.add(GEO.box, new V3(0, 1.0, 0.3), new V3(0.72, 0.06, 0.08), K);
  m.add(GEO.box, new V3(0, 0.26, -1.25), new V3(0.5, 0.16, 0.3), K);
  g.add(new THREE.Mesh(m.build(), jetMat)); root.add(g); return g;
}
const jets = [
  { g: makeJet('#e8463a'), x: DOCK.x + 2, z: DOCK.z1 + 0.5, h: Math.PI, v: 0, mine: true },
  // two others race their own loops: one west of the bridge, one along the far side
  { g: makeJet('#2f86d6'), cx: -30, cz: -104, rx: 18, rz: 7, ph: 0, sp: 0.42 },
  { g: makeJet('#f2c12e'), cx: 40, cz: -108, rx: 10, rz: 3.5, ph: 2.6, sp: -0.55 },
];
{
  // the dock: a cedar pier out from the shore, posts, a striped hut for the jets
  const m = new Merge(), WOOD = ['#8a6a4c', '#7d5c40', '#94744f'].map(C);
  for (let z = DOCK.z0; z > DOCK.z1; z -= 0.34) m.add(GEO.box, new V3(DOCK.x, 0.28, z), new V3(2.0, 0.08, 0.3), WOOD[(R() * 3) | 0]);
  for (let z = DOCK.z0; z >= DOCK.z1; z -= 2) for (const dx of [-0.95, 0.95]) m.limb(new V3(DOCK.x + dx, -1, z), new V3(DOCK.x + dx, 0.7, z), 0.08, 0.07, C('#5e4532'));
  const hx = DOCK.x - 4, hz = DOCK.z0 + 4;
  m.add(GEO.box, new V3(hx, 1.2, hz), new V3(3, 2.4, 2.4), C('#f4f1ea'));
  for (let s = 0; s < 6; s++) m.add(GEO.box, new V3(hx - 1.25 + s * 0.5, 2.55, hz), new V3(0.5, 0.25, 2.8), s % 2 ? C('#2f86d6') : C('#ffffff'));
  root.add(new THREE.Mesh(m.build(), toy));
}

/* ---------- spray, wakes and splashes: one set of points ---------- */
const NP = 1400, pPos = new Float32Array(NP * 3), pAge = new Float32Array(NP).fill(99), pLife = new Float32Array(NP), pVel = new Float32Array(NP * 3), pSize = new Float32Array(NP);
let pNext = 0;
const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pg.setAttribute('aAge', new THREE.BufferAttribute(new Float32Array(NP), 1)); pg.setAttribute('aSize', new THREE.BufferAttribute(pSize, 1));
const spray = new THREE.Points(pg, new THREE.ShaderMaterial({ uniforms: { uNight: skyU.uNight }, transparent: true, depthWrite: false,
  vertexShader: 'attribute float aAge,aSize;varying float vA;void main(){vA=aAge;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(aSize*300./-mv.z,1.,40.)*step(aAge,1.);gl_Position=projectionMatrix*mv;}',
  fragmentShader: 'uniform float uNight;varying float vA;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,.1,d)*(1.-vA)*.8;gl_FragColor=vec4(mix(vec3(1.),vec3(.55,.7,.8),uNight),a);}' }));
spray.frustumCulled = false; root.add(spray);
function emit(x, y, z, vx, vy, vz, life, size) { const i = pNext; pNext = (pNext + 1) % NP; pPos.set([x, y, z], i * 3); pVel.set([vx, vy, vz], i * 3); pAge[i] = 0; pLife[i] = life; pSize[i] = size; }
function burst(x, y, z, n, power) { for (let k = 0; k < n; k++) { const a = R() * Math.PI * 2, s = (0.4 + R()) * power; emit(x, y, z, Math.cos(a) * s, (1.5 + R() * 2.5) * power, Math.sin(a) * s, 0.8 + R() * 0.8, 0.35 + R() * 0.4); } }
function wake(j, speed, turn) {
  const f = new V3(Math.sin(j.h), 0, Math.cos(j.h)), sx = j.g.position.x - f.x * 1.3, sz = j.g.position.z - f.z * 1.3;
  if (speed > 0.8) for (let k = 0; k < 2; k++) emit(sx + (R() - 0.5) * 0.6, WATER + 0.05, sz + (R() - 0.5) * 0.6, -f.z * (R() - 0.5) * 1.2, 0.05, f.x * (R() - 0.5) * 1.2, 1.6 + R(), 0.5 + R() * 0.3);
  // a rooster tail of spray behind at speed, thrown wide in a hard turn
  if (speed > 5) for (let k = 0; k < Math.round(speed / 4); k++) emit(sx, WATER + 0.3, sz, -f.x * speed * 0.35 + (R() - 0.5) + turn * f.z * 3, 2 + R() * speed * 0.25, -f.z * speed * 0.35 + (R() - 0.5) - turn * f.x * 3, 0.7 + R() * 0.4, 0.25 + R() * 0.25);
}
function stepParticles(dt) {
  const ages = pg.attributes.aAge.array;
  for (let i = 0; i < NP; i++) {
    if (pAge[i] >= 99) { ages[i] = 2; continue; }
    pAge[i] += dt / pLife[i]; if (pAge[i] >= 1) { pAge[i] = 99; ages[i] = 2; continue; }
    const k = i * 3; pVel[k + 1] -= G * dt * (pPos[k + 1] > WATER + 0.1 ? 1 : 0); pPos[k] += pVel[k] * dt; pPos[k + 1] = Math.max(WATER + 0.02, pPos[k + 1] + pVel[k + 1] * dt); pPos[k + 2] += pVel[k + 2] * dt;
    pVel[k] *= 1 - dt * 0.8; pVel[k + 2] *= 1 - dt * 0.8; ages[i] = pAge[i];
  }
  pg.attributes.position.needsUpdate = true; pg.attributes.aAge.needsUpdate = true; pg.attributes.aSize.needsUpdate = true;
}

/* ---------- floating rings in the wave pool ---------- */
const rings = [];
{
  const RC = ['#e8463a', '#f2c12e', '#2fa88a', '#ef7fb0', '#3b78d0', '#f28a2a'];
  for (let k = 0; k < 7; k++) { const g = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.22, 10, 24).rotateX(Math.PI / 2), nightLit(new THREE.MeshPhongMaterial({ color: RC[k % RC.length], shininess: 60 }), 0.3)); root.add(g); rings.push({ g, ph: R() * 6, x: WP.wave.x - 12 + R() * 24, z: WP.wave.z - 6 + R() * 12 }); }
}

/* ---------- under the water: a blue haze over the view for a moment after the slide ---------- */
const under = $('#underwater');
let underK = 0;
const setUnder = k => { underK = k; if (under) { under.style.opacity = String(k); under.hidden = k <= 0.001; } };

/* ---------- the rides ---------- */
const slide = { on: false, s: 0, v: 0, phase: 'slide', t: 0, entry: null };
const float = { on: false };
const jet0 = jets[0];
const tmpV = new V3();
const slideRide = {
  key: 'slide', label: 'Ride the water slide', name: 'Down the water slide', hint: 'hold on, and lean into the bends', exit: W3(WP.splash.x - 1, 0, WP.splash.z - WP.splash.rz - 2.4),
  board() { slide.on = true; slide.s = 0.5; slide.v = 1.6; slide.phase = 'slide'; slide.t = 0; },
  leave() { slide.on = false; setUnder(0); late.setVeil && late.setVeil(0); },
  seat(v) {
    if (slide.phase === 'slide') {
      const f = flumeAt(slide.s), lean = clamp(Math.atan(slide.v * slide.v * f.k / G) * 0.9, -1.1, 1.1), r = FL.R - 0.62;
      v.copy(f.c).addScaledVector(f.side, -Math.sin(lean) * r).addScaledVector(f.up, -Math.cos(lean) * r + 0.18); v.add(O); return;
    }
    const e = slide.entry; v.copy(e.p).addScaledVector(e.d, Math.min(slide.t, 1.6) * (e.v * 0.55) * (1 - Math.min(slide.t, 1.6) / 3.2));
    v.y = slide.phase === 'float' ? WATER + 0.42 + Math.sin(T * 1.7) * 0.05 : e.p.y + (WATER - 0.75 - e.p.y) * smooth(0, 0.32, slide.t) + (WATER + 0.42 - (WATER - 0.75)) * smooth(1.1, 1.9, slide.t);
    v.add(O);
  },
  fwd(v) {
    if (slide.phase === 'slide') { const f = flumeAt(slide.s); v.copy(f.t); v.y -= 0.12; return; }
    v.copy(slide.entry.d); v.y = slide.phase === 'float' ? 0.02 : -0.15 + 0.3 * smooth(0.6, 1.6, slide.t);
  },
};
const floatRide = {
  key: 'float', label: 'Float in the wave pool', name: 'In the wave pool', hint: 'ride the waves; drag to look around', yaw0: Math.PI, follow: false, exit: W3(WP.wave.x, 0, WP.wave.z - WP.wave.rz - 2.6),
  board() { float.on = true; }, leave() { float.on = false; },
  seat(v) { const r = rings[0]; v.set(r.g.position.x, r.g.position.y + 0.78, r.g.position.z).add(O); },
};
const jetRide = {
  key: 'jet', label: 'Ride a jet ski', name: 'On a jet ski', hint: 'W to go, S to slow, A and D to steer', drive: true, exit: W3(DOCK.x, 0, DOCK.z0 + 2.2),
  board() { jet0.v = 0; jet0.riding = true; },
  leave() { jet0.riding = false; jet0.v = 0; jet0.x = DOCK.x + 2; jet0.z = DOCK.z1 + 0.5; jet0.h = Math.PI; },
  seat(v) { jet0.g.localToWorld(v.set(0, 1.55, -0.55)); },
  fwd(v) { v.set(Math.sin(jet0.h), -0.1 - (jet0.pitch || 0) * 0.5, Math.cos(jet0.h)); },
};
rides.push(slideRide, floatRide, jetRide);
const start = r => () => late.startRide && late.startRide(r);
{ const g = new THREE.Group(); root.add(g); regThing(g, slideRide.label, start(slideRide), { x: O.x + TW.x - 3.4, z: O.z + TW.z - 3.4, r: 4.2 }); }
regThing(rings[0].g, floatRide.label, start(floatRide), { x: O.x + WP.wave.x, z: O.z + WP.wave.z - WP.wave.rz - 2.2, r: 5 });
regThing(jet0.g, jetRide.label, start(jetRide), { x: O.x + DOCK.x, z: O.z + DOCK.z0 - 1.5, r: 3.6 });

/* ---------- every frame ---------- */
addTick(dt => {
  if (state.world !== 'sun') return;
  dt = Math.min(dt, 0.05);
  poolShared.uSun.value.copy(sun.position).normalize();
  // the rings bob on the waves; the first carries you when you float
  rings.forEach((r, k) => {
    if (k === 0 && float.on) { r.x = WP.wave.x - 2 + Math.sin(T * 0.07) * 3; r.z = WP.wave.z + 1 + Math.cos(T * 0.05) * 2.5; }
    else { r.x += Math.sin(T * 0.1 + r.ph) * dt * 0.3; r.z += Math.cos(T * 0.08 + r.ph) * dt * 0.3; if (wpE(r.x, r.z, WP.wave) > 0.8) { r.x += (WP.wave.x - r.x) * dt * 0.3; r.z += (WP.wave.z - r.z) * dt * 0.3; } }
    const h = waveH(r.x, r.z, T), hx = waveH(r.x + 0.5, r.z, T), hz = waveH(r.x, r.z + 0.5, T);
    r.g.position.set(r.x, WATER + h + 0.12, r.z); r.g.rotation.set((hz - h) * 1.6, 0, -(hx - h) * 1.6);
  });
  // the slide: real speed from the flume's slope, less friction and the drag of the water
  if (slide.on) {
    if (slide.phase === 'slide') {
      // gravity along the slope, less the sliding friction of a body on a film of running water (about 0.03) and
      // the drag of water and air: over this 86 m flume and 16 m drop that is a 13 s run, up to 43 km/h, as real
      // body slides are (simulated over the flume's own shape)
      const f = flumeAt(slide.s), sinA = clamp(-f.dy, -1, 1), cosA = Math.sqrt(1 - sinA * sinA), a = G * sinA - 0.03 * G * cosA - 0.012 * slide.v * slide.v;
      slide.v = clamp(slide.v + a * dt, 1.5, 14); slide.s += slide.v * dt;
      if (R() < 0.6) { tmpV.copy(f.c).addScaledVector(f.up, -FL.R + 0.15); emit(tmpV.x, tmpV.y, tmpV.z, (R() - 0.5) * 1.5, 0.6 + R(), (R() - 0.5) * 1.5, 0.35, 0.18); }
      if (slide.s >= FL.L - 0.3) {
        const e = flumeAt(FL.L - 0.3), d = new V3(e.t.x, 0, e.t.z).normalize(), p = e.c.clone().addScaledVector(e.up, -FL.R + 0.8);
        slide.entry = { p, d, v: slide.v }; slide.phase = 'splash'; slide.t = 0;
        burst(p.x + d.x * 1.2, WATER + 0.1, p.z + d.z * 1.2, 160, 1.6); late.setVeil && late.setVeil(0.85);
      }
    } else {
      slide.t += dt;
      late.setVeil && late.setVeil(Math.max(0, 0.85 - slide.t * 1.6));
      setUnder(smooth(0.2, 0.35, slide.t) * (1 - smooth(1.3, 1.85, slide.t)));
      if (slide.phase === 'splash' && slide.t > 1.9) slide.phase = 'float';
      // after a little while bobbing in the pool, up the tower and down again
      if (slide.phase === 'float' && slide.t > 6.5) { slide.s = 0.5; slide.v = 1.6; slide.phase = 'slide'; slide.t = 0; late.setVeil && late.setVeil(0.6); }
    }
  }
  // jet skis: yours from the keys or the joystick; the others racing round the lagoon
  jets.forEach(j => {
    let turn = 0;
    if (j.mine) {
      if (j.riding) {
        const ix = jetRide.ix || 0, iz = jetRide.iz || 0, thrust = iz > 0 ? 12 * iz : 6 * iz;
        const prev = j.v; j.v += (thrust - 0.55 * j.v - 0.025 * j.v * Math.abs(j.v)) * dt; j.v = clamp(j.v, -3, 16);
        turn = ix * 1.7 * (0.25 + Math.min(1, Math.abs(j.v) / 6)); j.h -= turn * dt * Math.sign(j.v || 1);
        j.pitch = lerp(j.pitch || 0, clamp((j.v - prev) / dt / 30, -0.12, 0.18), dt * 4);
        let nx = j.x + Math.sin(j.h) * j.v * dt, nz = j.z + Math.cos(j.h) * j.v * dt;
        // the lagoon's shore and the bridge turn you back
        if (lagoonE(nx, nz) > 0.9 || nx < 7) { const gx = (nx - LAGOON.x) / (LAGOON.rx * LAGOON.rx), gz = (nz - LAGOON.z) / (LAGOON.rz * LAGOON.rz); const n = nx < 7 ? new V3(-1, 0, 0) : new V3(gx, 0, gz).normalize(); const f = new V3(Math.sin(j.h), 0, Math.cos(j.h)); f.addScaledVector(n, -2 * f.dot(n)); j.h = Math.atan2(f.x, f.z); j.v *= 0.35; nx = j.x; nz = j.z; burst(j.x + n.x, WATER, j.z + n.z, 30, 0.8); }
        j.x = nx; j.z = nz;
      }
      const sp = Math.abs(j.v), bob = Math.sin(T * 8.5) * 0.06 * Math.min(1, sp / 10) + Math.sin(T * 1.6) * 0.04;
      j.g.position.set(j.x, WATER + 0.02 + bob, j.z); j.g.rotation.set(-(j.pitch || 0) - sp * 0.004, j.h, turn * Math.min(1, sp / 8) * 0.28, 'YXZ');
      if (j.riding) wake(j, sp, turn);
    } else {
      const t = T * j.sp / Math.max(j.rx, j.rz) * 9 + j.ph, x = j.cx + Math.cos(t) * j.rx, z = j.cz + Math.sin(t) * j.rz;
      const nx = j.cx + Math.cos(t + 0.02 * Math.sign(j.sp)) * j.rx, nz = j.cz + Math.sin(t + 0.02 * Math.sign(j.sp)) * j.rz;
      j.h = Math.atan2(nx - x, nz - z); j.x = x; j.z = z; const sp = 9;
      j.g.position.set(x, WATER + 0.02 + Math.sin(T * 8 + j.ph) * 0.05, z); j.g.rotation.set(-0.04, j.h, 0.22 * Math.sign(j.sp), 'YXZ'); wake(j, sp, 0.4 * Math.sign(j.sp));
    }
  });
  stepParticles(dt);
});

/* ---------- walking here: the deck is level; pools, the tower and the lagoon stop you; the dock does not ---------- */
{
  const f = worlds.sun.floorH, b = worlds.sun.blocked;
  const loc = (x, z) => [x - O.x, z - O.z];
  const onDock = (lx, lz) => Math.abs(lx - DOCK.x) < 1.0 && lz < DOCK.z0 + 0.6 && lz > DOCK.z1;
  worlds.sun.floorH = (x, z) => { const [lx, lz] = loc(x, z); if (onDock(lx, lz)) return 0.32; if (lx > WP.x0 && lx < WP.x1 && lz < WP.z0 && lz > WP.z1) return 0.1; return f(x, z); };
  worlds.sun.blocked = (x, z) => {
    const [lx, lz] = loc(x, z);
    if (onDock(lx, lz)) return false;
    if (wpE(lx, lz, WP.wave) < 1.04 || wpE(lx, lz, WP.splash) < 1.08) return true;
    if (Math.abs(lx - TW.x) < 2.8 && Math.abs(lz - TW.z) < 2.8) return true;
    return b(x, z);
  };
}
// for the secret world's map
Object.assign(SUN_PLAN, { FLUME: flume.getSpacedPoints(60), DOCK });
// for the test harness: how fast the slider is going, and where on the run
export const slideState = slide;

/* ================= the Thunder Bowl: a tube down a tower, round a great bowl, and through ================= */
// After the Thunder Bowl slides: a 20 m tower, an enclosed tube striped orange and blue spiralling down round it
// and on to the rim of a great striped bowl, which you enter sideways and circle (about two and a half laps,
// faster high on the wall, slower as you sink toward the middle) until you drop through its hole into the pool
// beneath. The speeds are physics: gravity along the tube less the friction of a body on running water (0.03)
// and the water's drag, 13 s to about 30 km/h; in the bowl, gravity down its slope against the circling speed,
// with a body's friction on the wetted wall (0.08), simulated before choosing the bowl's shape.
const BW = BOWL, BT = BW.tower, BTH = 2.45;
const bowlH = r => BW.hole + (BW.rim - BW.hole) * Math.pow(clamp((r - BW.rh) / (BW.R - BW.rh), 0, 1), 1.5);
const bowlS = r => 1.5 * (BW.rim - BW.hole) / (BW.R - BW.rh) * Math.sqrt(clamp((r - BW.rh) / (BW.R - BW.rh), 0, 1));
const bowlCurve = (() => {
  const pts = [[BT.x + 1.6, BT.h + 0.4, BT.z]];
  for (let k = 0; k <= 20; k++) { const f = k / 20, phi = -2 * Math.PI + f * 2.5 * Math.PI; pts.push([BT.x + 4.6 * Math.cos(phi), BT.h + 0.2 - f * 4.6, BT.z + 4.6 * Math.sin(phi)]); }
  const ex = BW.x + BW.R * Math.cos(BTH), ez = BW.z + BW.R * Math.sin(BTH), tx = -Math.sin(BTH), tz = Math.cos(BTH);
  for (const [s, y] of [[22, 14.4], [16, 13.2], [9, 12.1], [3, 11.4], [0, 11.2]]) pts.push([ex - tx * s, y, ez - tz * s]);
  return new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new V3(x, y, z)), false, 'catmullrom', 0.5);
})();
const TBF = { N: 420, R: 0.95 }, tbf = [];
{
  TBF.L = bowlCurve.getLength();
  for (let i = 0; i <= TBF.N; i++) { const u = i / TBF.N, c = bowlCurve.getPointAt(u), t = bowlCurve.getTangentAt(u).normalize(); const side = new V3().crossVectors(t, up).normalize(), upv = new V3().crossVectors(side, t).normalize(); tbf.push({ c, t, side, up: upv }); }
  // the tube: closed all round, bands of orange and blue with a thin yellow line between
  const pos = [], col = [], idx = [], NA = 24, c3 = new THREE.Color(), OR = C('#f08a2a'), BL = C('#2a64c8'), YE = C('#f6c22a');
  tbf.forEach((f, i) => { const band = i / TBF.N * TBF.L / 2.4, k = Math.floor(band), e = band - k; for (let j = 0; j <= NA; j++) { const a = j / NA * Math.PI * 2, p = f.c.clone().addScaledVector(f.side, Math.sin(a) * TBF.R).addScaledVector(f.up, -Math.cos(a) * TBF.R); pos.push(p.x, p.y, p.z); c3.copy(e < 0.08 ? YE : k % 2 ? BL : OR); col.push(c3.r, c3.g, c3.b); } });
  for (let i = 0; i < TBF.N; i++) for (let j = 0; j < NA; j++) { const a = i * (NA + 1) + j, b = a + NA + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  root.add(new THREE.Mesh(g, nightLit(new THREE.MeshPhongMaterial({ vertexColors: true, side: THREE.DoubleSide, shininess: 80, specular: '#ffffff', emissive: '#2a1e14', emissiveIntensity: 0.9 }), 0.4)));
  // white legs from the ground to the tube, and the tower: four blue legs, a stair, a platform, a striped canopy
  const m = new Merge();
  for (let i = 12; i < TBF.N - 6; i += 20) { const f = tbf[i], b = f.c.clone().addScaledVector(f.up, -TBF.R - 0.05); if (Math.hypot(b.x - BW.x, b.z - BW.z) < BW.pool + 0.8) continue; m.limb(new V3(b.x, 0, b.z), b, 0.14, 0.12, C('#f4f1ea')); m.add(GEO.box, b, new V3(0.5, 0.14, 0.5), C('#d8d4ca')); }
  for (const [dx, dz] of [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]]) m.limb(new V3(BT.x + dx, 0, BT.z + dz), new V3(BT.x + dx, BT.h + 3.2, BT.z + dz), 0.24, 0.22, C('#2a64c8'));
  for (let y = 2; y < BT.h; y += 2.2) { m.add(GEO.box, new V3(BT.x, y, BT.z + 2.2), new V3(4.6, 0.12, 0.12), C('#f4f1ea')); m.add(GEO.box, new V3(BT.x - 2.2, y, BT.z), new V3(0.12, 0.12, 4.6), C('#f4f1ea')); }
  for (let k = 0; k < 30; k++) { const y = k * (BT.h / 30), a = k * 0.5; m.add(GEO.box, new V3(BT.x + Math.cos(a) * 1.4, y + 0.3, BT.z + Math.sin(a) * 1.4), new V3(1.4, 0.12, 0.5), C('#f08a2a'), new THREE.Quaternion().setFromAxisAngle(up, -a)); }
  m.add(GEO.box, new V3(BT.x, BT.h, BT.z), new V3(5.2, 0.3, 5.2), C('#f6c22a'));
  for (const [dx, dz, w, d] of [[0, 2.5, 5.2, 0.08], [0, -2.5, 5.2, 0.08], [-2.5, 0, 0.08, 5.2]]) m.add(GEO.box, new V3(BT.x + dx, BT.h + 0.6, BT.z + dz), new V3(w, 1.0, d), C('#f4f1ea'));
  for (let s = 0; s < 12; s++) { const b = s / 12 * Math.PI * 2; m.add(GEO.cone, new V3(BT.x + Math.cos(b) * 1.6, BT.h + 3.6, BT.z + Math.sin(b) * 1.6), new V3(2.2, 1.2, 1.1), s % 2 ? C('#2a64c8') : C('#f08a2a'), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -b, 1.2, 'YXZ'))); }
  // the bowl's eight legs and a ring beam under it, the pool's white coping
  const LR = 7.6, LH = bowlH(LR);
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + Math.PI / 8, x = BW.x + Math.cos(a) * LR, z = BW.z + Math.sin(a) * LR; m.limb(new V3(x, 0, z), new V3(x, LH - 0.2, z), 0.3, 0.26, C('#f4f1ea')); m.add(GEO.box, new V3(x, 0.15, z), new V3(0.9, 0.3, 0.9), C('#d8d4ca')); }
  m.add(new THREE.TorusGeometry(LR, 0.22, 6, 48).rotateX(Math.PI / 2), new V3(BW.x, LH - 0.3, BW.z), new V3(1, 1, 1), C('#f4f1ea'));
  m.add(new THREE.TorusGeometry(BW.pool * 1.02, 0.28, 6, 64).rotateX(Math.PI / 2), new V3(BW.x, 0.1, BW.z), new V3(1, 1, 1), C('#f8f6f0'));
  root.add(new THREE.Mesh(m.build(), toy));
  // the water running down the tube's floor
  const fu = { uTime: waterU.uTime, uNight: skyU.uNight }, wp = [], wuv = [], wi = [], WA = 6;
  tbf.forEach((f, i) => { for (let j = 0; j <= WA; j++) { const a = -0.7 + 1.4 * j / WA, p = f.c.clone().addScaledVector(f.side, Math.sin(a) * (TBF.R - 0.05)).addScaledVector(f.up, -Math.cos(a) * (TBF.R - 0.05)); wp.push(p.x, p.y, p.z); wuv.push(i / TBF.N * TBF.L, j / WA); } });
  for (let i = 0; i < TBF.N; i++) for (let j = 0; j < WA; j++) { const a = i * (WA + 1) + j, b = a + WA + 1; wi.push(a, b, a + 1, a + 1, b, b + 1); }
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); wg.setAttribute('uv', new THREE.Float32BufferAttribute(wuv, 2)); wg.setIndex(wi);
  const flow = 'uniform float uTime,uNight;varying vec2 vUv;float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}void main(){float s=vUv.x*.9-uTime*5.,w=vUv.y;float st=smoothstep(.75,1.,fract(s+h2(vec2(floor(w*7.),0.))*.7))*smoothstep(.0,.2,w)*smoothstep(1.,.8,w);vec3 c=mix(vec3(.35,.82,.95),vec3(1.),st*.8);c*=mix(1.,.45,uNight);gl_FragColor=vec4(c,.5+st*.35);}';
  root.add(new THREE.Mesh(wg, new THREE.ShaderMaterial({ uniforms: fu, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: flow })));
  // the bowl: a striped funnel whose stripes swirl toward the hole, a rolled lip, and water sheeting round it
  const prof = []; for (let j = 0; j <= 30; j++) { const r = BW.rh + (BW.R - BW.rh) * j / 30; prof.push(new THREE.Vector2(r, bowlH(r))); }
  prof.push(new THREE.Vector2(BW.R + 0.3, BW.rim + 0.32), new THREE.Vector2(BW.R + 0.55, BW.rim + 0.18), new THREE.Vector2(BW.R + 0.6, BW.rim - 0.2));
  // the stripes come from a texture whose u is turned a little more the further out it is, so they swirl, crisp
  const stripes = canvasTex(1024, 16, (g, w) => { const SC = ['#f08a2a', '#2a64c8', '#f6c22a', '#2a64c8']; for (let k = 0; k < 16; k++) { g.fillStyle = SC[k % 4]; g.fillRect(k * w / 16, 0, w / 16 + 1, 16); } g.fillStyle = 'rgba(255,255,255,.55)'; for (let k = 0; k < 16; k++) g.fillRect(k * w / 16, 0, 3, 16); }, true);
  const bg = new THREE.LatheGeometry(prof, 160), bp = bg.attributes.position, buv = bg.attributes.uv, bc = [];
  for (let i = 0; i < bp.count; i++) { const r = Math.hypot(bp.getX(i), bp.getZ(i)); buv.setX(i, buv.getX(i) + r * 0.05); const c = r > BW.R + 0.1 ? 1.6 : 1; bc.push(c, c, c); }
  bg.setAttribute('color', new THREE.Float32BufferAttribute(bc, 3)); bg.computeVertexNormals();
  const bm = new THREE.Mesh(bg, nightLit(new THREE.MeshPhongMaterial({ map: stripes, vertexColors: true, side: THREE.DoubleSide, shininess: 40, specular: '#5a5a5a' }), 0.4)); bm.position.set(BW.x, 0, BW.z); root.add(bm);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(BW.rh, 0.12, 8, 40).rotateX(Math.PI / 2), nightLit(new THREE.MeshLambertMaterial({ color: '#f08a2a' }), 0.4)); ring.position.set(BW.x, BW.hole, BW.z); root.add(ring);
  const sheet = new THREE.LatheGeometry(prof.slice(0, 29).map(v => new THREE.Vector2(v.x, v.y + 0.05)), 120);
  const sheetM = new THREE.Mesh(sheet, new THREE.ShaderMaterial({ uniforms: fu, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform float uTime,uNight;varying vec2 vUv;void main(){float st=smoothstep(.82,1.,fract(vUv.x*14.+vUv.y*2.5-uTime*.9))+smoothstep(.9,1.,fract(vUv.x*31.-vUv.y*4.-uTime*1.4))*.6;vec3 c=mix(vec3(.6,.9,1.),vec3(1.),st);c*=mix(1.,.45,uNight);gl_FragColor=vec4(c,(.12+st*.45)*smoothstep(0.,.15,vUv.y));}' })); sheetM.position.set(BW.x, 0, BW.z); root.add(sheetM);
  // the pool beneath, and a tiled deck all round with the pool cut out
  pool({ x: BW.x, z: BW.z, rx: BW.pool, rz: BW.pool }, false, [28, 28]);
  const D = BW.deck, sh = new THREE.Shape(); sh.moveTo(D.x0, -D.z0); sh.lineTo(D.x1, -D.z0); sh.lineTo(D.x1, -D.z1); sh.lineTo(D.x0, -D.z1); sh.closePath();
  const hp = new THREE.Path(); hp.absellipse(BW.x, -BW.z, BW.pool * 1.01, BW.pool * 1.01, 0, Math.PI * 2, true); sh.holes.push(hp);
  const dg = new THREE.ShapeGeometry(sh, 64).rotateX(-Math.PI / 2), duv = dg.attributes.uv, dps = dg.attributes.position; for (let i = 0; i < dps.count; i++) duv.setXY(i, dps.getX(i), dps.getZ(i));
  const deck = new THREE.Mesh(dg, new THREE.MeshLambertMaterial({ map: tileTex, color: '#ffffff' })); deck.position.y = 0.06; root.add(deck);
  // its sign by the way in from the fair
  const tex = canvasTex(1024, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#f08a2a'); gr.addColorStop(1, '#2a64c8'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.strokeStyle = '#ffffff'; g.lineWidth = 12; g.strokeRect(10, 10, w - 20, h - 20); g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 128px "Cormorant Garamond", Georgia, serif'; g.fillText('The Thunder Bowl', w / 2, h / 2 + 6); });
  const sx = D.x0 + 1, sz = BW.z + 12, sm = new Merge(); for (const dz of [-3.4, 3.4]) sm.limb(new V3(sx, 0, sz + dz), new V3(sx, 5.2, sz + dz), 0.18, 0.16, C('#f4f1ea')); root.add(new THREE.Mesh(sm.build(), toy));
  for (const r of [-Math.PI / 2, Math.PI / 2]) { const b = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 1.8), new THREE.MeshLambertMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.25 })); b.position.set(sx + (r > 0 ? 0.05 : -0.05), 4.4, sz); b.rotation.y = r; root.add(b); }
}
const tubeAt = s => { const f = clamp(s / TBF.L, 0, 1) * TBF.N, i = Math.min(TBF.N - 1, Math.floor(f)), k = f - i, a = tbf[i], b = tbf[i + 1]; return { c: a.c.clone().lerp(b.c, k), t: a.t.clone().lerp(b.t, k).normalize(), up: a.up.clone().lerp(b.up, k).normalize(), dy: (b.c.y - a.c.y) / (TBF.L / TBF.N) }; };
const bowl = { on: false, phase: 'tube', s: 0, v: 0, r: 0, th: 0, vt: 0, vr: 0, t: 0, fx: 0, fz: 0 };
const bowlNormal = (r, th, v) => { const s = bowlS(r); return v.set(-s * Math.cos(th), 1, -s * Math.sin(th)).normalize(); };
const bowlRide = {
  key: 'bowl', label: 'Ride the Thunder Bowl', name: 'The Thunder Bowl', hint: 'down the tube, round the bowl, and through', exit: W3(BW.x + 12, 0, BW.z - 2),
  board() { bowl.on = true; bowl.phase = 'tube'; bowl.s = 0.5; bowl.v = 1.6; bowl.t = 0; },
  leave() { bowl.on = false; setUnder(0); late.setVeil && late.setVeil(0); },
  seat(v) {
    if (bowl.phase === 'tube') { const f = tubeAt(bowl.s); v.copy(f.c).addScaledVector(f.up, -TBF.R + 0.55).add(O); return; }
    if (bowl.phase === 'bowl') { const n = bowlNormal(bowl.r, bowl.th, tmpV); v.set(BW.x + Math.cos(bowl.th) * bowl.r, bowlH(bowl.r), BW.z + Math.sin(bowl.th) * bowl.r).addScaledVector(n, 1.05).add(O); return; }
    const y = bowl.phase === 'fall' ? Math.max(WATER, BW.hole - 0.3 - 0.5 * G * bowl.t * bowl.t) : bowl.phase === 'float' ? WATER + 0.42 + Math.sin(T * 1.7) * 0.05 : WATER - 0.75 + (WATER + 0.42 - (WATER - 0.75)) * smooth(0.9, 1.7, bowl.t);
    v.set(bowl.fx, y, bowl.fz).add(O);
  },
  fwd(v) {
    if (bowl.phase === 'tube') { v.copy(tubeAt(bowl.s).t); v.y -= 0.1; return; }
    if (bowl.phase === 'bowl') { const c = Math.cos(bowl.th), s = Math.sin(bowl.th); const sp = Math.max(0.5, Math.hypot(bowl.vt, bowl.vr)); v.set((-s * bowl.vt + c * bowl.vr) / sp - c * 0.35, bowlS(bowl.r) * bowl.vr / sp - 0.1, (c * bowl.vt + s * bowl.vr) / sp - s * 0.35).normalize(); return; }
    if (bowl.phase === 'fall') { v.set(Math.cos(bowl.th) * 0.25, -1, Math.sin(bowl.th) * 0.25); return; }
    v.set(Math.cos(bowl.th), bowl.phase === 'float' ? 0.02 : -0.15 + 0.3 * smooth(0.5, 1.5, bowl.t), Math.sin(bowl.th));
  },
};
rides.push(bowlRide);
{ const g = new THREE.Group(); root.add(g); regThing(g, bowlRide.label, start(bowlRide), { x: O.x + BT.x - 4.2, z: O.z + BT.z, r: 4 }); }
addTick(dt => {
  if (state.world !== 'sun' || !bowl.on) return;
  dt = Math.min(dt, 0.05);
  if (bowl.phase === 'tube') {
    const f = tubeAt(bowl.s), sinA = clamp(-f.dy, -1, 1), cosA = Math.sqrt(1 - sinA * sinA);
    bowl.v = clamp(bowl.v + (G * sinA - 0.03 * G * cosA - 0.012 * bowl.v * bowl.v) * dt, 1.5, 14); bowl.s += bowl.v * dt;
    if (bowl.s >= TBF.L - 0.3) { bowl.phase = 'bowl'; bowl.r = BW.R - 0.4; bowl.th = BTH; bowl.vt = bowl.v; bowl.vr = 0; tmpV.set(BW.x + Math.cos(BTH) * bowl.r, bowlH(bowl.r) + 0.3, BW.z + Math.sin(BTH) * bowl.r); burst(tmpV.x, tmpV.y, tmpV.z, 50, 0.9); }
  } else if (bowl.phase === 'bowl') {
    // circling a bowl: the wall's slope pulls you in, your circling speed holds you out; friction and the water's
    // drag slow you, so you circle lower and faster round, until you go through the hole
    for (let n = Math.ceil(dt / 0.005), h = dt / n; n > 0; n--) {
      const s = bowlS(bowl.r), k = Math.sqrt(1 + s * s), sp = Math.max(0.1, Math.hypot(bowl.vt, bowl.vr * k)), fr = 0.08 * G / k + 0.012 * sp * sp;
      const ar = (bowl.vt * bowl.vt / bowl.r - G * s) / (1 + s * s) - fr * bowl.vr * k / sp, at = -bowl.vt * bowl.vr / bowl.r - fr * bowl.vt / sp;
      bowl.vr += ar * h; bowl.vt += at * h; bowl.r += bowl.vr * h; bowl.th += bowl.vt / bowl.r * h;
    }
    if (R() < 0.7) { const p = new V3(BW.x + Math.cos(bowl.th) * bowl.r, bowlH(bowl.r) + 0.1, BW.z + Math.sin(bowl.th) * bowl.r); emit(p.x, p.y, p.z, (R() - 0.5) * 2, 0.8 + R(), (R() - 0.5) * 2, 0.4, 0.2); }
    if (bowl.r < BW.rh + 0.15) { bowl.phase = 'fall'; bowl.t = 0; bowl.fx = BW.x + Math.cos(bowl.th) * BW.rh * 0.5; bowl.fz = BW.z + Math.sin(bowl.th) * BW.rh * 0.5; }
  } else {
    bowl.t += dt;
    if (bowl.phase === 'fall' && BW.hole - 0.3 - 0.5 * G * bowl.t * bowl.t <= WATER) { bowl.phase = 'splash'; bowl.t = 0; burst(bowl.fx, WATER + 0.1, bowl.fz, 200, 2); late.setVeil && late.setVeil(0.85); }
    else if (bowl.phase !== 'fall') {
      late.setVeil && late.setVeil(Math.max(0, 0.85 - bowl.t * 1.6));
      setUnder(bowl.phase === 'splash' ? smooth(0.1, 0.3, bowl.t) * (1 - smooth(1.1, 1.6, bowl.t)) : 0);
      if (bowl.phase === 'splash' && bowl.t > 1.7) { bowl.phase = 'float'; bowl.t = 0; }
      // a little while bobbing in the pool, then up the tower and round again
      if (bowl.phase === 'float' && bowl.t > 5) { bowl.phase = 'tube'; bowl.s = 0.5; bowl.v = 1.6; bowl.t = 0; late.setVeil && late.setVeil(0.6); }
    }
  }
});
// walking here: the deck is level; the pool, the tower and the bowl's legs stop you
{
  const f = worlds.sun.floorH, b = worlds.sun.blocked, D = BW.deck;
  const loc = (x, z) => [x - O.x, z - O.z];
  worlds.sun.floorH = (x, z) => { const [lx, lz] = loc(x, z); if (lx > D.x0 && lx < D.x1 && lz < D.z0 && lz > D.z1 && Math.hypot(lx - BW.x, lz - BW.z) > BW.pool * 1.05) return 0.1; return f(x, z); };
  worlds.sun.blocked = (x, z) => {
    const [lx, lz] = loc(x, z);
    if (Math.hypot(lx - BW.x, lz - BW.z) < BW.pool * 1.06) return true;
    if (Math.abs(lx - BT.x) < 2.8 && Math.abs(lz - BT.z) < 2.8) return true;
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + Math.PI / 8; if (Math.hypot(lx - BW.x - Math.cos(a) * 7.6, lz - BW.z - Math.sin(a) * 7.6) < 0.8) return true; }
    return b(x, z);
  };
}
Object.assign(SUN_PLAN, { BOWL_TUBE: bowlCurve.getSpacedPoints(80) });
export const bowlState = bowl;
provide({ get bowlState() { return bowl; } });
