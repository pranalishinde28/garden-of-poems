import * as THREE from 'three';
import { C, V3, clamp, rng } from '../core/util.js';
import { groundH } from './terrain.js';
import { camera, scene } from './renderer.js';
import { GEO, Merge, VC } from './geometry.js';
import { decor } from './paths.js';
import { waterU } from '../water/water.js';
import { SFX } from '../animals/animals.js';
import { addTick, regThing } from '../core/things.js';
import { flag } from '../settings/storage.js';
import { late } from '../core/late.js';

/* ================= the fountain, between the pond and the Wild Garden ================= */
// A granite fountain: an octagonal pool, two bowls that overflow in falling sheets, a jet at the top.
// The water is drawn in shaders driven by the shared clock, so it costs no CPU per frame. Click it to
// toss a coin; the coins stay on the pool floor (kept on this device).

export const FOUNTAIN = { x: 11.0, z: -10.2 };
const POOL_Y = 0.38, MID = { y: 1.02, r: 0.92 }, TOP = { y: 1.66, r: 0.47 };
const fountain = new THREE.Group(); fountain.position.set(FOUNTAIN.x, groundH(FOUNTAIN.x, FOUNTAIN.z) - 0.04, FOUNTAIN.z); scene.add(fountain);

(function buildStone() {
  const m = new Merge(), R = rng(29), granite = ['#8b8880', '#827f77', '#938f86', '#7c7972'];
  const tone = () => C(granite[Math.floor(R() * 4)]);
  const q = a => new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), a);
  // the pool: eight wall blocks, a wider cap, a step around the outside
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4, side = 2 * 2.05 * Math.tan(Math.PI / 8);
    m.add(GEO.box, new V3(Math.cos(a) * 1.93, 0.2, Math.sin(a) * 1.93), new V3(0.28, 0.46, side * 0.98), tone(), q(-a));
    m.add(GEO.box, new V3(Math.cos(a) * 1.95, 0.46, Math.sin(a) * 1.95), new V3(0.4, 0.07, side * 1.03), tone(), q(-a));
    m.add(GEO.box, new V3(Math.cos(a) * 2.2, 0.03, Math.sin(a) * 2.2), new V3(0.3, 0.07, side * 1.13), C('#75726b'), q(-a));
  }
  m.add(new THREE.CylinderGeometry(1.95, 1.95, 0.06, 8, 1, false, Math.PI / 8), new V3(0, 0.03, 0), new V3(1, 1, 1), C('#5d6a66'));
  // the column and two bowls, turned on a lathe
  const bowl = (r, h) => new THREE.LatheGeometry([[0.12, 0], [r * 0.45, h * 0.12], [r * 0.82, h * 0.48], [r, h * 0.92], [r * 1.04, h], [r * 0.95, h * 1.02], [r * 0.9, h * 0.8], [0.1, h * 0.55]].map(([x, y]) => new THREE.Vector2(x, y)), 28);
  const column = (r0, r1, h) => new THREE.LatheGeometry([[r0 * 1.5, 0], [r0 * 1.5, h * 0.08], [r0, h * 0.16], [r1 * 0.9, h * 0.7], [r1 * 1.3, h * 0.88], [r1 * 1.3, h]].map(([x, y]) => new THREE.Vector2(x, y)), 20);
  m.add(column(0.2, 0.15, MID.y - 0.12), new V3(0, 0.06, 0), new V3(1, 1, 1), tone());
  m.add(bowl(MID.r, 0.3), new V3(0, MID.y - 0.24, 0), new V3(1, 1, 1), C('#8d8a82'));
  m.add(column(0.12, 0.08, TOP.y - MID.y - 0.08), new V3(0, MID.y + 0.02, 0), new V3(1, 1, 1), tone());
  m.add(bowl(TOP.r, 0.2), new V3(0, TOP.y - 0.16, 0), new V3(1, 1, 1), C('#918e86'));
  // a lotus bud where the jet rises
  m.add(GEO.sph, new V3(0, TOP.y + 0.06, 0), new V3(0.07, 0.11, 0.07), C('#97948c'));
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; m.add(GEO.sph, new V3(Math.cos(a) * 0.06, TOP.y + 0.02, Math.sin(a) * 0.06), new V3(0.04, 0.08, 0.025), C('#8f8c84'), q(-a)); }
  const mesh = new THREE.Mesh(m.build(), VC); mesh.castShadow = true; mesh.receiveShadow = true; fountain.add(mesh);
})();

