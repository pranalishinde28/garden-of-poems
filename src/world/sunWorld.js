import * as THREE from 'three';
import { C, V3, clamp, lerp, rng, smooth } from '../core/util.js';
import { state, T } from '../core/state.js';
import { camera, renderer } from './renderer.js';
import { canvasTex, glowTex } from './textures.js';
import { GEO, Merge } from './geometry.js';
import { windify } from './wind.js';
import { nightLit } from './architecture.js';
import { worlds } from '../core/worlds.js';
import { addTick, regThing } from '../core/things.js';
import { late } from '../core/late.js';
import { makeBoat } from './gorge.js';

/* ================= the secret garden: sunflowers, and the Starlight Fair beyond them ================= */
// A world of its own, reached through the light behind Manai Falls (its own scene, drawn instead of the
// garden while you are here; core/worlds.js). You arrive at a jetty on a lake and walk up a stone path
// through a field of sunflowers (after Showa Kinen Park, Tachikawa), under a green sunflower arch, into an
// original fairground in the spirit of the great theme parks: a plaza with a striped carousel, a lagoon
// crossed by a bridge, a Ferris wheel and a roller coaster lit up at night, and a pink castle with blue
// spires and gold tips. (It is not Disneyland: their castle, characters and name are theirs.) A white door
// at the plaza's edge leads home. The garden's light setting (day, sunset, night) holds here too.
// It sits 3 km from the garden so nothing of either world is found from the other.

const R = rng(7171), O = new V3(0, 0, 3000);
export const sunScene = new THREE.Scene();
sunScene.background = new THREE.Color('#9cc8ee');
sunScene.fog = new THREE.Fog('#d4e6f4', 170, 1150);
const root = new THREE.Group(); root.position.copy(O); sunScene.add(root);
// local coordinates; root carries them out to the world
const at = (x, z, y = 0) => new V3(x, y, z);

/* ---------- the layout ---------- */
const LAKE = { x: 0, z: 48, rx: 24, rz: 10, y: -0.15 };
const FIELD = { z0: 31, z1: -38 }, ARCH_Z = -41, PLAZA = { x: 0, z: -64, r: 23 }, CAROUSEL = { x: 0, z: -64, r: 7.6 };
const LAGOON = { x: 0, z: -104, rx: 62, rz: 14 }, BRIDGE = { half: 2.4 }, CASTLE = { x: 0, z: -152 };
const WHEEL = { x: -40, z: -134, hub: 18.5, r: 15 };
const DOOR = { x: -16, z: -50 };
const lakeE = (x, z) => Math.hypot((x - LAKE.x) / LAKE.rx, (z - LAKE.z) / LAKE.rz);
const lagoonE = (x, z) => Math.hypot((x - LAGOON.x) / LAGOON.rx, (z - LAGOON.z) / LAGOON.rz);
// the stone path curves through the sunflowers from the lake to the arch, then runs straight on
const pathX = z => z > ARCH_Z && z < FIELD.z0 + 3 ? 5.5 * Math.sin((FIELD.z0 + 3 - z) / (FIELD.z0 + 3 - ARCH_Z) * Math.PI * 2) : 0;
export function sunH(x, z) {
  const r = Math.hypot(x, z + 60);
  let h = 0.25 * Math.sin(x * 0.05 + 1) * Math.cos(z * 0.04) + 0.1 * Math.sin(x * 0.13 + z * 0.11);
  // the fairground is level
  h *= 1 - 0.85 * smooth(-36, -46, z) * (1 - smooth(70, 95, Math.abs(x)));
  h = lerp(h, -1.4, 1 - smooth(0.85, 1.12, lakeE(x, z)));
  h = lerp(h, -1.4, 1 - smooth(0.88, 1.06, lagoonE(x, z)));
  const a = Math.atan2(z + 60, x);
  h += smooth(160, 280, r) * (20 + 10 * Math.sin(a * 3 + 1) + 6 * Math.sin(a * 7 + 2));
  return h;
}

/* ---------- light: the same day, sunset and night as the garden ---------- */
const skyU = { uSun: { value: new V3(0.25, 0.62, 0.74).normalize() }, uNight: { value: 0 }, uDusk: { value: 0 } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(1300, 32, 16), new THREE.ShaderMaterial({ uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: `uniform vec3 uSun;uniform float uNight,uDusk;varying vec3 vD;
    float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float nz(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1,0)),u.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),u.x),u.y);}
    float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=nz(p)*a;p*=2.03;a*=.5;}return s;}
    void main(){vec3 d=normalize(vD);float y=max(d.y,0.);
      vec3 day=mix(vec3(.80,.89,.96),vec3(.22,.5,.88),pow(y,.55));
      vec3 dusk=mix(vec3(1.,.62,.36),mix(vec3(.85,.45,.6),vec3(.25,.25,.55),smoothstep(.15,.6,y)),smoothstep(0.,.18,y));
      vec3 night=mix(vec3(.07,.1,.2),vec3(.01,.02,.06),pow(y,.5));
      vec3 c=mix(mix(day,dusk,uDusk),night,uNight);
      vec2 q=d.xz/(d.y+.12)*1.6;float cl=smoothstep(.52,.8,fbm(q+vec2(3.,1.)))*smoothstep(.02,.15,d.y);
      vec3 cc=mix(mix(vec3(1.,.99,.97),vec3(1.,.7,.6),uDusk),vec3(.14,.16,.26),uNight);
      c=mix(c,cc*(.92+.08*fbm(q*3.)),cl*.85);
      vec3 sd=normalize(mix(uSun,vec3(-.5,.08,-.86),uDusk));float s=max(dot(d,sd),0.);
      c+=vec3(1.,.9,.7)*(pow(s,600.)*3.+pow(s,12.)*.25)*(1.-uNight);
      // stars and a moon at night
      vec2 sq=d.xz/(d.y+.3)*90.,sc=floor(sq);float st=step(.994,h2(sc))*smoothstep(.16,.0,length(fract(sq)-.5))*smoothstep(.05,.3,d.y)*(1.-cl);
      float m=max(dot(d,normalize(vec3(.3,.5,-.8))),0.);
      c+=uNight*(vec3(st)*.9+vec3(.95,.95,.85)*smoothstep(.9994,.9997,m)+vec3(.3,.35,.5)*pow(m,60.)*.4);
      gl_FragColor=vec4(c,1.);}` }));
sunScene.add(sky);
const hemi = new THREE.HemisphereLight('#e2f1ff', '#4d7a32', 0.62); sunScene.add(hemi);
const sun = new THREE.DirectionalLight('#fff1d8', 0.95); sun.position.set(40, 100, 120); sunScene.add(sun);
sunScene.add(new THREE.AmbientLight('#ffffff', 0.06));
// the fair's lit windows and lamp globes, brighter as the light fails
const winMats = [];

