import * as THREE from 'three';
import { V3 } from '../core/util.js';
import { scene } from './renderer.js';
import { regEnd } from './paths.js';

/* ================= Mount Fuji ================= */
export const fujiU = { uLight: { value: new V3(0, 1, 0) }, uHor: { value: new THREE.Color() }, uNight: { value: 0 } };
(function buildFuji() {
  const H = 400, rb = 980, rt = 52, rings = 96, seg = 260, pos = [], at = [], idx = [];
  const gul = a => Math.sin(a * 37 + 1.3) * 0.6 + Math.sin(a * 83 + 0.4) * 0.3 + Math.sin(a * 151) * 0.1;
  for (let i = 0; i <= rings; i++) {
    const t = i / rings, rr = rt + (rb - rt) * Math.pow(1 - t, 1.75);
    for (let k = 0; k <= seg; k++) {
      const a = k / seg * Math.PI * 2, g = gul(a);
      const shoulder = 1 + 0.07 * Math.exp(-Math.pow(Math.atan2(Math.sin(a - 0.35), Math.cos(a - 0.35)), 2) / 0.03) * Math.exp(-Math.pow(t - 0.42, 2) / 0.02);
      const f = (1 + 0.028 * g * Math.min(1, t * 2.5) * (1 - t * 0.6)) * shoulder;
      let y = t * H; if (t > 0.975) y = H - (t - 0.975) * H * 0.9;
      pos.push(Math.cos(a) * rr * f, y, Math.sin(a) * rr * f); at.push(t, a);
      if (i < rings && k < seg) { const b = i * (seg + 1) + k; idx.push(b, b + seg + 1, b + 1, b + 1, b + seg + 1, b + seg + 2); }
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aT', new THREE.Float32BufferAttribute(at, 2)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: fujiU, fog: false,
    vertexShader: 'attribute vec2 aT;varying vec2 vT;varying vec3 vN;void main(){vT=aT;vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform vec3 uLight,uHor;uniform float uNight;varying vec2 vT;varying vec3 vN;
      float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1,0)),u.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),u.x),u.y);}
      float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.07+vec2(3.1,1.7);a*=.5;}return v;}
      void main(){
        float t=vT.x,a=vT.y;
        float g=sin(a*37.+1.3)*0.6+sin(a*83.+.4)*0.3+sin(a*151.)*0.1;
        float n=fbm(vec2(a*16.,t*5.));
        float finger=smoothstep(0.1,0.9,-g)*smoothstep(0.18,0.6,t)*0.2*(0.6+0.8*fbm(vec2(a*60.,t*3.)));
        float line=0.6+(n-0.5)*0.24+0.04*g;
        float snow=smoothstep(line-0.025,line+0.012,t+finger);
        vec3 L=normalize(uLight),N=normalize(vN);float lam=max(dot(N,L),0.);
        vec3 rock=mix(vec3(.19,.2,.28),vec3(.29,.25,.3),fbm(vec2(a*55.,t*45.)));
        rock=mix(rock,vec3(.12,.19,.18),smoothstep(0.32,0.06,t));
        vec3 snowC=mix(vec3(.74,.8,.93),vec3(1.,.99,.97),smoothstep(0.,0.7,lam));
        vec3 c=mix(rock*(0.45+0.75*lam),snowC*(0.82+0.25*lam),snow);
        c*=mix(1.,0.2,uNight);
        vec3 haze=mix(uHor,vec3(.6,.7,.85)*mix(1.,0.25,uNight),0.35);
        c=mix(c,haze,clamp(0.1+pow(1.-t,1.7)*0.8,0.,0.92));
        gl_FragColor=vec4(c,1.);}` }));
  m.position.set(-240, -45, -1180); scene.add(m);
})();
regEnd();