// still water in the pool and bowls: rings where the sheets land, a little shimmer, and a splash
const surfaces = [];
function waterSurface(r, y, fall) {
  const u = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uFall: { value: fall }, uSplash: { value: new THREE.Vector3(0, 0, -99) } }]);
  u.uTime = waterU.uTime; u.uNight = waterU.uNight;
  const mat = new THREE.ShaderMaterial({
    uniforms: u, fog: true, transparent: true,
    vertexShader: `varying vec2 vP;
      #include <fog_pars_vertex>
      void main(){vP=position.xz;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime,uNight,uFall;uniform vec3 uSplash;varying vec2 vP;
      #include <fog_pars_fragment>
      void main(){
        float r=length(vP),d=abs(r-uFall);
        float ring=sin(d*34.-uTime*8.)*exp(-d*3.5);
        float n=sin(vP.x*11.+uTime*1.7)*sin(vP.y*9.-uTime*1.3);
        float st=uTime-uSplash.z,sr=length(vP-uSplash.xy),w=st*0.8;
        float sp=(st>0.&&st<2.4)?sin((sr-w)*32.)*exp(-abs(sr-w)*7.)*(1.-st/2.4)*1.6:0.;
        float h=ring*.55+n*.2+sp;
        vec3 c=mix(vec3(.13,.31,.34),vec3(.5,.71,.74),.38+.3*h);
        c+=vec3(.9,.95,1.)*pow(max(h,0.),3.)*.45;
        c=mix(c,vec3(.92,.95,.96),smoothstep(.1,0.,d)*.55*(.6+.4*sin(uTime*13.+atan(vP.y,vP.x)*9.)));
        c*=mix(1.,.35,uNight);
        gl_FragColor=vec4(c,.9);
        #include <fog_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 32).rotateX(-Math.PI / 2), mat); m.position.y = y; fountain.add(m); surfaces.push(m);
  return m;
}
const pool = waterSurface(1.86, POOL_Y, MID.r + 0.02);
waterSurface(MID.r * 0.93, MID.y + 0.03, TOP.r + 0.02);
waterSurface(TOP.r * 0.92, TOP.y + 0.0, 0.18);

// sheets of water spilling from each bowl's lip
const sheetMat = new THREE.ShaderMaterial({
  uniforms: { uTime: waterU.uTime, uNight: waterU.uNight }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: `uniform float uTime,uNight;varying vec2 vUv;
    float h(float x){return fract(sin(x*91.7)*437.5);}
    void main(){float col=floor(vUv.x*90.);float s=fract(vUv.y*1.3+uTime*(1.4+h(col)*.6)+h(col+7.));
      float a=.18+.42*smoothstep(.55,1.,s)*(.5+.5*h(col+3.));a*=smoothstep(0.,.12,vUv.y);
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

decor.push({ x: FOUNTAIN.x, z: FOUNTAIN.z, r: 2.9, collide: 2.25 });

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
function tossCoin() {
  if (tossing) return; tossing = true;
  const from = camera.position.clone().add(new V3(0, -0.35, 0)), to = new V3();
  // land in the near half of the pool, clear of the column
  const toYou = new V3(from.x - FOUNTAIN.x, 0, from.z - FOUNTAIN.z).normalize(), a = Math.atan2(toYou.z, toYou.x) + (Math.random() - .5) * 1.4, r = 0.6 + Math.random() * 0.9;
  const lx = Math.cos(a) * r, lz = Math.sin(a) * r; to.set(FOUNTAIN.x + lx, fountain.position.y + POOL_Y, FOUNTAIN.z + lz);
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
regThing(fountain, 'Toss a coin and make a wish', tossCoin, { x: FOUNTAIN.x, z: FOUNTAIN.z, r: 3.6 });

/* ---------- the sound of water, nearer as you walk up ---------- */
let amb = null;
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
  const v = M.muted ? 0 : 0.11 * Math.pow(clamp(1 - (d - 2.5) / 16, 0, 1), 2);
  amb.gain.setTargetAtTime(v, M.ctx.currentTime, 0.3);
  return true;
}, true);