/* ---------- the land: lawn, the lake, wooded hills, blue mountains ---------- */
const lawnTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) { const v = 200 + R() * 55 | 0; g.fillStyle = `rgba(${v - 20},${v},${v - 40},.5)`; g.fillRect(R() * w, R() * h, 1, 2 + R() * 4); }
}, true);
{
  const S = 600, N = 210, g = new THREE.PlaneGeometry(S, S, N, N).rotateX(-Math.PI / 2), p = g.attributes.position, col = [], uv = g.attributes.uv, c = new THREE.Color();
  const LAWN = C('#4a8530'), LAWN2 = C('#57953a'), FOREST = C('#2a4f22'), BANK = C('#4d6b35');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i) - 60, y = sunH(x, z); p.setXYZ(i, x, y, z); uv.setXY(i, x / 3, z / 3);
    const r = Math.hypot(x, z + 60);
    c.copy(LAWN).lerp(LAWN2, (Math.sin(x * 0.42) > 0 ? 0.55 : 0.1) * (1 - smooth(60, 120, r))).lerp(FOREST, smooth(150, 210, r) * 0.9);
    c.lerp(BANK, smooth(-0.1, -0.6, y));
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  root.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, map: lawnTex })));
}
const mountMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false });
{
  const pos = [], idx = [], SEG = 220, RINGS = 10;
  for (let i = 0; i <= RINGS; i++) {
    const r = 440 + i * 55;
    for (let k = 0; k <= SEG; k++) {
      const a = k / SEG * Math.PI * 2, n = Math.sin(a * 4 + 1) * 0.5 + Math.sin(a * 9 + 2) * 0.3 + Math.sin(a * 17) * 0.15;
      const h = (60 + 70 * (0.5 + 0.5 * n)) * Math.sin(i / RINGS * Math.PI) * (a > Math.PI ? 1.3 : 0.9) - 10;
      pos.push(Math.cos(a) * r, h, Math.sin(a) * r - 60);
      if (i < RINGS && k < SEG) { const b = i * (SEG + 1) + k; idx.push(b, b + SEG + 1, b + 1, b + 1, b + SEG + 1, b + SEG + 2); }
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  const col = []; for (let i = 0; i < pos.length; i += 3) { const k = clamp(pos[i + 1] / 120, 0, 1); col.push(0.42 + 0.12 * k, 0.53 + 0.1 * k, 0.66 + 0.08 * k); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  root.add(new THREE.Mesh(g, mountMat));
}

/* ---------- water: the lake and the lagoon, catching the fair's lights in long streaks at night ---------- */
// reflections are drawn, not rendered: each light is mirrored in the water plane and smeared into a ripple
// along the line from your eye (cheap, and exactly where a reflection would be)
const NL = 16, waterU = { uTime: { value: 0 }, uSun: skyU.uSun, uNight: skyU.uNight, uDusk: skyU.uDusk, uGlow: { value: 0 },
  uL: { value: Array.from({ length: NL }, () => new V3(0, -99, 0)) }, uLC: { value: Array.from({ length: NL }, () => new THREE.Color()) } };
const waterMat = new THREE.ShaderMaterial({ uniforms: waterU, fog: false,
  vertexShader: 'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
  fragmentShader: `uniform float uTime,uNight,uDusk,uGlow;uniform vec3 uSun,uL[${NL}],uLC[${NL}];varying vec3 vW;
    float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float nz(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1,0)),u.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),u.x),u.y);}
    float wv(vec2 p){return nz(p*.7+uTime*.25)*.6+nz(p*2.1-uTime*.4)*.4;}
    void main(){vec2 p=vW.xz;float e=.2,h=wv(p);vec3 n=normalize(vec3(-(wv(p+vec2(e,0.))-h)*.6,1.,-(wv(p+vec2(0.,e))-h)*.6));
      vec3 v=normalize(cameraPosition-vW);float fr=pow(1.-max(dot(n,v),0.),3.);
      vec3 sky=mix(mix(vec3(.62,.8,.92),vec3(1.,.66,.55),uDusk),vec3(.06,.08,.16),uNight);
      vec3 c=mix(mix(vec3(.22,.36,.3),vec3(.3,.2,.25),uDusk)*(1.-uNight*.8),sky,fr*.9+.1);
      c+=vec3(1.,.95,.8)*pow(max(dot(reflect(-v,n),normalize(uSun)),0.),220.)*1.5*(1.-uNight);
      vec3 a=normalize(vW-cameraPosition);float ah=atan(a.x,a.z),av=asin(a.y);
      for(int i=0;i<${NL};i++){
        vec3 m=vec3(uL[i].x,2.*vW.y-uL[i].y,uL[i].z),b=normalize(m-cameraPosition);
        float dh=ah-atan(b.x,b.z)+(nz(p*1.3+uTime*.6)-.5)*.02,dv=av-asin(b.y);
        c+=uLC[i]*exp(-dh*dh*2500.-dv*dv*40.)*uGlow*1.6;
      }
      gl_FragColor=vec4(c,1.);}` });
{
  const lake = new THREE.Mesh(new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2), waterMat);
  lake.scale.set(LAKE.rx * 1.06, 1, LAKE.rz * 1.1); lake.position.set(LAKE.x, LAKE.y, LAKE.z); root.add(lake);
  const lag = new THREE.Mesh(new THREE.CircleGeometry(1, 80).rotateX(-Math.PI / 2), waterMat);
  lag.scale.set(LAGOON.rx, 1, LAGOON.rz); lag.position.set(LAGOON.x, LAKE.y, LAGOON.z); root.add(lag);
  // the jetty where you arrive, and your boat tied up beside it
  const j = new Merge(), WOOD = ['#8a6a4c', '#7d5c40', '#94744f'].map(C), dark = C('#5e4532');
  for (let z = 35.4; z < 43.5; z += 0.32) j.add(GEO.box, at(0, z, 0.22), new V3(1.8, 0.07, 0.28), WOOD[(R() * 3) | 0]);
  for (let z = 36; z < 44; z += 2.5) for (const x of [-0.82, 0.82]) j.limb(at(x, z, -1.2), at(x, z, 0.65), 0.07, 0.06, dark);
  root.add(new THREE.Mesh(j.build(), new THREE.MeshLambertMaterial({ vertexColors: true })));
  const b = makeBoat('#f4efe2', '#6f8f4a', new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  b.g.position.set(1.7, LAKE.y - 0.12, 42.2); b.g.rotation.y = 0.15; b.oars.forEach((o, k) => o.rotation.set(0, (k ? -1 : 1) * 0.5, (k ? 1 : -1) * 0.35)); root.add(b.g);
  b.g.traverse(o => { if (o.isSprite) o.visible = false; });
}

/* ---------- paths and paving ---------- */
const paveTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#8f887b'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 40) { let x = -(R() * 40); while (x < w) { const pw = 40 + R() * 50; const v = 160 + R() * 28 | 0; g.fillStyle = `rgb(${v},${v - 6},${v - 16})`; g.fillRect(x + 2, y + 2, pw - 4, 36); x += pw; } }
}, true);
// the fair's paving: warm pink-beige stone in a herringbone, as on a theme-park promenade
const plazaTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#b79a88'; g.fillRect(0, 0, w, h);
  for (let y = -32; y < h + 32; y += 16) for (let x = -32; x < w + 32; x += 32) { const v = 205 + R() * 25 | 0; g.fillStyle = `rgb(${v},${v - 28 | 0},${v - 40 | 0})`; g.save(); g.translate(x + ((y / 16) % 2) * 16, y); g.rotate(Math.PI / 4); g.fillRect(1, 1, 30, 14); g.restore(); }
}, true);
const decal = tex => new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
function ribbon(z0, z1, half, mat, lift) {
  const pos = [], uv = [], idx = []; let n = 0, len = 0, prev = null;
  for (let z = z0; z >= z1; z -= 0.5) {
    const x = pathX(z), dx = (pathX(z - 0.1) - pathX(z + 0.1)) / 0.2, nl = Math.hypot(1, dx), nx = 1 / nl, nz = dx / nl;
    if (prev) len += Math.hypot(x - prev[0], z - prev[1]); prev = [x, z];
    for (const s of [-1, 1]) { const px = x + s * half * nx, pz = z + s * half * nz; pos.push(px, sunH(px, pz) + lift, pz); uv.push((s + 1) / 2 * half * 2 / 3, len / 3); }
    if (n) { const a = (n - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    n++;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  root.add(new THREE.Mesh(g, mat));
}
const plazaMat = decal(plazaTex);
ribbon(FIELD.z0 + 4, ARCH_Z - 2, 1.3, decal(paveTex), 0.04);
ribbon(ARCH_Z - 2, PLAZA.z + PLAZA.r - 2, 2.2, plazaMat, 0.05);
ribbon(PLAZA.z - PLAZA.r + 2, LAGOON.z + LAGOON.rz + 1, 2.4, plazaMat, 0.05);
ribbon(LAGOON.z - LAGOON.rz - 1, CASTLE.z + 4, 3.2, plazaMat, 0.05);
{ const m = new THREE.Mesh(new THREE.CircleGeometry(PLAZA.r, 64).rotateX(-Math.PI / 2), plazaMat); m.position.set(PLAZA.x, sunH(PLAZA.x, PLAZA.z) + 0.06, PLAZA.z); root.add(m); }
{ const m = new THREE.Mesh(new THREE.PlaneGeometry(56, 20).rotateX(-Math.PI / 2), plazaMat); m.position.set(CASTLE.x, sunH(0, CASTLE.z + 14) + 0.05, CASTLE.z + 16); root.add(m); }

/* ---------- the sunflowers: a field all round the path from the lake to the arch ---------- */
const sunTex = canvasTex(256, 256, g => {
  for (let k = 0; k < 2; k++) for (let i = 0; i < 26; i++) {
    const a = i / 26 * 6.283 + k * 0.12, r0 = k ? 70 : 82;
    g.save(); g.translate(128, 128); g.rotate(a); g.fillStyle = k ? '#f5b81c' : '#ffd12a';
    g.beginPath(); g.moveTo(34, -9); g.quadraticCurveTo(r0 * 0.7, -15, r0 + 30, 0); g.quadraticCurveTo(r0 * 0.7, 15, 34, 9); g.closePath(); g.fill(); g.restore();
  }
  const gr = g.createRadialGradient(128, 128, 4, 128, 128, 46); gr.addColorStop(0, '#3a2412'); gr.addColorStop(0.7, '#5a3818'); gr.addColorStop(1, '#7a4e1e');
  g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 46, 0, 7); g.fill();
  for (let i = 0; i < 160; i++) { const a = i * 2.39996, r = Math.sqrt(i) * 3.4; g.fillStyle = 'rgba(30,18,8,.6)'; g.beginPath(); g.arc(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 1.4, 0, 7); g.fill(); }
});
const sunLeafGeo = (() => { const s = new THREE.Shape(); s.moveTo(0, 0); s.bezierCurveTo(0.12, 0.06, 0.16, 0.2, 0, 0.32); s.bezierCurveTo(-0.16, 0.2, -0.12, 0.06, 0, 0); return new THREE.ShapeGeometry(s, 4); })();
const stemGeo = (() => {
  const m = new Merge(); m.limb(new V3(0, 0, 0), new V3(0, 1, 0), 0.028, 0.02, C('#4f7f2e'));
  for (const [y, a] of [[0.35, 0.3], [0.55, 2.6], [0.75, 4.4]]) m.add(sunLeafGeo, new V3(0, y, 0), new V3(1.1, 1.1, 1.1), C('#4c8a30'), new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.0, a, 0, 'YXZ')));
  return m.build();
})();
const headGeo = new THREE.CircleGeometry(0.2, 20);
{
  const spots = [];
  for (let z = FIELD.z0; z > FIELD.z1; z -= 0.55) for (let x = -34; x < 34; x += 0.55) {
    const px = x + (R() - 0.5) * 0.35, pz = z + (R() - 0.5) * 0.35;
    if (Math.abs(px - pathX(pz)) < 1.8 || lakeE(px, pz) < 1.35) continue;
    // shorter beside the path, so the field rises away from you
    const d = Math.abs(px - pathX(pz));
    spots.push([px, pz, 1.1 + Math.min(1, d / 6) * 0.7 + R() * 0.6]);
  }
  const stemMat = windify(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), 0.012, 'blade');
  const headMat = new THREE.MeshLambertMaterial({ map: sunTex, alphaTest: 0.4, side: THREE.DoubleSide });
  const stems = new THREE.InstancedMesh(stemGeo, stemMat, spots.length), heads = new THREE.InstancedMesh(headGeo, headMat, spots.length), d = new THREE.Object3D();
  spots.forEach(([x, z, h], i) => {
    d.position.set(x, sunH(x, z), z); d.rotation.set(0, (R() - 0.5) * 0.8, 0); d.scale.set(1, h, 1); d.updateMatrix(); stems.setMatrixAt(i, d.matrix);
    // the heads turn a little toward the path
    const face = Math.atan2(pathX(z) - x, 6) * 0.6;
    d.position.set(x, sunH(x, z) + h + 0.02, z); d.rotation.set(-0.2 - R() * 0.25, face + (R() - 0.5) * 0.5, (R() - 0.5) * 0.5, 'YXZ'); const s = 0.85 + R() * 0.45; d.scale.set(s, s, s); d.updateMatrix(); heads.setMatrixAt(i, d.matrix);
  });
  root.add(stems, heads);
  // further off, painted on crossed cards: the sea of sunflowers runs on to the woods
  const far = canvasTex(512, 256, g => {
    for (let i = 0; i < 70; i++) { const x = R() * 512, y = 120 + R() * 136; g.fillStyle = `rgb(${60 + R() * 20 | 0},${110 + R() * 40 | 0},${40 + R() * 20 | 0})`; g.beginPath(); g.ellipse(x, y, 14 + R() * 12, 22 + R() * 20, R() * 2, 0, 7); g.fill(); }
    for (let i = 0; i < 90; i++) { const x = 10 + R() * 492, y = 30 + R() * 110, r = 10 + R() * 9; g.drawImage(sunTex.image, x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4); }
  });
  const card = (() => { const a = new THREE.PlaneGeometry(4, 2.3).translate(0, 1.15, 0), b = a.clone().rotateY(Math.PI / 2); const m = new Merge(); m.add(a, new V3(), new V3(1, 1, 1), C('#ffffff')); m.add(b, new V3(), new V3(1, 1, 1), C('#ffffff')); return m.build(); })();
  const list = []; for (let z = FIELD.z0 + 4; z > FIELD.z1 - 2; z -= 2.6) for (const s of [-1, 1]) for (let x = 34; x < 110; x += 2.8) if (lakeE(s * x, z) > 1.4) list.push([s * (x + R()), z + R()]);
  const im = new THREE.InstancedMesh(card, new THREE.MeshLambertMaterial({ map: far, alphaTest: 0.45, side: THREE.DoubleSide }), list.length);
  list.forEach(([x, z], i) => { d.position.set(x, sunH(x, z) - 0.2, z); d.rotation.set(0, R() * 0.6 - 0.3 + Math.PI / 4, 0); d.scale.setScalar(0.9 + R() * 0.3); d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
  root.add(im);
}

/* ---------- the sunflower arch, the way from the field into the fair ---------- */
{
  const g = new THREE.Group(); g.position.set(0, sunH(0, ARCH_Z), ARCH_Z); root.add(g);
  const metal = new THREE.MeshLambertMaterial({ color: '#3f6a3a' }), RA = 2.2, LEG = 2.0;
  for (const z of [-0.3, 0.3]) {
    const pts = [new V3(-RA, 0, z)]; for (let k = 0; k <= 24; k++) { const a = Math.PI - k / 24 * Math.PI; pts.push(new V3(Math.cos(a) * RA, LEG + Math.sin(a) * RA, z)); } pts.push(new V3(RA, 0, z));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.045, 6), metal));
  }
  const hm = new THREE.MeshLambertMaterial({ map: sunTex, alphaTest: 0.4, side: THREE.DoubleSide }), lm = new THREE.MeshLambertMaterial({ color: '#4c8a30', side: THREE.DoubleSide });
  for (let k = 0; k < 19; k++) {
    const a = Math.PI * (0.03 + 0.94 * k / 18), p = new V3(Math.cos(a) * RA, LEG + Math.sin(a) * RA, 0.32);
    const h = new THREE.Mesh(headGeo, hm); h.position.copy(p); h.scale.setScalar(1.1 + R() * 0.6); h.rotation.set(0, (R() - 0.5) * 0.4, R() * 3); g.add(h);
    for (let l = 0; l < 2; l++) { const lf = new THREE.Mesh(sunLeafGeo, lm); lf.position.copy(p).add(new V3((R() - 0.5) * 0.4, (R() - 0.5) * 0.4, -0.05)); lf.rotation.set(R() * 3, R() * 3, R() * 3); lf.scale.setScalar(1.3); g.add(lf); }
  }
  for (const sx of [-1, 1]) for (let y = 0.3; y < LEG; y += 0.42) { const h = new THREE.Mesh(headGeo, hm); h.position.set(sx * RA + sx * 0.05, y, 0.32); h.scale.setScalar(1 + R() * 0.4); g.add(h); }
}

