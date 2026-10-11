import * as THREE from 'three';
import { C, V3, lerp } from '../core/util.js';
import { SETTINGS } from '../settings/storage.js';
import { T, state } from '../core/state.js';
import { SEASON, SKY, scene } from './renderer.js';
import { skyU } from './sky.js';
import { dirL, hemi, lightDir, moonDir, sunDir } from './lights.js';
import { mountainU } from './ground.js';
import { nightGlow, nightSprites, setShadowDirty } from '../plants/registry.js';
import { waterU } from '../water/water.js';
import { lampGlowU } from './lamps.js';
import { fujiU } from './fuji.js';
import { mist } from '../plants/flowerGardens.js';
import { airU, ffU, linkU, petalU, rainU } from './particles.js';
import { airSeason } from '../ui/themes.js';

/* ================= frame loop ================= */
export const tmpV = new V3();
export let seasonTint = SEASON[state.seasonCur].tint.clone(), shadowClock = 0, lastNight = -1;
const hemiD = { s: C('#d6e6f2'), g: C('#5d6e44') }, hemiN = { s: C('#4f6288'), g: C('#10170f') };
const dirD = C('#fff0d8'), dirN = C('#a3b7de');
const RAIN_D = C('#9aa2a6'), RAIN_N = C('#262c33'), rainCol = new THREE.Color();
const SHOWER = { every: 420, lasts: 140 }; // passing showers: about 2½ minutes of rain in every 7
function rainWanted() {
  if (SETTINGS.weather === 'rain') return 1;
  if (SETTINGS.weather === 'showers') return (T - state.showerAt) % SHOWER.every < SHOWER.lasts ? 1 : 0;
  return 0;
}
export function atmosphere(dt) {
  state.night += (state.nightTarget - state.night) * (1 - Math.exp(-dt * 0.7));
  state.rain += (rainWanted() - state.rain) * (1 - Math.exp(-dt * 0.3));
  const n = state.night, r = state.rain;
  rainCol.copy(RAIN_D).lerp(RAIN_N, n);
  skyU.uRain.value = r; skyU.uRainCol.value.copy(rainCol); waterU.uRain.value = r; rainU.uRain.value = r; rainU.uNight.value = n;
  document.body.classList.toggle('is-night', n > 0.5);
  seasonTint.lerp(SEASON[airSeason()].tint, 1 - Math.exp(-dt * 0.8));
  fujiU.uHor.value.copy(scene.fog.color); fujiU.uLight.value.copy(lightDir); fujiU.uNight.value = state.night; lampGlowU.uOpacity.value = 0.04 + state.night * 0.96;
  skyU.uNight.value = n; skyU.uTime.value = T;
  const hor = scene.fog.color.copy(SKY.horD).lerp(SKY.horN, n).lerp(rainCol, r * 0.6);
  scene.fog.near = lerp(lerp(30, 14, n), 9, r * 0.7); scene.fog.far = lerp(lerp(170, 115, n), 85, r * 0.7);
  mountainU.forEach(u => { u.uHor.value.copy(hor); u.uNight.value = n; });
  hemi.color.copy(hemiD.s).lerp(hemiN.s, n); hemi.groundColor.copy(hemiD.g).lerp(hemiN.g, n); hemi.intensity = lerp(0.62, 0.42, n) * (1 - r * 0.12);
  dirL.color.copy(dirD).lerp(dirN, n).multiply(seasonTint); dirL.intensity = lerp(1.05, 0.36, n) * (1 - r * 0.65);
  sunDir.set(0.6 + Math.sin(T * 0.008) * 0.1, 0.48 + Math.sin(T * 0.011) * 0.04, 0.64).normalize();
  skyU.uSunDir.value.copy(sunDir); skyU.uMoonDir.value.copy(moonDir);
  lightDir.copy(n < 0.5 ? sunDir : moonDir);
  dirL.position.copy(lightDir).multiplyScalar(120);
  waterU.uLightDir.value.copy(lightDir); waterU.uLightCol.value.copy(n < 0.5 ? C('#fff2dc') : C('#c8d8f4')).multiplyScalar((n < 0.5 ? 1 - n * 1.6 : (n - 0.5) * 1.2) * (1 - r * 0.85));
  waterU.uNight.value = n;
  waterU.fogColor.value.copy(scene.fog.color); waterU.fogNear.value = scene.fog.near; waterU.fogFar.value = scene.fog.far;
  ffU.uOpacity.value = (0.02 + n * 0.95) * (1 - r * 0.85);
  linkU.uOpacity.value = 0.22 + n * 0.6;
  petalU.uOpacity.value = 1 - n * 0.4;
  nightGlow.forEach(g => { g.m.emissiveIntensity = lerp(g.day, g.night, n); });
  nightSprites.forEach(g => { g.s.material.opacity = lerp(g.day, g.night, n) + Math.sin(T * 3 + g.day * 9) * 0.02; });
  mist.forEach(s => { const u = s.userData; s.material.opacity = lerp(0.14, 0.06, n) * (state.season === 'winter' ? 1.3 : 1) * (1 + r * 0.8); s.position.x = u.x + Math.sin(T * 0.05 + u.ph) * 1.5; });
  const pp = SEASON[state.seasonCur].particle;
  if (state.seasonCur !== airSeason()) { airU.uOpacity.value -= dt * 0.8; if (airU.uOpacity.value <= 0) { airU.uOpacity.value = 0; state.seasonCur = airSeason(); const q = SEASON[state.seasonCur].particle; airU.uFall.value = q.fall; airU.uSway.value = q.sway; airU.uSize.value = q.size; airU.uLeaf.value = q.leaf; airU.uColor.value.copy(q.color); } }
  else airU.uOpacity.value = Math.min(pp.op * (1 - n * 0.3) * (1 - r), airU.uOpacity.value + dt * 0.5);
  if (!SETTINGS.drift) airU.uOpacity.value = 0;
  if (Math.abs(lastNight - n) > 0.02) { lastNight = n; setShadowDirty(true); }
}
export function setShadowClock(v) { return (shadowClock = v); }
