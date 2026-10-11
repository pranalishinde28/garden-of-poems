import * as THREE from 'three';
import { C, V3, isTouch, rng } from '../core/util.js';
import { WATER_Y, groundH } from './terrain.js';
import { SETTINGS, THEME, poems } from '../settings/storage.js';
import { POINT_VS_HEAD, pointsMat, scene } from './renderer.js';
import { glowTex } from './textures.js';
import { windU } from './wind.js';
import { DS, GEO, M, part } from './geometry.js';
import { plants } from '../plants/registry.js';
import { late, provide } from '../core/late.js';

// names other modules reach through late (see core/late.js)
provide({
  get rebuildPetals() { return rebuildPetals; },
});

/* ================= particles ================= */
export const ffU = { uTime: windU.uTime, uOpacity: { value: 0 }, uColor: { value: C('#f7e9a8') } };
(function buildFireflies() {
  const N = isTouch ? 150 : 280, R = rng(17), pos = [], seed = [];
  for (let i = 0; i < N; i++) { const a = R() * 6.28, r = 6 + Math.sqrt(R()) * 56, x = Math.cos(a) * r, z = Math.sin(a) * r; pos.push(x, Math.max(groundH(x, z), WATER_Y) + 0.4 + R() * 1.8, z); seed.push(R()); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
  const m = pointsMat(ffU, `${POINT_VS_HEAD}attribute float aSeed;uniform float uTime;varying float vA;void main(){vec3 p=position;float t=uTime*0.32+aSeed*6.28;
    p.x+=sin(t*1.3+aSeed*10.)*0.9;p.y+=sin(t*0.9)*0.35;p.z+=cos(t*1.1+aSeed*4.)*0.9;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
    gl_PointSize=min(0.13*uScale/-mv.z,40.);vA=pow(0.5+0.5*sin(uTime*1.7+aSeed*40.),2.);}`,
    'uniform vec3 uColor;uniform float uOpacity;varying float vA;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,0.,d);gl_FragColor=vec4(uColor,a*a*vA*uOpacity);}', true);
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; scene.add(pts);
})();
export const airU = { uTime: windU.uTime, uCam: { value: new V3() }, uFall: { value: 0.03 }, uSway: { value: 0.5 }, uSize: { value: 0.04 }, uLeaf: { value: 0 }, uOpacity: { value: 0 }, uColor: { value: new THREE.Color() } };
(function buildAir() {
  const N = isTouch ? 300 : 600, R = rng(19), pos = [], seed = [];
  for (let i = 0; i < N; i++) { pos.push(R() * 40, R() * 12, R() * 40); seed.push(R()); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
  const m = pointsMat(airU, `${POINT_VS_HEAD}attribute float aSeed;uniform float uTime,uFall,uSway,uSize;uniform vec3 uCam;varying float vRot,vA;
    void main(){vec3 p=position;float t=uTime;
      p.x+=t*0.22+sin(t*0.7+aSeed*20.)*uSway;p.z+=t*0.1+cos(t*0.5+aSeed*13.)*uSway;
      p.y-=t*uFall*(0.6+aSeed*0.8);p.y+=sin(t*0.6+aSeed*30.)*0.3;
      p.xz=mod(p.xz-uCam.xz+20.,40.)+uCam.xz-20.;float yy=mod(p.y,12.);p.y=yy+uCam.y-3.5;
      vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
      gl_PointSize=min(uSize*uScale/-mv.z,36.);vRot=aSeed*6.28+t*(0.6+aSeed);
      vA=smoothstep(20.,9.,length(p.xz-uCam.xz))*smoothstep(0.,1.2,yy)*smoothstep(12.,10.,yy)*smoothstep(0.3,1.4,-mv.z);}`,
    `uniform vec3 uColor;uniform float uLeaf,uOpacity;varying float vRot,vA;void main(){vec2 c=gl_PointCoord-.5;float s=sin(vRot),co=cos(vRot);c=mat2(co,-s,s,co)*c;
      float d=mix(length(c),length(c*vec2(1.,2.3)),uLeaf);float a=mix(smoothstep(.5,0.,d),smoothstep(.5,.4,d),uLeaf);
      gl_FragColor=vec4(uColor*(1.-0.3*uLeaf*(c.x+.5)),a*vA*uOpacity);}`, false);
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; scene.add(pts);
})();
/* rain: slanted streaks in a box that follows the camera; uRain thins or fills it */
export const rainU = { uTime: windU.uTime, uCam: { value: new V3() }, uRain: { value: 0 }, uNight: { value: 0 }, uWind: { value: new THREE.Vector2(1.1, 0.5) } };
(function buildRain() {
  const N = isTouch ? 1800 : 4200, R = rng(23), pos = [], end = [], seed = [];
  for (let i = 0; i < N; i++) { const x = R() * 40, y = R() * 16, z = R() * 40, s = R(); for (let e = 0; e < 2; e++) { pos.push(x, y, z); end.push(e); seed.push(s); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aEnd', new THREE.Float32BufferAttribute(end, 1)); g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
  const m = new THREE.ShaderMaterial({ uniforms: rainU, transparent: true, depthWrite: false,
    vertexShader: `attribute float aEnd,aSeed;uniform float uTime,uRain;uniform vec3 uCam;uniform vec2 uWind;varying float vA,vEnd;
      void main(){vec3 p=position;float sp=10.+aSeed*4.;float y=mod(p.y-uTime*sp,16.);
        p.xz+=uWind*(y/sp)+aEnd*uWind*0.05;p.xz=mod(p.xz-uCam.xz+20.,40.)+uCam.xz-20.;
        p.y=y+uCam.y-5.+aEnd*(0.5+aSeed*0.25);
        vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;vEnd=aEnd;
        vA=step(aSeed,uRain)*smoothstep(20.,12.,length(p.xz-uCam.xz))*smoothstep(0.,1.5,y)*smoothstep(16.,13.,y)*smoothstep(0.4,1.6,-mv.z);}`,
    fragmentShader: `uniform float uNight;varying float vA,vEnd;void main(){gl_FragColor=vec4(mix(vec3(.82,.86,.9),vec3(.5,.56,.66),uNight),vA*mix(.6,.08,vEnd));}` });
  const lines = new THREE.LineSegments(g, m); lines.frustumCulled = false; lines.layers.set(2); scene.add(lines);
})();
/* falling sakura petals */
export const petalU = { uTime: windU.uTime, uAutumn: { value: 0 }, uOpacity: { value: 1 }, uWind: { value: new THREE.Vector2(0.7, 0.3) } };
let petalPoints = null;
export function rebuildPetals() {
  if (petalPoints) { scene.remove(petalPoints); petalPoints.geometry.dispose(); petalPoints = null; }
  if (THEME !== 'autumn' && SETTINGS.tree === 'green') return;
  const trees = []; plants.forEach(pl => { if (pl.canopy && pl.target === 1 && !pl.dying) trees.push(pl); });
  if (!trees.length) return;
  const total = Math.min(isTouch ? 450 : 1100, trees.length * 110), pos = [], gr = [], sd = [], R = rng(trees.length * 7 + 3);
  for (let i = 0; i < total; i++) {
    const pl = trees[i % trees.length], c = pl.canopy, a = R() * 6.28, r = Math.sqrt(R()) * c.r;
    const x = pl.root.position.x + Math.cos(a) * r, z = pl.root.position.z + Math.sin(a) * r;
    pos.push(x, pl.root.position.y + c.top + R() * 0.6, z); gr.push(groundH(x, z) + 0.02); sd.push(R());
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aGround', new THREE.Float32BufferAttribute(gr, 1)); g.setAttribute('aSeed', new THREE.Float32BufferAttribute(sd, 1));
  const m = pointsMat(petalU, `${POINT_VS_HEAD}attribute float aGround,aSeed;uniform float uTime;uniform vec2 uWind;varying float vRot,vA,vT;
    void main(){float H=max(position.y-aGround,0.6);float sp=0.22+aSeed*0.25;float k=mod(uTime*sp+aSeed*H*7.,H+1.2);float fall=min(k,H);
      vec3 p=vec3(position.x,position.y-fall,position.z);float f=fall/H;
      p.xz+=uWind*fall*0.55+vec2(sin(uTime*1.3+aSeed*40.),cos(uTime*1.1+aSeed*23.))*0.28*(f+0.15);
      vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=min(0.065*uScale/-mv.z,30.);
      vRot=aSeed*30.+uTime*(0.8+aSeed*2.);vT=aSeed;vA=smoothstep(0.,0.3,k)*(1.-smoothstep(H,H+1.2,k))*smoothstep(0.2,0.9,-mv.z);}`,
    `uniform float uOpacity,uAutumn;varying float vRot,vA,vT;void main(){vec2 c=gl_PointCoord-.5;float s=sin(vRot),co=cos(vRot);c=mat2(co,-s,s,co)*c;
      float d=length(vec2(c.x*1.8,c.y));float a=smoothstep(.46,.36,d);a*=1.-step(0.3,c.y)*step(abs(c.x),0.045);
      vec3 col=mix(mix(vec3(1.,.9,.93),vec3(.96,.68,.78),vT),mix(vec3(.82,.22,.14),vec3(.96,.74,.2),vT),uAutumn)*(0.85+0.3*(0.5-c.y));gl_FragColor=vec4(col,a*vA*uOpacity);}`, false);
  petalPoints = new THREE.Points(g, m); petalPoints.frustumCulled = false; scene.add(petalPoints);
}
export const linkU = { uTime: windU.uTime, uOpacity: { value: 0.4 } };
let linkPoints = null;
const LINK_WORDS = ['summer', 'winter', 'autumn', 'spring', 'rain', 'snow', 'moon', 'sea', 'river', 'mother', 'father', 'grandmother', 'home', 'train', 'city', 'letter', 'hands', 'light', 'station', 'night'];
function poemWords(p) { const t = (p.title + ' ' + p.content).toLowerCase(); return LINK_WORDS.filter(w => new RegExp('\\b' + w + '\\b').test(t)); }
export function rebuildConnections() {
  if (linkPoints) { scene.remove(linkPoints); linkPoints.geometry.dispose(); linkPoints = null; }
  const vis = poems.filter(p => late.inFilter(p) && plants.has(p.id) && !plants.get(p.id).dying);
  const words = vis.map(poemWords), cnt = vis.map(() => 0), pos = [], ts = [], sd = [];
  for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
    if (cnt[i] >= 2 || cnt[j] >= 2) continue;
    const a = vis[i], b = vis[j];
    const sameTheme = a.theme && b.theme && a.theme.trim().toLowerCase() === b.theme.trim().toLowerCase();
    if (!sameTheme && !words[i].some(w => words[j].includes(w))) continue;
    const pa = plants.get(a.id), pb = plants.get(b.id);
    const A = pa.root.position.clone().add(new V3(0, pa.h * 0.7, 0)), B = pb.root.position.clone().add(new V3(0, pb.h * 0.7, 0));
    const D = A.distanceTo(B); if (D > 45) continue;
    const Cm = A.clone().lerp(B, 0.5); Cm.y += 0.8 + Math.min(D * 0.1, 2.2);
    const curve = new THREE.QuadraticBezierCurve3(A, Cm, B), n = Math.floor(30 + D * 2), s = Math.random();
    for (let k = 0; k <= n; k++) { const p = curve.getPoint(k / n); pos.push(p.x, p.y, p.z); ts.push(k / n); sd.push(s); }
    cnt[i]++; cnt[j]++;
  }
  if (!pos.length) return;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aT', new THREE.Float32BufferAttribute(ts, 1)); g.setAttribute('aSeed', new THREE.Float32BufferAttribute(sd, 1));
  const m = pointsMat(linkU, `${POINT_VS_HEAD}attribute float aT,aSeed;uniform float uTime;varying float vA;void main(){vec3 p=position;
    p.y+=sin(uTime*0.8+aT*12.+aSeed*6.)*0.08;p.x+=cos(uTime*0.6+aT*9.)*0.06;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
    gl_PointSize=min(0.055*uScale/-mv.z,16.);float wave=pow(0.5+0.5*sin(aT*18.-uTime*1.3+aSeed*6.),6.);
    vA=pow(sin(3.14159*aT),.6)*(0.04+0.96*wave);}`,
    'uniform float uOpacity;varying float vA;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,0.,d);gl_FragColor=vec4(0.97,0.9,0.7,a*vA*uOpacity);}', true);
  linkPoints = new THREE.Points(g, m); linkPoints.frustumCulled = false; scene.add(linkPoints);
}

/* butterflies */
export const butterflies = [];
(function buildButterflies() {
  const R = rng(23), cols = ['#f2c4d2', '#bfd2ea', '#f6f1e6', '#c6b6e6', '#f3e19c'];
  const wg = new THREE.PlaneGeometry(0.2, 0.15); wg.rotateX(-Math.PI / 2); wg.translate(0.1, 0, 0);
  for (let i = 0; i < 0; i++) {
    const g = new THREE.Group(), col = cols[i % cols.length];
    const mat = new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: 0.18, side: DS });
    const l = new THREE.Mesh(wg, mat), r = new THREE.Mesh(wg, mat); r.scale.x = -1; g.add(l, r);
    part(g, GEO.box, M('#3a3328'), [0, 0, 0], [0.02, 0.02, 0.14]);
    const a = 0.25 + (R() - .5) * 1.2, rr = 14 + R() * 14;
    butterflies.push({ g, l, r, cx: Math.cos(a) * rr, cz: Math.sin(a) * rr, rad: 1.5 + R() * 3, sp: 0.18 + R() * 0.15, ph: R() * 50, h: 0.7 + R() * 0.9, last: new V3() });
    scene.add(g);
  }
})();

/* seed + bursts */
export const seedObj = new THREE.Group();
(function () {
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshBasicMaterial({ color: '#fffbe8' }));
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#f8d6e0', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(1.3); seedObj.add(core, halo); seedObj.visible = false; scene.add(seedObj);
})();
export const trail = [];
for (let i = 0; i < 34; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#f8dbe4', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); s.visible = false; s.userData.life = 0; scene.add(s); trail.push(s); }
export let trailI = 0, trailClock = 0;
export function emitTrail(p) { const s = trail[trailI++ % trail.length]; s.position.copy(p); s.userData.life = 1; s.visible = true; s.scale.setScalar(0.45); }
export const burst = { pts: null, vel: [], life: 0 };
(function () {
  const N = 70, g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3));
  const u = { uOpacity: { value: 0 } };
  burst.pts = new THREE.Points(g, pointsMat(u, `${POINT_VS_HEAD}void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=min(0.12*uScale/-mv.z,30.);}`,
    'uniform float uOpacity;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,0.,d);gl_FragColor=vec4(1.,0.9,0.93,a*uOpacity);}', true));
  burst.u = u; burst.pts.frustumCulled = false; burst.pts.visible = false; scene.add(burst.pts);
  for (let i = 0; i < N; i++) burst.vel.push(new V3());
})();
export function fireBurst(at) {
  const p = burst.pts.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    p.setXYZ(i, at.x, at.y + 0.1, at.z);
    const a = Math.random() * 6.28, s = 0.8 + Math.random() * 1.8;
    burst.vel[i].set(Math.cos(a) * s, 0.6 + Math.random() * 2.2, Math.sin(a) * s);
  }
  p.needsUpdate = true; burst.life = 1; burst.pts.visible = true;
}

export function setTrailClock(v) { return (trailClock = v); }
