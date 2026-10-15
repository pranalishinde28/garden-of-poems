import { V3 } from '../core/util.js';
import { WORLD_R } from '../world/terrain.js';
import { poems } from '../settings/storage.js';
import { camera } from '../world/renderer.js';
import { BENCH, featOn } from '../world/paths.js';
import { plants } from '../plants/registry.js';
import { sign } from '../world/decor.js';
import { swings } from '../world/swings.js';
import { blocked, curLook, floorH, lookDir, player } from './camera.js';
import { jv, keys } from '../ui/input.js';
import { regionAt, setCue, showRegion } from '../ui/helpers.js';
import { board } from '../settings/customize.js';
import { tmpV } from '../world/atmosphere.js';
import { fireFlurry } from '../world/particles.js';
import { T } from '../core/state.js';
import { things } from '../core/things.js';

export function walk(dt) {
  let ix = 0, iz = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) iz += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) iz -= 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
  ix += jv.x; iz += jv.y;
  const l = Math.hypot(ix, iz); if (l > 1) { ix /= l; iz /= l; }
  const sp = (keys.has('ShiftLeft') || keys.has('ShiftRight')) ? 5.2 : 3.0;
  const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
  player.vel.lerp(new V3((-sy * iz + cy * ix) * sp, 0, (-cy * iz - sy * ix) * sp), 1 - Math.exp(-dt * 5));
  const nx = player.pos.x + player.vel.x * dt, nz = player.pos.z + player.vel.z * dt;
  const stuck = blocked(player.pos.x, player.pos.z);
  if (stuck || !blocked(nx, nz)) { player.pos.x = nx; player.pos.z = nz; }
  else if (!blocked(nx, player.pos.z)) player.pos.x = nx;
  else if (!blocked(player.pos.x, nz)) player.pos.z = nz;
  else player.vel.set(0, 0, 0);
  const r = Math.hypot(player.pos.x, player.pos.z);
  if (r > WORLD_R + 1) player.pos.multiplyScalar((WORLD_R + 1) / r);
  plants.forEach(pl => {
    if (!pl.collide || pl.vis < 0.5) return;
    const dx = player.pos.x - pl.root.position.x, dz = player.pos.z - pl.root.position.z, d = Math.hypot(dx, dz), m = pl.collide + 0.35;
    if (d < m && d > 0.0001) { player.pos.x = pl.root.position.x + dx / d * m; player.pos.z = pl.root.position.z + dz / d * m; }
  });
  const ty = floorH(player.pos.x, player.pos.z) + 1.6;
  player.eyeY += (ty - player.eyeY) * (1 - Math.exp(-dt * 6));
  camera.position.set(player.pos.x, player.eyeY, player.pos.z);
  camera.rotation.set(player.pitch, player.yaw, 0);
  curLook.copy(camera.position).add(lookDir());

  const fwd = new V3(-sy, 0, -cy); let best = null, bd = 1e9;
  plants.forEach(pl => {
    if (pl.vis < 0.9 || pl.dying || !pl.root.visible) return;
    tmpV.set(pl.root.position.x - player.pos.x, 0, pl.root.position.z - player.pos.z);
    const d = tmpV.length() - pl.radius * 0.6; if (d > 3.2) return;
    const facing = tmpV.normalize().dot(fwd);
    if (facing < 0.25 && d > 0.8) return;
    const score = d - facing; if (score < bd) { bd = score; best = pl; }
  });
  let target = best ? { kind: 'plant', plant: best } : null, nearThing = null;
  if (!target) {
    const nearBoard = Math.hypot(player.pos.x - board.position.x, player.pos.z - board.position.z) < 2.6;
    const swn = featOn('swings') && !nearBoard && swings.find(sw => Math.hypot(player.pos.x - sw.g.position.x, player.pos.z - sw.g.position.z) < 2.9);
    if (nearBoard) target = { kind: 'board' };
    else if (swn) target = { kind: 'swing', sw: swn };
    else if (Math.hypot(player.pos.x - BENCH.x, player.pos.z - BENCH.z) < 3.2) target = { kind: 'bench' };
    else if (sign.visible && Math.hypot(player.pos.x - sign.position.x, player.pos.z - sign.position.z) < 3) target = { kind: 'sign' };
    else if ((nearThing = things.find(t => t.near && t.root.visible && Math.hypot(player.pos.x - t.near.x, player.pos.z - t.near.z) < t.near.r))) target = { kind: 'thing', it: nearThing };
    else if (r < 11.6 && tmpV.set(-player.pos.x, 0, -player.pos.z).normalize().dot(fwd) > 0.45 && poems.length) target = { kind: 'pond' };
  }
  // brushing through a tree's canopy shakes a few petals (or leaves, or snow) loose
  if (Math.hypot(player.vel.x, player.vel.z) > 0.6) for (const pl of plants.values()) {
    if (pl.vis < 0.9 || !pl.root.visible || T < (pl.brushT || 0)) continue;
    const d = Math.hypot(pl.root.position.x - player.pos.x, pl.root.position.z - player.pos.z);
    if (d < pl.radius * 0.8) { pl.brushT = T + 6; fireFlurry(pl.root.position.x + (player.pos.x - pl.root.position.x) * 0.5, pl.root.position.y + Math.min(3.2, (pl.h || 3) * 0.7), pl.root.position.z + (player.pos.z - pl.root.position.z) * 0.5, Math.min(2.2, pl.radius * 0.6)); break; }
  }
  plants.forEach(pl => { pl.glowT = 0; });
  if (target && target.kind === 'plant') target.plant.glowT = 1;
  setCue(target);
  showRegion(regionAt(player.pos.x, player.pos.z));
}
