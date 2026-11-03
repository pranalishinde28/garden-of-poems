import * as THREE from 'three';
import { C, V3, rng, siteURL } from '../core/util.js';
import { T } from '../core/state.js';
import { canvasTex } from './textures.js';
import { GEO, Merge } from './geometry.js';
import { worlds } from '../core/worlds.js';
import { addTick, regThing } from '../core/things.js';
import { late, provide } from '../core/late.js';
import { O, sunScene } from './sunWorld.js';
import { museFigure } from './buddha.js';
import { HALL, OPEN_HALF, OPEN_Z, artTex, baroque, cover, frame, hall, img } from './castleHall.js';

/* ================= the Hall of Paintings, off the Hall of Mirrors: after the Galleria Doria Pamphilj ================= */
// On your right as you come into the castle, a 16 m-wide hallway leads to a great gallery in the manner of the Doria
// Pamphilj in Rome (140 m long, a painted dome before the salon after Santa Maria in Vallicella): walls of
// crimson damask hung with paintings in two tiers (a quadreria), gilded pilasters and
// ribs under a painted vault, oval gilded mirrors where the upper tier leaves room (the Galleria degli Specchi),
// gilded console tables with marble tops and urns, white marble statues on pedestals down the middle, crimson
// benches, Venetian glass chandeliers. 33 famous public-domain paintings (public/art/gallery, CREDITS.md) hang
// there; walk up to one to look at it closely (ui/paintings.js). At the far end, behind a gilded proscenium with
// velvet curtains drawn back, is a salon of your own paintings on green velvet: eleven carved frames, rectangles
// and ovals, each under a picture light, two easels and a painter's table. Shown whenever the Hall of Mirrors is.

provide({ get hangOwnPaintings() { return hangOwn; } });
// the gallery: its axis runs east from 22 m beyond the hall's east wall; 140 m long, 30 m wide, 22 m to the vault.
// Eleven 10 m bays of paintings (ART_BAYS), then a domed crossing (DOME, two bays), then the salon (SAL on).
export const GAL = { x: HALL.x + HALL.hw + 22, z: OPEN_Z, y: -90, L: 140, hw: 15, wall: 22, rise: 7, bay: 10 };
const ART_BAYS = 11, DOME = { x: 120, r: 9.6, drum: 4.2 }, SAL = 131;
const W = new V3(O.x + GAL.x, O.y + GAL.y, O.z + GAL.z);
const gal = new THREE.Group(); gal.position.copy(W); gal.visible = false; sunScene.add(gal);
addTick(() => { if (gal.visible !== hall.visible) { gal.visible = hall.visible; if (gal.visible) loadFamous(); } }, true);
const GOLD = C('#d4a63a'), GOLD2 = C('#e8c25a'), CREAM = C('#efe6d2'), MARBLE = C('#f2eee6'), MARBLE2 = C('#e2dcd0');
const gilt = new THREE.MeshPhongMaterial({ vertexColors: true, specular: '#8a6a2a', shininess: 45, emissive: '#3a2808', emissiveIntensity: 0.7, fog: false });
const stone = new THREE.MeshPhongMaterial({ vertexColors: true, specular: '#ffffff', shininess: 30, emissive: '#c8c0b2', emissiveIntensity: 0.45, fog: false });
const lit = (map, k = 0.5, extra = {}) => new THREE.MeshLambertMaterial(Object.assign({ map, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: k, color: '#d8ccb4', fog: false }, extra));
const glows = [], lights = [];

/* ---------- the famous paintings: [file, title, painter, year, where it hangs, a few words] ---------- */
export const FAMOUS_ART = [
  ['mona-lisa', 'Mona Lisa', 'Leonardo da Vinci', 'c. 1503–1519', 'Louvre, Paris', 'The most famous portrait in the world: a smile that seems to change as you look, before a hazy, dreamlike landscape.'],
  ['starry-night', 'The Starry Night', 'Vincent van Gogh', '1889', 'Museum of Modern Art, New York', 'Painted from the window of his room at Saint-Rémy: the night sky swirls with light over a sleeping village and a flame-like cypress.'],
  ['pearl-earring', 'Girl with a Pearl Earring', 'Johannes Vermeer', 'c. 1665', 'Mauritshuis, The Hague', 'Not a portrait but a “tronie”, a study of a face: a girl turning over her shoulder, a single pearl catching the light.'],
  ['great-wave', 'The Great Wave off Kanagawa', 'Katsushika Hokusai', 'c. 1831', 'woodblock print, many collections', 'From the Thirty-six Views of Mount Fuji: a wave curls like a claw over three boats, Fuji small and still beneath it.'],
  ['birth-of-venus', 'The Birth of Venus', 'Sandro Botticelli', 'c. 1485', 'Uffizi, Florence', 'The goddess arrives on a shell, blown ashore by the winds, as one of the Hours hurries to cloak her in a flowered robe.'],
  ['water-lilies', 'Water Lilies', 'Claude Monet', '1906', 'Art Institute of Chicago', 'One of some 250 paintings of the lily pond in his garden at Giverny: no horizon, only water, sky and light.'],
  ['innocent-x', 'Portrait of Innocent X', 'Diego Velázquez', '1650', 'Galleria Doria Pamphilj, Rome', 'The Pope is said to have called it “troppo vero”, too true. It still hangs in the Doria Pamphilj, the gallery this hall remembers.'],
  ['rest-flight', 'Rest on the Flight into Egypt', 'Caravaggio', 'c. 1597', 'Galleria Doria Pamphilj, Rome', 'An angel plays the violin from music held by Joseph, while Mary and the child sleep. Another treasure of the Doria Pamphilj.'],
  ['magdalene', 'Penitent Magdalene', 'Caravaggio', 'c. 1594–1596', 'Galleria Doria Pamphilj, Rome', 'A young woman sits alone, her jewels cast on the floor; it hangs in the same gallery as the Rest on the Flight.'],
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
  ['milkmaid', 'The Milkmaid', 'Johannes Vermeer', 'c. 1658', 'Rijksmuseum, Amsterdam', 'A kitchen maid pours milk in a quiet room full of morning light; every crumb of bread glints.'],
  ['temeraire', 'The Fighting Temeraire', 'J. M. W. Turner', '1839', 'National Gallery, London', 'A great sailing warship, ghost-pale, is towed by a dark little steam tug to be broken up, under a blazing sunset.'],
  ['grande-jatte', 'A Sunday on La Grande Jatte', 'Georges Seurat', '1884–1886', 'Art Institute of Chicago', 'Parisians at leisure on an island in the Seine, built entirely of tiny dots of colour that mix in the eye.'],
  ['moulin-galette', 'Bal du moulin de la Galette', 'Pierre-Auguste Renoir', '1876', 'Musée d’Orsay, Paris', 'A Sunday afternoon dance in Montmartre, sunlight falling through the trees in patches onto the dancers.'],
  ['dance-class', 'The Dance Class', 'Edgar Degas', '1874', 'Musée d’Orsay, Paris', 'Young ballerinas wait, stretch and fidget as an old ballet master, leaning on his stick, takes the class.'],
  ['lady-ermine', 'Lady with an Ermine', 'Leonardo da Vinci', 'c. 1489–1491', 'Czartoryski Museum, Kraków', 'Cecilia Gallerani turns toward a light we cannot see, holding a white ermine that turns with her.'],
  ['hunters-snow', 'The Hunters in the Snow', 'Pieter Bruegel the Elder', '1565', 'Kunsthistorisches Museum, Vienna', 'Weary hunters and their dogs come home over a hill above a village, its frozen ponds full of skaters.'],
  ['the-swing', 'The Swing', 'Jean-Honoré Fragonard', 'c. 1767', 'Wallace Collection, London', 'A young woman in a frothy pink dress flies high on a swing in a leafy garden, kicking off her slipper.'],
  ['hay-wain', 'The Hay Wain', 'John Constable', '1821', 'National Gallery, London', 'A horse-drawn cart crosses a shallow river by a mill in Suffolk on a summer day of drifting clouds.'],
  ['parasol', 'Woman with a Parasol', 'Claude Monet', '1875', 'National Gallery of Art, Washington', 'Camille Monet and their son on a hilltop in the wind, painted quickly in a single sitting.'],
  ['irises', 'Irises', 'Vincent van Gogh', '1889', 'Getty Center, Los Angeles', 'Painted in the asylum garden at Saint-Rémy in his first week there: blue irises, and one white.'],
  ['shalott', 'The Lady of Shalott', 'John William Waterhouse', '1888', 'Tate Britain, London', 'From Tennyson’s poem: the Lady drifts toward Camelot in her boat, the candles beside her almost burned out.'],
  ['carnation-lily', 'Carnation, Lily, Lily, Rose', 'John Singer Sargent', '1885–1886', 'Tate Britain, London', 'Two girls light paper lanterns among lilies at dusk, painted for a few minutes each evening over two summers.'],
  ['venus-urbino', 'Venus of Urbino', 'Titian', '1534', 'Uffizi, Florence', 'A young woman reclines on a white sheet, a little dog asleep at her feet, maids at a chest behind her.'],
].map(([file, title, artist, year, where, note]) => ({ id: 'f:' + file, file, title, artist, year, where, note, famous: true }));
const ASPECT = { 'birth-of-venus': 1.59, 'cafe-terrace': 0.80, 'carnation-lily': 0.88, 'creation-adam': 2.20, 'dance-class': 0.90, 'grande-jatte': 1.50, 'great-wave': 1.49, 'hay-wain': 1.45, 'hunters-snow': 1.41, 'impression-sunrise': 1.29, 'innocent-x': 0.78, 'irises': 1.31, 'lady-ermine': 0.74, 'las-meninas': 0.87, 'magdalene': 0.82, 'milkmaid': 0.89, 'mona-lisa': 0.67, 'moulin-galette': 1.34, 'night-watch': 1.19, 'ophelia': 1.47, 'parasol': 0.80, 'pearl-earring': 0.84, 'rest-flight': 1.24, 'school-athens': 1.29, 'shalott': 1.30, 'starry-night': 1.26, 'sunflowers': 0.79, 'temeraire': 1.35, 'the-kiss': 1.00, 'the-swing': 0.80, 'venus-urbino': 1.42, 'wanderer': 0.78, 'water-lilies': 1.04 };
const pics = {}, waiting = [];
let asked = false;
function loadFamous() {
  if (asked) return; asked = true;
  FAMOUS_ART.forEach(a => { const im = new Image(); im.decoding = 'async'; im.onload = () => { pics[a.file] = im; waiting.filter(w => w.file === a.file).forEach(w => w.draw(im)); }; im.src = siteURL() + 'art/gallery/' + a.file + '.jpg'; });
}

