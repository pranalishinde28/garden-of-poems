import * as THREE from 'three';
import { V3 } from '../core/util.js';
import { SKY, scene } from './renderer.js';

/* ---------- sky ---------- */
export const skyU = { uSunDir: { value: new V3(0, 1, 0) }, uMoonDir: { value: new V3(0, 1, 0) }, uNight: { value: 0 }, uTime: { value: 0 }, uZenD: { value: SKY.zenD }, uHorD: { value: SKY.horD }, uZenN: { value: SKY.zenN }, uHorN: { value: SKY.horN }, uRain: { value: 0 }, uRainCol: { value: new THREE.Color() } };
export const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 48, 24), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: `uniform vec3 uSunDir,uMoonDir,uZenD,uHorD,uZenN,uHorN,uRainCol;uniform float uNight,uTime,uRain;varying vec3 vP;
  float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float h3(vec3 p){p=fract(p*0.3183099+.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1,0)),u.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),u.x),u.y);}
  float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
  void main(){
    vec3 d=normalize(vP);float y=d.y;float n=uNight;
    vec3 zen=mix(uZenD,uZenN,n),hor=mix(uHorD,uHorN,n);
    vec3 c=mix(hor,zen,pow(clamp(y,0.,1.),0.5));
    vec3 sd=normalize(uSunDir);float s=max(dot(d,sd),0.);vec3 sc=vec3(1.,.87,.68);
    c+=sc*(pow(s,6.)*0.22+pow(s,40.)*0.3)*(1.-n)*(1.-uRain);
    c+=vec3(1.,.97,.9)*smoothstep(0.99925,0.9997,s)*2.5*(1.-n)*(1.-uRain);
    c=mix(c,hor*1.04,exp(-max(y,0.)*12.)*0.4);
    if(y<0.)c=hor*mix(1.,.9,clamp(-y*4.,0.,1.));
    vec3 md=normalize(uMoonDir);float m=max(dot(d,md),0.);
    c+=n*(vec3(.96,.97,1.)*smoothstep(0.99955,0.99975,m)*1.3+vec3(.5,.6,.8)*pow(m,90.)*0.3+vec3(.25,.33,.5)*pow(m,10.)*0.1);
    if(y>0.){vec3 q=floor(d*300.);float st=step(0.9984,h3(q));c+=vec3(st)*n*smoothstep(0.04,0.35,y)*(0.55+0.45*sin(uTime*1.7+q.x*3.1))*(1.-uRain);}
    c=mix(c,uRainCol,uRain*0.6);
    if(y>0.005){
      vec2 uv=d.xz/(y+0.09)*0.8+vec2(uTime*0.005,uTime*0.0018);
      float cl=fbm(uv*0.85);float cov=smoothstep(mix(0.5,0.2,uRain),mix(0.8,0.62,uRain),cl);
      float lit=fbm(uv*0.85+sd.xz*0.08);float shade=clamp((cl-lit)*3.5+0.55,0.,1.);
      vec3 cd=mix(vec3(.66,.7,.76),vec3(1.,.985,.96),shade)+sc*pow(s,4.)*0.25;
      vec3 cn=mix(vec3(.04,.055,.08),vec3(.2,.24,.31),shade)+vec3(.2,.25,.35)*pow(m,6.)*0.6;
      cd=mix(cd,uRainCol*mix(0.78,1.08,shade),uRain*0.85);cn=mix(cn,uRainCol*mix(0.7,1.1,shade),uRain*0.6);
      c=mix(c,mix(cd,cn,n),cov*smoothstep(0.005,0.2,y)*0.95);
    }
    gl_FragColor=vec4(c,1.);
  }`
}));
sky.renderOrder = -1; scene.add(sky);

