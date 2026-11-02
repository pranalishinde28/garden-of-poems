import * as THREE from 'three';
import { C, V3, rng, siteURL } from '../core/util.js';
import { state, T } from '../core/state.js';
import { canvasTex } from './textures.js';
import { GEO, Merge } from './geometry.js';
import { worlds } from '../core/worlds.js';
import { addTick, regThing } from '../core/things.js';
import { late, provide } from '../core/late.js';
import { O, sunScene } from './sunWorld.js';
import { HALL, artTex, baroque, cover, frame, hall, img } from './castleHall.js';

/* ================= the Hall of Paintings, off the Hall of Mirrors: after the Galleria Doria Pamphilj ================= */
// On your right as you come into the castle, a hallway leads to a long gilded gallery hung with famous paintings
// (public/art/gallery, public-domain photographs, credits in CREDITS.md) in gilded frames on crimson damask, under a
// painted vault, with mirrors and chandeliers. At its far end is a wall of your own paintings (ui/paintings.js
// hangs what you upload; the frames refill when you add one). Walk up to any painting to look at it closely.
// Shown whenever the Hall of Mirrors is.

provide({ get hangOwnPaintings() { return hangOwn; } });
const R = rng(1357);
const BAY_Z = HALL.z - HALL.hl + (19 + 0.5) * HALL.bay;
// the gallery: its axis runs east, beginning 22 m beyond the hall's east wall; 64 m long, 16 m wide, 17 m to the vault
export const GAL = { x: HALL.x + HALL.hw + 22, z: BAY_Z, y: -90, L: 64, hw: 8, wall: 17, rise: 4 };
const W = new V3(O.x + GAL.x, O.y + GAL.y, O.z + GAL.z);
const gal = new THREE.Group(); gal.position.copy(W); gal.visible = false; sunScene.add(gal);
addTick(() => { if (gal.visible !== hall.visible) { gal.visible = hall.visible; if (gal.visible) loadFamous(); } }, true);
const GOLD = C('#d4a63a'), GOLD2 = C('#e8c25a'), CREAM = C('#efe6d2');
const gilt = new THREE.MeshPhongMaterial({ vertexColors: true, specular: '#8a6a2a', shininess: 45, emissive: '#3a2808', emissiveIntensity: 0.7, fog: false });
const lit = (map, k = 0.5, extra = {}) => new THREE.MeshLambertMaterial(Object.assign({ map, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: k, color: '#d8ccb4', fog: false }, extra));

