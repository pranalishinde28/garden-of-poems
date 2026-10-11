import { backOut, clamp, easeOut } from './util.js';
import { WATER_Y, groundH } from '../world/terrain.js';
import { T, state } from './state.js';
import { camera } from '../world/renderer.js';
import { plants, removePlant } from '../plants/registry.js';
import { koi } from '../water/water.js';
import { burst, butterflies, trail } from '../world/particles.js';
import { late } from './late.js';

export function updatePlants(dt) {
  const camP = camera.position; let growing = false;
  plants.forEach(pl => {
    if (pl.delay > 0) { pl.delay -= dt; }
    else if (pl.vis !== pl.target) { pl.vis = pl.target > pl.vis ? Math.min(1, pl.vis + pl.speed * dt) : Math.max(0, pl.vis - pl.speed * dt); growing = true; }
    const s = pl.target === 1 ? backOut(pl.vis) : easeOut(pl.vis);
    pl.inner.scale.setScalar(Math.max(0.0001, s));
    pl.root.visible = pl.vis > 0.002;
    if (pl.dying && pl.vis <= 0) { removePlant(pl); return; }
    if (!pl.root.visible) return;
    if (camP.distanceToSquared(pl.root.position) < 1600) {
      pl.sway.forEach(w => { const v = w.base + Math.sin(T * 1.3 + w.ph + pl.root.position.x * 0.2) * w.amp; if (w.axis === 'x') w.o.rotation.x = v; else w.o.rotation.z = v; });
      pl.bobs.forEach(b => { b.o.position.y = b.y + Math.sin(T * 0.8 + b.ph) * b.amp; });
    }
    pl.pulse = Math.max(0, pl.pulse - dt * 0.35);
    const gt = Math.max(pl.glowT * 0.55, pl === late.hoverPlant ? 0.5 : 0, pl.pulse * 0.7, state.reading === pl.poem.id ? 0.35 : 0);
    pl.glowV += (gt - pl.glowV) * (1 - Math.exp(-dt * 4));
    pl.glow.material.opacity = pl.glowV * (0.75 + 0.25 * Math.sin(T * 2.2));
  });
  return growing;
}
export function updateFx(dt) {
  trail.forEach(s => { if (!s.visible) return; s.userData.life -= dt * 1.4; s.material.opacity = Math.max(0, s.userData.life) * 0.7; s.scale.setScalar(0.45 * s.userData.life + 0.05); s.position.y += dt * 0.15; if (s.userData.life <= 0) s.visible = false; });
  if (burst.life > 0) {
    burst.life -= dt * 0.6; const p = burst.pts.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { const v = burst.vel[i]; v.y -= dt * 1.6; v.multiplyScalar(1 - dt * 1.2); p.setXYZ(i, p.getX(i) + v.x * dt, p.getY(i) + v.y * dt, p.getZ(i) + v.z * dt); }
    p.needsUpdate = true; burst.u.uOpacity.value = Math.max(0, burst.life); if (burst.life <= 0) burst.pts.visible = false;
  }
  const day = 1 - state.night;
  butterflies.forEach(b => {
    b.g.visible = day > 0.35; if (!b.g.visible) return;
    const t = T * b.sp + b.ph;
    const x = b.cx + Math.sin(t) * b.rad + Math.sin(t * 2.3) * 0.6, z = b.cz + Math.cos(t * 0.8) * b.rad;
    const y = groundH(x, z) + b.h + Math.sin(t * 3.1) * 0.25;
    b.g.position.set(x, y, z);
    const dx = x - b.last.x, dz = z - b.last.z; if (dx * dx + dz * dz > 1e-6) b.g.rotation.y = Math.atan2(dx, dz);
    b.last.set(x, y, z);
    const f = Math.sin(T * 15 + b.ph) * 0.95; b.l.rotation.z = f; b.r.rotation.z = -f;
    b.g.scale.setScalar(clamp(day, 0, 1));
  });
  koi.forEach(k => {
    const a = T * k.sp + k.ph, x = k.cx + Math.cos(a) * k.r + Math.sin(a * 2.7) * 0.4, z = k.cz + Math.sin(a) * k.r * 0.8;
    k.g.position.set(x, WATER_Y - k.d + Math.sin(T * 0.7 + k.ph) * 0.03, z);
    const dx = x - k.last.x, dz = z - k.last.z; if (dx * dx + dz * dz > 1e-7) k.g.rotation.y = Math.atan2(dx, dz);
    k.last.set(x, 0, z); k.tail.rotation.y = Math.sin(T * 6 + k.ph) * 0.35;
  });
}
