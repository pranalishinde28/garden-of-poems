import { V3, clamp, reduceMotion } from '../core/util.js';
import { POND_R, SHORE_MAX_R, WATER_Y, WORLD_R, beachH, bridgeH, groundH, riverDist, seaDepth, shore } from '../world/terrain.js';
import { setTween } from '../core/state.js';
import { camera } from '../world/renderer.js';
import { decor, featOn } from '../world/paths.js';

/* ================= player & camera: position, tweens, collision ================= */
export const player = { pos: new V3(0, 0, 49), yaw: 0, pitch: -0.06, vel: new V3(), eyeY: 0 };
// a few steps outside the gate, so the arch, its name and the sign are the first things you see
export const SPAWN = { pos: new V3(0, 0, 49), yaw: 0 };
export const curLook = new V3(0, 0, 0);
export function camTween(toPos, toLook, dur, done) {
  setTween({ fp: camera.position.clone(), tp: toPos.clone(), fl: curLook.clone(), tl: toLook.clone(), t: 0, dur: reduceMotion ? Math.min(dur, 0.6) : dur, done });
}
export function blocked(x, z) {
  const r = Math.hypot(x, z);
  // by the sea the garden opens onto the beach: walk on down to the water and wade in, up to about a metre
  if (r < POND_R || r > (shore.on ? SHORE_MAX_R : WORLD_R)) return true;
  if (shore.on && r > WORLD_R && seaDepth(x, z) > 1.0) return true;
  if (riverDist(x, z) < 2.5 && bridgeH(x, z) === null) return true;
  if (decor.some(o => o.collide > 0 && (!o.key || featOn(o.key)) && Math.hypot(o.x - x, o.z - z) < o.collide + 0.25)) return true;
  return false;
}
export const floorH = (x, z) => { const b = bridgeH(x, z); if (b !== null) return b; if (shore.on && Math.hypot(x, z) > 68) return beachH(x, z); return Math.max(groundH(x, z), WATER_Y); };
export function syncPlayerFromCamera() {
  const dir = new V3().subVectors(curLook, camera.position).normalize();
  player.pos.set(camera.position.x, 0, camera.position.z);
  const r = Math.hypot(player.pos.x, player.pos.z); if (r < POND_R) player.pos.multiplyScalar(POND_R / r);
  player.yaw = Math.atan2(-dir.x, -dir.z); player.pitch = clamp(Math.asin(clamp(dir.y, -1, 1)), -1.05, 0.85);
  player.eyeY = camera.position.y; player.vel.set(0, 0, 0);
}
export const lookDir = () => new V3(-Math.sin(player.yaw) * Math.cos(player.pitch), Math.sin(player.pitch), -Math.cos(player.yaw) * Math.cos(player.pitch));