/* ---------- the famous paintings: [file, title, painter, year, where it hangs, a few words] ---------- */
export const FAMOUS_ART = [
  ['mona-lisa', 'Mona Lisa', 'Leonardo da Vinci', 'c. 1503–1519', 'Louvre, Paris', 'The most famous portrait in the world: a smile that seems to change as you look, before a hazy, dreamlike landscape.'],
  ['starry-night', 'The Starry Night', 'Vincent van Gogh', '1889', 'Museum of Modern Art, New York', 'Painted from the window of his room at Saint-Rémy: the night sky swirls with light over a sleeping village and a flame-like cypress.'],
  ['pearl-earring', 'Girl with a Pearl Earring', 'Johannes Vermeer', 'c. 1665', 'Mauritshuis, The Hague', 'Not a portrait but a “tronie”, a study of a face: a girl turning over her shoulder, a single pearl catching the light.'],
  ['great-wave', 'The Great Wave off Kanagawa', 'Katsushika Hokusai', 'c. 1831', 'woodblock print, many collections', 'From the Thirty-six Views of Mount Fuji: a wave curls like a claw over three boats, Fuji small and still beneath it.'],
  ['birth-of-venus', 'The Birth of Venus', 'Sandro Botticelli', 'c. 1485', 'Uffizi, Florence', 'The goddess arrives on a shell, blown ashore by the winds, as a Hour hurries to cloak her in a flowered robe.'],
  ['water-lilies', 'Water Lilies', 'Claude Monet', '1906', 'Art Institute of Chicago', 'One of some 250 paintings of the lily pond in his garden at Giverny: no horizon, only water, sky and light.'],
  ['innocent-x', 'Portrait of Innocent X', 'Diego Velázquez', '1650', 'Galleria Doria Pamphilj, Rome', 'The Pope is said to have called it “troppo vero”, too true. It still hangs in the Doria Pamphilj, the gallery this hall remembers.'],
  ['rest-flight', 'Rest on the Flight into Egypt', 'Caravaggio', 'c. 1597', 'Galleria Doria Pamphilj, Rome', 'An angel plays the violin from music held by Joseph, while Mary and the child sleep. Another treasure of the Doria Pamphilj.'],
  ['the-kiss', 'The Kiss', 'Gustav Klimt', '1907–1908', 'Belvedere, Vienna', 'Two lovers wrapped in gold leaf at the edge of a flowered meadow: the height of Klimt’s golden period.'],
  ['sunflowers', 'Sunflowers', 'Vincent van Gogh', '1888', 'National Gallery, London', 'Painted to welcome his friend Gauguin to Arles: fifteen sunflowers, from bud to seed, in every yellow he had.'],
  ['wanderer', 'Wanderer above the Sea of Fog', 'Caspar David Friedrich', 'c. 1818', 'Kunsthalle, Hamburg', 'A man stands on a rocky peak with his back to us, looking out over a landscape lost in mist.'],
  ['creation-adam', 'The Creation of Adam', 'Michelangelo', 'c. 1508–1512', 'Sistine Chapel ceiling, Vatican', 'The almost-touching fingers of God and Adam, from the ceiling Michelangelo painted lying on scaffolding.'],
  ['impression-sunrise', 'Impression, Sunrise', 'Claude Monet', '1872', 'Musée Marmottan Monet, Paris', 'The harbour of Le Havre in morning mist, an orange sun on the water. Its title gave Impressionism its name.'],
  ['night-watch', 'The Night Watch', 'Rembrandt van Rijn', '1642', 'Rijksmuseum, Amsterdam', 'A militia company stepping out, caught in motion and in light. It is not really night: the varnish darkened over time.'],
  ['las-meninas', 'Las Meninas', 'Diego Velázquez', '1656', 'Prado, Madrid', 'The little princess and her maids of honour, the painter at his canvas, and the king and queen glimpsed in a mirror.'],
  ['school-athens', 'The School of Athens', 'Raphael', '1509–1511', 'Apostolic Palace, Vatican', 'The philosophers of antiquity gathered under great arches, Plato and Aristotle walking at the centre.'],
  ['cafe-terrace', 'Café Terrace at Night', 'Vincent van Gogh', '1888', 'Kröller-Müller Museum, Otterlo', 'A café in Arles under a starry blue sky: his first painting with a starry background, and not a speck of black.'],
  ['ophelia', 'Ophelia', 'John Everett Millais', '1851–1852', 'Tate Britain, London', 'Hamlet’s Ophelia floats singing in a stream among flowers, painted outdoors over months by a river in Surrey.'],
].map(([file, title, artist, year, where, note]) => ({ id: 'f:' + file, file, title, artist, year, where, note, famous: true }));
// the pictures, loaded the first time you come in
const pics = {}, waiting = [];
let asked = false;
function loadFamous() {
  if (asked) return; asked = true;
  FAMOUS_ART.forEach(a => { const im = new Image(); im.decoding = 'async'; im.onload = () => { pics[a.file] = im; waiting.filter(w => w.file === a.file).forEach(w => w.draw(im)); }; im.src = siteURL() + 'art/gallery/' + a.file + '.jpg'; });
}
const ASPECT = { 'mona-lisa': 0.67, 'starry-night': 1.26, 'pearl-earring': 0.84, 'great-wave': 1.49, 'birth-of-venus': 1.59, 'water-lilies': 1.04, 'innocent-x': 0.78, 'rest-flight': 1.24, 'the-kiss': 1, 'sunflowers': 0.79, 'wanderer': 0.78, 'creation-adam': 2.2, 'impression-sunrise': 1.29, 'night-watch': 1.19, 'las-meninas': 0.87, 'school-athens': 1.29, 'cafe-terrace': 0.8, 'ophelia': 1.47 };

