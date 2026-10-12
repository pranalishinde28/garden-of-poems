import * as THREE from 'three';
import { V3 } from '../core/util.js';
import { groundH } from './terrain.js';
import { scene } from './renderer.js';

/* ================= the view toward Fuji: a five-storey pagoda, a temple hall, a torii ================= */
// Built on the hills beyond the hedge, outside the garden (nothing here is clickable). The pagoda
// stands to the right of Fuji and the hall and torii to the left, as in the classic Chūreitō view.
// Roofs turn white in winter (setTempleSeason).

// out of the garden's fog (it would wash them to ghosts at this distance); a touch of distance is in the colours
const lam = color => new THREE.MeshLambertMaterial({ color, fog: false });
const red = lam('#b8452e'), white = lam('#d6d0c4'), stone = lam('#8a8984'), bronze = lam('#45443f'), roofMat = lam('#45504f');
export const templeGroup = new THREE.Group(); scene.add(templeGroup);

// a square hip roof with flared eaves whose corners turn up
function roof(w, h, up, mat = roofMat) {
  const g = new THREE.CylinderGeometry(w * 0.16, w * 0.75, h, 32, 1, false), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
    p.setX(i, x * k * 0.72); p.setZ(i, z * k * 0.72);
    if (p.getY(i) < 0) p.setY(i, p.getY(i) + up * Math.pow((k - 1) / (Math.SQRT2 - 1), 2));
  }
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}
const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); return b; };

function pagoda(x, z, s = 1) {
  const g = new THREE.Group(), y0 = groundH(x, z) - 0.3; g.position.set(x, y0, z); g.scale.setScalar(s);
  g.add(box(10, 1.6, 10, stone, 0, 0.8, 0));
  let y = 1.6, w = 7.2;
  for (let i = 0; i < 5; i++) {
    const bh = i === 0 ? 3.4 : 2.5;
    g.add(box(w * 0.66, bh, w * 0.66, red, 0, y + bh / 2, 0));
    g.add(box(w * 0.67, bh * 0.4, w * 0.67, white, 0, y + bh * 0.62, 0)); // white panels between the vermilion posts
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.32, bh, 0.32, red, sx * w * 0.33, y + bh / 2, sz * w * 0.33));
    g.add(box(w * 0.7, 0.28, w * 0.7, red, 0, y + bh - 0.15, 0));
    if (i > 0) g.add(box(w * 0.86, 0.22, w * 0.86, red, 0, y + 0.1, 0)); // the balcony rail
    const r = roof(w * 1.55, 1.25, 0.75); r.position.y = y + bh + 0.55; g.add(r);
    y += bh + 1.0; w *= 0.88;
  }
  // the spire: nine bronze rings and a jewel
  const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 8), bronze); sp.position.y = y + 3.4; g.add(sp);
  for (let k = 0; k < 9; k++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42 - k * 0.018, 0.08, 6, 14), bronze); ring.rotation.x = Math.PI / 2; ring.position.y = y + 1.2 + k * 0.55; g.add(ring); }
  const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), bronze); jewel.position.y = y + 7; g.add(jewel);
  g.rotation.y = Math.atan2(-x, -z); templeGroup.add(g);
}
function hall(x, z) {
  const g = new THREE.Group(); g.position.set(x, groundH(x, z) - 0.2, z);
  g.add(box(19, 1.8, 13, stone, 0, 0.9, 0));
  g.add(box(15, 5.5, 9.5, white, 0, 4.55, 0));
  for (let i = 0; i <= 6; i++) for (const sz of [-1, 1]) g.add(box(0.45, 5.5, 0.45, red, -7.5 + i * 2.5, 4.55, sz * 4.75));
  g.add(box(15.4, 0.5, 9.9, red, 0, 7.1, 0));
  const r = roof(25, 3.6, 1.3); r.scale.z = 0.72; r.position.y = 9.1; g.add(r);
  const r2 = roof(12, 2.4, 0.8); r2.scale.z = 0.65; r2.position.y = 11.5; g.add(r2);
  g.add(box(10, 0.5, 0.6, roofMat, 0, 12.8, 0)); // the ridge
  g.rotation.y = Math.atan2(-x, -z); templeGroup.add(g);
}
function torii(x, z) {
  const g = new THREE.Group(); g.position.set(x, groundH(x, z) - 0.2, z);
  for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 9, 12), red); p.position.set(sx * 4.2, 4.5, 0); g.add(p); }
  g.add(box(10.4, 0.6, 0.8, red, 0, 7.6, 0)); // nuki
  const kasa = box(13.5, 0.75, 1.1, red, 0, 9.2, 0); g.add(kasa);
  g.add(box(13.9, 0.32, 1.25, bronze, 0, 9.7, 0)); // the black cap
  for (const sx of [-1, 1]) { const tip = box(1.4, 0.4, 1.25, bronze, sx * 7.3, 9.95, 0); tip.rotation.z = sx * 0.18; g.add(tip); }
  g.add(box(0.7, 1.6, 0.5, red, 0, 8.4, 0)); // the plaque post
  g.rotation.y = Math.atan2(-x, -z); templeGroup.add(g);
}

pagoda(40, -96, 1.05);
hall(-66, -104);
torii(-44, -86);
pagoda(-92, -122, 0.62); // a smaller pagoda, further back on the left
templeGroup.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });

export function setTempleSeason(season) { roofMat.color.set(season === 'winter' ? '#e4e9ee' : '#45504f'); }