/* ---------- the fair ---------- */
// one lit material for everything built (it glows warmly from below after dusk, architecture.js nightLit);
// bulbs: [x, y, z, r, g, b, phase]; ref: lights the water mirrors
const lit = () => nightLit(new THREE.MeshLambertMaterial({ vertexColors: true }), 0.9);
const body = lit(), bulbs = [], ref = [];
const bulb = (p, col, ph = R()) => { const c = new THREE.Color(col); bulbs.push(p.x, p.y, p.z, c.r, c.g, c.b, ph * 100); };

// the castle: pink walls, blue conical spires with gold finials, a gate in its front wall
{
  const m = new Merge(), win = new Merge(), WALL = C('#e6aaa8'), TRIM = C('#f4d6d0'), STONE = C('#c9ae9c'), BLUE = C('#3b78d0'), BLUE2 = C('#5591e2'), GOLD = C('#e4b23a'), DARK = C('#4a3a42');
  const cx = CASTLE.x, cz = CASTLE.z, base = sunH(cx, cz);
  const tower = (x, z, r, h, roof, y0 = 0, roofCol = BLUE) => {
    m.add(new THREE.CylinderGeometry(r, r * 1.05, h, 18), at(cx + x, cz + z, base + y0 + h / 2), new V3(1, 1, 1), WALL);
    m.add(new THREE.CylinderGeometry(r * 1.12, r * 1.12, 0.5, 18), at(cx + x, cz + z, base + y0 + h - 0.1), new V3(1, 1, 1), TRIM);
    m.add(new THREE.ConeGeometry(r * 1.2, roof, 18), at(cx + x, cz + z, base + y0 + h + roof / 2), new V3(1, 1, 1), roofCol);
    m.limb(at(cx + x, cz + z, base + y0 + h + roof - 0.2), at(cx + x, cz + z, base + y0 + h + roof + 1.4), 0.08, 0.05, GOLD);
    m.add(GEO.sph, at(cx + x, cz + z, base + y0 + h + roof + 0.6), new V3(0.18, 0.18, 0.18), GOLD);
    // windows round the tower, glowing at night
    for (let k = 0; k < 4; k++) {
      const a = k / 4 * Math.PI * 2 + 0.4, wy = base + y0 + h * 0.62;
      win.add(GEO.box, at(cx + x + Math.sin(a) * r * 0.98, cz + z + Math.cos(a) * r * 0.98, wy), new V3(r * 0.3, h * 0.12, r * 0.3), C('#ffd79a'), new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), a));
      bulb(at(cx + x + Math.sin(a) * r * 1.02, cz + z + Math.cos(a) * r * 1.02, wy), '#ffd08a');
    }
  };
  const wall = (x0, z0, x1, z1, h) => {
    const L = Math.hypot(x1 - x0, z1 - z0), q = new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2);
    m.add(GEO.box, at(cx + (x0 + x1) / 2, cz + (z0 + z1) / 2, base + h / 2), new V3(L, h, 2.4), WALL, q);
    for (let t = 0.5; t < L; t += 1.4) m.add(GEO.box, at(cx + x0 + (x1 - x0) * t / L, cz + z0 + (z1 - z0) * t / L, base + h + 0.4), new V3(0.8, 0.8, 2.5), TRIM, q);
  };
  m.add(GEO.box, at(cx, cz - 2, base + 1), new V3(46, 2, 30), STONE);
  wall(-18, 9, 18, 9, 10); wall(-18, 9, -15, -8, 11); wall(18, 9, 15, -8, 11);
  // the gate: a deep arch in the front wall
  m.add(GEO.box, at(cx, cz + 10.25, base + 3), new V3(5, 6, 0.3), DARK);
  m.add(new THREE.CylinderGeometry(2.5, 2.5, 0.3, 20, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2), at(cx, cz + 10.25, base + 6), new V3(1, 1, 1), DARK);
  m.add(new THREE.TorusGeometry(2.8, 0.35, 8, 24, Math.PI), at(cx, cz + 10.35, base + 6), new V3(1, 1, 1), TRIM);
  // the keep, then towers rising in tiers to the tallest spire
  m.add(GEO.box, at(cx, cz - 1, base + 9), new V3(16, 18, 13), WALL);
  for (let t = -7; t <= 7; t += 1.4) m.add(GEO.box, at(cx + t, cz + 5.6, base + 18.4), new V3(0.8, 0.8, 0.8), TRIM);
  tower(-18, 9, 3.2, 15, 8); tower(18, 9, 3.2, 15, 8);
  tower(-15, -8, 3.4, 19, 9, 0, BLUE2); tower(15, -8, 3.4, 19, 9, 0, BLUE2);
  tower(-7, 4.5, 1.8, 6, 6, 18); tower(7, 4.5, 1.8, 6, 6, 18);
  tower(-5.5, -5, 2.4, 9, 7, 18, BLUE2); tower(5.5, -5, 2.4, 9, 7, 18, BLUE2);
  tower(0, -1, 4, 16, 13, 18);
  tower(0, -1, 1.6, 5, 7, 34, BLUE2);
  // a rose window over the gate, and a line of lights along the front wall
  m.add(GEO.disc, at(cx, cz + 5.55, base + 13), new V3(2.2, 1, 2.2), C('#e7a0b8'), new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), Math.PI / 2));
  for (let x = -17; x <= 17; x += 1.7) bulb(at(cx + x, cz + 10.5, base + 10.9), '#ffe2a8');
  root.add(new THREE.Mesh(m.build(), body));
  const wm = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#ffb860', emissiveIntensity: 0 }); winMats.push(wm);
  root.add(new THREE.Mesh(win.build(), wm));
  ref.push([at(cx, cz, base + 36), '#ffd9a0'], [at(cx - 15, cz - 8, base + 24), '#ffd9a0'], [at(cx + 15, cz - 8, base + 24), '#ffd9a0']);
}