/* ---------- walls: crimson damask; the floor: patterned marble; the vault: painted ---------- */
const damask = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#7a1e22'; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(160,50,50,.45)';
  for (const [cx, cy] of [[64, 64], [192, 192], [192, 64], [64, 192]]) { g.save(); g.translate(cx, cy); for (let k = 0; k < 4; k++) { g.rotate(Math.PI / 2); g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(14, -10, 26, -34, 0, -52); g.bezierCurveTo(-26, -34, -14, -10, 0, 0); g.fill(); } g.restore(); }
  g.fillStyle = 'rgba(255,200,160,.08)'; for (let k = 0; k < 200; k++) g.fillRect(Math.random() * w, Math.random() * h, 1, 3);
}, true);
const marbleFloor = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#ece4d2'; g.fillRect(0, 0, w, h);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { g.fillStyle = (i + j) % 2 ? '#c9b494' : '#ece4d2'; g.fillRect(i * 128 + 4, j * 128 + 4, 120, 120); }
  g.fillStyle = '#5a3a28'; for (let j = 0; j <= 4; j++) for (let i = 0; i <= 4; i++) { g.save(); g.translate(i * 128, j * 128); g.rotate(Math.PI / 4); g.fillRect(-14, -14, 28, 28); g.restore(); }
  g.strokeStyle = 'rgba(120,100,80,.3)'; for (let k = 0; k < 80; k++) { g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let s = 0; s < 3; s++) { x += (Math.random() - 0.5) * 50; y += (Math.random() - 0.5) * 50; g.lineTo(x, y); } g.stroke(); }
}, true);
{
  const { L, hw, wall, rise } = GAL, xm = L / 2;
  damask.repeat.set(L / 3, wall / 3);
  for (const sz of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(L, wall), lit(damask, 0.38)); m.position.set(xm, wall / 2, sz * hw); m.rotation.y = sz > 0 ? Math.PI : 0; gal.add(m); }
  // the far end: damask; the near end: damask round the hallway's arch
  const end = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, wall), lit(damask.clone(), 0.38)); end.material.map.repeat.set(hw * 2 / 3, wall / 3); end.material.map.needsUpdate = true; end.position.set(L, wall / 2, 0); end.rotation.y = -Math.PI / 2; gal.add(end);
  for (const sz of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(hw - 4, wall), lit(damask, 0.38)); p.position.set(0, wall / 2, sz * (4 + (hw - 4) / 2)); p.rotation.y = Math.PI / 2; gal.add(p); }
  // the vault's two ends, closed in cream and gold above the walls (the hallway's opening runs the walls' full height)
  for (const [ex, ry] of [[0.02, Math.PI / 2], [L - 0.02, -Math.PI / 2]]) { const lu = new THREE.Mesh(new THREE.CircleGeometry(1, 40, 0, Math.PI), new THREE.MeshLambertMaterial({ color: '#e8d8b0', emissive: '#efe2c4', emissiveIntensity: 0.45, side: THREE.DoubleSide, fog: false })); lu.scale.set(hw, rise, 1); lu.position.set(ex, wall, 0); lu.rotation.y = ry; gal.add(lu); }
  marbleFloor.repeat.set(L / 4, hw * 2 / 4);
  const f = new THREE.Mesh(new THREE.PlaneGeometry(L, hw * 2).rotateX(-Math.PI / 2), new THREE.MeshPhongMaterial({ map: marbleFloor, shininess: 70, specular: '#4a3a2a', emissive: '#ffffff', emissiveMap: marbleFloor, emissiveIntensity: 0.3, color: '#bdb2a0', fog: false })); f.position.set(xm, 0.004, 0); gal.add(f);
  // the vault, painted: the Le Brun sky and its peace and victory, in gilded frames on gold, down the gallery
  const vt = artTex(2048, 512, (g, w, h) => { g.fillStyle = '#d9b04a'; g.fillRect(0, 0, w, h); for (let k = 0; k < 4; k++) { baroque(g, k * w / 4 + 30, 40, w / 4 - 60, h - 80, 100 + k); frame(g, k * w / 4 + 30, 40, w / 4 - 60, h - 80, 16); } },
    (g, w, h) => { g.fillStyle = '#d9b04a'; g.fillRect(0, 0, w, h); ['sky', 'peace', 'victory', 'sun'].forEach((k, i) => { cover(g, img[k], i * w / 4 + 30, 40, w / 4 - 60, h - 80); frame(g, i * w / 4 + 30, 40, w / 4 - 60, h - 80, 16); }); }, true);
  vt.repeat.set(2, 1);
  const v = new THREE.Mesh(new THREE.CylinderGeometry(hw, hw, L, 40, 1, true, 0, Math.PI), lit(vt, 0.7, { side: THREE.BackSide })); v.rotation.z = Math.PI / 2; v.scale.set(rise / hw, 1, 1); v.position.set(xm, wall, 0); gal.add(v);
  // gilded pilasters, a gilded cornice, a dado of green marble, gold mouldings
  const m = new Merge(), bays = 8;
  for (let k = 0; k <= bays; k++) { const x = k / bays * L; for (const sz of [-1, 1]) { m.add(GEO.box, new V3(x, wall / 2, sz * (hw - 0.2)), new V3(0.7, wall, 0.4), GOLD); m.add(GEO.box, new V3(x, wall - 0.7, sz * (hw - 0.35)), new V3(1, 0.7, 0.6), GOLD2); } }
  for (const sz of [-1, 1]) { m.add(GEO.box, new V3(xm, wall - 0.2, sz * (hw - 0.3)), new V3(L, 0.4, 0.6), GOLD2); m.add(GEO.box, new V3(xm, 0.55, sz * (hw - 0.06)), new V3(L, 1.1, 0.12), C('#4f6a52')); m.add(GEO.box, new V3(xm, 1.12, sz * (hw - 0.1)), new V3(L, 0.08, 0.2), GOLD); }
  // crimson benches in pairs either side of a clear aisle down the middle, facing the walls
  for (let k = 1; k < bays; k++) { const x = (k + 0.5) / bays * L; for (const bz of [-2.8, 2.8]) { m.add(GEO.box, new V3(x, 0.45, bz), new V3(2.6, 0.18, 0.9), C('#8a1f24')); for (const dx of [-1.1, 1.1]) for (const dz of [-0.35, 0.35]) m.add(GEO.box, new V3(x + dx, 0.2, bz + dz), new V3(0.1, 0.4, 0.1), GOLD); } }
  gal.add(new THREE.Mesh(m.build(), gilt));
}