/* ---------- textures: crimson damask, patterned marble, green velvet for the salon ---------- */
const damask = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#7a1e22'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(160,50,50,.45)';
  for (const [cx, cy] of [[64, 64], [192, 192], [192, 64], [64, 192]]) { g.save(); g.translate(cx, cy); for (let k = 0; k < 4; k++) { g.rotate(Math.PI / 2); g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(14, -10, 26, -34, 0, -52); g.bezierCurveTo(-26, -34, -14, -10, 0, 0); g.fill(); } g.restore(); }
  const RS = rng(4); g.fillStyle = 'rgba(255,200,160,.08)'; for (let k = 0; k < 200; k++) g.fillRect(RS() * w, RS() * h, 1, 3);
}, true);
const marbleFloor = canvasTex(512, 512, (g, w, h) => {
  const RS = rng(8); g.fillStyle = '#ece4d2'; g.fillRect(0, 0, w, h);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { g.fillStyle = (i + j) % 2 ? '#c9b494' : '#ece4d2'; g.fillRect(i * 128 + 4, j * 128 + 4, 120, 120); }
  g.fillStyle = '#5a3a28'; for (let j = 0; j <= 4; j++) for (let i = 0; i <= 4; i++) { g.save(); g.translate(i * 128, j * 128); g.rotate(Math.PI / 4); g.fillRect(-14, -14, 28, 28); g.restore(); }
  g.strokeStyle = 'rgba(120,100,80,.3)'; for (let k = 0; k < 80; k++) { g.beginPath(); let x = RS() * w, y = RS() * h; g.moveTo(x, y); for (let s = 0; s < 3; s++) { x += (RS() - 0.5) * 50; y += (RS() - 0.5) * 50; g.lineTo(x, y); } g.stroke(); }
}, true);
const velvet = canvasTex(256, 256, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#1f4a36'); gr.addColorStop(1, '#173a2b'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(212,166,58,.32)'; g.lineWidth = 2;
  for (let k = -4; k < 8; k++) { g.beginPath(); g.moveTo(k * 64, 0); g.lineTo(k * 64 + 256, 256); g.stroke(); g.beginPath(); g.moveTo(k * 64 + 256, 0); g.lineTo(k * 64, 256); g.stroke(); }
  g.fillStyle = 'rgba(232,194,90,.55)'; for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(i * 64 + 32, j * 64, 3.5, 0, 7); g.fill(); }
}, true);

/* ---------- the room ---------- */
{
  const { L, hw, wall, rise } = GAL, xm = L / 2;
  damask.repeat.set(L / 3, wall / 3);
  for (const sz of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(L, wall), lit(damask, 0.38)); m.position.set(xm, wall / 2, sz * hw); m.rotation.y = sz > 0 ? Math.PI : 0; gal.add(m); }
  // the near end: damask either side of the hallway's opening, which runs the walls' full height
  for (const sz of [-1, 1]) { const t = damask.clone(); t.needsUpdate = true; t.repeat.set((hw - OPEN_HALF) / 3, wall / 3); const p = new THREE.Mesh(new THREE.PlaneGeometry(hw - OPEN_HALF, wall), lit(t, 0.38)); p.position.set(0, wall / 2, sz * (OPEN_HALF + (hw - OPEN_HALF) / 2)); p.rotation.y = Math.PI / 2; gal.add(p); }
  // the far end: the salon's green velvet
  velvet.repeat.set(hw * 2 / 4, wall / 4);
  const end = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, wall), lit(velvet, 0.42)); end.position.set(L, wall / 2, 0); end.rotation.y = -Math.PI / 2; gal.add(end);
  for (const [ex, ry] of [[0.02, Math.PI / 2], [L - 0.02, -Math.PI / 2]]) { const lu = new THREE.Mesh(new THREE.CircleGeometry(1, 40, 0, Math.PI), new THREE.MeshLambertMaterial({ color: '#e8d8b0', emissive: '#efe2c4', emissiveIntensity: 0.45, side: THREE.DoubleSide, fog: false })); lu.scale.set(hw, rise, 1); lu.position.set(ex, wall, 0); lu.rotation.y = ry; gal.add(lu); }
  marbleFloor.repeat.set(L / 4, hw * 2 / 4);
  const f = new THREE.Mesh(new THREE.PlaneGeometry(L, hw * 2).rotateX(-Math.PI / 2), new THREE.MeshPhongMaterial({ map: marbleFloor, shininess: 70, specular: '#4a3a2a', emissive: '#ffffff', emissiveMap: marbleFloor, emissiveIntensity: 0.3, color: '#bdb2a0', fog: false })); f.position.set(xm, 0.004, 0); gal.add(f);
  // the vault: frescoes (the Le Brun photographs) in gilded frames on gold, crossed by gilded ribs at every pilaster
  const vt = artTex(2048, 512, (g, w, h) => { g.fillStyle = '#d9b04a'; g.fillRect(0, 0, w, h); for (let k = 0; k < 4; k++) { baroque(g, k * w / 4 + 30, 40, w / 4 - 60, h - 80, 100 + k); frame(g, k * w / 4 + 30, 40, w / 4 - 60, h - 80, 16); } },
    (g, w, h) => { g.fillStyle = '#d9b04a'; g.fillRect(0, 0, w, h); ['sky', 'peace', 'victory', 'sun'].forEach((k, i) => { cover(g, img[k], i * w / 4 + 30, 40, w / 4 - 60, h - 80); frame(g, i * w / 4 + 30, 40, w / 4 - 60, h - 80, 16); }); }, true);
  // the barrel vault runs over the paintings and over the salon; the crossing between them has the dome
  for (const [x0, x1] of [[0, DOME.x - GAL.bay], [DOME.x + GAL.bay, L]]) {
    const t = vt.clone(); t.needsUpdate = true; t.repeat.set(1, (x1 - x0) / 9); // u runs round the arch, v along the hall: four square panels across, one every 9 m along
    const v = new THREE.Mesh(new THREE.CylinderGeometry(hw, hw, x1 - x0, 48, 1, true, 0, Math.PI), lit(t, 0.7, { side: THREE.BackSide })); v.rotation.z = Math.PI / 2; v.scale.set(rise / hw, 1, 1); v.position.set((x0 + x1) / 2, wall, 0); gal.add(v);
  }
  const m = new Merge(), bays = L / GAL.bay;
  for (let k = 0; k <= bays; k++) {
    const x = k * GAL.bay;
    for (const sz of [-1, 1]) {
      m.add(GEO.box, new V3(x, wall / 2, sz * (hw - 0.22)), new V3(0.8, wall, 0.44), GOLD);
      m.add(GEO.box, new V3(x, 0.5, sz * (hw - 0.3)), new V3(1.1, 1.0, 0.6), CREAM);
      m.add(GEO.box, new V3(x, wall - 0.75, sz * (hw - 0.4)), new V3(1.2, 0.8, 0.8), GOLD2);
      for (const dy of [6.6, 11.6]) m.add(GEO.sph, new V3(x, dy, sz * (hw - 0.45)), new V3(0.3, 0.42, 0.2), GOLD2);
    }
    // a gilded rib over the vault
    if (k > 0 && k < bays) m.add(new THREE.TorusGeometry(hw - 0.05, k === ART_BAYS || k === ART_BAYS + 2 ? 0.45 : 0.22, 6, 48, Math.PI).rotateY(Math.PI / 2), new V3(x, wall, 0), new V3(1, rise / hw, 1), GOLD);
  }
  for (const sz of [-1, 1]) {
    m.add(GEO.box, new V3(xm, wall - 0.2, sz * (hw - 0.35)), new V3(L, 0.4, 0.7), GOLD2);
    m.add(GEO.box, new V3(xm, 0.55, sz * (hw - 0.06)), new V3(L, 1.1, 0.12), C('#4f6a52'));
    m.add(GEO.box, new V3(xm, 1.12, sz * (hw - 0.1)), new V3(L, 0.08, 0.2), GOLD);
    m.add(GEO.box, new V3(xm, 13.1, sz * (hw - 0.1)), new V3(L, 0.14, 0.2), GOLD);
  }
  gal.add(new THREE.Mesh(m.build(), gilt));
}

