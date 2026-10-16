import * as THREE from 'three';
import { V3 } from '../core/util.js';
import { SKY, scene } from './renderer.js';

/* ---------- sky ---------- */
export const skyU = { uDusk: { value: 0 }, uMidD: { value: SKY.midD }, uZenS: { value: SKY.zenS }, uMidS: { value: SKY.midS }, uHorS: { value: SKY.horS }, uSunDir: { value: new V3(0, 1, 0) }, uMoonDir: { value: new V3(0, 1, 0) }, uNight: { value: 0 }, uTime: { value: 0 }, uZenD: { value: SKY.zenD }, uHorD: { value: SKY.horD }, uZenN: { value: SKY.zenN }, uHorN: { value: SKY.horN }, uRain: { value: 0 }, uRainCol: { value: new THREE.Color() } };
export const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 48, 24), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: `uniform vec3 uSunDir,uMoonDir,uZenD,uHorD,uZenN,uHorN,uRainCol,uMidD,uZenS,uMidS,uHorS;uniform float uNight,uTime,uRain,uDusk;varying vec3 vP;
  float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float h3(vec3 p){p=fract(p*0.3183099+.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1,0)),u.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),u.x),u.y);}
  float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
  void main(){
    vec3 d=normalize(vP);float y=d.y;float n=uNight;
    float yy=clamp(y,0.,1.);vec3 sd=normalize(uSunDir);float s=max(dot(d,sd),0.);
    // three-stop gradients: day (deep blue, clear blue, a warm pale horizon) and sunset (violet, rose,
    // glowing orange), brightest toward the sun; night stays as it was
    vec3 day=mix(uHorD,uMidD,smoothstep(0.,.2,yy));day=mix(day,uZenD,smoothstep(.15,.85,yy));day=mix(day,vec3(.99,.94,.86),exp(-yy*16.)*.35);
    vec3 dusk=mix(uHorS,uMidS,smoothstep(0.,.24,yy));dusk=mix(dusk,uZenS,smoothstep(.2,.85,yy));
    float toward=pow(max(dot(normalize(vec3(d.x,0.,d.z)+1e-4),normalize(vec3(sd.x,0.,sd.z)+1e-4)),0.),3.);
    dusk+=vec3(1.,.5,.2)*toward*exp(-yy*5.)*.55;dusk=mix(dusk,uZenS*.8,(1.-toward)*smoothstep(.0,.6,yy)*.25);
    vec3 nightc=mix(uHorN,uZenN,pow(yy,0.5));
    vec3 c=mix(mix(day,dusk,uDusk),nightc,n);
    vec3 hor=mix(mix(uHorD,uHorS,uDusk),uHorN,n),zen=mix(uZenD,uZenN,n);
    vec3 sc=mix(vec3(1.,.87,.68),vec3(1.,.55,.25),uDusk);
    c+=sc*(pow(s,6.)*mix(.22,.5,uDusk)+pow(s,40.)*.3)*(1.-n)*(1.-uRain);
    c+=mix(vec3(1.,.97,.9),vec3(1.,.72,.42),uDusk)*smoothstep(mix(0.99925,0.9986,uDusk),0.9997,s)*2.5*(1.-n)*(1.-uRain);
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
      cd=mix(cd,mix(vec3(.5,.38,.55),vec3(1.,.68,.52),shade)+vec3(1.,.5,.25)*pow(s,3.)*.4,uDusk); // clouds lit pink and gold from below
      vec3 cn=mix(vec3(.04,.055,.08),vec3(.2,.24,.31),shade)+vec3(.2,.25,.35)*pow(m,6.)*0.6;
      cd=mix(cd,uRainCol*mix(0.78,1.08,shade),uRain*0.85);cn=mix(cn,uRainCol*mix(0.7,1.1,shade),uRain*0.6);
      c=mix(c,mix(cd,cn,n),cov*smoothstep(0.005,0.2,y)*0.95);
    }
    gl_FragColor=vec4(c,1.);
  }`
}));
sky.renderOrder = -1; scene.add(sky);