/* ---------- the paintings, hung densely on both long walls as in a princely gallery ---------- */
// each: a plane with the photograph (a stand-in until it loads), a deep gilded frame, a small brass label
const hung = [];
function hangPainting(art, x, y, z, side, height) {
  const asp = ASPECT[art.file] || (art.w && art.h ? art.w / art.h : 1), h = height, w = h * asp;
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = Math.max(128, Math.round(512 / asp));
  const g = cv.getContext('2d'); g.fillStyle = '#3a2a1a'; g.fillRect(0, 0, cv.width, cv.height);
  const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 8;
  const draw = im => { g.drawImage(im, 0, 0, cv.width, cv.height); tex.needsUpdate = true; };
  if (art.famous) { if (pics[art.file]) draw(pics[art.file]); else waiting.push({ file: art.file, draw }); }
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, color: '#e8e0d0', fog: false }));
  mesh.position.set(x, y, side * (GAL.hw - 0.18)); mesh.rotation.y = side > 0 ? Math.PI : 0; gal.add(mesh);
  const m = new Merge(), d = side * (GAL.hw - 0.22), t = 0.28;
  for (const [fx, fy, fw, fh] of [[x, y + h / 2 + t / 2, w + t * 2, t], [x, y - h / 2 - t / 2, w + t * 2, t], [x - w / 2 - t / 2, y, t, h], [x + w / 2 + t / 2, y, t, h]]) m.add(GEO.box, new V3(fx, fy, d), new V3(fw, fh, 0.16), GOLD);
  m.add(GEO.box, new V3(x, y - h / 2 - t - 0.28, side * (GAL.hw - 0.16)), new V3(0.9, 0.22, 0.04), C('#c9a040'));
  const frameMesh = new THREE.Mesh(m.build(), gilt); gal.add(frameMesh);
  const item = { art, mesh, frameMesh, draw, x, y, side };
  hung.push(item);
  const wp = new V3(W.x + x, 0, W.z + side * (GAL.hw - 3.2));
  regThing(mesh, 'Look at “' + art.title + '”', () => late.viewPainting && late.viewPainting(art.id), { x: wp.x, z: wp.z, r: 2.6 });
  return item;
}
{
  // upper and lower rows, larger works at eye level; the near half of the gallery, both sides
  const lay = [
    // one to a bay, in the middle of it, between the gilded pilasters (every 8 m)
    [-1, 4, 4.6, 'innocent-x'], [-1, 12, 4.4, 'rest-flight'], [-1, 20, 4.6, 'las-meninas'], [-1, 28, 4.0, 'pearl-earring'], [-1, 36, 4.2, 'night-watch'], [-1, 44, 4.8, 'mona-lisa'], [-1, 52, 3.4, 'birth-of-venus'], [-1, 60, 4.0, 'school-athens'],
    [1, 4, 3.8, 'starry-night'], [1, 12, 4.6, 'cafe-terrace'], [1, 20, 4.4, 'sunflowers'], [1, 28, 3.2, 'great-wave'], [1, 36, 4.6, 'wanderer'], [1, 44, 4.4, 'the-kiss'], [1, 52, 3.6, 'impression-sunrise'], [1, 60, 3.6, 'water-lilies'],
  ];
  lay.forEach(([side, x, h, file]) => hangPainting(FAMOUS_ART.find(a => a.file === file), x, 3.6 + h / 2 - 0.4, 0, side, h));
  // high up, smaller: The Creation of Adam and Ophelia, long and low
  hangPainting(FAMOUS_ART.find(a => a.file === 'creation-adam'), 28, 12.6, 0, -1, 2.8);
  hangPainting(FAMOUS_ART.find(a => a.file === 'ophelia'), 28, 12.6, 0, 1, 3.6);
}