/* ---------- the dome over the crossing before the salon, after Santa Maria in Vallicella ---------- */
// A square crossing two bays long; its ceiling opens in a ring onto a drum of gilded coffers and arched windows,
// and above it a painted dome (the baroque sky, or the Le Brun photographs once loaded) in eight panels
// between gilded ribs, rising to a bright oculus. The vault's ends are closed by painted lunettes.
{
  const { wall, hw, rise } = GAL, r = DOME.r, y0 = wall, y1 = wall + DOME.drum, sy = 0.92;
  // the ceiling of the crossing, with its round opening
  const cs = new THREE.Shape(); cs.moveTo(-GAL.bay, -hw); cs.lineTo(GAL.bay, -hw); cs.lineTo(GAL.bay, hw); cs.lineTo(-GAL.bay, hw); cs.closePath();
  const hole = new THREE.Path(); hole.absarc(0, 0, r, 0, Math.PI * 2, true); cs.holes.push(hole);
  const ceil = new THREE.Mesh(new THREE.ShapeGeometry(cs, 64).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#d9b04a', emissive: '#6a4a14', emissiveIntensity: 0.9, side: THREE.DoubleSide, fog: false }));
  ceil.position.set(DOME.x, y0, 0); gal.add(ceil);
  // the drum: gilded coffers above and below a ring of sixteen arched windows full of daylight
  const drumTex = canvasTex(2048, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#8a6418'); gr.addColorStop(0.5, '#e8c25a'); gr.addColorStop(1, '#8a6418'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const n = 16, cw = w / n;
    for (let i = 0; i < n; i++) {
      const x = i * cw;
      g.fillStyle = '#efe6d2'; g.fillRect(x + cw * 0.08, 30, cw * 0.84, h - 60);
      const wg = g.createLinearGradient(0, 50, 0, h - 40); wg.addColorStop(0, '#ffffff'); wg.addColorStop(1, '#f6ead0'); g.fillStyle = wg;
      g.beginPath(); g.moveTo(x + cw * 0.3, h - 44); g.lineTo(x + cw * 0.3, 96); g.arc(x + cw / 2, 96, cw * 0.2, Math.PI, 0); g.lineTo(x + cw * 0.7, h - 44); g.closePath(); g.fill();
      g.strokeStyle = '#a07a2a'; g.lineWidth = 6; g.stroke(); g.lineWidth = 2; g.beginPath(); g.moveTo(x + cw / 2, 76); g.lineTo(x + cw / 2, h - 44); g.moveTo(x + cw * 0.3, 150); g.lineTo(x + cw * 0.7, 150); g.stroke();
      for (const px of [x + cw * 0.14, x + cw * 0.86]) { const pg = g.createLinearGradient(px - 10, 0, px + 10, 0); pg.addColorStop(0, '#a07a2a'); pg.addColorStop(0.5, '#fff0b8'); pg.addColorStop(1, '#a07a2a'); g.fillStyle = pg; g.fillRect(px - 10, 30, 20, h - 60); }
    }
    g.fillStyle = '#fff2c0'; for (let x = 6; x < w; x += 16) { g.beginPath(); g.arc(x, 15, 4, 0, 7); g.arc(x, h - 15, 4, 0, 7); g.fill(); }
  });
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(r, r, DOME.drum, 96, 1, true), lit(drumTex, 0.8, { side: THREE.BackSide })); drum.position.set(DOME.x, (y0 + y1) / 2, 0); gal.add(drum);
  // the dome's painting: eight panels round a golden glory and the oculus (the whole canvas spans the dome,
  // its top row at the crown, its bottom row at the drum)
  const panel = (g, w, h, k, real) => {
    const pw = w / 8, top = 150, bot = h - 40;
    const x = k * pw;
    if (real) cover(g, img[['sky', 'peace', 'victory', 'sun'][k % 4]], x, top, pw, bot - top); else baroque(g, x, top, pw, bot - top, 300 + k);
  };
  const glory = (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, 260); gr.addColorStop(0, '#fffdf2'); gr.addColorStop(0.45, '#fbe7ae'); gr.addColorStop(1, 'rgba(240,210,140,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, 260); const b = g.createLinearGradient(0, h - 60, 0, h); b.addColorStop(0, 'rgba(160,110,30,0)'); b.addColorStop(1, '#a07a2a'); g.fillStyle = b; g.fillRect(0, h - 60, w, 60); };
  const domeTex = artTex(2048, 1024, (g, w, h) => { g.fillStyle = '#d9b04a'; g.fillRect(0, 0, w, h); for (let k = 0; k < 8; k++) panel(g, w, h, k, false); glory(g, w, h); },
    (g, w, h) => { g.fillStyle = '#d9b04a'; g.fillRect(0, 0, w, h); for (let k = 0; k < 8; k++) panel(g, w, h, k, true); glory(g, w, h); });
  const dm = new THREE.Mesh(new THREE.SphereGeometry(r, 96, 32, 0, Math.PI * 2, 0, Math.PI / 2), lit(domeTex, 0.75, { side: THREE.BackSide }));
  dm.scale.set(1, sy, 1); dm.position.set(DOME.x, y1, 0); gal.add(dm);
  // the oculus: a disc of light at the crown
  const oc = new THREE.Mesh(new THREE.CircleGeometry(1.7, 40).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#fffaf0', fog: false })); oc.position.set(DOME.x, y1 + r * sy - 0.08, 0); gal.add(oc);
  // gilded ribs, the cornices of the drum and the dome, the oculus's ring
  const m = new Merge();
  for (let k = 0; k < 8; k++) m.add(new THREE.TorusGeometry(r - 0.12, 0.2, 6, 40, Math.PI / 2), new V3(DOME.x, y1, 0), new V3(1, sy, 1), GOLD, new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), k / 8 * Math.PI * 2));
  for (const [yy, rr, t] of [[y0 + 0.05, r - 0.1, 0.42], [y1, r - 0.15, 0.36], [y1 + r * sy - 0.2, 1.75, 0.22]]) m.add(new THREE.TorusGeometry(rr, t, 8, 96).rotateX(Math.PI / 2), new V3(DOME.x, yy, 0), new V3(1, 1, 1), GOLD2);
  gal.add(new THREE.Mesh(m.build(), gilt));
  // the vault's ends, closed by painted lunettes facing the crossing
  const lt = artTex(1024, 512, (g, w, h) => { g.fillStyle = '#d9b04a'; g.fillRect(0, 0, w, h); baroque(g, 40, 40, w - 80, h - 40, 77); frame(g, 40, 40, w - 80, h - 40, 16); },
    (g, w, h) => { g.fillStyle = '#d9b04a'; g.fillRect(0, 0, w, h); cover(g, img.sky, 40, 40, w - 80, h - 40); frame(g, 40, 40, w - 80, h - 40, 16); });
  for (const [ex, ry] of [[DOME.x - GAL.bay + 0.03, -Math.PI / 2], [DOME.x + GAL.bay - 0.03, Math.PI / 2]]) { const lu = new THREE.Mesh(new THREE.CircleGeometry(1, 48, 0, Math.PI), lit(lt, 0.7, { side: THREE.DoubleSide })); lu.scale.set(hw, rise, 1); lu.position.set(ex, wall, 0); lu.rotation.y = ry; gal.add(lu); }
  // an inlaid floor under the dome: a star of coloured marble in a ring
  const inlay = canvasTex(1024, 1024, (g, w) => {
    const c = w / 2; g.fillStyle = '#efe6d6'; g.beginPath(); g.arc(c, c, c, 0, 7); g.fill();
    for (const [rr, col] of [[c - 4, '#6a1a1e'], [c - 40, '#efe6d6'], [c - 70, '#c9a040'], [c - 84, '#efe6d6']]) { g.fillStyle = col; g.beginPath(); g.arc(c, c, rr, 0, 7); g.fill(); }
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, long = k % 2 ? 0.62 : 0.86; g.fillStyle = k % 2 ? '#3a5a4a' : '#8a2a2a'; g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.cos(a - 0.12) * c * 0.25, c + Math.sin(a - 0.12) * c * 0.25); g.lineTo(c + Math.cos(a) * c * long, c + Math.sin(a) * c * long); g.lineTo(c + Math.cos(a + 0.12) * c * 0.25, c + Math.sin(a + 0.12) * c * 0.25); g.closePath(); g.fill(); }
    g.fillStyle = '#c9a040'; g.beginPath(); g.arc(c, c, c * 0.12, 0, 7); g.fill();
  });
  const fl = new THREE.Mesh(new THREE.CircleGeometry(r - 1.5, 64).rotateX(-Math.PI / 2), new THREE.MeshPhongMaterial({ map: inlay, shininess: 80, specular: '#4a3a2a', emissive: '#ffffff', emissiveMap: inlay, emissiveIntensity: 0.3, color: '#bdb2a0', fog: false }));
  fl.position.set(DOME.x, 0.008, 0); gal.add(fl);
}

