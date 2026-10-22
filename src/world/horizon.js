import * as THREE from 'three';
import { C, clamp, rng, smooth } from '../core/util.js';
import { groundH, shore } from './terrain.js';
import { beachThings } from './beach.js';
import { scene } from './renderer.js';
import { groundMesh, mountainMeshes } from './ground.js';
import { fujiMesh } from './fuji.js';
import { templeGroup } from './temples.js';
import { waterU } from '../water/water.js';
import { hedges } from './decor.js';

/* ================= the horizon: Mount Fuji, or the sea ================= */
// Beyond the hedge (r > 70) the ground keeps two shapes: rolling hills toward Fuji, or a sandy beach
// running down into the sea. Switching swaps the outer vertices and colours of the one ground mesh
// (nothing is rebuilt) and shows the sea or the mountains, Fuji and temples.

const SEA_Y = -0.9;
const pos = groundMesh.geometry.attributes.position, col = groundMesh.geometry.attributes.color;
const outer = [];
// warm sand that holds its colour in the sun
const sandDry = C('#d9c08c'), sandWet = C('#b39d72'), sandUnder = C('#8c7f62'), t = new THREE.Color();
for (let i = 0; i < pos.count; i++) {
  const x = pos.getX(i), z = pos.getZ(i), r = Math.hypot(x, z);
  if (r < 68) continue;
  const hy = pos.getY(i), hc = [col.getX(i), col.getY(i), col.getZ(i)];
  // the beach: the garden's own ground until 72 m, then sand sloping gently into the water
  const k = smooth(70, 80, r), by = (1 - k) * hy + k * Math.max(-9, 0.35 - (r - 80) * 0.09) + Math.sin(x * 0.11 + z * 0.07) * 0.08 * k;
  t.setRGB(hc[0], hc[1], hc[2]).lerp(by > 0.2 ? sandDry : by > SEA_Y - 0.1 ? sandWet : sandUnder, smooth(68, 74, r));
  outer.push({ i, hy, hc, by, bc: [t.r, t.g, t.b] });
}

// the sea: deep blue far out, turquoise over the sand, a sun glint, and surf where it meets the beach
const seaU = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]);
seaU.uLightDir = waterU.uLightDir; seaU.uLightCol = waterU.uLightCol; seaU.uNight = waterU.uNight; seaU.uTime = waterU.uTime; seaU.fogColor = waterU.fogColor;
const sea = new THREE.Mesh(new THREE.CircleGeometry(1600, 96).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
  uniforms: seaU, fog: false, transparent: true, depthWrite: false, // its own slow haze
  vertexShader: `varying vec3 vW;
    void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
  fragmentShader: `uniform float uTime,uNight;uniform vec3 uLightDir,uLightCol,fogColor;varying vec3 vW;
    float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1,0)),u.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),u.x),u.y);}
    float wave(vec2 p){float t=uTime;return sin(dot(p,vec2(.21,.13))+t*.9)*.5+sin(dot(p,vec2(-.11,.27))+t*1.3)*.3+(noise(p*.6+t*.15)-.5)*.6+(noise(p*2.1-t*.3)-.5)*.25;}
    void main(){
      float r=length(vW.xz);
      if(r<84.)discard;
      vec2 p=vW.xz;float e=.4,h0=wave(p);
      vec3 n=normalize(vec3(-(wave(p+vec2(e,0.))-h0)*.35,1.,-(wave(p+vec2(0.,e))-h0)*.35));
      vec3 v=normalize(cameraPosition-vW);
      float fr=pow(1.-max(dot(n,v),0.),4.);
      vec3 deep=vec3(.08,.33,.5),shallow=vec3(.3,.66,.68);
      vec3 c=mix(shallow,deep,smoothstep(92.,150.,r));
      c=mix(c,vec3(.62,.75,.86),fr*.55);
      vec3 hl=normalize(normalize(uLightDir)+v);c+=uLightCol*pow(max(dot(n,hl),0.),220.)*1.6;
      float shore=94.+sin(uTime*.6+atan(p.y,p.x)*9.)*.8+sin(uTime*.9)*.6;
      float foam=smoothstep(2.4,0.,abs(r-shore))*(0.55+0.45*noise(p*1.4+uTime*.5));
      c=mix(c,vec3(.95,.97,.97),foam*.8);
      c*=mix(1.,.25,uNight);
      c=mix(c,fogColor,smoothstep(160.,1300.,length(cameraPosition-vW)));
      gl_FragColor=vec4(c,smoothstep(84.,90.,r));
    }`,
}));
sea.position.y = SEA_Y; sea.visible = false; sea.layers.set(2); scene.add(sea);


// the beach itself: a ring of sand over the ground's beach shape, with a wavy edge where the grass ends
const beach = (() => {
  const g = new THREE.RingGeometry(68, 104, 180, 20).rotateX(-Math.PI / 2), p = g.attributes.position, cols = [], R = rng(77);
  const ph = [R() * 6, R() * 6, R() * 6];
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), z = p.getZ(i); const a = Math.atan2(z, x), r0 = Math.hypot(x, z);
    const edge = 70.5 + Math.sin(a * 7 + ph[0]) * 1.2 + Math.sin(a * 17 + ph[1]) * 0.6, r = edge + (r0 - 68) / 36 * (104 - edge);
    x = Math.cos(a) * r; z = Math.sin(a) * r;
    const k = smooth(70, 80, r), y = (1 - k) * groundH(x, z) + k * Math.max(-9, 0.35 - (r - 80) * 0.09) + Math.sin(x * 0.11 + z * 0.07) * 0.08 * k;
    p.setXYZ(i, x, y + 0.05, z);
    const c = (y > 0.2 ? sandDry : y > SEA_Y - 0.1 ? sandWet : sandUnder).clone().multiplyScalar(0.92 + R() * 0.1);
    cols.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true })); m.receiveShadow = true; m.visible = false; scene.add(m);
  return m;
})();

let current = 'fuji';
export function applyHorizon(view, fujiOn) {
  const seaView = view === 'sea'; shore.on = seaView; beachThings.visible = seaView;
  sea.visible = seaView; beach.visible = seaView;
  waterU.uRiverMax.value = seaView ? 71 : 1e4; // the stream stops at the lawn's edge; the sea takes over
  mountainMeshes.forEach(m => { m.visible = !seaView; });
  fujiMesh.forEach(m => { m.visible = !seaView && fujiOn; });
  templeGroup.visible = !seaView;
  hedges.forEach(h => { h.visible = !seaView; }); // open to the beach
  if (current === view) return;
  current = view;
  for (const o of outer) {
    pos.setY(o.i, seaView ? o.by : o.hy);
    const c = seaView ? o.bc : o.hc; col.setXYZ(o.i, clamp(c[0], 0, 1), clamp(c[1], 0, 1), clamp(c[2], 0, 1));
  }
  pos.needsUpdate = true; col.needsUpdate = true; groundMesh.geometry.computeVertexNormals();
}