/* ---------- your wall: the far end, frames that fill with the paintings you hang ---------- */
const SLOTS = [];
{
  const L = GAL.L, m = new Merge();
  // a plaque above: Your paintings
  const sign = canvasTex(1024, 192, (g, w, h) => { g.fillStyle = '#2a1a10'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d4a63a'; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20); g.fillStyle = '#f0d890'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 96px "Cormorant Garamond", Georgia, serif'; g.fillText('Your paintings', w / 2, h / 2 + 6); });
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.1), new THREE.MeshBasicMaterial({ map: sign, fog: false })); sg.position.set(L - 0.12, 12.2, 0); sg.rotation.y = -Math.PI / 2; gal.add(sg);
  // nine frames on the end wall, three across, three high; and an easel to hang one
  for (const [r, c] of [[1, 1], [1, 0], [1, 2], [2, 1], [2, 0], [2, 2], [0, 1], [0, 0], [0, 2]]) SLOTS.push({ z: (c - 1) * 4.6, y: 2.6 + r * 3.0 });
  SLOTS.forEach(sl => {
    const cv = document.createElement('canvas'); cv.width = 384; cv.height = 288; const g = cv.getContext('2d');
    const tex = new THREE.CanvasTexture(cv); sl.cv = cv; sl.g = g; sl.tex = tex;
    sl.mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.4), new THREE.MeshBasicMaterial({ map: tex, color: '#e8e0d0', fog: false })); sl.mesh.position.set(L - 0.18, sl.y, sl.z); sl.mesh.rotation.y = -Math.PI / 2; gal.add(sl.mesh);
    for (const [fy, fz, fh, fw] of [[sl.y + 1.34, sl.z, 0.24, 4.08], [sl.y - 1.34, sl.z, 0.24, 4.08], [sl.y, sl.z - 1.92, 2.4, 0.24], [sl.y, sl.z + 1.92, 2.4, 0.24]]) m.add(GEO.box, new V3(L - 0.22, fy, fz), new V3(0.16, fh, fw), GOLD);
    const wp = new V3(W.x + L - 3.2, 0, W.z + sl.z);
    sl.thing = regThing(sl.mesh, 'Hang your painting', () => late.viewPainting && late.viewPainting(sl.art ? sl.art.id : 'upload'), { x: wp.x, z: wp.z, r: 2.2 });
  });
  // the easel, by the wall
  const ex = L - 4, ez = -5.6;
  for (const [dx, dz] of [[-0.4, -0.3], [0.4, -0.3], [0, 0.4]]) m.limb(new V3(ex + dx, 0, ez + dz), new V3(ex, 2.4, ez), 0.05, 0.05, C('#7a5234'));
  m.add(GEO.box, new V3(ex, 1.6, ez - 0.05), new V3(0.06, 1.2, 1.6), C('#f4ecd8'), new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), -0.12));
  gal.add(new THREE.Mesh(m.build(), gilt));
  regThing(gal, 'Hang a painting of your own', () => late.viewPainting && late.viewPainting('upload'), { x: W.x + ex, z: W.z + ez + 1.2, r: 2.2 });
}
// paint the end wall's frames: your paintings, or an empty canvas waiting
function hangOwn(list) {
  SLOTS.forEach((sl, i) => {
    const art = list[i] || null; sl.art = art; const g = sl.g, cw = sl.cv.width, ch = sl.cv.height;
    g.fillStyle = '#f2ead8'; g.fillRect(0, 0, cw, ch);
    if (art && art.image) { const im = art.image, s = Math.max(cw / im.width, ch / im.height), sw = cw / s, sh = ch / s; g.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, 0, 0, cw, ch); }
    else { g.strokeStyle = 'rgba(120,90,50,.35)'; g.lineWidth = 3; g.setLineDash([12, 10]); g.strokeRect(24, 24, cw - 48, ch - 48); g.setLineDash([]); g.fillStyle = 'rgba(90,60,30,.6)'; g.textAlign = 'center'; g.font = 'italic 600 34px "Cormorant Garamond", Georgia, serif'; g.fillText(i === list.length ? 'Hang yours here' : '', cw / 2, ch / 2 + 10); }
    sl.tex.needsUpdate = true;
    sl.thing.label = art ? 'Look at “' + art.title + '”' : 'Hang your painting';
  });
}
hangOwn([]);