/* ---------- the quadreria: paintings in two tiers, and oval mirrors in the upper tier's gaps ---------- */
function hangPainting(art, x, yBottom, side, maxH, maxW) {
  const asp = ASPECT[art.file] || 1, h = Math.min(maxH, maxW / asp), w = h * asp, y = yBottom + h / 2;
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = Math.max(128, Math.round(512 / asp));
  const g = cv.getContext('2d'); g.fillStyle = '#3a2a1a'; g.fillRect(0, 0, cv.width, cv.height);
  const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 8;
  const draw = im => { g.drawImage(im, 0, 0, cv.width, cv.height); tex.needsUpdate = true; };
  if (pics[art.file]) draw(pics[art.file]); else waiting.push({ file: art.file, draw });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, color: '#e8e0d0', fog: false }));
  mesh.position.set(x, y, side * (GAL.hw - 0.2)); mesh.rotation.y = side > 0 ? Math.PI : 0; gal.add(mesh);
  // a deep carved frame: an outer gilded band, an inner bead, corner ornaments, a crest; a brass label below
  const m = new Merge(), d = side * (GAL.hw - 0.26), t = 0.32;
  for (const [fx, fy, fw, fh] of [[x, y + h / 2 + t / 2, w + t * 2, t], [x, y - h / 2 - t / 2, w + t * 2, t], [x - w / 2 - t / 2, y, t, h], [x + w / 2 + t / 2, y, t, h]]) m.add(GEO.box, new V3(fx, fy, d), new V3(fw, fh, 0.2), GOLD);
  for (const [fx, fy, fw, fh] of [[x, y + h / 2 + 0.04, w + 0.1, 0.07], [x, y - h / 2 - 0.04, w + 0.1, 0.07], [x - w / 2 - 0.04, y, 0.07, h], [x + w / 2 + 0.04, y, 0.07, h]]) m.add(GEO.box, new V3(fx, fy, side * (GAL.hw - 0.3)), new V3(fw, fh, 0.08), GOLD2);
  for (const cx of [-1, 1]) for (const cy of [-1, 1]) m.add(GEO.sph, new V3(x + cx * (w / 2 + t / 2), y + cy * (h / 2 + t / 2), side * (GAL.hw - 0.34)), new V3(0.2, 0.2, 0.12), GOLD2);
  m.add(GEO.sph, new V3(x, y + h / 2 + t + 0.12, side * (GAL.hw - 0.32)), new V3(0.42, 0.24, 0.1), GOLD2);
  m.add(GEO.box, new V3(x, y - h / 2 - t - 0.3, side * (GAL.hw - 0.17)), new V3(0.95, 0.24, 0.04), C('#c9a040'));
  gal.add(new THREE.Mesh(m.build(), gilt));
  const wp = new V3(W.x + x, 0, W.z + side * (GAL.hw - 3.4));
  regThing(mesh, 'Look at “' + art.title + '”', () => late.viewPainting && late.viewPainting(art.id), { x: wp.x, z: wp.z, r: 3 });
}
const mirrorTex = canvasTex(256, 384, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#d9dcd8'); gr.addColorStop(0.45, '#8f948f'); gr.addColorStop(0.55, '#a8aca6'); gr.addColorStop(1, '#6d6f69'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let k = 0; k < 9; k++) { const x = 30 + k * 26, y = 80 + (k % 3) * 70; const rg = g.createRadialGradient(x, y, 0, x, y, 26); rg.addColorStop(0, 'rgba(255,230,170,.7)'); rg.addColorStop(1, 'rgba(255,230,170,0)'); g.fillStyle = rg; g.fillRect(x - 26, y - 26, 52, 52); }
  g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 6; g.beginPath(); g.moveTo(40, h); g.lineTo(w - 40, 0); g.stroke();
});
function hangMirror(x, side) {
  const y = 17.2, w = 3.6, h = 5.0;
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshPhongMaterial({ map: mirrorTex, shininess: 120, specular: '#ffffff', emissive: '#ffffff', emissiveMap: mirrorTex, emissiveIntensity: 0.35, fog: false }));
  m.scale.set(w / 2, h / 2, 1); m.position.set(x, y, side * (GAL.hw - 0.2)); m.rotation.y = side > 0 ? Math.PI : 0; gal.add(m);
  const fm = new Merge(); fm.add(new THREE.TorusGeometry(1, 0.11, 8, 48), new V3(x, y, side * (GAL.hw - 0.26)), new V3(w / 2, h / 2, 1), GOLD, new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), side > 0 ? Math.PI : 0));
  fm.add(GEO.sph, new V3(x, y + h / 2 + 0.35, side * (GAL.hw - 0.3)), new V3(0.6, 0.35, 0.12), GOLD2);
  for (const o of [-1, 1]) fm.add(GEO.sph, new V3(x + o * (w / 2 + 0.2), y, side * (GAL.hw - 0.3)), new V3(0.18, 0.5, 0.1), GOLD2);
  gal.add(new THREE.Mesh(fm.build(), gilt));
}
{
  // the lower tier: the largest and best-known, one to a bay, centred between the pilasters, over a console
  const lower = [
    ['innocent-x', 'rest-flight', 'magdalene', 'las-meninas', 'night-watch', 'mona-lisa', 'birth-of-venus', 'school-athens', 'venus-urbino', 'hunters-snow', 'milkmaid'],
    ['starry-night', 'cafe-terrace', 'sunflowers', 'great-wave', 'wanderer', 'the-kiss', 'grande-jatte', 'moulin-galette', 'temeraire', 'water-lilies', 'the-swing'],
  ];
  // the upper tier: alternate bays, smaller, with an oval mirror in the bays between
  const upper = [['pearl-earring', 'lady-ermine', 'creation-adam', 'dance-class', 'shalott'], ['impression-sunrise', 'parasol', 'irises', 'hay-wain', 'carnation-lily', 'ophelia']];
  const bays = GAL.L / GAL.bay, art = f => FAMOUS_ART.find(a => a.file === f);
  [-1, 1].forEach((side, si) => {
    lower[si].forEach((f, k) => hangPainting(art(f), (k + 0.5) * GAL.bay, 2.4, side, 7.4, 7.6));
    let u = 0;
    for (let k = 0; k < ART_BAYS; k++) {
      const x = (k + 0.5) * GAL.bay;
      if ((k + si) % 2 === 1 && upper[si][u]) hangPainting(art(upper[si][u++]), x, 14.2, side, 5.6, 7.6);
      else hangMirror(x, side);
    }
  });
}

