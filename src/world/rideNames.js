import * as THREE from 'three';
import { C, V3 } from '../core/util.js';
import { state } from '../core/state.js';
import { camera } from './renderer.js';
import { addTick } from '../core/things.js';
import { O, SUN_PLAN as P, sunH, sunScene } from './sunWorld.js';

/* ================= the rides' names, in big block letters over each one ================= */
// Asked after round 60, instead of sign boards: every ride's name stands high over it in chunky 3D block letters,
// readable from across the fair. Each name is drawn once in a heavy typeface on a small canvas and every lit
// pixel becomes a block (one InstancedMesh a name), a bright colour fading down the letters with a white
// rim; the name turns to face you wherever you stand, so it never reads backwards, and glows after dusk.

const box = new THREE.BoxGeometry(1, 1, 1), d = new THREE.Object3D(), names = [];
const mat = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.12 });
function blockName(text, x, z, y, size, top, low) {
  const PX = 22, c = document.createElement('canvas'), g = c.getContext('2d'), font = `900 ${PX}px "Arial Black", Impact, "Helvetica Neue", Arial, sans-serif`;
  g.font = font; const w = Math.ceil(g.measureText(text).width) + 4, h = PX + 6; c.width = w; c.height = h;
  g.font = font; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(text, 2, h / 2 + 1);
  const px = g.getImageData(0, 0, w, h).data, on = (i, j) => i >= 0 && j >= 0 && i < w && j < h && px[(j * w + i) * 4 + 3] > 120;
  const cells = []; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (on(i, j)) cells.push([i, j, !(on(i - 1, j) && on(i + 1, j) && on(i, j - 1) && on(i, j + 1))]);
  const im = new THREE.InstancedMesh(box, mat, cells.length), cTop = C(top), cLow = C(low), white = C('#fff8ec'), col = new THREE.Color();
  cells.forEach(([i, j, edge], k) => {
    d.position.set((i - w / 2) * size, (h / 2 - j) * size, 0); d.scale.set(size * 1.02, size * 1.02, size * (edge ? 3.2 : 2.6)); d.updateMatrix(); im.setMatrixAt(k, d.matrix);
    im.setColorAt(k, edge ? white : col.copy(cTop).lerp(cLow, j / h));
  });
  const grp = new THREE.Group(); grp.position.set(O.x + x, O.y + sunH(x, z) + y, O.z + z); grp.add(im); sunScene.add(grp); names.push(grp);
}
// [name, where (local x, z), how high, block size, colours]
const coasterTop = P.track ? Math.max(...P.track.map(p => p.y)) : 20;
const coasterAt = P.track ? P.track.reduce((a, p) => [a[0] + p.x / P.track.length, a[1] + p.z / P.track.length], [0, 0]) : [60, -145];
[
  ['FERRIS WHEEL', P.WHEEL.x, P.WHEEL.z, P.WHEEL.hub + P.WHEEL.r + 5, 0.3, '#ff5a5a', '#c21e3a'],
  ['CAROUSEL', P.CAROUSEL.x, P.CAROUSEL.z, 14, 0.24, '#ff8ac0', '#d0407a'],
  ['TEACUPS', P.FAIR_RIDES.tea.x, P.FAIR_RIDES.tea.z, 13, 0.22, '#ff9ad0', '#c8508a'],
  ['SWINGS', P.SWING.x, P.SWING.z, 20, 0.24, '#6ab4ff', '#2a5ec8'],
  ['DROP TOWER', P.FAIR_RIDES.drop.x, P.FAIR_RIDES.drop.z, 62, 0.36, '#ff6a3a', '#c8280e'],
  ['ROLLER COASTER', coasterAt[0], coasterAt[1], coasterTop + 7, 0.32, '#ff5a5a', '#a0142a'],
  ['STORYBOOK BOATS', P.CANAL.x, P.CANAL.z, 11, 0.22, '#7ad0ff', '#2a7ac8'],
  ['WATER SLIDE', P.WP.tower.x, P.WP.tower.z, P.WP.tower.h + 8, 0.26, '#ffd23a', '#f08a1a'],
  ['WAVE POOL', P.WP.wave.x, P.WP.wave.z, 9, 0.26, '#5ae0f0', '#1a8ac8'],
  P.DOCK && ['JET SKIS', P.DOCK.x, P.DOCK.z1, 7, 0.22, '#5ae0f0', '#1a6ac8'],
  ['THUNDER BOWL', P.BOWL.tower.x - 6, P.BOWL.tower.z - 4, P.BOWL.tower.h + 14, 0.32, '#ffb43a', '#e8401a'],
].filter(Boolean).forEach(([t, x, z, y, s, a, b]) => blockName(t, x, z, y, s, a, b));
// each name turns to face you, and glows a little after dusk
addTick(() => {
  if (state.world !== 'sun') return;
  for (const n of names) n.rotation.y = Math.atan2(camera.position.x - n.position.x, camera.position.z - n.position.z);
  mat.emissiveIntensity = 0.12 + 0.5 * state.night;
}, true);