/* ---------- warm light: chandeliers (points of light) down the gallery ---------- */
{
  const pos = [];
  for (let k = 0; k < 8; k++) { const x = (k + 0.5) / 8 * GAL.L; for (let a = 0; a < 12; a++) pos.push(x + Math.cos(a / 12 * 6.28) * 1.1, GAL.wall + 1.2 - (a % 2) * 0.35, Math.sin(a / 12 * 6.28) * 1.1); pos.push(x, GAL.wall + 0.5, 0); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const pts = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: 'uniform float uTime;varying float vF;void main(){vF=.85+.15*sin(uTime*6.+position.x*3.+position.z*5.);vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(420./-mv.z,2.,24.);gl_Position=projectionMatrix*mv;}',
    fragmentShader: 'varying float vF;void main(){float d=length(gl_PointCoord-.5);float a=(smoothstep(.5,.0,d)*.55+smoothstep(.14,.0,d))*vF;gl_FragColor=vec4(vec3(1.,.85,.6)*a,a);}' }));
  gal.add(pts);
  const cm = new Merge(); for (let k = 0; k < 8; k++) { const x = (k + 0.5) / 8 * GAL.L; cm.limb(new V3(x, GAL.wall + GAL.rise - 0.2, 0), new V3(x, GAL.wall + 1.3, 0), 0.03, 0.03, GOLD); cm.add(new THREE.TorusGeometry(1.1, 0.06, 6, 24).rotateX(Math.PI / 2), new V3(x, GAL.wall + 1.0, 0), new V3(1, 1, 1), GOLD2); }
  gal.add(new THREE.Mesh(cm.build(), gilt));
  addTick(() => { if (gal.visible) pts.material.uniforms.uTime.value = T; }, true);
}

