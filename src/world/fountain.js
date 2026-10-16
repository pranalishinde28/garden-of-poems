import * as THREE from 'three';
import { C, V3, clamp, rng } from '../core/util.js';
import { groundH } from './terrain.js';
import { camera, scene } from './renderer.js';
import { GEO, Merge, VC } from './geometry.js';
import { decor } from './paths.js';
import { clearArea } from './grass.js';
import { waterU } from '../water/water.js';
import { SFX } from '../animals/animals.js';
import { addTick, regThing } from '../core/things.js';
import { flag } from '../settings/storage.js';
import { late } from '../core/late.js';
import { makeKoi } from '../water/koiModel.js';

/* ================= the fountain, between the pond and the Wild Garden ================= */
// A granite fountain: an octagonal pool, two bowls that overflow in falling sheets, a jet at the top.
// The water is drawn in shaders driven by the shared clock, so it costs no CPU per frame. Click it to
// look into the water: it stills and clears, and the koi come up to you. A coin can be tossed from there;
// the coins stay on the pool floor (kept on this device).

export const FOUNTAIN = { x: 11.0, z: -10.2 };
const POOL_Y = 0.38, MID = { y: 1.02, r: 0.92 }, TOP = { y: 1.66, r: 0.47 };
const FS = 1.6; // built at 1 and scaled: the pool is about six metres across
// the ground slopes toward the pond, so the fountain sits level on the highest ground under it, and a
// plinth goes down to the lowest (before, the ground rose through the pool floor on one side)
const GH = (() => { let lo = 1e9, hi = -1e9; for (let k = 0; k < 24; k++) for (const r of [0, 1.8, 3.7]) { const a = k / 24 * 6.28, y = groundH(FOUNTAIN.x + Math.cos(a) * r, FOUNTAIN.z + Math.sin(a) * r); lo = Math.min(lo, y); hi = Math.max(hi, y); } return { lo, hi }; })();
const fountain = new THREE.Group(); fountain.position.set(FOUNTAIN.x, GH.hi + 0.02, FOUNTAIN.z); fountain.scale.setScalar(FS); scene.add(fountain);
clearArea(FOUNTAIN.x, FOUNTAIN.z, 2.45 * FS);
export const fountainGroup = fountain;
export const fountainState = { calm: { value: 0 }, lure: null }; // calm: 1 while you look in; lure: where the koi gather

(function buildStone() {
  const m = new Merge(), R = rng(29), granite = ['#6f6c66', '#67645e', '#77736c', '#625f59'] // weathered grey granite (paler read as plastic in the sun);
  const tone = () => C(granite[Math.floor(R() * 4)]);
  const q = a => new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), a);
  // the pool: eight wall blocks, a wider cap, a step around the outside
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4, side = 2 * 2.05 * Math.tan(Math.PI / 8);
    m.add(GEO.box, new V3(Math.cos(a) * 1.93, 0.2, Math.sin(a) * 1.93), new V3(0.28, 0.46, side * 0.98), tone(), q(-a));
    m.add(GEO.box, new V3(Math.cos(a) * 1.95, 0.46, Math.sin(a) * 1.95), new V3(0.4, 0.07, side * 1.03), tone(), q(-a));
    m.add(GEO.box, new V3(Math.cos(a) * 2.2, 0.03, Math.sin(a) * 2.2), new V3(0.3, 0.07, side * 1.13), C('#5d5a54'), q(-a));
  }
  { const drop = (GH.hi - GH.lo + 0.3) / FS; m.add(new THREE.CylinderGeometry(2.36, 2.42, drop, 8, 1, false, Math.PI / 8), new V3(0, -drop / 2 + 0.005, 0), new V3(1, 1, 1), C('#57544e')); }
  // the column and two bowls, turned on a lathe
  const bowl = (r, h) => new THREE.LatheGeometry([[0.12, 0], [r * 0.45, h * 0.12], [r * 0.82, h * 0.48], [r, h * 0.92], [r * 1.04, h], [r * 0.95, h * 1.02], [r * 0.9, h * 0.8], [0.1, h * 0.55]].map(([x, y]) => new THREE.Vector2(x, y)), 28);
  const column = (r0, r1, h) => new THREE.LatheGeometry([[r0 * 1.5, 0], [r0 * 1.5, h * 0.08], [r0, h * 0.16], [r1 * 0.9, h * 0.7], [r1 * 1.3, h * 0.88], [r1 * 1.3, h]].map(([x, y]) => new THREE.Vector2(x, y)), 20);
  m.add(column(0.2, 0.15, MID.y - 0.12), new V3(0, 0.06, 0), new V3(1, 1, 1), tone());
  m.add(bowl(MID.r, 0.3), new V3(0, MID.y - 0.24, 0), new V3(1, 1, 1), C('#706d66'));
  m.add(column(0.12, 0.08, TOP.y - MID.y - 0.08), new V3(0, MID.y + 0.02, 0), new V3(1, 1, 1), tone());
  m.add(bowl(TOP.r, 0.2), new V3(0, TOP.y - 0.16, 0), new V3(1, 1, 1), C('#73706a'));
  // a lotus bud where the jet rises
  m.add(GEO.sph, new V3(0, TOP.y + 0.06, 0), new V3(0.07, 0.11, 0.07), C('#7a7770'));
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; m.add(GEO.sph, new V3(Math.cos(a) * 0.06, TOP.y + 0.02, Math.sin(a) * 0.06), new V3(0.04, 0.08, 0.025), C('#726f69'), q(-a)); }
  const mesh = new THREE.Mesh(m.build(), VC); mesh.castShadow = true; mesh.receiveShadow = true; fountain.add(mesh);
})();

