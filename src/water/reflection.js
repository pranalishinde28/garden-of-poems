import * as THREE from 'three';
import { WATER_Y } from '../world/terrain.js';
import { camera, reflRT, renderer, scene } from '../world/renderer.js';
import { reflCam, river, texMat, water } from './water.js';
import { curLook } from '../player/camera.js';

// The pond and stream reflect a mirrored camera. Everything below the water is cut away with an
// oblique near plane in that camera's projection (as three.js's Reflector does) rather than with
// renderer.clippingPlanes: clipping planes made every material swap shader variants twice a frame,
// which cost CPU on every draw call and doubled the shader programs.
const plane = new THREE.Plane(), clip = new THREE.Vector4(), q = new THREE.Vector4(), prevClear = new THREE.Color();
const N = new THREE.Vector3(0, 1, 0), P = new THREE.Vector3(0, WATER_Y - 0.02, 0);
export function renderReflection() {
  const cp = camera.position;
  // a very deep far plane: the oblique near plane tilts the far plane, which would otherwise cut away the sky and Fuji
  reflCam.fov = camera.fov; reflCam.aspect = camera.aspect; reflCam.near = 0.1; reflCam.far = 60000; reflCam.updateProjectionMatrix();
  reflCam.position.set(cp.x, 2 * WATER_Y - cp.y, cp.z);
  reflCam.up.set(0, 1, 0); reflCam.lookAt(curLook.x, 2 * WATER_Y - curLook.y, curLook.z);
  reflCam.updateMatrixWorld(); reflCam.matrixWorldInverse.copy(reflCam.matrixWorld).invert();
  texMat.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(reflCam.projectionMatrix).multiply(reflCam.matrixWorldInverse);
  // oblique near plane at the water surface
  plane.setFromNormalAndCoplanarPoint(N, P).applyMatrix4(reflCam.matrixWorldInverse);
  clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
  const e = reflCam.projectionMatrix.elements;
  q.set((Math.sign(clip.x) + e[8]) / e[0], (Math.sign(clip.y) + e[9]) / e[5], -1, (1 + e[10]) / e[14]);
  clip.multiplyScalar(2 / clip.dot(q));
  e[2] = clip.x; e[6] = clip.y; e[10] = clip.z + 1; e[14] = clip.w;
  reflCam.projectionMatrixInverse.copy(reflCam.projectionMatrix).invert();
  water.visible = river.visible = false;
  // clear to the horizon colour: the oblique plane also trims the sky dome's lower half, which used to fill in there
  renderer.getClearColor(prevClear); const prevAlpha = renderer.getClearAlpha();
  renderer.setRenderTarget(reflRT); renderer.setClearColor(scene.fog.color, 1); renderer.clear(); renderer.render(scene, reflCam);
  renderer.setRenderTarget(null); renderer.setClearColor(prevClear, prevAlpha);
  water.visible = river.visible = true;
}