/* ---------- the hallway from the Hall of Mirrors: the same as the library's, its pictures in the gallery's style ---------- */
const HWY = { A: HALL.x + HALL.hw - GAL.x, B: 0, half: 4, h: HALL.wall, rise: 3.4 };
{
  const { A, B, half, h, rise } = HWY, L = B - A, xm = (A + B) / 2, way = new THREE.Group(); gal.add(way);
  for (const sz of [-1, 1]) { const t = damask.clone(); t.needsUpdate = true; t.repeat.set(L / 3, h / 3); const wm = new THREE.Mesh(new THREE.PlaneGeometry(L, h), lit(t, 0.4)); wm.position.set(xm, h / 2, sz * half); wm.rotation.y = sz > 0 ? Math.PI : 0; way.add(wm); }
  const ft = marbleFloor.clone(); ft.needsUpdate = true; ft.repeat.set(L / 4, 2);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(L + 1, half * 2).rotateX(-Math.PI / 2), new THREE.MeshPhongMaterial({ map: ft, shininess: 70, specular: '#4a3a2a', emissive: '#ffffff', emissiveMap: ft, emissiveIntensity: 0.3, color: '#bdb2a0', fog: false })); fl.position.set(xm, 0.006, 0); way.add(fl);
  const vtex = canvasTex(512, 256, (g, w, hh) => { g.fillStyle = '#efe4c8'; g.fillRect(0, 0, w, hh); for (let y = 0; y < hh; y += 64) for (let x = 0; x < w; x += 64) { g.fillStyle = '#e2d0a4'; g.fillRect(x + 6, y + 6, 52, 52); g.fillStyle = '#d4a63a'; g.beginPath(); g.arc(x + 32, y + 32, 9, 0, 7); g.fill(); } }, true); vtex.repeat.set(L / 6, 1);
  const vt = new THREE.Mesh(new THREE.CylinderGeometry(half, half, L, 32, 1, true, 0, Math.PI), lit(vtex, 0.55, { side: THREE.BackSide })); vt.rotation.z = Math.PI / 2; vt.scale.set(rise / half, 1, 1); vt.position.set(xm, h, 0); way.add(vt);
  const m = new Merge(), bays = 5;
  for (let k = 0; k <= bays; k++) { const x = A + k / bays * L; for (const sz of [-1, 1]) { m.add(GEO.box, new V3(x, h / 2, sz * (half - 0.15)), new V3(0.55, h, 0.3), GOLD); m.add(GEO.box, new V3(x, 0.5, sz * (half - 0.2)), new V3(0.75, 1.0, 0.4), CREAM); } }
  for (const sz of [-1, 1]) m.add(GEO.box, new V3(xm, h - 0.25, sz * (half - 0.25)), new V3(L, 0.5, 0.5), GOLD2);
  for (const ex of [A + 0.15, B - 0.15]) { m.add(new THREE.TorusGeometry(half, 0.3, 8, 40, Math.PI).rotateY(Math.PI / 2), new V3(ex, h, 0), new V3(1, rise / half, 1), GOLD); for (const sz of [-1, 1]) m.add(GEO.box, new V3(ex, h / 2, sz * (half - 0.05)), new V3(0.4, h, 0.4), GOLD); }
  m.add(GEO.box, new V3(A + 0.4, 14.6, 0), new V3(0.25, 0.25, half * 2), GOLD);
  // a carpet
  way.add(new THREE.Mesh(m.build(), gilt));
  const carpet = canvasTex(64, 256, (g, w, hh) => { g.fillStyle = '#8a1f24'; g.fillRect(0, 0, w, hh); g.fillStyle = '#d4a63a'; g.fillRect(0, 0, 5, hh); g.fillRect(w - 5, 0, 5, hh); }, true); carpet.repeat.set(1, L / 4);
  const cp = new THREE.Mesh(new THREE.PlaneGeometry(2.8, L + 4).rotateX(-Math.PI / 2).rotateY(Math.PI / 2), lit(carpet, 0.35)); cp.position.set(xm + 1, 0.016, 0); way.add(cp);
  // signs: over the way in, seen from the Hall of Mirrors, and over the gallery's arch
  const sign = canvasTex(512, 128, (g, w, hh) => { g.fillStyle = '#2a1a10'; g.fillRect(0, 0, w, hh); g.strokeStyle = '#d4a63a'; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, hh - 16); g.fillStyle = '#f0d890'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 54px "Cormorant Garamond", Georgia, serif'; g.fillText('The Hall of Paintings', w / 2, hh / 2 + 4); });
  const s1 = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.15), new THREE.MeshBasicMaterial({ map: sign, fog: false, side: THREE.DoubleSide })); s1.position.set(A + 0.4, 13.8, 0); s1.rotation.y = Math.PI / 2; way.add(s1);
  // the gallery's near wall is open only where the hallway meets it: no wall left blocking it at its full height
}