/* ---------- furniture: consoles and urns, marble statues down the middle, benches, chandeliers ---------- */
{
  const m = new Merge(), s = new Merge(), bays = ART_BAYS + 1, statues = [];
  for (let k = 0; k < ART_BAYS; k++) {
    const x = (k + 0.5) * GAL.bay;
    for (const sz of [-1, 1]) {
      // a gilded console against the wall under each lower painting: carved legs, an apron, a marble top, an urn or a bust
      const z = sz * (GAL.hw - 0.75);
      for (const dx of [-1.1, 1.1]) { m.limb(new V3(x + dx, 0, z), new V3(x + dx * 0.9, 0.95, z), 0.07, 0.11, GOLD); m.add(GEO.sph, new V3(x + dx * 0.9, 0.12, z), new V3(0.12, 0.12, 0.12), GOLD2); }
      m.add(GEO.box, new V3(x, 0.88, z), new V3(2.6, 0.2, 0.7), GOLD);
      m.add(GEO.sph, new V3(x, 0.72, z - sz * 0.32), new V3(0.4, 0.2, 0.06), GOLD2);
      s.add(GEO.box, new V3(x, 1.02, z), new V3(2.8, 0.08, 0.82), C('#c9b8a8'));
      if (k % 2 === 0) { s.add(GEO.sph, new V3(x, 1.4, z), new V3(0.26, 0.34, 0.26), C('#e8dfd0')); s.add(new THREE.CylinderGeometry(0.1, 0.16, 0.24, 12), new V3(x, 1.14, z), new V3(1, 1, 1), C('#e8dfd0')); s.add(new THREE.CylinderGeometry(0.17, 0.13, 0.12, 12), new V3(x, 1.72, z), new V3(1, 1, 1), C('#e8dfd0')); }
      else { s.add(GEO.box, new V3(x, 1.2, z), new V3(0.4, 0.3, 0.3), C('#e8dfd0')); s.add(GEO.sph, new V3(x, 1.6, z), new V3(0.18, 0.24, 0.2), MARBLE); s.add(GEO.sph, new V3(x, 1.38, z), new V3(0.24, 0.12, 0.16), MARBLE); }
    }
    if (k % 2 === 1 && k < bays - 2) {
      // a white marble statue on a pedestal in the middle of the bay
      s.add(GEO.box, new V3(x, 0.15, 0), new V3(1.8, 0.3, 1.8), C('#cfc6b8')); s.add(GEO.box, new V3(x, 1.0, 0), new V3(1.3, 1.4, 1.3), MARBLE2); s.add(GEO.box, new V3(x, 1.76, 0), new V3(1.5, 0.14, 1.5), C('#cfc6b8'));
      statues.push([x, k % 4 === 1 ? 1 : -1]);
    } else if (k > 0 && k < bays - 1) {
      // crimson benches with gilded legs, either side of the middle
      for (const bz of [-4.6, 4.6]) { m.add(GEO.box, new V3(x, 0.48, bz), new V3(2.8, 0.2, 0.95), C('#8a1f24')); for (const dx of [-1.2, 1.2]) for (const dz of [-0.36, 0.36]) m.add(GEO.box, new V3(x + dx, 0.2, bz + dz), new V3(0.1, 0.42, 0.1), GOLD); }
    }
  }
  // under the dome: a round crimson ottoman with a gilded urn of flowers rising from its middle
  m.add(new THREE.CylinderGeometry(2.6, 2.7, 0.5, 40), new V3(DOME.x, 0.25, 0), new V3(1, 1, 1), C('#8a1f24'));
  m.add(new THREE.TorusGeometry(2.62, 0.08, 6, 40).rotateX(Math.PI / 2), new V3(DOME.x, 0.5, 0), new V3(1, 1, 1), GOLD);
  m.add(new THREE.CylinderGeometry(1.0, 1.2, 1.1, 32), new V3(DOME.x, 1.0, 0), new V3(1, 1, 1), C('#7a1a20'));
  // a gilded urn on a fluted stem, brimming with roses, lilies and trailing green
  m.add(new THREE.LatheGeometry([[0.42, 0], [0.42, 0.1], [0.2, 0.22], [0.16, 0.6], [0.3, 0.72], [0.55, 0.95], [0.7, 1.3], [0.62, 1.6], [0.48, 1.72], [0.62, 1.82], [0.6, 1.88]].map(([a, b]) => new THREE.Vector2(a, b)), 28), new V3(DOME.x, 1.55, 0), new V3(1, 1, 1), GOLD);
  for (const o of [-1, 1]) m.add(new THREE.TorusGeometry(0.22, 0.05, 6, 16, Math.PI * 1.3), new V3(DOME.x, 2.95, o * 0.72), new V3(1, 1, 1), GOLD2, new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), Math.PI / 2));
  const RB = rng(808);
  for (let k = 0; k < 90; k++) { const a = RB() * 6.283, rr = Math.sqrt(RB()) * 0.85, y = 3.5 + (0.85 - rr) * 0.7 + RB() * 0.25; m.add(GEO.sph, new V3(DOME.x + Math.cos(a) * rr, y, Math.sin(a) * rr), new V3(0.13, 0.11, 0.13), C(['#f6f2ea', '#e88aa0', '#f2d0dc', '#c84a5a', '#f4e3a0'][k % 5])); }
  for (let k = 0; k < 30; k++) { const a = RB() * 6.283, rr = 0.6 + RB() * 0.35; m.add(GEO.sph, new V3(DOME.x + Math.cos(a) * rr, 3.3 + RB() * 0.4 - (k % 3) * 0.3, Math.sin(a) * rr), new V3(0.09, 0.2, 0.06), C(k % 2 ? '#3f6a3a' : '#4f7a42')); }
  gal.add(new THREE.Mesh(m.build(), gilt)); gal.add(new THREE.Mesh(s.build(), stone));
  // the marble Muses on the pedestals (world/buddha.js sculpts them), facing the way in, mirrored in turn
  const marble = new THREE.MeshPhongMaterial({ color: '#f1ece2', specular: '#ffffff', shininess: 26, emissive: '#7a756c', emissiveIntensity: 0.55, fog: false }), fig = museFigure();
  for (const [x, sd] of statues) { const st = new THREE.Mesh(fig, marble); st.scale.set(2.5 * sd, 2.5, 2.5); st.position.set(x, 1.83, 0); st.rotation.y = -Math.PI / 2; gal.add(st); }
  // Venetian glass chandeliers: two tiers of candles, crystal drops, a glass body, one over every bay
  const cm = new Merge(), glass = C('#eef4ff');
  for (let k = 0; k < ART_BAYS; k++) {
    const x = (k + 0.5) * GAL.bay, top = GAL.wall + GAL.rise - 0.3, y = GAL.wall + 0.6;
    cm.limb(new V3(x, top, 0), new V3(x, y + 1.6, 0), 0.03, 0.03, GOLD);
    cm.add(GEO.sph, new V3(x, y + 0.8, 0), new V3(0.35, 0.8, 0.35), glass);
    for (const [r, yy, n] of [[1.4, y, 10], [0.85, y + 1.0, 6]]) {
      cm.add(new THREE.TorusGeometry(r, 0.05, 6, 24).rotateX(Math.PI / 2), new V3(x, yy, 0), new V3(1, 1, 1), glass);
      for (let a = 0; a < n; a++) { const an = a / n * Math.PI * 2, cx = x + Math.cos(an) * r, cz = Math.sin(an) * r; cm.limb(new V3(cx, yy, cz), new V3(cx, yy + 0.24, cz), 0.03, 0.03, C('#fffaf0')); glows.push(cx, yy + 0.34, cz); cm.add(GEO.cone, new V3(cx, yy - 0.25, cz), new V3(0.06, 0.28, 0.06), glass, new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), Math.PI)); }
    }
  }
  gal.add(new THREE.Mesh(cm.build(), new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 120, specular: '#ffffff', emissive: '#4a4030', emissiveIntensity: 0.6, transparent: true, opacity: 0.92, fog: false })));
}

