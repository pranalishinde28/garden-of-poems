import { $, ease, isTouch } from './util.js';
import { POST } from '../settings/storage.js';
import { T, introA, seed, setIntroA, setTime, setTween, state, tween } from './state.js';
import { camera, canvas, renderer, scene } from '../world/renderer.js';
import { sky } from '../world/sky.js';
import { windU } from '../world/wind.js';
import { plants, setShadowDirty, shadowDirty } from '../plants/registry.js';
import { waterU } from '../water/water.js';
import { swings } from '../world/swings.js';
import { updateAnimals } from '../animals/animals.js';
import { airU, rainU } from '../world/particles.js';
import { Music } from '../audio/music.js';
import { curLook } from '../player/camera.js';
import { drag, hoverXY, pick } from '../ui/input.js';
import { regionKey, setCue, showRegion } from '../ui/helpers.js';
import { updateSeed } from '../ui/writing.js';
import { updateSwing } from '../ui/swinging.js';
import { atmosphere, setShadowClock, shadowClock } from '../world/atmosphere.js';
import { walk } from '../player/walk.js';
import { updateFx, updatePlants } from './updates.js';
import { renderReflection } from '../water/reflection.js';
import { renderPost } from '../world/post.js';
import { late } from './late.js';

let last = performance.now(), first = true;
export function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; setTime(T + dt);
  windU.uTime.value = T; waterU.uTime.value = T;
  atmosphere(dt);
  if (tween) {
    tween.t = Math.min(1, tween.t + dt / tween.dur); const e = ease(tween.t);
    camera.position.lerpVectors(tween.fp, tween.tp, e); curLook.lerpVectors(tween.fl, tween.tl, e); camera.lookAt(curLook);
    if (tween.t >= 1) { const d = tween.done; setTween(null); d && d(); }
  } else if (state.mode === 'intro') {
    setIntroA(introA + (dt * 0.025));
    camera.position.set(Math.sin(introA) * 33, 12.5 + Math.sin(T * 0.1) * 0.6, Math.cos(introA) * 33);
    curLook.set(0, 0.5, 0); camera.lookAt(curLook);
  } else if (state.mode === 'walk') walk(dt);
  else if (state.mode === 'cinematic' && seed) updateSeed(dt);
  else if (state.mode === 'swing') updateSwing(dt);
  swings.forEach(sw => { if (sw !== (state.mode === 'swing' ? state.swing : null)) { sw.omega += (-(9.8 / sw.Lw) * Math.sin(sw.theta) - 0.6 * sw.omega) * dt; sw.theta += sw.omega * dt; sw.pivot.rotation.x = sw.theta; } });
  updateAnimals(dt);
  if (state.mode !== 'walk') { setCue(null); plants.forEach(pl => pl.glowT = 0); if (regionKey) showRegion(null); }
  if (hoverXY && !drag && !isTouch && (state.mode === 'walk' || state.mode === 'focus') && (Math.floor(T * 20) % 3 === 0)) {
    const t = pick(hoverXY[0], hoverXY[1]); late.hoverPlant = t && t.kind === 'plant' ? t.plant : null; canvas.style.cursor = t ? 'pointer' : 'grab';
  } else if (drag && state.mode === 'walk') canvas.style.cursor = 'grabbing';
  const growing = updatePlants(dt); updateFx(dt);
  setShadowClock(shadowClock + dt);
  if (shadowDirty || (growing && shadowClock > 0.25) || shadowClock > 3) { renderer.shadowMap.needsUpdate = true; setShadowClock(0); setShadowDirty(false); }
  airU.uCam.value.copy(camera.position); rainU.uCam.value.copy(camera.position);
  sky.position.copy(camera.position);
  Music.update(state.rain);
  camera.updateMatrixWorld();
  renderReflection();
  if (POST.on) renderPost(); else renderer.render(scene, camera);
  if (first) { first = false; setTimeout(() => $('#loading').classList.add('done'), 200); }
  requestAnimationFrame(frame);
}
