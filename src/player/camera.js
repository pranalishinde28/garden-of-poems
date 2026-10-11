import { V3, clamp, reduceMotion } from '../core/util.js';
import { POND_R, WATER_Y, WORLD_R, bridgeH, groundH, riverDist } from '../world/terrain.js';
import { setTween } from '../core/state.js';
import { camera } from '../world/renderer.js';
import { decor, featOn } from '../world/paths.js';

/* ================= player & camera: position, tweens, collision ================= */
export const player = { pos: new V3(0, 0, 35.5), yaw: 0, pitch: -0.06, vel: new V3(), eyeY: 0 };
export const SPAWN = { pos: new V3(0, 0, 35.5), yaw: 0 };
export const curLook = new V3(0, 0, 0);
export function camTween(toPos, toLook, dur, done) {
  setTween({ fp: camera.position.clone(), tp: toPos.clone(), fl: curLook.clone(), tl: toLook.clone(), t: 0, dur: reduceMotion ? Math.min(dur, 0.6) : dur, done });
}
export function blocked(x, z) {
  const r = Math.hypot(x, z);
  if (r < POND_R || r > WORLD_R) return true;
  if (riverDist(x, z) < 2.5 && bridgeH(x, z) === null) return true;
  if (decor.some(o => o.collide > 0 && (!o.key || featOn(o.key)) && Math.hypot(o.x - x, o.z - z) < o.collide + 0.25)) return true;
  return false;
}
export const floorH = (x, z) => { const b = bridgeH(x, z); return b !== null ? b : Math.max(groundH(x, z), WATER_Y); };
export function syncPlayerFromCamera() {
  const dir = new V3().subVectors(curLook, camera.position).normalize();
  player.pos.set(camera.position.x, 0, camera.position.z);
  const r = Math.hypot(player.pos.x, player.pos.z); if (r < POND_R) player.pos.multiplyScalar(POND_R / r);
  player.yaw = Math.atan2(-dir.x, -dir.z); player.pitch = clamp(Math.asin(clamp(dir.y, -1, 1)), -1.05, 0.85);
  player.eyeY = camera.position.y; player.vel.set(0, 0, 0);
}
export const lookDir = () => new V3(-Math.sin(player.yaw) * Math.cos(player.pitch), Math.sin(player.pitch), -Math.cos(player.yaw) * Math.cos(player.pitch));