// still water in the pool and bowls: rings where the sheets land, a little shimmer, and a splash
const surfaces = [];
function waterSurface(r, y, fall, clear = false) {
  const u = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uFall: { value: fall }, uSplash: { value: new THREE.Vector3(0, 0, -99) }, uClear: { value: clear ? 1 : 0 } }]);
  u.uTime = waterU.uTime; u.uNight = waterU.uNight; u.uCalm = fountainState.calm;
  const mat = new THREE.ShaderMaterial({
    uniforms: u, fog: true, transparent: true,
    vertexShader: `varying vec2 vP;varying vec3 vW;
      #include <fog_pars_vertex>
      void main(){vP=position.xz;vW=(modelMatrix*vec4(position,1.)).xyz;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime,uNight,uFall,uClear,uCalm;uniform vec3 uSplash;varying vec2 vP;varying vec3 vW;
      #include <fog_pars_fragment>
      void main(){
        float r=length(vP),d=abs(r-uFall);
        float ring=sin(d*34.-uTime*8.)*exp(-d*3.5);
        float n=sin(vP.x*11.+uTime*1.7)*sin(vP.y*9.-uTime*1.3);
        float st=uTime-uSplash.z,sr=length(vP-uSplash.xy),w=st*0.8;
        float sp=(st>0.&&st<2.4)?sin((sr-w)*32.)*exp(-abs(sr-w)*7.)*(1.-st/2.4)*1.6:0.;
        float calm=1.-uCalm*0.85,h=(ring*.55+n*.2)*calm+sp;
        vec3 c=mix(vec3(.13,.31,.34),vec3(.5,.71,.74),.38+.3*h);
        c+=vec3(.9,.95,1.)*pow(max(h,0.),3.)*.45;
        c=mix(c,vec3(.92,.95,.96),smoothstep(.1,0.,d)*.55*calm*(.6+.4*sin(uTime*13.+atan(vP.y,vP.x)*9.)));
        c*=mix(1.,.35,uNight);
        // the pool is clear: you see through it from above, and it mirrors the sky at a glance
        vec3 v=normalize(cameraPosition-vW);float fr=pow(1.-clamp(v.y,0.,1.),3.);
        float a=mix(.9,mix(mix(.34,.12,uCalm),.82,fr),uClear);
        if(uClear>.5)c=mix(mix(vec3(.55,.8,.82),vec3(.75,.88,.92),fr),c,.45+.25*fr);
        gl_FragColor=vec4(c,a);
        #include <fog_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 32).rotateX(-Math.PI / 2), mat); m.position.y = y; fountain.add(m); surfaces.push(m);
  return m;
}
const pool = waterSurface(1.86, POOL_Y, MID.r + 0.02, true);
// the pool floor: pale stone with the sun's light rippling over it (caustics), so the koi show clearly
(function buildFloor() {
  const u = THREE.UniformsUtils.merge([THREE.UniformsLib.fog]); u.uTime = waterU.uTime; u.uNight = waterU.uNight;
  const mat = new THREE.ShaderMaterial({ uniforms: u, fog: true,
    vertexShader: `varying vec2 vP;
      #include <fog_pars_vertex>
      void main(){vP=position.xz;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime,uNight;varying vec2 vP;
      #include <fog_pars_fragment>
      float cell(vec2 p){vec2 i=floor(p),f=fract(p);float m=1.;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(x,y),o=fract(sin(vec2(dot(i+g,vec2(127.1,311.7)),dot(i+g,vec2(269.5,183.3))))*43758.5453);o=.5+.45*sin(uTime*.9+6.2831*o);m=min(m,length(g+o-f));}return m;}
      void main(){
        vec2 p=vP*3.2;float c=pow(1.-cell(p),6.)*.9+pow(1.-cell(p*1.7+3.1),8.)*.5;
        float tile=step(.96,fract(vP.x*1.6))+step(.96,fract(vP.y*1.6));
        vec3 col=mix(vec3(.76,.74,.68),vec3(.62,.6,.55),tile*.6)*mix(vec3(.82,.92,.92),vec3(1.),.5)+vec3(1.,.98,.9)*c*.45;
        col*=mix(1.,.3,uNight);
        gl_FragColor=vec4(col,1.);
        #include <fog_fragment>
      }` });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1.95, 8, Math.PI / 8).rotateX(-Math.PI / 2), mat); floor.position.y = 0.065; fountain.add(floor);
})();
waterSurface(MID.r * 0.93, MID.y + 0.03, TOP.r + 0.02);
waterSurface(TOP.r * 0.92, TOP.y + 0.0, 0.18);

// sheets of water spilling from each bowl's lip
const sheetMat = new THREE.ShaderMaterial({
  uniforms: { uTime: waterU.uTime, uNight: waterU.uNight }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: `uniform float uTime,uNight;varying vec2 vUv;
    float h(float x){return fract(sin(x*91.7)*437.5);}
    float vn(float x){float i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(h(i),h(i+1.),f);}
    void main(){float x=vUv.x*70.;float sp=1.3+vn(x*.7)*.6;
      // soft, moving strands rather than hard columns
      float s=vn(x+vUv.y*1.5)*.5+vn(x*2.3-uTime*.3)*.5;float flow=fract(vUv.y*1.2+uTime*sp+vn(x*.4)*3.);
      float a=.16+.3*smoothstep(.35,.95,s)+.18*smoothstep(.7,1.,flow)*s;a*=smoothstep(0.,.15,vUv.y);
      vec3 c=mix(vec3(.82,.9,.93),vec3(1.),s)*mix(1.,.4,uNight);gl_FragColor=vec4(c,a);}`,
});
for (const [b, y1] of [[MID, POOL_Y], [TOP, MID.y + 0.03]]) {
  const h = b.y - y1, m = new THREE.Mesh(new THREE.CylinderGeometry(b.r * 1.02, b.r * 1.07, h, 40, 1, true), sheetMat);
  m.position.y = y1 + h / 2; m.layers.set(2); fountain.add(m);
}
// the jet: drops thrown up from the bud, worked out entirely in the shader
(function buildJet() {
  const N = 90, R = rng(31), ph = new Float32Array(N), dir = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) { ph[i] = R(); const a = R() * 6.28, s = 0.25 + R() * 0.55; dir[i * 2] = Math.cos(a) * s; dir[i * 2 + 1] = Math.sin(a) * s; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3));
  g.setAttribute('aPh', new THREE.BufferAttribute(ph, 1)); g.setAttribute('aDir', new THREE.BufferAttribute(dir, 2));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: waterU.uTime, uNight: waterU.uNight }, transparent: true, depthWrite: false,
    vertexShader: `uniform float uTime;attribute float aPh;attribute vec2 aDir;varying float vA;
      void main(){float t=fract(uTime*1.3+aPh),tau=t*.68;vec3 p=vec3(aDir.x*tau*.75,2.9*tau-4.9*tau*tau,aDir.y*tau*.75);
        vA=1.-t*.6;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(90./-mv.z,1.,9.);}`,
    fragmentShader: `uniform float uNight;varying float vA;void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(vec3(.9,.96,1.)*mix(1.,.45,uNight),smoothstep(.5,.1,d)*vA*.8);}`,
  });
  const pts = new THREE.Points(g, mat); pts.position.y = TOP.y + 0.14; pts.frustumCulled = false; pts.layers.set(2); fountain.add(pts);
})();

decor.push({ x: FOUNTAIN.x, z: FOUNTAIN.z, r: 2.9 * FS, collide: 2.25 * FS });

/* ---------- coins for wishes ---------- */
// a bright little ring as the coin leaves your hand, then the plop and spray as it lands
SFX.coin = function () { const o = this.out(); if (!o) return; const ctx = late.Music.ctx, t = ctx.currentTime + 0.01; [2637, 3951, 5274].forEach((f, i) => { const os = ctx.createOscillator(), g = ctx.createGain(); os.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07 / (i + 1), t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5 - i * 0.1); os.connect(g); g.connect(o); os.start(t); os.stop(t + 0.55); }); };
SFX.splash = function () {
  const o = this.out(); if (!o) return; const ctx = late.Music.ctx, t = ctx.currentTime + 0.01;
  const os = ctx.createOscillator(), g = ctx.createGain(); os.frequency.setValueAtTime(900, t); os.frequency.exponentialRampToValueAtTime(260, t + 0.07); g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09); os.connect(g); g.connect(o); os.start(t); os.stop(t + 0.1);
  const len = ctx.sampleRate * 0.35, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const n = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), ng = ctx.createGain(); n.buffer = buf; hp.type = 'highpass'; hp.frequency.value = 1800; ng.gain.value = 0.12; n.connect(hp); hp.connect(ng); ng.connect(o); n.start(t + 0.02);
};

const COIN_KEY = 'coins', MAX_COINS = 48;
const coinMat = new THREE.MeshLambertMaterial({ color: '#d9b45a', emissive: '#4a3510' });
const coinGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.008, 14);
const resting = new THREE.InstancedMesh(coinGeo, coinMat, MAX_COINS); resting.count = 0; fountain.add(resting);
const flying = new THREE.Mesh(coinGeo, coinMat); flying.visible = false; scene.add(flying);
const cR = rng(97), dd = new THREE.Object3D();
function placeCoin(i, x, z) { dd.position.set(x, 0.07, z); dd.rotation.set((cR() - .5) * 0.2, cR() * 6.28, (cR() - .5) * 0.2); dd.updateMatrix(); resting.setMatrixAt(i, dd.matrix); resting.count = Math.max(resting.count, i + 1); resting.instanceMatrix.needsUpdate = true; }
let coins = Math.min(MAX_COINS, Number(flag.get(COIN_KEY)) || 0);
for (let i = 0; i < coins; i++) { const a = cR() * 6.28, r = 0.45 + cR() * 1.25; placeCoin(i, Math.cos(a) * r, Math.sin(a) * r); }

const WISHES = ['A wish, kept by the water.', 'The water will keep it for you.', 'Something hoped for, quietly.', 'The fountain hums. Your wish is safe here.', 'Let it sink. Let it be held.'];
let tossing = false;
export function tossCoin() {
  if (tossing) return; tossing = true;
  const from = camera.position.clone().add(new V3(0, -0.35, 0)), to = new V3();
  // land in the near half of the pool, clear of the column
  const toYou = new V3(from.x - FOUNTAIN.x, 0, from.z - FOUNTAIN.z).normalize(), a = Math.atan2(toYou.z, toYou.x) + (Math.random() - .5) * 1.4, r = 0.6 + Math.random() * 0.9;
  const lx = Math.cos(a) * r, lz = Math.sin(a) * r; to.set(FOUNTAIN.x + lx * FS, fountain.position.y + POOL_Y * FS, FOUNTAIN.z + lz * FS);
  const dur = 0.85, peak = Math.max(from.y, to.y) + 0.7; let t = 0;
  flying.visible = true; SFX.coin && SFX.coin();
  addTick(dt => {
    t += dt / dur; const k = Math.min(1, t);
    flying.position.lerpVectors(from, to, k); flying.position.y = (1 - k) * (1 - k) * from.y + 2 * (1 - k) * k * peak + k * k * to.y;
    flying.rotation.x += dt * 18; flying.rotation.z += dt * 7;
    if (k < 1) return true;
    flying.visible = false; tossing = false;
    pool.material.uniforms.uSplash.value.set(lx, lz, waterU.uTime.value);
    SFX.splash && SFX.splash();
    coins++; flag.set(COIN_KEY, String(coins)); placeCoin((coins - 1) % MAX_COINS, lx, lz);
    late.toast(coins % 10 === 0 ? `${coins} wishes rest in the fountain now.` : WISHES[(coins - 1) % WISHES.length], 3200);
    return false;
  });
}
regThing(fountain, 'Look into the fountain', () => (late.lookIntoFountain ? late.lookIntoFountain() : tossCoin()), { x: FOUNTAIN.x, z: FOUNTAIN.z, r: 3.4 * FS });

/* ---------- the koi in the pool ---------- */
// seven fish of different varieties, steering round the column; when you look in they gather on your side
const fish = ['kohaku', 'tancho', 'ogon', 'showa', 'sanke', 'asagi', 'yamabuki'].map((kind, i) => {
  const R = rng(500 + i), k = makeKoi(kind, 0.28 + R() * 0.08, 40 + i), a = R() * 6.28, r = 0.8 + R() * 0.7;
  fountain.add(k.g);
  return { k, x: Math.cos(a) * r, z: Math.sin(a) * r, h: R() * 6.28, sp: 0.18 + R() * 0.1, tx: 0, tz: 0, R, ph: R() * 9, turn: 0 };
});
fish.forEach(f => { f.tx = f.x; f.tz = f.z; });
function newTarget(f) {
  const L = fountainState.lure;
  if (L) { const a = Math.atan2(L.z, L.x) + (f.R() - 0.5) * 1.3, r = 1.15 + f.R() * 0.45; f.tx = Math.cos(a) * r; f.tz = Math.sin(a) * r; return; }
  const a = f.R() * 6.28, r = 0.75 + f.R() * 0.85; f.tx = Math.cos(a) * r; f.tz = Math.sin(a) * r;
}
addTick(dt => {
  const near = fountain.visible && camera.position.distanceTo(fountain.position) < 45;
  fish.forEach(f => { f.k.g.visible = near; }); // nobody near: they are not drawn at all
  if (!near) return true;
  const t = waterU.uTime.value;
  fish.forEach(f => {
    if (Math.hypot(f.tx - f.x, f.tz - f.z) < 0.25 || f.R() < dt * 0.08) newTarget(f);
    let want = Math.atan2(f.tx - f.x, f.tz - f.z), d = Math.atan2(Math.sin(want - f.h), Math.cos(want - f.h));
    const r = Math.hypot(f.x, f.z); if (r < 0.62) d += Math.atan2(Math.sin(Math.atan2(f.x, f.z) - f.h), Math.cos(Math.atan2(f.x, f.z) - f.h)) * 0.8; // round the column
    const turn = clamp(d, -1.4 * dt, 1.4 * dt); f.h += turn; f.turn += (turn / Math.max(dt, 1e-3) * 0.12 - f.turn) * 0.1;
    const sp = f.sp * (fountainState.lure ? 1.35 : 1);
    f.x += Math.sin(f.h) * sp * dt; f.z += Math.cos(f.h) * sp * dt;
    const rr = Math.hypot(f.x, f.z); if (rr > 1.68) { f.x *= 1.68 / rr; f.z *= 1.68 / rr; }
    f.k.g.position.set(f.x, 0.2 + Math.sin(t * 0.7 + f.ph) * 0.03 + (fountainState.lure ? 0.06 : 0), f.z); f.k.g.rotation.y = f.h;
    f.k.swim(t + f.ph, sp / 0.3, clamp(f.turn, -0.6, 0.6));
  });
  return true;
}, true);

/* ---------- the sound of water, nearer as you walk up ---------- */
let amb = null, ambV = -1;
addTick(() => {
  const M = late.Music; if (!M || !M.ctx) return true;
  if (!amb) {
    const ctx = M.ctx, len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let b = 0; for (let i = 0; i < len; i++) { b = 0.97 * b + 0.03 * (Math.random() * 2 - 1); d[i] = (Math.random() * 2 - 1) * 0.5 + b * 4; }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.6;
    const g = ctx.createGain(); g.gain.value = 0; src.connect(bp); bp.connect(g); g.connect(ctx.destination); src.start();
    amb = g;
  }
  const d = Math.hypot(camera.position.x - FOUNTAIN.x, camera.position.z - FOUNTAIN.z);
  // only when it changes: each setTargetAtTime adds an event to the gain's timeline
  const v = M.muted ? 0 : Math.round(0.11 * Math.pow(clamp(1 - (d - 2.5) / 16, 0, 1), 2) * 400) / 400;
  if (v !== ambV) { ambV = v; amb.gain.setTargetAtTime(v, M.ctx.currentTime, 0.3); }
  return true;
}, true);