/* ---------- the salon of your paintings, behind a gilded proscenium at the far end ---------- */
// nine carved rectangular frames hung salon-style on green velvet (all rectangles, asked after round 56), each under
// a picture light; your paintings fill them in this order: the centre, its two sides, the top row, the bottom row
const SLOTS = [
  { z: 0, y: 10.2, w: 9.0, h: 6.6 },
  { z: -9.4, y: 10.2, w: 4.8, h: 6.0 }, { z: 9.4, y: 10.2, w: 4.8, h: 6.0 },
  { z: -7.8, y: 16.6, w: 5.4, h: 3.8 }, { z: 0, y: 16.5, w: 5.8, h: 3.6 }, { z: 7.8, y: 16.6, w: 5.4, h: 3.8 },
  { z: -7.2, y: 3.9, w: 5.6, h: 3.4 }, { z: 0, y: 3.8, w: 4.6, h: 3.0 }, { z: 7.2, y: 3.9, w: 5.6, h: 3.4 },
];
// a carved gilded frame and its picture, painted together on one canvas (so ovals and corner ornaments are crisp)
function paintSlot(sl, im) {
  const g = sl.g, cw = sl.cv.width, ch = sl.cv.height, t = Math.round(Math.min(cw, ch) * 0.13);
  g.clearRect(0, 0, cw, ch);
  const shape = inset => { g.beginPath(); if (sl.oval) g.ellipse(cw / 2, ch / 2, cw / 2 - inset, ch / 2 - inset, 0, 0, 7); else g.rect(inset, inset, cw - inset * 2, ch - inset * 2); };
  const gold = (a, b) => { const gr = g.createLinearGradient(0, 0, cw, ch); gr.addColorStop(0, a); gr.addColorStop(0.5, b); gr.addColorStop(1, a); return gr; };
  // the frame: layered gold, darker in its hollows, a bright inner lip
  shape(0); g.fillStyle = gold('#8a6418', '#e8c25a'); g.fill();
  shape(t * 0.25); g.fillStyle = gold('#c99a32', '#f6dc8a'); g.fill();
  shape(t * 0.55); g.fillStyle = gold('#7a5410', '#c99a32'); g.fill();
  shape(t * 0.75); g.fillStyle = gold('#e8c25a', '#fff0b8'); g.fill();
  // a row of beads, and carved shells
  g.fillStyle = '#fff2c0';
  const shell = (x, y, r) => { const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, '#fff6c8'); rg.addColorStop(0.6, '#e0b44a'); rg.addColorStop(1, 'rgba(160,110,30,0)'); g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
  if (sl.oval) {
    for (let i = 0; i < 64; i++) { const a = i / 64 * Math.PI * 2; g.beginPath(); g.arc(cw / 2 + Math.cos(a) * (cw / 2 - t * 0.4), ch / 2 + Math.sin(a) * (ch / 2 - t * 0.4), t * 0.07, 0, 7); g.fill(); }
    shell(cw / 2, t * 0.4, t * 1.0); shell(cw / 2, ch - t * 0.4, t * 0.7);
    // laurel leaves all round the oval
    for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2, rx = cw / 2 - t * 0.62, ry = ch / 2 - t * 0.62, x = cw / 2 + Math.cos(a) * rx, y = ch / 2 + Math.sin(a) * ry; g.fillStyle = i % 2 ? '#f6dc8a' : '#b8862e'; g.beginPath(); g.ellipse(x, y, t * 0.16, t * 0.07, a + Math.PI / 2 + 0.5, 0, 7); g.fill(); }
  } else {
    for (let x = t * 0.5; x < cw - t * 0.4; x += t * 0.28) for (const y of [t * 0.4, ch - t * 0.4]) { g.beginPath(); g.arc(x, y, t * 0.07, 0, 7); g.fill(); }
    for (let y = t * 0.5; y < ch - t * 0.4; y += t * 0.28) for (const x of [t * 0.4, cw - t * 0.4]) { g.beginPath(); g.arc(x, y, t * 0.07, 0, 7); g.fill(); }
    for (const [x, y] of [[t * 0.5, t * 0.5], [cw - t * 0.5, t * 0.5], [t * 0.5, ch - t * 0.5], [cw - t * 0.5, ch - t * 0.5], [cw / 2, t * 0.45], [cw / 2, ch - t * 0.45]]) shell(x, y, t * 0.75);
    // acanthus: a scroll of gilded leaves running along each side between the corners
    g.lineCap = 'round';
    const scroll = (x0, y0, x1, y1) => {
      const L2 = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L2, uy = (y1 - y0) / L2, n = Math.max(2, Math.round(L2 / (t * 1.6)));
      for (let i = 0; i < n; i++) {
        const cx = x0 + ux * (i + 0.5) * L2 / n, cy = y0 + uy * (i + 0.5) * L2 / n, r = t * 0.22, sgn = i % 2 ? 1 : -1;
        g.strokeStyle = '#7a5410'; g.lineWidth = t * 0.09; g.beginPath(); g.arc(cx - uy * r * 0.3 * sgn, cy + ux * r * 0.3 * sgn, r, 0, Math.PI * 1.5); g.stroke();
        g.strokeStyle = '#fff0b8'; g.lineWidth = t * 0.045; g.beginPath(); g.arc(cx - uy * r * 0.3 * sgn, cy + ux * r * 0.3 * sgn, r, 0, Math.PI * 1.5); g.stroke();
        g.fillStyle = '#f6dc8a'; g.beginPath(); g.ellipse(cx + ux * r, cy + uy * r, r * 0.55, r * 0.22, Math.atan2(uy, ux) + 0.6 * sgn, 0, 7); g.fill();
      }
    };
    const mid = t * 0.62;
    scroll(t * 1.2, mid, cw / 2 - t * 0.9, mid); scroll(cw / 2 + t * 0.9, mid, cw - t * 1.2, mid);
    scroll(t * 1.2, ch - mid, cw / 2 - t * 0.9, ch - mid); scroll(cw / 2 + t * 0.9, ch - mid, cw - t * 1.2, ch - mid);
    scroll(mid, t * 1.2, mid, ch - t * 1.2); scroll(cw - mid, t * 1.2, cw - mid, ch - t * 1.2);
  }
  // the picture, or a primed canvas waiting for one
  g.save(); shape(t); g.clip();
  const x0 = t, y0 = t, w = cw - 2 * t, h = ch - 2 * t;
  if (im) { const s2 = Math.max(w / im.width, h / im.height), sw = w / s2, sh = h / s2; g.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, x0, y0, w, h); }
  else {
    const gr = g.createLinearGradient(0, y0, 0, y0 + h); gr.addColorStop(0, '#f6eedc'); gr.addColorStop(1, '#e8dcc0'); g.fillStyle = gr; g.fillRect(x0, y0, w, h);
    const RS = rng(Math.round(sl.z * 10 + sl.y * 3) + 50); g.strokeStyle = 'rgba(160,130,90,.12)'; for (let i = 0; i < 160; i++) { const yy = y0 + RS() * h; g.beginPath(); g.moveTo(x0, yy); g.lineTo(x0 + w, yy + (RS() - 0.5) * 3); g.stroke(); }
    // a soft watercolour wash, and the invitation
    for (const [cx, cy, r, c] of [[0.35, 0.45, 0.32, 'rgba(232,150,170,.18)'], [0.62, 0.55, 0.28, 'rgba(120,170,210,.18)'], [0.5, 0.35, 0.22, 'rgba(240,200,110,.18)']]) { const rg = g.createRadialGradient(x0 + cx * w, y0 + cy * h, 0, x0 + cx * w, y0 + cy * h, r * Math.max(w, h)); rg.addColorStop(0, c); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(x0, y0, w, h); }
    g.fillStyle = 'rgba(90,60,30,.62)'; g.textAlign = 'center'; g.font = `italic 600 ${Math.round(Math.min(w, h) * 0.13)}px "Cormorant Garamond", Georgia, serif`; g.fillText('Your painting here', cw / 2, ch / 2 + Math.min(w, h) * 0.05);
  }
  g.restore();
  // a soft shadow inside the frame's lip
  g.save(); shape(t); g.clip(); g.strokeStyle = 'rgba(40,20,5,.45)'; g.lineWidth = t * 0.5; shape(t - t * 0.2); g.stroke(); g.restore();
  sl.tex.needsUpdate = true;
}
{
  const L = GAL.L, m = new Merge(), PX = SAL;
  // the proscenium: gilded pilasters and an arch, with crimson velvet curtains swept back to each side
  for (const sz of [-1, 1]) { m.add(GEO.box, new V3(PX, GAL.wall / 2, sz * (GAL.hw - 0.9)), new V3(0.9, GAL.wall, 1.4), GOLD); m.add(GEO.box, new V3(PX, 0.6, sz * (GAL.hw - 0.9)), new V3(1.2, 1.2, 1.7), CREAM); }
  m.add(new THREE.TorusGeometry(GAL.hw - 0.9, 0.4, 8, 48, Math.PI).rotateY(Math.PI / 2), new V3(PX, GAL.wall, 0), new V3(1, GAL.rise / GAL.hw, 1), GOLD);
  m.add(GEO.box, new V3(PX, GAL.wall - 0.4, 0), new V3(0.7, 0.8, GAL.hw * 2 - 1.8), GOLD2);
  // the salon's floor: a step of dark marble and a crimson carpet
  m.add(GEO.box, new V3((PX + L) / 2, 0.12, 0), new V3(L - PX, 0.24, GAL.hw * 2 - 0.6), C('#3a2a22'));
  m.add(GEO.box, new V3((PX + L) / 2 + 0.2, 0.26, 0), new V3(L - PX - 1, 0.04, 12), C('#7a1e22'));
  // the frames stand proud of the velvet: a gilded moulding behind each canvas, a carved crest on top
  SLOTS.forEach(sl => {
    if (sl.oval) m.add(new THREE.TorusGeometry(1, 0.09, 8, 48).rotateY(Math.PI / 2), new V3(L - 0.22, sl.y, sl.z), new V3(1, sl.h / 2 + 0.05, sl.w / 2 + 0.05), GOLD);
    else for (const [dy, dz, hh, ww] of [[sl.h / 2, 0, 0.22, sl.w + 0.3], [-sl.h / 2, 0, 0.22, sl.w + 0.3], [0, sl.w / 2, sl.h, 0.22], [0, -sl.w / 2, sl.h, 0.22]]) m.add(GEO.box, new V3(L - 0.24, sl.y + dy, sl.z + dz), new V3(0.18, hh, ww), GOLD);
    const top = sl.y + sl.h / 2 + 0.25;
    m.add(GEO.sph, new V3(L - 0.3, top, sl.z), new V3(0.12, 0.26, Math.min(0.55, sl.w * 0.1)), GOLD2);
    for (const o of [-1, 1]) m.add(GEO.sph, new V3(L - 0.28, top - 0.08, sl.z + o * Math.min(0.75, sl.w * 0.15)), new V3(0.1, 0.14, 0.26), GOLD);
  });
  // picture lights: a brass bar over each frame
  SLOTS.forEach(sl => { const ly = sl.y + sl.h / 2 + 0.75; m.add(GEO.box, new V3(L - 0.55, ly, sl.z), new V3(0.3, 0.08, sl.w * 0.5), C('#c9a040')); m.limb(new V3(L - 0.1, ly - 0.15, sl.z), new V3(L - 0.5, ly, sl.z), 0.03, 0.03, C('#c9a040')); lights.push(L - 0.6, ly - 0.1, sl.z); });
  // two gilded easels with primed canvases, and a painter's table with a palette
  for (const ez of [-10, 10]) {
    const ex = L - 5.4;
    for (const [dx, dz] of [[-0.45, -0.35], [0.45, -0.35], [0.4, 0.45]]) m.limb(new V3(ex + dx, 0.24, ez + dz), new V3(ex, 2.9, ez), 0.05, 0.05, GOLD);
    m.add(GEO.box, new V3(ex - 0.1, 1.1, ez), new V3(0.08, 0.08, 1.8), GOLD);
    m.add(GEO.box, new V3(ex - 0.12, 1.85, ez), new V3(0.06, 1.4, 1.8), C('#f4ecd8'), new THREE.Quaternion().setFromAxisAngle(new V3(0, 0, 1), 0.08));
  }
  m.add(new THREE.CylinderGeometry(0.6, 0.6, 0.06, 20), new V3(L - 5.6, 0.95, -4.6), new V3(1, 1, 1), C('#7a5234'));
  for (const [dx, dz] of [[-0.35, -0.35], [0.35, -0.35], [0, 0.45]]) m.limb(new V3(L - 5.6 + dx, 0.24, -4.6 + dz), new V3(L - 5.6, 0.93, -4.6), 0.04, 0.04, C('#5a3a20'));
  m.add(GEO.sph, new V3(L - 5.6, 1.0, -4.6), new V3(0.42, 0.03, 0.32), C('#c8a06a'));
  for (const [c, dx, dz] of [['#c0392b', -0.2, -0.1], ['#2f6ad6', 0, 0.15], ['#f2c12e', 0.18, -0.08], ['#2fa86a', 0.12, 0.12], ['#ffffff', -0.15, 0.14]]) m.add(GEO.sph, new V3(L - 5.6 + dx, 1.03, -4.6 + dz), new V3(0.06, 0.03, 0.06), C(c));
  gal.add(new THREE.Mesh(m.build(), gilt));
  // the curtains: crimson velvet hanging in folds, gathered back toward the pilasters
  const cg = new THREE.PlaneGeometry(4.2, GAL.wall, 18, 30), cp = cg.attributes.position;
  for (let i = 0; i < cp.count; i++) { const u = cp.getX(i) / 4.2 + 0.5, y = cp.getY(i) / GAL.wall + 0.5, pinch = 0.35 + 0.65 * Math.min(1, Math.abs(y - 0.3) * 2.2); cp.setX(i, (u - 0.5) * 4.2 * pinch - (1 - pinch) * 1.4); cp.setZ(i, Math.sin(u * Math.PI * 7) * 0.22 * (1.2 - pinch * 0.5)); }
  cg.computeVertexNormals();
  const curtain = canvasTex(64, 64, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#5a0e14'); gr.addColorStop(0.5, '#9a2028'); gr.addColorStop(1, '#5a0e14'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, true); curtain.repeat.set(7, 1);
  for (const sz of [-1, 1]) { const c = new THREE.Mesh(cg, lit(curtain, 0.32, { side: THREE.DoubleSide })); c.position.set(PX + 0.6, GAL.wall / 2, sz * (GAL.hw - 3.0)); c.rotation.y = -Math.PI / 2; c.scale.x = -sz; gal.add(c); }
  // the cartouche above: Your Paintings
  const sign = canvasTex(1024, 320, (g, w, h) => {
    g.fillStyle = '#d4a63a'; g.beginPath(); g.moveTo(80, h / 2); g.bezierCurveTo(80, 30, 200, 20, w / 2, 24); g.bezierCurveTo(w - 200, 20, w - 80, 30, w - 80, h / 2); g.bezierCurveTo(w - 80, h - 30, w - 200, h - 20, w / 2, h - 24); g.bezierCurveTo(200, h - 20, 80, h - 30, 80, h / 2); g.fill();
    for (const sx of [-1, 1]) { g.save(); g.translate(w / 2 + sx * (w / 2 - 70), h / 2); g.scale(sx, 1); g.beginPath(); g.arc(0, 0, 46, 0.5, Math.PI * 1.6); g.lineWidth = 14; g.strokeStyle = '#e8c25a'; g.stroke(); g.restore(); }
    g.fillStyle = '#1f3a2b'; g.beginPath(); g.ellipse(w / 2, h / 2, w / 2 - 140, h / 2 - 50, 0, 0, 7); g.fill();
    g.strokeStyle = '#f0d880'; g.lineWidth = 4; g.beginPath(); g.ellipse(w / 2, h / 2, w / 2 - 152, h / 2 - 62, 0, 0, 7); g.stroke();
    g.fillStyle = '#f6e2a0'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 84px "Cormorant Garamond", Georgia, serif'; g.fillText('Your Paintings', w / 2, h / 2 - 16);
    g.font = 'italic 600 34px "Cormorant Garamond", Georgia, serif'; g.fillText('hung here by your own hand', w / 2, h / 2 + 44);
  });
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(8, 2.5), new THREE.MeshBasicMaterial({ map: sign, transparent: true, alphaTest: 0.1, fog: false })); sg.position.set(L - 0.15, 20.4, 0); sg.rotation.y = -Math.PI / 2; gal.add(sg);
  // the frames
  SLOTS.forEach(sl => {
    sl.cv = document.createElement('canvas'); sl.cv.width = Math.round(sl.w * 150); sl.cv.height = Math.round(sl.h * 150); sl.g = sl.cv.getContext('2d');
    sl.tex = new THREE.CanvasTexture(sl.cv); sl.tex.anisotropy = 8;
    sl.mesh = new THREE.Mesh(new THREE.PlaneGeometry(sl.w, sl.h), new THREE.MeshBasicMaterial({ map: sl.tex, color: '#ece4d4', transparent: true, alphaTest: 0.5, fog: false }));
    sl.mesh.position.set(L - 0.32, sl.y, sl.z); sl.mesh.rotation.y = -Math.PI / 2; gal.add(sl.mesh);
    const wp = new V3(W.x + L - 4.2, 0, W.z + sl.z * 0.7);
    sl.thing = regThing(sl.mesh, 'Hang your painting', () => late.viewPainting && late.viewPainting(sl.art ? sl.art.id : 'upload'), { x: wp.x, z: wp.z, r: 1.6 });
  });
  regThing(gal, 'Hang a painting of your own', () => late.viewPainting && late.viewPainting('upload'), { x: W.x + L - 5.4, z: W.z + 7, r: 2.2 });
}
function hangOwn(list) {
  SLOTS.forEach((sl, i) => { const art = list[i] || null; sl.art = art; paintSlot(sl, art && art.image); sl.thing.label = art ? 'Look at “' + art.title + '”' : 'Hang your painting'; });
}
hangOwn([]);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => SLOTS.forEach(sl => paintSlot(sl, sl.art && sl.art.image)));

