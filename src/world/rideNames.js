import * as THREE from 'three';
import { C, V3 } from '../core/util.js';
import { state } from '../core/state.js';
import { camera } from './renderer.js';
import { addTick } from '../core/things.js';
import { O, SUN_PLAN as P, sunH, sunScene } from './sunWorld.js';

/* ================= the rides' names, in big block letters over each one ================= */
// Asked after round 60, instead of sign boards; after round 61 only the water slide and wave pool keep a floating
// name, and the Thunder Bowl's name sits on a board at sign height. Each name is drawn once in a heavy typeface on a small canvas and every lit
// pixel becomes a block (one InstancedMesh a name), a bright colour fading down the letters with a white
// rim; the name turns to face you wherever you stand, so it never reads backwards, and glows after dusk.

const box = new THREE.BoxGeometry(1, 1, 1), d = new THREE.Object3D(), names = [];
const mat = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.12 });
function blockName(text, x, z, y, size, top, low, yaw) {
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
  const grp = new THREE.Group(); grp.position.set(O.x + x, O.y + sunH(x, z) + y, O.z + z); grp.add(im); sunScene.add(grp); if (yaw === undefined) names.push(grp); else grp.rotation.y = yaw; return grp;
}
// [name, where (local x, z), how high, block size, colours]
const coasterTop = P.track ? Math.max(...P.track.map(p => p.y)) : 20;
const coasterAt = P.track ? P.track.reduce((a, p) => [a[0] + p.x / P.track.length, a[1] + p.z / P.track.length], [0, 0]) : [60, -145];
// only the water park's names float over their rides (the fair's names were removed at the owner's request)
[
  ['WATER SLIDE', P.WP.tower.x, P.WP.tower.z, P.WP.tower.h + 8, 0.26, '#ffd23a', '#f08a1a'],
  ['WAVE POOL', P.WP.wave.x, P.WP.wave.z, 9, 0.26, '#5ae0f0', '#1a8ac8'],
].forEach(([t, x, z, y, s, a, b]) => blockName(t, x, z, y, s, a, b));
// the Thunder Bowl's name stands on a board at the deck's way in, at a sign's height, facing the fair
{
  const B = P.BOWL, x = B.deck.x0 + 1, z = B.z + 12, gy = sunH(x, z), w = 9.6, h = 2.2, y = 4.3;
  const g = blockName('THUNDER BOWL', x, z, y, 0.046, '#ffb43a', '#e8401a', -Math.PI / 2);
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.18, h, w), new THREE.MeshLambertMaterial({ color: '#1f4fa8', emissive: '#0a1a3a', emissiveIntensity: 0.4 }));
  board.position.set(O.x + x + 0.25, O.y + gy + y, O.z + z); sunScene.add(board);
  const rim = new THREE.Mesh(new THREE.BoxGeometry(0.12, h + 0.3, w + 0.3), new THREE.MeshLambertMaterial({ color: '#f6c22a' })); rim.position.copy(board.position).add(new V3(0.08, 0, 0)); sunScene.add(rim);
  for (const dz of [-w / 2 + 0.6, w / 2 - 0.6]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, y + h / 2, 10), new THREE.MeshLambertMaterial({ color: '#f4f1ea' })); post.position.set(O.x + x + 0.45, O.y + gy + (y + h / 2) / 2, O.z + z + dz); sunScene.add(post); }
}
// each name turns to face you, and glows a little after dusk
addTick(() => {
  if (state.world !== 'sun') return;
  for (const n of names) n.rotation.y = Math.atan2(camera.position.x - n.position.x, camera.position.z - n.position.z);
  mat.emissiveIntensity = 0.12 + 0.5 * state.night;
}, true);
