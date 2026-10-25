import * as THREE from 'three';
import { groundH } from './terrain.js';
import { scene } from './renderer.js';
import { Kit, PAL, brackets, hipRoof, lantern, nightLit, pagoda, railing, roofMat, setRoofSeason, storey, torii } from './architecture.js';

/* ================= the view toward Fuji: a five-storey pagoda, a temple hall, a torii ================= */
// Built on the hills beyond the hedge, outside the garden (nothing here is clickable). The pagoda
// stands to the right of Fuji and the hall and torii to the left, as in the classic Chūreitō view.
// Roofs turn white in winter (setTempleSeason).

// out of the garden's fog (it would wash them to ghosts at this distance); a touch of distance is in the colours.
// Built with the same carpentry as the garden's own pagoda and shrine (world/architecture.js).
const body = nightLit(new THREE.MeshLambertMaterial({ vertexColors: true, fog: false })), roofs = roofMat('#45504f', false);
export const templeGroup = new THREE.Group(); scene.add(templeGroup);
function place(x, z, s = 1, sink = 0.3) { const g = new THREE.Group(); g.position.set(x, groundH(x, z) - sink, z); g.rotation.y = Math.atan2(-x, -z); g.scale.setScalar(s); templeGroup.add(g); return g; }

function bigPagoda(x, z, s) { const kit = new Kit(); pagoda(kit, 5, 4.8, { h0: 3.4, h: 2.5, shrink: 0.88, spire: 1.25 }); lantern(kit, -5.6, 7.2, 1.5); lantern(kit, 5.6, 7.2, 1.5); kit.build(place(x, z, s), body, roofs); }
function hall(x, z) {
  const kit = new Kit();
  kit.box(19, 1.8, 13, 0, 0.9, 0, PAL.stone); kit.box(19.4, 0.16, 13.4, 0, 1.82, 0, PAL.stoneDark);
  for (let st = 0; st < 4; st++) { const sh = 0.45 * (st + 1); kit.box(5, sh, 0.5, 0, sh / 2, 6.5 + 0.25 + (3 - st) * 0.5, PAL.stoneDark); }
  railing(kit, 17.6, 11.8, 1.9);
  for (const sx of [-1, 1]) lantern(kit, sx * 5.5, 9.6, 1.5);
  const top = storey(kit, 15, 9.5, 1.9, 5.3, 23, 17.5, 3.0, 1.2);
  // the upper roof of a two-tier hall, its own short walls and brackets beneath it
  kit.box(10.5, 1.6, 6.4, 0, top + 2.2, 0, PAL.white);
  brackets(kit, 10.5, 6.4, top + 2.9, 2);
  kit.geo(hipRoof(14.5, 10.4, 2.6, 0.9), 0, top + 3.3, 0, '#ffffff', undefined, 0, 0, 0, true);
  kit.rbox(6.5, 0.6, 0.7, 0, top + 5.9, 0, '#bdbdbd');
  for (const sx of [-1, 1]) kit.rbox(0.9, 1.0, 0.8, sx * 3.4, top + 6.1, 0, '#b0b0b0'); // shibi at the ridge ends
  kit.build(place(x, z, 1, 0.2), body, roofs);
}
function gate(x, z) { const kit = new Kit(); torii(kit, 8.4, 9); lantern(kit, -5.8, 1.5, 1.6); lantern(kit, 5.8, 1.5, 1.6); kit.build(place(x, z, 1, 0.2), body, roofs); }

bigPagoda(40, -96, 1.05);
hall(-66, -104);
gate(-44, -86);
gate(31, -80); // a torii on the way up to the great pagoda
gate(-80, -106); // and one before the small pagoda
bigPagoda(-92, -122, 0.62); // a smaller pagoda, further back on the left
templeGroup.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });

// every roof in the garden and on the hills whitens in winter
export function setTempleSeason(season) { setRoofSeason(season); }