/* ---------- the glow of candles and picture lights ---------- */
{
  const g = new THREE.BufferGeometry(), pos = [...glows, ...lights], warm = [];
  for (let i = 0; i < glows.length / 3; i++) warm.push(1, 0.82, 0.55);
  for (let i = 0; i < lights.length / 3; i++) warm.push(1, 0.92, 0.72);
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(warm, 3));
  const pts = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: 'uniform float uTime;varying float vF;varying vec3 vC;void main(){vC=color;vF=.85+.15*sin(uTime*6.+position.x*3.+position.z*5.);vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(420./-mv.z,2.,24.);gl_Position=projectionMatrix*mv;}',
    fragmentShader: 'varying float vF;varying vec3 vC;void main(){float d=length(gl_PointCoord-.5);float a=(smoothstep(.5,.0,d)*.55+smoothstep(.14,.0,d))*vF;gl_FragColor=vec4(vC*a,a);}' }));
  gal.add(pts);
  addTick(() => { if (gal.visible) pts.material.uniforms.uTime.value = T; }, true);
}

/* ---------- the hallway from the Hall of Mirrors: 16 m wide, the walls' full height ---------- */
const HWY = { A: HALL.x + HALL.hw - GAL.x, B: 0, half: OPEN_HALF, h: HALL.wall, rise: 4.4 };
{
  const { A, B, half, h, rise } = HWY, L = B - A, xm = (A + B) / 2, way = new THREE.Group(); gal.add(way);
  for (const sz of [-1, 1]) { const t = damask.clone(); t.needsUpdate = true; t.repeat.set(L / 3, h / 3); const wm = new THREE.Mesh(new THREE.PlaneGeometry(L, h), lit(t, 0.4)); wm.position.set(xm, h / 2, sz * half); wm.rotation.y = sz > 0 ? Math.PI : 0; way.add(wm); }
  const ft = marbleFloor.clone(); ft.needsUpdate = true; ft.repeat.set(L / 4, half * 2 / 4);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(L + 1, half * 2).rotateX(-Math.PI / 2), new THREE.MeshPhongMaterial({ map: ft, shininess: 70, specular: '#4a3a2a', emissive: '#ffffff', emissiveMap: ft, emissiveIntensity: 0.3, color: '#bdb2a0', fog: false })); fl.position.set(xm, 0.006, 0); way.add(fl);
  const vtex = canvasTex(512, 256, (g, w, hh) => { g.fillStyle = '#efe4c8'; g.fillRect(0, 0, w, hh); for (let y = 0; y < hh; y += 64) for (let x = 0; x < w; x += 64) { g.fillStyle = '#e2d0a4'; g.fillRect(x + 6, y + 6, 52, 52); g.fillStyle = '#d4a63a'; g.beginPath(); g.arc(x + 32, y + 32, 9, 0, 7); g.fill(); } }, true); vtex.repeat.set(1.7, L / 6); // u round the arch, v along the hallway
  const vt = new THREE.Mesh(new THREE.CylinderGeometry(half, half, L, 40, 1, true, 0, Math.PI), lit(vtex, 0.55, { side: THREE.BackSide })); vt.rotation.z = Math.PI / 2; vt.scale.set(rise / half, 1, 1); vt.position.set(xm, h, 0); way.add(vt);
  const m = new Merge(), bays = 4;
  for (let k = 0; k <= bays; k++) { const x = A + k / bays * L; for (const sz of [-1, 1]) { m.add(GEO.box, new V3(x, h / 2, sz * (half - 0.15)), new V3(0.6, h, 0.3), GOLD); m.add(GEO.box, new V3(x, 0.5, sz * (half - 0.2)), new V3(0.8, 1.0, 0.4), CREAM); } }
  for (const sz of [-1, 1]) m.add(GEO.box, new V3(xm, h - 0.25, sz * (half - 0.25)), new V3(L, 0.5, 0.5), GOLD2);
  for (const ex of [A + 0.15, B - 0.15]) { m.add(new THREE.TorusGeometry(half, 0.32, 8, 48, Math.PI).rotateY(Math.PI / 2), new V3(ex, h, 0), new V3(1, rise / half, 1), GOLD); for (const sz of [-1, 1]) m.add(GEO.box, new V3(ex, h / 2, sz * (half - 0.05)), new V3(0.45, h, 0.45), GOLD); }
  for (const ex of [A + 0.4, B - 0.5]) m.add(GEO.box, new V3(ex, 14.6, 0), new V3(0.25, 0.25, half * 2), GOLD);
  way.add(new THREE.Mesh(m.build(), gilt));
  // the vault's end where it meets the Hall of Mirrors, closed above the opening
  { const lu = new THREE.Mesh(new THREE.CircleGeometry(1, 40, 0, Math.PI), new THREE.MeshLambertMaterial({ color: '#e8d8b0', emissive: '#efe2c4', emissiveIntensity: 0.45, side: THREE.DoubleSide, fog: false })); lu.scale.set(half, rise, 1); lu.position.set(A + 0.05, h, 0); lu.rotation.y = Math.PI / 2; way.add(lu); }
  const carpet = canvasTex(64, 256, (g, w, hh) => { g.fillStyle = '#8a1f24'; g.fillRect(0, 0, w, hh); g.fillStyle = '#d4a63a'; g.fillRect(0, 0, 5, hh); g.fillRect(w - 5, 0, 5, hh); }, true); carpet.repeat.set(1, L / 4);
  const cp = new THREE.Mesh(new THREE.PlaneGeometry(4, L + 4).rotateX(-Math.PI / 2).rotateY(Math.PI / 2), lit(carpet, 0.35)); cp.position.set(xm + 1, 0.016, 0); way.add(cp);
  // the signs, at both ends, each two panels back to back so they read the right way round from either side
  const sign = canvasTex(1024, 256, (g, w, hh) => { g.fillStyle = '#2a1a10'; g.fillRect(0, 0, w, hh); g.strokeStyle = '#d4a63a'; g.lineWidth = 10; g.strokeRect(14, 14, w - 28, hh - 28); g.fillStyle = '#f0d890'; g.textAlign = 'center'; g.textBaseline = 'middle'; let px = 116; do { g.font = `700 ${px}px "Cormorant Garamond", Georgia, serif`; px -= 4; } while (g.measureText('The Hall of Paintings').width > w - 90); g.fillText('The Hall of Paintings', w / 2, hh / 2 + 6); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { const g = sign.image.getContext('2d'), w = 1024, hh = 256; g.fillStyle = '#2a1a10'; g.fillRect(0, 0, w, hh); g.strokeStyle = '#d4a63a'; g.lineWidth = 10; g.strokeRect(14, 14, w - 28, hh - 28); g.fillStyle = '#f0d890'; g.textAlign = 'center'; g.textBaseline = 'middle'; let px = 116; do { g.font = `700 ${px}px "Cormorant Garamond", Georgia, serif`; px -= 4; } while (g.measureText('The Hall of Paintings').width > w - 90); g.fillText('The Hall of Paintings', w / 2, hh / 2 + 6); sign.needsUpdate = true; });
  for (const ex of [A + 0.4, B - 0.5]) for (const k of [0, 1]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshBasicMaterial({ map: sign, fog: false })); s.position.set(ex + (k ? 0.08 : -0.08), 13.8, 0); s.rotation.y = k ? Math.PI / 2 : -Math.PI / 2; way.add(s); }
}

