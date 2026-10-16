import * as THREE from 'three';
import { $, C, isTouch } from '../core/util.js';

/* ================= renderer & scene ================= */
export const canvas = $('#c');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouch || devicePixelRatio < 2, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.5 : 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1700);
camera.rotation.order = 'YXZ';
camera.layers.enable(2);
scene.fog = new THREE.Fog(0xc7d8e4, 30, 170);
export const pointScale = { value: 1 };
export const POINT_VS_HEAD = 'uniform float uScale;';
export function pointsMat(uniforms, vs, fs, additive) {
  return new THREE.ShaderMaterial({ uniforms: Object.assign({ uScale: pointScale }, uniforms), vertexShader: vs, fragmentShader: fs, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
}
export const reflQuality = { scale: isTouch ? 0.35 : 0.5 }; // settings/quality.js changes this
export const reflRT = new THREE.WebGLRenderTarget(16, 16, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
function onResize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  pointScale.value = renderer.getPixelRatio() * innerHeight * 0.866;
  const pr = renderer.getPixelRatio();
  reflRT.setSize(Math.max(64, Math.floor(innerWidth * pr * reflQuality.scale)), Math.max(64, Math.floor(innerHeight * pr * reflQuality.scale)));
}
export { onResize };
onResize(); addEventListener('resize', onResize);
export const maxAniso = renderer.capabilities.getMaxAnisotropy();

// day: deep zenith, clear mid blue, pale horizon; sunset: violet, rose, glowing orange; night
export const SKY = { midD: C('#6aa6e2'), zenS: C('#3a4a8c'), midS: C('#d47a95'), horS: C('#f7a15a'), zenD: C('#2560bd'), horD: C('#dbe9f1'), zenN: C('#04080f'), horN: C('#16212f') };
export const SEASON = {
  spring: { tint: C('#fff6f4'), particle: { color: C('#f6eccf'), fall: 0.04, sway: 0.6, size: 0.045, leaf: 0, op: 0.45 }, words: 'mostly spring' },
  monsoon: { tint: C('#eef6ec'), particle: { color: C('#9cc47a'), fall: 0.3, sway: 0.8, size: 0.06, leaf: 1, op: 0.35 }, words: 'mostly the monsoon' },
  autumn: { tint: C('#ffe2c2'), particle: { color: C('#c4743d'), fall: 0.5, sway: 1.0, size: 0.11, leaf: 1, op: 0.85 }, words: 'mostly autumn' },
  winter: { tint: C('#e6eeff'), particle: { color: C('#f4f6fa'), fall: 0.65, sway: 0.4, size: 0.06, leaf: 0, op: 0.85 }, words: 'mostly winter' }
};

