import * as THREE from 'three';
import { state } from '../core/state.js';
import { glowTex } from './textures.js';
import { GEO } from './geometry.js';
import { archLights, archNightU } from './architecture.js';
import { addTick } from '../core/things.js';

/* ================= the temples by night ================= */
// Every stone lantern built with the temple kit (the pagodas, the bell tower, the shrine, the hall and gates
// on the hills) records where its firebox is; here each one gets a glowing paper window and a soft halo,
// and the buildings take the warm light washing up from below (architecture.js, nightLit). They wake at
// dusk and are brightest at night. Lights are added to their building's group, so they hide with it.
const paper = new THREE.MeshBasicMaterial({ color: '#ffd9a0', transparent: true, opacity: 0, fog: false });
const halo = new THREE.SpriteMaterial({ map: glowTex, color: '#ffc77a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
for (const { group, lights } of archLights) {
  for (const { p, s } of lights) {
    const box = new THREE.Mesh(GEO.box, paper); box.position.copy(p); box.scale.setScalar(0.36 * s); group.add(box);
    const sp = new THREE.Sprite(halo); sp.position.copy(p); sp.scale.setScalar(2.6 * s); group.add(sp);
  }
}
addTick(() => {
  const k = Math.max(state.night, (state.dusk || 0) * 0.45);
  archNightU.value = k * 0.75; paper.opacity = k; halo.opacity = k * 0.85;
}, true);