/* ---------- walking: the hallway, then the gallery ---------- */
{
  const f = worlds.sun.floorH, b = worlds.sun.blocked, bays = GAL.L / GAL.bay;
  const loc = (x, z) => [x - W.x, z - W.z];
  const inWay = (lx, lz) => lx > HWY.A - 3 && lx < 0.6 && Math.abs(lz) < HWY.half + 1;
  const inGal = (lx, lz) => lx > -0.6 && lx < GAL.L + 2 && Math.abs(lz) < GAL.hw + 2;
  worlds.sun.floorH = (x, z) => { const [lx, lz] = loc(x, z); return inWay(lx, lz) || inGal(lx, lz) ? O.y + GAL.y : f(x, z); };
  worlds.sun.blocked = (x, z) => {
    const [lx, lz] = loc(x, z);
    if (inWay(lx, lz)) { if (Math.abs(lz) < HWY.half - 0.75) return false; if (lx < HWY.A - 0.1) return b(x, z); return true; }
    if (inGal(lx, lz)) {
      if (lx < 0.4 && Math.abs(lz) > HWY.half - 0.7) return true;
      if (lx > GAL.L - 1.2 || Math.abs(lz) > GAL.hw - 1.4) return true;
      for (let k = 0; k < ART_BAYS; k++) {
        const x = (k + 0.5) * GAL.bay;
        if (k % 2 === 1 && k < ART_BAYS + 1 - 2) { if (Math.abs(lx - x) < 1.2 && Math.abs(lz) < 1.2) return true; }
        else if (k > 0 && k < ART_BAYS) { if (Math.abs(lx - x) < 1.6 && Math.abs(Math.abs(lz) - 4.6) < 0.7) return true; }
      }
      if (Math.abs(lx - SAL) < 0.8 && Math.abs(lz) > GAL.hw - 2) return true;
      if (Math.hypot(lx - DOME.x, lz) < 3.1) return true;
      for (const ez of [-10, 10]) if (Math.hypot(lx - (GAL.L - 5.4), lz - ez) < 0.8) return true;
      if (Math.hypot(lx - (GAL.L - 5.6), lz + 4.6) < 0.8) return true;
      return false;
    }
    return b(x, z);
  };
}