/* ---------- walking: the hallway, then the gallery ---------- */
{
  const f = worlds.sun.floorH, b = worlds.sun.blocked;
  const loc = (x, z) => [x - W.x, z - W.z];
  const inWay = (lx, lz) => lx > HWY.A - 3 && lx < 0.6 && Math.abs(lz) < HWY.half + 1;
  const inGal = (lx, lz) => lx > -0.6 && lx < GAL.L + 2 && Math.abs(lz) < GAL.hw + 2;
  worlds.sun.floorH = (x, z) => { const [lx, lz] = loc(x, z); return inWay(lx, lz) || inGal(lx, lz) ? O.y + GAL.y : f(x, z); };
  worlds.sun.blocked = (x, z) => {
    const [lx, lz] = loc(x, z);
    if (inWay(lx, lz)) { if (Math.abs(lz) < HWY.half - 0.75) return false; if (lx < HWY.A - 0.1) return b(x, z); return true; }
    if (inGal(lx, lz)) {
      if (lx < 0.4 && Math.abs(lz) > 3.3) return true;
      if (lx > GAL.L - 0.9 || Math.abs(lz) > GAL.hw - 1.2) return true;
      for (let k = 1; k < 8; k++) { const x = (k + 0.5) / 8 * GAL.L; if (Math.abs(lx - x) < 1.5 && Math.abs(Math.abs(lz) - 2.8) < 0.65) return true; }
      if (Math.hypot(lx - (GAL.L - 4), lz + 5.6) < 0.7) return true;
      return false;
    }
    return b(x, z);
  };
}
