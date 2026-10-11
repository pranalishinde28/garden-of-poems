import { WATER_Y } from '../world/terrain.js';
import { camera, reflRT, renderer, scene } from '../world/renderer.js';
import { clipPlane, reflCam, river, texMat, water } from './water.js';
import { curLook } from '../player/camera.js';

export function renderReflection() {
  const cp = camera.position;
  reflCam.fov = camera.fov; reflCam.aspect = camera.aspect; reflCam.near = 0.1; reflCam.far = 1700; reflCam.projectionMatrix.copy(camera.projectionMatrix);
  reflCam.position.set(cp.x, 2 * WATER_Y - cp.y, cp.z);
  reflCam.up.set(0, 1, 0); reflCam.lookAt(curLook.x, 2 * WATER_Y - curLook.y, curLook.z);
  reflCam.updateMatrixWorld(); reflCam.matrixWorldInverse.copy(reflCam.matrixWorld).invert();
  texMat.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(reflCam.projectionMatrix).multiply(reflCam.matrixWorldInverse);
  water.visible = river.visible = false;
  renderer.setRenderTarget(reflRT); renderer.clippingPlanes = [clipPlane];
  renderer.clear(); renderer.render(scene, reflCam);
  renderer.clippingPlanes = []; renderer.setRenderTarget(null);
  water.visible = river.visible = true;
}

