import * as THREE from 'three';
import { isTouch } from '../core/util.js';
import { THEME } from '../settings/storage.js';
import { T, state } from '../core/state.js';
import { camera, renderer, scene } from './renderer.js';

/* ================= cinematic finish: bloom, film grade, vignette, grain ================= */
const rtOpts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
const sceneRT = (renderer.capabilities.isWebGL2 && THREE.WebGLMultisampleRenderTarget) ? new THREE.WebGLMultisampleRenderTarget(16, 16, rtOpts) : new THREE.WebGLRenderTarget(16, 16, rtOpts);
if ('samples' in sceneRT) sceneRT.samples = isTouch ? 2 : 4;
const bloomA = new THREE.WebGLRenderTarget(16, 16, rtOpts), bloomB = new THREE.WebGLRenderTarget(16, 16, rtOpts);
const postScene = new THREE.Scene(), postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quad.frustumCulled = false; postScene.add(quad);
const PVS = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
const postMat = (u, fs) => new THREE.ShaderMaterial({ uniforms: u, vertexShader: PVS, fragmentShader: fs, depthTest: false, depthWrite: false });
const brightMat = postMat({ tDiffuse: { value: null }, uThresh: { value: 0.7 } }, 'uniform sampler2D tDiffuse;uniform float uThresh;varying vec2 vUv;void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;float l=dot(c,vec3(.299,.587,.114));gl_FragColor=vec4(c*smoothstep(uThresh,uThresh+0.3,l),1.);}');
const blurMat = postMat({ tDiffuse: { value: null }, uDir: { value: new THREE.Vector2() } }, 'uniform sampler2D tDiffuse;uniform vec2 uDir;varying vec2 vUv;void main(){vec3 c=texture2D(tDiffuse,vUv).rgb*0.227;c+=(texture2D(tDiffuse,vUv+uDir*1.385).rgb+texture2D(tDiffuse,vUv-uDir*1.385).rgb)*0.316;c+=(texture2D(tDiffuse,vUv+uDir*3.231).rgb+texture2D(tDiffuse,vUv-uDir*3.231).rgb)*0.07;gl_FragColor=vec4(c,1.);}');
const compMat = postMat({ tScene: { value: null }, tBloom: { value: null }, uTime: { value: 0 }, uNight: { value: 0 }, uAutumn: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } }, `uniform sampler2D tScene,tBloom;uniform float uTime,uNight,uAutumn;uniform vec2 uRes;varying vec2 vUv;
  vec3 aces(vec3 x){return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.,1.);}
  float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
  void main(){
    vec2 d=vUv-.5;float r2=dot(d,d);vec2 off=d*0.006*r2;
    vec3 c=vec3(texture2D(tScene,vUv+off).r,texture2D(tScene,vUv).g,texture2D(tScene,vUv-off).b);
    c+=texture2D(tBloom,vUv).rgb*mix(0.5,1.0,uNight);
    c=mix(c,aces(c*1.2),0.55);
    float l=dot(c,vec3(.299,.587,.114));
    c=mix(vec3(l),c,mix(1.2,1.1,uNight));
    vec3 sh=mix(vec3(.93,.98,1.06),vec3(.98,.95,1.04),uNight),hi=mix(vec3(1.05,1.01,.95),vec3(1.08,.99,.9),uAutumn);
    c*=mix(sh,hi,smoothstep(.12,.85,l));
    c=(c-.5)*1.06+.5;
    c*=1.-r2*mix(0.5,0.85,uNight);
    c+=(h(vUv*uRes+fract(uTime*7.)*91.)-.5)*0.028;
    gl_FragColor=vec4(clamp(c,0.,1.),1.);}`);
function resizePost() {
  const pr = renderer.getPixelRatio(), w = Math.floor(innerWidth * pr), h = Math.floor(innerHeight * pr);
  sceneRT.setSize(w, h); bloomA.setSize(Math.max(32, w >> 2), Math.max(32, h >> 2)); bloomB.setSize(Math.max(32, w >> 2), Math.max(32, h >> 2)); compMat.uniforms.uRes.value.set(w, h);
}
resizePost(); addEventListener('resize', resizePost);
export function renderPost() {
  renderer.setRenderTarget(sceneRT); renderer.clear(); renderer.render(scene, camera);
  quad.material = brightMat; brightMat.uniforms.tDiffuse.value = sceneRT.texture; renderer.setRenderTarget(bloomA); renderer.render(postScene, postCam);
  for (let i = 0; i < 2; i++) {
    quad.material = blurMat; blurMat.uniforms.tDiffuse.value = bloomA.texture; blurMat.uniforms.uDir.value.set((1 + i * 1.5) / bloomA.width, 0); renderer.setRenderTarget(bloomB); renderer.render(postScene, postCam);
    blurMat.uniforms.tDiffuse.value = bloomB.texture; blurMat.uniforms.uDir.value.set(0, (1 + i * 1.5) / bloomA.height); renderer.setRenderTarget(bloomA); renderer.render(postScene, postCam);
  }
  quad.material = compMat; compMat.uniforms.tScene.value = sceneRT.texture; compMat.uniforms.tBloom.value = bloomA.texture; compMat.uniforms.uTime.value = T; compMat.uniforms.uNight.value = state.night; compMat.uniforms.uAutumn.value = THEME === 'autumn' ? 1 : 0;
  renderer.setRenderTarget(null); renderer.render(postScene, postCam);
}

