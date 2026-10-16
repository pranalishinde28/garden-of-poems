import * as THREE from 'three';
import { C, V3, rng } from '../core/util.js';
import { RIVER, WATER_Y } from '../world/terrain.js';
import { reflRT, scene } from '../world/renderer.js';
import { DS, GEO, M, part } from '../world/geometry.js';
import { makeKoi } from './koiModel.js';

/* ================= water: reflective pond and river ================= */
export const reflCam = new THREE.PerspectiveCamera();
export const texMat = new THREE.Matrix4();
export const waterU = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
  uTime: { value: 0 }, uNight: { value: 0 }, uRain: { value: 0 }, uDeep: { value: C('#1d3634') }, uShallow: { value: C('#4f5d40') },
  uLightDir: { value: new V3() }, uLightCol: { value: new THREE.Color() }, uRip: { value: new THREE.Vector4(0, 0, -100, 0) },
  uTexMat: { value: texMat }, tRefl: { value: null }
}]);
waterU.tRefl.value = reflRT.texture;
function waterMat(river) {
  return new THREE.ShaderMaterial({
    uniforms: waterU, transparent: true, fog: true, defines: river ? { RIVER: 1 } : {},
    vertexShader: `attribute vec2 aFlow;attribute float aEdge;uniform mat4 uTexMat;varying vec3 vW;varying vec4 vR;varying vec2 vFlow;varying float vEdge;
      #include <fog_pars_vertex>
      void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;vR=uTexMat*w;vFlow=aFlow;vEdge=aEdge;vec4 mvPosition=viewMatrix*w;gl_Position=projectionMatrix*mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform sampler2D tRefl;uniform float uTime,uNight,uRain;uniform vec3 uDeep,uShallow,uLightDir,uLightCol;uniform vec4 uRip;
      varying vec3 vW;varying vec4 vR;varying vec2 vFlow;varying float vEdge;
      #include <fog_pars_fragment>
      float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1,0)),u.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),u.x),u.y);}
      float wh(vec2 p){float t=uTime;vec2 q=p-vFlow*t;
        float h=sin(dot(q,vec2(.8,.6))*1.9+t*1.1)*.5+sin(dot(q,vec2(-.5,.85))*2.7+t*1.4)*.35+sin(dot(q,vec2(.2,-.98))*4.3+t*1.9)*.2+sin(dot(q,vec2(-.9,-.4))*6.1+t*2.4)*.12;
        h+=(noise(q*2.5+t*.2)-.5)*.8+(noise(q*6.+vec2(t*.4,-t*.3))-.5)*.35;
        float age=uTime-uRip.z;float dr=length(p-uRip.xy);h+=sin((dr-age*1.7)*11.)*exp(-pow(dr-age*1.7,2.)*3.)*exp(-age*.7)*step(0.,age)*2.5;
        if(uRain>0.01){for(int k=0;k<2;k++){vec2 g=p*1.7+float(k)*vec2(.43,.71);vec2 i=floor(g),f=fract(g);
          float cy=t*(0.75+h2(i+3.7)*0.5)+h2(i+9.1),ph=fract(cy),id=floor(cy);vec2 c=vec2(h2(i+id*.37),h2(i+5.3+id*.61))*.6+.2;float d=length(f-c)-ph*.42;
          h+=sin(d*28.)*exp(-d*d*260.)*(1.-ph)*(1.-ph)*step(h2(i+float(k)*1.3+id*.17),uRain*0.55)*0.9;}}
        return h*.022;}
      void main(){
        float r=length(vW.xz);
        #ifdef RIVER
        if(r<8.)discard;
        #else
        if(r>8.)discard;
        #endif
        vec2 p=vW.xz;float e=.05;float h0=wh(p);
        vec3 n=normalize(vec3(-(wh(p+vec2(e,0.))-h0)/e,1.,-(wh(p+vec2(0.,e))-h0)/e));
        vec3 v=normalize(cameraPosition-vW);
        float f=clamp((0.03+0.97*pow(1.-max(dot(n,v),0.),5.))*1.1,0.,1.);
        vec2 uv=vR.xy/vR.w+n.xz*0.05;
        vec3 refl=texture2D(tRefl,uv).rgb;
        #ifdef RIVER
        float edge=smoothstep(.5,1.,vEdge);
        #else
        float edge=smoothstep(.7,.92,vEdge);
        #endif
        vec3 body=mix(uDeep,uShallow,edge*0.55)*mix(1.,0.35,uNight);
        vec3 c=mix(body,refl,f);
        #ifdef RIVER
        vec2 fd=normalize(vFlow+1e-4);vec2 pr=vec2(dot(p,vec2(-fd.y,fd.x)),dot(p,fd));
        float st=noise(vec2(pr.x*2.4,pr.y*0.3+uTime*0.9))*noise(vec2(pr.x*5.,pr.y*0.7+uTime*1.5));
        float foam=smoothstep(0.38,0.6,st)*0.3+smoothstep(0.8,1.05,vEdge)*0.35*noise(p*3.5+uTime*0.6);
        c=mix(c,vec3(.9,.94,.96)*mix(1.,0.25,uNight),foam*(1.-f*0.4));
        #endif
        vec3 hv=normalize(normalize(uLightDir)+v);c+=uLightCol*pow(max(dot(n,hv),0.),260.)*1.8;
        #ifdef RIVER
        float a=max(mix(0.8,0.97,f),edge*0.4);
        #else
        float a=max(mix(0.6,0.97,f),edge*0.5);
        #endif
        gl_FragColor=vec4(c,a);
        #include <fog_fragment>
      }`
  });
}
const pondGeo = new THREE.CircleGeometry(9.8, 96).rotateX(-Math.PI / 2);
{ const n = pondGeo.attributes.position.count, fl = new Float32Array(n * 2), ed = new Float32Array(n); for (let i = 0; i < n; i++) ed[i] = Math.hypot(pondGeo.attributes.position.getX(i), pondGeo.attributes.position.getZ(i)) / 9.8 * 1.22; pondGeo.setAttribute('aFlow', new THREE.BufferAttribute(fl, 2)); pondGeo.setAttribute('aEdge', new THREE.BufferAttribute(ed, 1)); }
export const water = new THREE.Mesh(pondGeo, waterMat(false)); water.position.y = WATER_Y; scene.add(water);
const riverGeo = (() => {
  const pos = [], fl = [], ed = [], idx = [], HW = 2.6; let k = 0;
  for (let i = 0; i < RIVER.length; i++) {
    const p = RIVER[i]; if (Math.hypot(p.x, p.z) < 6) continue;
    const a = RIVER[Math.max(0, i - 1)], b = RIVER[Math.min(RIVER.length - 1, i + 1)];
    let tx = b.x - a.x, tz = b.z - a.z; const L = Math.hypot(tx, tz); tx /= L; tz /= L;
    const sp = 0.7;
    for (const s of [-1, 0, 1]) { pos.push(p.x - tz * HW * s, 0, p.z + tx * HW * s); fl.push(-tx * sp, -tz * sp); ed.push(Math.abs(s) * 1.25); }
    if (k > 0) { const o = (k - 1) * 3; idx.push(o, o + 3, o + 1, o + 1, o + 3, o + 4, o + 1, o + 4, o + 2, o + 2, o + 4, o + 5); }
    k++;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aFlow', new THREE.Float32BufferAttribute(fl, 2)); g.setAttribute('aEdge', new THREE.Float32BufferAttribute(ed, 1)); g.setIndex(idx); g.computeBoundingSphere();
  return g;
})();
export const river = new THREE.Mesh(riverGeo, waterMat(true)); river.position.y = WATER_Y; river.frustumCulled = false; scene.add(river);

/* lily pads and water lilies */
(function lilies() {
  const R = rng(21);
  for (let i = 0; i < 11; i++) {
    const a = R() * 6.28, r = 2 + R() * 4.8, s = 0.28 + R() * 0.25;
    const pad = new THREE.Mesh(new THREE.CircleGeometry(1, 20, 0.25, Math.PI * 2 - 0.5).rotateX(-Math.PI / 2), M(R() < .5 ? '#4d6b3f' : '#5a7a47'));
    pad.scale.setScalar(s); pad.position.set(Math.cos(a) * r, WATER_Y + 0.012, Math.sin(a) * r); pad.rotation.y = R() * 6; scene.add(pad);
    if (i < 4) {
      const fl = new THREE.Group(); fl.position.copy(pad.position); fl.position.y += 0.02; scene.add(fl);
      const pm = M(i % 2 ? '#f2d3dc' : '#fbf3f4', { side: DS });
      for (let ring = 0; ring < 2; ring++) for (let k = 0; k < 8; k++) { const pv = new THREE.Group(); pv.rotation.y = k / 8 * 6.28 + ring * 0.4; fl.add(pv); part(pv, GEO.petal, pm, [0, 0.01, 0], [0.13 - ring * 0.03, 0.13, 0.09], [0, 0, 0.35 + ring * 0.45]); }
      part(fl, GEO.sph, M('#ecc54e'), [0, 0.04, 0], 0.03);
    }
  }
})();

/* koi */
export const koi = [];
// where the koi gather for a while: wherever you touch the water (ui/input.js)
export const koiLure = { x: 0, z: 0, until: -1 };
(function buildKoi() {
  // lifelike koi (water/koiModel.js), each a different variety
  const R = rng(61), kinds = ['kohaku', 'ogon', 'showa', 'chagoi', 'sanke', 'tancho', 'asagi', 'yamabuki', 'kohaku'];
  kinds.forEach((kind, i) => {
    const k = makeKoi(kind, 0.45 + R() * 0.2, 70 + i); scene.add(k.g);
    koi.push({ g: k.g, swim: k.swim, r: 1.6 + R() * 3.6, cx: (R() - .5) * 1.5, cz: (R() - .5) * 1.5, sp: (0.12 + R() * 0.1) * (R() < .5 ? 1 : -1), ph: R() * 6.28, d: 0.18 + R() * 0.14, last: new V3(), turn: 0 });
  });
})();