// the Ferris wheel: a rainbow of spokes, cabins that hang level, a golden sunburst at its hub
const wheel = new THREE.Group(), cabins = [];
{
  const base = sunH(WHEEL.x, WHEEL.z), g = new THREE.Group(); g.position.set(WHEEL.x, base + WHEEL.hub, WHEEL.z); root.add(g);
  const legs = new Merge(), white = C('#f4f1ea');
  for (const sz of [-1.6, 1.6]) for (const sx of [-1, 1]) legs.limb(new V3(sx * 8, -WHEEL.hub - 0.2, sz * 1.8), new V3(0, 0, sz), 0.35, 0.25, white);
  for (const sz of [-1.6, 1.6]) legs.limb(new V3(-5.2, -WHEEL.hub * 0.35, sz * 1.7), new V3(5.2, -WHEEL.hub * 0.35, sz * 1.7), 0.18, 0.18, white);
  legs.limb(new V3(0, 0, -1.8), new V3(0, 0, 1.8), 0.5, 0.5, C('#c9c3b5'));
  g.add(new THREE.Mesh(legs.build(), body));
  g.add(wheel);
  const w = new Merge(), RAINBOW = ['#e8463a', '#f08a1c', '#f7d433', '#4fb35a', '#3b8fe0', '#7a5cc8'].map(C);
  for (const z of [-0.9, 0.9]) { w.add(new THREE.TorusGeometry(WHEEL.r, 0.28, 8, 96), new V3(0, 0, z), new V3(1, 1, 1), C('#d83a3a')); w.add(new THREE.TorusGeometry(WHEEL.r * 0.62, 0.16, 8, 64), new V3(0, 0, z), new V3(1, 1, 1), C('#f4f1ea')); }
  for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2, c = RAINBOW[k % 6]; for (const z of [-0.9, 0.9]) w.limb(new V3(0, 0, z), new V3(Math.cos(a) * WHEEL.r, Math.sin(a) * WHEEL.r, z), 0.1, 0.08, c); }
  // the hub: a golden sun with rays (an original emblem)
  for (const z of [-1.05, 1.05]) {
    w.add(new THREE.CylinderGeometry(2.2, 2.2, 0.3, 32).rotateX(Math.PI / 2), new V3(0, 0, z), new V3(1, 1, 1), C('#f2c12e'));
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; w.add(new THREE.ConeGeometry(0.5, 2.2, 4).rotateZ(-Math.PI / 2), new V3(Math.cos(a) * 3.1, Math.sin(a) * 3.1, z), new V3(1, 1, 0.3), C(k % 2 ? '#f7a21c' : '#ffd54a'), new THREE.Quaternion().setFromAxisAngle(new V3(0, 0, 1), a)); }
  }
  wheel.add(new THREE.Mesh(w.build(), body));
  const CAB = ['#e8463a', '#3b8fe0', '#f7d433', '#4fb35a', '#f08a1c', '#d95aa8', '#7a5cc8', '#40b8c4'];
  for (let k = 0; k < 16; k++) {
    const a = k / 16 * Math.PI * 2, pivot = new THREE.Group(); pivot.position.set(Math.cos(a) * WHEEL.r, Math.sin(a) * WHEEL.r, 0); wheel.add(pivot);
    const cm = new Merge(), c = C(CAB[k % CAB.length]);
    cm.limb(new V3(0, 0, 0), new V3(0, -1.0, 0), 0.05, 0.05, C('#dddddd'));
    cm.add(new THREE.CylinderGeometry(0.95, 0.85, 1.4, 12), new V3(0, -1.8, 0), new V3(1, 1, 1), c);
    cm.add(new THREE.ConeGeometry(1.15, 0.7, 12), new V3(0, -0.85, 0), new V3(1, 1, 1), c);
    cm.add(new THREE.CylinderGeometry(0.98, 0.98, 0.5, 12), new V3(0, -1.6, 0), new V3(1, 1, 1), C('#fff3d6'));
    pivot.add(new THREE.Mesh(cm.build(), body)); cabins.push(pivot);
  }
  // bulbs on the rim and the spokes, turning with the wheel, cycling through the rainbow
  const wp = [], wh = [];
  for (let k = 0; k < 96; k++) { const a = k / 96 * Math.PI * 2; for (const z of [-1.0, 1.0]) { wp.push(Math.cos(a) * WHEEL.r, Math.sin(a) * WHEEL.r, z); wh.push(k / 96); } }
  for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; for (let t = 0.25; t < 0.98; t += 0.12) { wp.push(Math.cos(a) * WHEEL.r * t, Math.sin(a) * WHEEL.r * t, 1.0); wh.push(k / 24 + t); } }
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); bg.setAttribute('aH', new THREE.Float32BufferAttribute(wh, 1));
  wheel.add(new THREE.Points(bg, new THREE.ShaderMaterial({ uniforms: { uTime: waterU.uTime, uGlow: waterU.uGlow }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float uTime;attribute float aH;varying vec3 vC;
      vec3 hue(float h){return clamp(abs(mod(h*6.+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.);}
      void main(){vC=mix(hue(aH-uTime*.08),vec3(1.,.9,.7),.25);vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(260./-mv.z,2.,16.);gl_Position=projectionMatrix*mv;}`,
    fragmentShader: 'uniform float uGlow;varying vec3 vC;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,.05,d)*uGlow;gl_FragColor=vec4(vC*a*1.4,a);}' })));
}

// the roller coaster: a red track looping and swooping on white trestles, a train of cars running round it
const track = (() => {
  const pts = [[22, -122, 4], [36, -118, 9], [54, -120, 22], [68, -132, 12], [64, -150, 5], [50, -160, 16], [34, -168, 8], [24, -156, 3], [30, -142, 14], [44, -138, 6], [38, -128, 3]];
  return new THREE.CatmullRomCurve3(pts.map(([x, z, y]) => at(x, z, sunH(x, z) + y + 2)), true, 'catmullrom', 0.4);
})();
const train = [];
{
  const m = new Merge(), N = 360, RED = C('#d8322e'), WHITE = C('#f4f1ea');
  m.add(new THREE.TubeGeometry(track, 600, 0.32, 8, true), new V3(), new V3(1, 1, 1), RED);
  for (let i = 0; i < N; i++) {
    const t = i / N, p = track.getPointAt(t), tg = track.getTangentAt(t), side = new V3(tg.z, 0, -tg.x).normalize();
    m.add(GEO.box, p.clone().add(new V3(0, 0.25, 0)), new V3(1.6, 0.12, 0.25), RED, new THREE.Quaternion().setFromUnitVectors(new V3(1, 0, 0), side));
    if (i % 2 === 0) for (const s of [-0.7, 0.7]) m.limb(p.clone().addScaledVector(side, s).add(new V3(0, 0.25, 0)), track.getPointAt((i + 2) / N % 1).addScaledVector(side, s).add(new V3(0, 0.25, 0)), 0.09, 0.09, RED);
    if (i % 6 === 0) {
      const g = sunH(p.x, p.z);
      for (const s of [-0.9, 0.9]) m.limb(new V3(p.x + side.x * s, g, p.z + side.z * s), new V3(p.x + side.x * s * 0.6, p.y - 0.2, p.z + side.z * s * 0.6), 0.12, 0.1, WHITE);
      if (p.y - g > 6) for (let y = g + 3; y < p.y - 1; y += 3) m.limb(new V3(p.x + side.x * 0.9, y, p.z + side.z * 0.9), new V3(p.x - side.x * 0.9, y + 1.5, p.z - side.z * 0.9), 0.06, 0.06, WHITE);
    }
    if (i % 3 === 0) bulb(p.clone().add(new V3(0, 0.5, 0)), i % 9 ? '#ffcf7a' : '#ff6a5a');
  }
  root.add(new THREE.Mesh(m.build(), body));
  const CAR = ['#3b8fe0', '#f7d433', '#4fb35a', '#d95aa8'];
  for (let k = 0; k < 4; k++) { const cm = new Merge(); cm.add(GEO.box, new V3(0, 0.75, 0), new V3(1.5, 0.7, 2.0), C(CAR[k])); cm.add(GEO.box, new V3(0, 1.25, 0.75), new V3(1.5, 0.4, 0.3), C('#f4f1ea')); const g = new THREE.Mesh(cm.build(), body); root.add(g); train.push(g); }
  ref.push([track.getPointAt(0.2), '#ff8a5a'], [track.getPointAt(0.45), '#ffcf7a'], [track.getPointAt(0.7), '#ff8a5a']);
}

// the carousel: a striped canopy, a ring of horses rising and falling, bulbs round its edge
const carousel = new THREE.Group(), ring = new THREE.Group(), horses = [];
{
  const base = sunH(CAROUSEL.x, CAROUSEL.z); carousel.position.set(CAROUSEL.x, base, CAROUSEL.z); root.add(carousel);
  const stripe = canvasTex(512, 64, (g, w, h) => { for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#f8f1e0' : '#3f86d6'; g.fillRect(i * w / 16, 0, w / 16, h); } });
  const m = new Merge(), GOLD = C('#e4b23a');
  m.add(new THREE.CylinderGeometry(7.2, 7.4, 0.6, 40), new V3(0, 0.3, 0), new V3(1, 1, 1), C('#c94a4a'));
  m.add(new THREE.CylinderGeometry(6.9, 6.9, 0.1, 40), new V3(0, 0.62, 0), new V3(1, 1, 1), C('#e8d6b4'));
  m.add(new THREE.CylinderGeometry(1.4, 1.4, 5.6, 16), new V3(0, 3.4, 0), new V3(1, 1, 1), C('#f2d3a0'));
  m.add(new THREE.CylinderGeometry(7.4, 7.4, 0.9, 40, 1, true), new V3(0, 5.9, 0), new V3(1, 1, 1), GOLD);
  carousel.add(new THREE.Mesh(m.build(), body));
  const cmat = nightLit(new THREE.MeshLambertMaterial({ map: stripe, side: THREE.DoubleSide }), 0.9);
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(7.9, 3.6, 32, 1, true), cmat); canopy.position.y = 8.1; carousel.add(canopy);
  const top = new Merge(); top.add(GEO.sph, new V3(0, 10, 0), new V3(0.9, 0.7, 0.9), C('#3f86d6')); top.limb(new V3(0, 10.4, 0), new V3(0, 11.8, 0), 0.08, 0.05, GOLD); top.add(GEO.sph, new V3(0, 11.9, 0), new V3(0.2, 0.2, 0.2), GOLD);
  for (let k = 0; k < 32; k++) { const a = k / 32 * Math.PI * 2; top.add(GEO.box, new V3(Math.cos(a) * 7.6, 5.35, Math.sin(a) * 7.6), new V3(1.45, 0.45, 0.08), C(k % 2 ? '#f8f1e0' : '#3f86d6'), new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), -a + Math.PI / 2)); }
  carousel.add(new THREE.Mesh(top.build(), body));
  for (let k = 0; k < 40; k++) { const a = k / 40 * Math.PI * 2; bulb(at(CAROUSEL.x + Math.cos(a) * 7.5, CAROUSEL.z + Math.sin(a) * 7.5, base + 6.35), '#ffd890'); }
  carousel.add(ring);
  const COAT = ['#f8f4ec', '#f2e2c6', '#e8d3b8', '#f8f4ec'];
  for (let k = 0; k < 12; k++) {
    const a = k / 12 * Math.PI * 2, hg = new THREE.Group(), r = k % 2 ? 5.3 : 4.0; hg.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); hg.rotation.y = -a; ring.add(hg);
    const hm = new Merge(), coat = C(COAT[k % 4]), mane = C(['#c9a24a', '#8a5a3a', '#e4b23a'][k % 3]);
    hm.limb(new V3(0, 0.6, 0), new V3(0, 5.4, 0), 0.05, 0.05, C('#e4b23a'));
    hm.add(GEO.box, new V3(0, 2.0, 0), new V3(0.45, 0.6, 1.35), coat);
    hm.limb(new V3(0, 2.15, 0.55), new V3(0, 2.85, 0.85), 0.16, 0.12, coat); hm.add(GEO.box, new V3(0, 2.95, 1.05), new V3(0.3, 0.32, 0.55), coat);
    hm.add(GEO.box, new V3(0, 2.55, 0.62), new V3(0.12, 0.6, 0.35), mane);
    for (const [x, z] of [[-0.15, 0.5], [0.15, 0.5], [-0.15, -0.5], [0.15, -0.5]]) hm.limb(new V3(x, 1.8, z), new V3(x, 1.25, z + (z > 0 ? 0.25 : -0.2)), 0.05, 0.04, coat);
    hm.add(GEO.box, new V3(0, 2.33, -0.05), new V3(0.5, 0.08, 0.55), C(['#c94a4a', '#3f86d6', '#4fb35a'][k % 3]));
    hg.add(new THREE.Mesh(hm.build(), body)); horses.push({ hg, ph: k * 1.3 });
  }
  ref.push([at(CAROUSEL.x, CAROUSEL.z, base + 6.4), '#ffd890']);
}

// the bridge over the lagoon, and lamp posts with flower baskets along every path
const lamps = [];
{
  const m = new Merge(), IRON = C('#2c2a30'), STONE = C('#e6d9cc'), PINK = ['#f27ea8', '#f7b9cd', '#e8463a', '#ffffff'].map(C), LEAF = C('#3f7a34');
  const z0 = LAGOON.z + LAGOON.rz + 1.5, z1 = LAGOON.z - LAGOON.rz - 1.5;
  m.add(GEO.box, at(0, (z0 + z1) / 2, 0.15), new V3(BRIDGE.half * 2 + 0.6, 0.5, z0 - z1), STONE);
  for (const s of [-1, 1]) { m.add(GEO.box, at(s * (BRIDGE.half + 0.15), (z0 + z1) / 2, 0.75), new V3(0.3, 0.9, z0 - z1), STONE); for (let z = z1 + 2; z < z0; z += 6) m.add(new THREE.CylinderGeometry(0.5, 0.6, 2.2, 10), at(s * 2.0, z, -0.9), new V3(1, 1, 1), STONE); }
  const lamp = (x, z, h = 3.6) => {
    const y = Math.abs(x) < 3 && lagoonE(x, z) < 1.12 ? 0.4 : sunH(x, z);
    m.add(new THREE.CylinderGeometry(0.16, 0.22, 0.4, 8), at(x, z, y + 0.2), new V3(1, 1, 1), IRON);
    m.limb(at(x, z, y), at(x, z, y + h), 0.07, 0.06, IRON);
    for (const s of [-1, 1]) {
      m.limb(at(x, z, y + h - 0.7), at(x + s * 0.55, z, y + h - 0.55), 0.03, 0.03, IRON);
      m.add(new THREE.CylinderGeometry(0.2, 0.12, 0.18, 10), at(x + s * 0.55, z, y + h - 0.9), new V3(1, 1, 1), C('#5a4030'));
      for (let k = 0; k < 7; k++) m.add(GEO.sph, at(x + s * 0.55 + (R() - 0.5) * 0.3, z + (R() - 0.5) * 0.3, y + h - 0.8 - R() * 0.25), new V3(0.06, 0.05, 0.06), k < 3 ? LEAF : PINK[(R() * 4) | 0]);
    }
    m.add(GEO.cone, at(x, z, y + h + 0.55), new V3(0.26, 0.25, 0.26), IRON);
    lamps.push(at(x, z, y + h + 0.25));
  };
  for (let z = ARCH_Z - 4; z > PLAZA.z + PLAZA.r; z -= 7) for (const s of [-1, 1]) lamp(s * 3.2, z);
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2 + 0.26; lamp(PLAZA.x + Math.cos(a) * (PLAZA.r - 1.2), PLAZA.z + Math.sin(a) * (PLAZA.r - 1.2)); }
  for (let z = PLAZA.z - PLAZA.r - 2; z > LAGOON.z + LAGOON.rz + 2; z -= 6) for (const s of [-1, 1]) lamp(s * 3.4, z);
  for (let z = z0 - 2; z > z1; z -= 7) for (const s of [-1, 1]) lamp(s * (BRIDGE.half + 0.15), z, 2.8);
  for (let z = z1 - 3; z > CASTLE.z + 14; z -= 7) for (const s of [-1, 1]) lamp(s * 4.4, z);
  root.add(new THREE.Mesh(m.build(), new THREE.MeshLambertMaterial({ vertexColors: true })));
  const gm = new THREE.MeshLambertMaterial({ color: '#fff3d6', emissive: '#ffcf80', emissiveIntensity: 0.2 }); winMats.push(gm);
  const globes = new THREE.InstancedMesh(GEO.sph, gm, lamps.length), d = new THREE.Object3D();
  lamps.forEach((p, i) => { d.position.copy(p); d.scale.setScalar(0.3); d.updateMatrix(); globes.setMatrixAt(i, d.matrix); bulb(p, '#ffe2a8'); });
  root.add(globes);
}
// flower beds round the plaza and before the castle: painted with blossom, laid flat
{
  const bedTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#3e7a32'; g.fillRect(0, 0, w, h);
    const COL = ['#f27ea8', '#f7b9cd', '#e8463a', '#ffffff', '#f7d433', '#b07ad8'];
    for (let i = 0; i < 2600; i++) { const x = R() * w, y = R() * h, c = COL[(Math.floor(x / 64 + y / 96) + (R() < 0.15 ? 1 : 0)) % COL.length], r = 4 + R() * 4; g.fillStyle = c; for (let k = 0; k < 5; k++) { const a = k / 5 * 6.283; g.beginPath(); g.arc(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.55, 0, 7); g.fill(); } }
  }, true);
  const bm = new THREE.MeshLambertMaterial({ map: bedTex, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const bed = (x, z, w, d) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), bm); m.position.set(x, sunH(x, z) + 0.09, z); root.add(m); };
  for (const s of [-1, 1]) { bed(s * 13, CASTLE.z + 18, 14, 5); bed(s * 9, PLAZA.z - PLAZA.r - 6, 9, 5); bed(s * 8, ARCH_Z - 10, 6, 10); }
  const ringBed = new THREE.Mesh(new THREE.RingGeometry(CAROUSEL.r + 0.6, CAROUSEL.r + 2.4, 48).rotateX(-Math.PI / 2), bm); ringBed.position.set(CAROUSEL.x, sunH(CAROUSEL.x, CAROUSEL.z) + 0.09, CAROUSEL.z); root.add(ringBed);
}

/* ---------- the white door, standing alone at the edge of the plaza ---------- */
const door = new THREE.Group(), leaf = new THREE.Group();
const doorLight = new THREE.Mesh(new THREE.PlaneGeometry(1.02, 2.2).translate(0, 1.1, 0), new THREE.MeshBasicMaterial({ color: '#fffaf0', transparent: true, opacity: 0 }));
export const DOOR_AT = O.clone().add(new V3(DOOR.x, 0, DOOR.z));
{
  door.position.set(DOOR.x, sunH(DOOR.x, DOOR.z), DOOR.z); root.add(door);
  const white = new THREE.MeshLambertMaterial({ color: '#fbfaf6', emissive: '#fff4e0', emissiveIntensity: 0 }), trim = new THREE.MeshLambertMaterial({ color: '#efece4' }), brass = new THREE.MeshLambertMaterial({ color: '#d4a64a', emissive: '#3a2a08' }), stone = new THREE.MeshLambertMaterial({ color: '#c9c3b6' });
  winMats.push(white);
  const box = (w, h, d, x, y, z, m, p = door) => { const b = new THREE.Mesh(GEO.box, m); b.scale.set(w, h, d); b.position.set(x, y, z); p.add(b); return b; };
  box(1.7, 0.16, 0.9, 0, 0.08, 0, stone);
  box(0.14, 2.5, 0.2, -0.6, 1.25 + 0.16, 0, white); box(0.14, 2.5, 0.2, 0.6, 1.25 + 0.16, 0, white); box(1.42, 0.16, 0.24, 0, 2.66 + 0.08, 0, white); box(1.58, 0.06, 0.3, 0, 2.86, 0, trim);
  // the leaf hangs on the left post and swings away from you
  leaf.position.set(-0.53, 0.16, 0); door.add(leaf);
  box(1.04, 2.24, 0.06, 0.53, 1.12, 0, white, leaf);
  for (const [y, h] of [[0.58, 0.82], [1.6, 0.9]]) for (const x of [0.29, 0.77]) { box(0.36, h, 0.02, x, y, 0.035, trim, leaf); box(0.36, h, 0.02, x, y, -0.035, trim, leaf); }
  for (const z of [0.07, -0.07]) { const k = new THREE.Mesh(GEO.sph, brass); k.scale.setScalar(0.045); k.position.set(0.94, 1.08, z); leaf.add(k); }
  doorLight.position.set(0, 0.16, -0.02); door.add(doorLight);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#fff3d6', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); halo.position.set(0, 1.4, 0.1); halo.scale.setScalar(5); door.add(halo); door.userData.halo = halo;
  // two small lights at its foot, so it can be found after dark
  for (const s of [-1, 1]) bulb(at(DOOR.x + s * 0.75, DOOR.z + 0.3, sunH(DOOR.x, DOOR.z) + 0.3), '#fff1d0');
  regThing(door, 'Open the white door', () => late.leaveSunWorld && late.leaveSunWorld(), { x: DOOR_AT.x, z: DOOR_AT.z + 1.2, r: 2.6 });
}
let doorT = -1;
export function openDoor() { doorT = 0; }
function closeDoor() { doorT = -1; leaf.rotation.y = 0; doorLight.material.opacity = 0; door.userData.halo.material.opacity = 0; }

// all the fair's bulbs, in one set of points that twinkle gently and glow at dusk and night
{
  const n = bulbs.length / 7, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), ph = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos.set(bulbs.slice(i * 7, i * 7 + 3), i * 3); col.set(bulbs.slice(i * 7 + 3, i * 7 + 6), i * 3); ph[i] = bulbs[i * 7 + 6]; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
  root.add(new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: { uTime: waterU.uTime, uGlow: waterU.uGlow }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    vertexShader: 'uniform float uTime;attribute float aPh;varying vec3 vC;void main(){vC=color*(.8+.2*sin(uTime*2.+aPh));vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(320./-mv.z,2.,22.);gl_Position=projectionMatrix*mv;}',
    fragmentShader: 'uniform float uGlow;varying vec3 vC;void main(){float d=length(gl_PointCoord-.5);float a=(smoothstep(.5,.0,d)*.6+smoothstep(.18,.0,d))*uGlow;gl_FragColor=vec4(vC*a,a);}' })));
}
// the lights the water mirrors: the wheel's rim (updated as it turns), the coaster, the castle, the
// carousel, and the lamps nearest the lagoon
const WHEEL_REF = 6;
for (let k = 0; k < WHEEL_REF; k++) ref.unshift([new V3(), '#ffffff']);
lamps.filter(p => Math.abs(p.z - LAGOON.z) < 20 && Math.abs(p.x) < 4).slice(0, Math.max(0, NL - ref.length)).forEach(p => ref.push([p, '#ffe2a8']));
ref.slice(0, NL).forEach(([p, c], i) => { waterU.uL.value[i].copy(p).add(O); waterU.uLC.value[i].set(c); });

/* ---------- life: butterflies over the sunflowers by day, pollen in the light ---------- */
const flies = [];
{
  const wingTex = canvasTex(64, 64, g => { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(32, 24, 26, 18, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(30, 48, 16, 12, 0.3, 0, 7); g.fill(); g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(44, 18, 4, 0, 7); g.fill(); });
  const wg = new THREE.PlaneGeometry(0.1, 0.1).translate(0.05, 0, 0).rotateX(-Math.PI / 2);
  for (let i = 0; i < 18; i++) {
    const m = new THREE.MeshLambertMaterial({ map: wingTex, color: ['#ffffff', '#fff3a0', '#ffd27a', '#cfe6ff'][i % 4], alphaTest: 0.5, side: THREE.DoubleSide });
    const g = new THREE.Group(), l = new THREE.Mesh(wg, m), r = new THREE.Mesh(wg, m); r.scale.x = -1; g.add(l, r); root.add(g);
    flies.push({ g, l, r, c: new V3((R() - 0.5) * 20, 0, 25 - R() * 55), ph: R() * 6.28, sp: 0.3 + R() * 0.3 });
  }
}
{
  const N = 400, p = new Float32Array(N * 3), ph = new Float32Array(N);
  for (let i = 0; i < N; i++) { p.set([(R() - 0.5) * 60, 0.4 + R() * 3, 30 - R() * 80], i * 3); ph[i] = R() * 100; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
  // pollen by day, fireflies by night
  root.add(new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: waterU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'uniform float uTime;attribute float aPh;varying float vB;void main(){vec3 q=position+vec3(sin(uTime*.2+aPh)*1.2,sin(uTime*.31+aPh*1.7)*.5,cos(uTime*.17+aPh)*1.2);vB=.5+.5*sin(uTime*1.1+aPh*3.);vec4 mv=modelViewMatrix*vec4(q,1.);gl_PointSize=clamp(40./-mv.z,1.,4.);gl_Position=projectionMatrix*mv;}',
    fragmentShader: 'uniform float uNight;varying float vB;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,0.,d)*.6*vB;vec3 c=mix(vec3(1.,.95,.75),vec3(.8,1.,.5),uNight);gl_FragColor=vec4(c*a,a);}' })));
}

/* ---------- every frame while you are here ---------- */
const DAY = { hemiS: C('#e2f1ff'), hemiG: C('#4d7a32'), sun: C('#fff1d8'), fog: C('#d4e6f4') };
const DUSK = { hemiS: C('#ffc9a8'), hemiG: C('#5a5a3a'), sun: C('#ffa060'), fog: C('#f0b48c') };
const NIGHT = { hemiS: C('#38497e'), hemiG: C('#1a2418'), sun: C('#9fb4ff'), fog: C('#141c33') };
const mix3 = (n, d, key) => DAY[key].clone().lerp(DUSK[key], d).lerp(NIGHT[key], n);
const DUSK_TINT = C('#ffb3a0'), tmp = new V3();
let announced = false;
addTick(dt => {
  if (state.world !== 'sun') return;
  const n = state.night, d = (state.dusk || 0) * (1 - n);
  skyU.uNight.value = n; skyU.uDusk.value = d; waterU.uTime.value = T; sky.position.copy(camera.position);
  hemi.color.copy(mix3(n, d, 'hemiS')); hemi.groundColor.copy(mix3(n, d, 'hemiG')); hemi.intensity = lerp(lerp(0.5, 0.45, d), 0.3, n);
  sun.color.copy(mix3(n, d, 'sun')); sun.intensity = lerp(lerp(0.78, 0.65, d), 0.22, n);
  sun.position.set(lerp(lerp(40, -120, d), 60, n), lerp(lerp(100, 25, d), 80, n), lerp(lerp(120, -200, d), -100, n));
  sunScene.fog.color.copy(mix3(n, d, 'fog')); sunScene.background.copy(sunScene.fog.color); renderer.setClearColor(sunScene.fog.color);
  sunScene.fog.near = lerp(170, 120, n); sunScene.fog.far = lerp(1150, 700, n);
  mountMat.color.setRGB(1, 1, 1).lerp(DUSK_TINT, d * 0.5).multiplyScalar(lerp(1, 0.22, n));
  // the fair's lights: a little by day, warm at sunset, full at night
  const glow = Math.max(n, d * 0.6, 0.12); waterU.uGlow.value = glow;
  winMats.forEach(m => { m.emissiveIntensity = glow * 1.2; });
  // the rides
  wheel.rotation.z = T * 0.05; cabins.forEach(c => { c.rotation.z = -wheel.rotation.z; });
  for (let i = 0; i < WHEEL_REF; i++) { const a = i / WHEEL_REF * Math.PI * 2 + wheel.rotation.z; waterU.uL.value[i].set(O.x + WHEEL.x + Math.cos(a) * WHEEL.r, O.y + sunH(WHEEL.x, WHEEL.z) + WHEEL.hub + Math.sin(a) * WHEEL.r, O.z + WHEEL.z); waterU.uLC.value[i].setHSL(((i / WHEEL_REF - T * 0.08) % 1 + 1) % 1, 0.9, 0.62); }
  train.forEach((c, i) => { const t = ((T * 0.03) - i * 0.006 + 10) % 1, p = track.getPointAt(t), q = track.getPointAt((t + 0.002) % 1); c.position.copy(p); c.lookAt(tmp.copy(q).add(O)); });
  ring.rotation.y = T * 0.25; horses.forEach(h => { h.hg.position.y = 0.35 + Math.sin(T * 1.6 + h.ph) * 0.35; });
  for (const f of flies) {
    f.g.visible = n < 0.5;
    const t = T * f.sp + f.ph, x = f.c.x + Math.sin(t) * 4 + Math.sin(t * 2.3) * 1.2, z = f.c.z + Math.cos(t * 0.8) * 4;
    f.g.position.set(x, sunH(x, z) + 0.7 + Math.sin(t * 3) * 0.25, z); f.g.rotation.y = -t * 0.8;
    const flap = Math.sin(T * 14 + f.ph) * 0.9; f.l.rotation.z = flap; f.r.rotation.z = -flap;
  }
  if (doorT >= 0) {
    doorT += dt; const e = smooth(0, 1.4, doorT);
    leaf.rotation.y = -1.7 * e; doorLight.material.opacity = smooth(0.2, 1.2, doorT); door.userData.halo.material.opacity = smooth(0.3, 1.6, doorT) * 0.9;
  }
  // under the arch into the fair: say where you are (ui/worlds.js shows it)
  if (!announced && camera.position.z - O.z < ARCH_Z - 3) { announced = true; worlds.sun.announce && worlds.sun.announce(); }
});

/* ---------- standing here: the ground, what stops you, where you arrive ---------- */
const local = (x, z) => [x - O.x, z - O.z];
worlds.sun = {
  scene: sunScene,
  arrive: { pos: O.clone().add(new V3(0, 0, 34.8)), yaw: 0 },
  floorH(x, z) {
    const [lx, lz] = local(x, z);
    if (Math.abs(lx) < 0.9 && lz > 35.2 && lz < 43.5) return 0.26;
    if (Math.abs(lx) < BRIDGE.half && lagoonE(lx, lz) < 1.12) return Math.max(0.42, sunH(lx, lz));
    return Math.max(sunH(lx, lz), LAKE.y);
  },
  blocked(x, z) {
    const [lx, lz] = local(x, z);
    if (Math.abs(lx) > 95 || lz > 70 || lz < CASTLE.z + 12) return true;
    if (lakeE(lx, lz) < 1.02 && !(Math.abs(lx) < 0.9 && lz < 43.5)) return true;
    if (lagoonE(lx, lz) < 1.03 && Math.abs(lx) > BRIDGE.half - 0.3) return true;
    if (Math.hypot(lx - CAROUSEL.x, lz - CAROUSEL.z) < CAROUSEL.r + 0.4) return true;
    if (Math.abs(lx - WHEEL.x) < 9.5 && Math.abs(lz - WHEEL.z) < 3) return true;
    if (lx > 18 && lx < 72 && lz < -114 && lz > -176) return true;
    if (Math.abs(lx - DOOR.x) < 0.85 && Math.abs(lz - DOOR.z) < 0.5) return true;
    return false;
  },
  enter() { closeDoor(); announced = false; },
  leave() { closeDoor(); },
  openDoor,
  announce: null,
};
