import * as THREE from 'three';
import { C, V3 } from '../core/util.js';
import { GEO, Merge } from './geometry.js';

/* ================= temple carpentry: a kit for pagodas, halls, shrines, gates and bell towers ================= */
// Everything a building is made of goes into two merged meshes: the body (vertex colours) and the roof
// (white vertex colours tinted by its material, so winter can whiten every roof at once). One building
// is two draw calls however much detail it has.

export const PAL = {
  red: '#b5442d', redDark: '#8c3423', white: '#e9e2d1', wood: '#7a5a40', hinoki: '#c7a47b', dark: '#3b2d23',
  stone: '#8e8c86', stoneDark: '#76746e', bronze: '#55685e', gold: '#cfa443', green: '#3f6b55', straw: '#d6bf7a',
  paper: '#f7f4ec', ochre: '#e3c77a', black: '#2c2a28',
};
const E = new THREE.Euler();
// turn about y first, then tilt: a rafter yawed to its side still pitches down along its length
const quat = (rx, ry, rz) => new THREE.Quaternion().setFromEuler(E.set(rx || 0, ry || 0, rz || 0, 'YXZ'));
const one = new V3(1, 1, 1);

// roofs share a few materials so the seasons can whiten them together (setRoofSeason)
const roofMats = [];
export function roofMat(base, fog = true) { const m = nightLit(new THREE.MeshLambertMaterial({ vertexColors: true, color: base, fog }), 0.45); m.userData.base = base; roofMats.push(m); return m; }

// after dark the buildings are lit as temples are: a warm light washing up from their base, fading higher up
// (world/nightLights.js sets archNightU from the light, and makes the stone lanterns glow)
export const archNightU = { value: 0 }, archLights = [];
export function nightLit(mat, k = 1) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uArchNight = archNightU;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vLy;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLy=position.y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uArchNight;varying float vLy;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance+=diffuseColor.rgb*vec3(1.,.7,.42)*uArchNight*${k.toFixed(2)}*(.2+.95*exp(-max(vLy,0.)/3.4));`);
  };
  mat.customProgramCacheKey = () => 'archnight' + k;
  return mat;
}
export function setRoofSeason(season) { roofMats.forEach(m => m.color.set(season === 'winter' ? '#e4e9ee' : m.userData.base)); }

export class Kit {
  // o: an origin added to every part, for building one piece of a site off its centre
  constructor() { this.body = new Merge(); this.roof = new Merge(); this.o = new V3(); this.lights = []; }
  at(x, y, z) { return new V3(x, y, z).add(this.o); }
  box(w, h, d, x, y, z, col, ry = 0, rx = 0, rz = 0) { this.body.add(GEO.box, this.at(x, y, z), new V3(w, h, d), C(col), quat(rx, ry, rz)); }
  // a cylinder standing on (x, y, z)
  post(r, h, x, y, z, col, r1 = r) { this.body.add(r1 === r ? GEO.cylB : new THREE.CylinderGeometry(r1, r, h, 10).translate(0, h / 2, 0), this.at(x, y, z), r1 === r ? new V3(r, h, r) : one, C(col)); }
  geo(g, x, y, z, col, s = one, ry = 0, rx = 0, rz = 0, roof = false) { (roof ? this.roof : this.body).add(g, this.at(x, y, z), s, C(col), quat(rx, ry, rz)); }
  limb(a, b, r0, r1, col, roof = false) { (roof ? this.roof : this.body).limb(a.clone().add(this.o), b.clone().add(this.o), r0, r1, C(col)); }
  rbox(w, h, d, x, y, z, shade = '#ffffff', ry = 0, rx = 0, rz = 0) { this.roof.add(GEO.box, this.at(x, y, z), new V3(w, h, d), C(shade), quat(rx, ry, rz)); }
  build(group, bodyMat, roofMat) {
    const out = [];
    for (const [m, mat] of [[this.body, bodyMat], [this.roof, roofMat]]) { const g = m.build(); if (!g) continue; const mesh = new THREE.Mesh(g, mat); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); out.push(mesh); }
    if (this.lights.length) archLights.push({ group, lights: this.lights });
    return out;
  }
}

// a hip roof W wide and D deep (at the eaves), H high, with a concave sweep and corners that turn up
export function hipRoof(W, D, H, up, top = 0.12, th = 0.16) {
  const prof = [[0, 0], [1, 0], [1, th], [0.86, th + H * 0.16], [0.6, th + H * 0.5], [0.34, th + H * 0.82], [top, H], [0, H]];
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 32), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z); if (r < 1e-5) continue;
    const a = Math.atan2(z, x), k = 1 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
    const lift = up * Math.pow((k - 1) / (Math.SQRT2 - 1), 2.2) * Math.pow(Math.max(0, (r - 0.5) / 0.5), 2);
    p.setXYZ(i, x * k * W / 2, p.getY(i) + lift, z * k * D / 2);
  }
  g.computeVertexNormals(); return g;
}
// the four hip ridges and their end tiles, from near the top down to the lifted corners
function hipRidges(kit, W, D, H, up, y, th = 0.16) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const a = new V3(sx * W * 0.1, y + H * 0.92, sz * D * 0.1), b = new V3(sx * W / 2 * 0.97, y + th + up * 0.95, sz * D / 2 * 0.97);
    kit.limb(a, b, 0.07, 0.06, '#c9c9c9', true);
    kit.rbox(0.22, 0.2, 0.22, b.x, b.y + 0.08, b.z, '#bdbdbd', Math.atan2(sx, sz));
  }
}
// bracket sets (tokyō) stepping out from a w × d wall top at height y
export function brackets(kit, w, d, y, tiers = 3, col = PAL.red) {
  for (let f = 0; f < 4; f++) {
    const a = f * Math.PI / 2, nx = Math.sin(a), nz = Math.cos(a), half = f % 2 ? w / 2 : d / 2, span = f % 2 ? d : w;
    for (const u of [-0.5, -1 / 6, 1 / 6, 0.5]) {
      const tx = nz, tz = -nx, px = tx * u * span, pz = tz * u * span;
      for (let t = 0; t < tiers; t++) {
        const o = half + 0.05 + t * 0.2, yy = y + 0.08 + t * 0.16;
        kit.box(0.17, 0.11, 0.17, px + nx * o, yy, pz + nz * o, col);
        kit.box(0.11, 0.08, 0.46, px + nx * (o + 0.08), yy + 0.08, pz + nz * (o + 0.08), col, a);
      }
    }
  }
}
// two layers of rafters from the wall line to the eave, their ends painted
export function rafters(kit, w, d, y, W, D, col = PAL.redDark, tip = PAL.ochre) {
  for (let f = 0; f < 4; f++) {
    const a = f * Math.PI / 2, nx = Math.sin(a), nz = Math.cos(a), half = f % 2 ? w / 2 : d / 2, eave = f % 2 ? W / 2 : D / 2, span = f % 2 ? D : W;
    const n = Math.max(6, Math.round(span / 0.26)), L = eave - half;
    for (let layer = 0; layer < 2; layer++) {
      const len = L * (layer ? 0.98 : 0.8), yy = y + layer * 0.12;
      for (let i = 0; i <= n; i++) {
        const u = (i / n - 0.5) * span * (layer ? 0.98 : 0.9), tx = nz, tz = -nx, mid = half + len / 2;
        kit.box(0.075, 0.075, len, tx * u + nx * mid, yy, tz * u + nz * mid, col, a, 0.12);
        kit.box(0.08, 0.08, 0.02, tx * u + nx * (half + len), yy - len * 0.06, tz * u + nz * (half + len), tip, a, 0.12);
      }
    }
  }
}
// a balcony railing (kōran) around a w × d floor at height y
export function railing(kit, w, d, y, col = PAL.red, open = null) {
  for (let f = 0; f < 4; f++) {
    const a = f * Math.PI / 2, nx = Math.sin(a), nz = Math.cos(a), half = f % 2 ? w / 2 : d / 2, span = f % 2 ? d : w, tx = nz, tz = -nx;
    const n = Math.max(3, Math.round(span / 0.5));
    for (let i = 0; i <= n; i++) { const u = (i / n - 0.5) * span; if (open === f && Math.abs(u) < 0.7) continue; kit.box(0.07, 0.55, 0.07, tx * u + nx * half, y + 0.27, tz * u + nz * half, col); }
    for (const [hh, th] of [[0.5, 0.07], [0.22, 0.05]]) {
      if (open === f) { for (const s of [-1, 1]) { const seg = span / 2 - 0.7, c = s * (0.7 + seg / 2); kit.box(seg, th, 0.07, tx * c + nx * half, y + hh, tz * c + nz * half, col, a + Math.PI / 2); } }
      else kit.box(span, th, 0.07, nx * half, y + hh, nz * half, col, a + Math.PI / 2);
    }
  }
}
// the storey of a pagoda or a hall: walls, posts, doors and lattice windows, brackets, rafters, roof
export function storey(kit, w, d, y, bh, roofW, roofD, rh, up, o = {}) {
  const red = o.red || PAL.red;
  kit.box(w * 0.98, bh, d * 0.98, 0, y + bh / 2, 0, o.wall || PAL.white);
  kit.box(w * 1.02, 0.22, d * 1.02, 0, y + bh - 0.11, 0, red); kit.box(w * 1.02, 0.14, d * 1.02, 0, y + 0.07, 0, red);
  for (let f = 0; f < 4; f++) {
    const a = f * Math.PI / 2, nx = Math.sin(a), nz = Math.cos(a), half = f % 2 ? w / 2 : d / 2, span = f % 2 ? d : w, tx = nz, tz = -nx;
    for (const u of [-0.5, -1 / 6, 1 / 6, 0.5]) kit.box(0.17, bh, 0.17, tx * u * span + nx * half, y + bh / 2, tz * u * span + nz * half, red);
    if (o.doors !== false) {
      kit.box(span * 0.22, bh * 0.66, 0.05, nx * (half + 0.03), y + bh * 0.4, nz * (half + 0.03), o.door || '#6a2b1d', a);
      kit.box(span * 0.22, 0.04, 0.07, nx * (half + 0.04), y + bh * 0.42, nz * (half + 0.04), PAL.gold, a);
      // lattice windows either side of the door
      for (const s of [-1, 1]) {
        const c = s * span * 0.32;
        kit.box(span * 0.17, 0.05, 0.06, tx * c + nx * (half + 0.03), y + bh * 0.72, tz * c + nz * (half + 0.03), red, a);
        kit.box(span * 0.17, 0.05, 0.06, tx * c + nx * (half + 0.03), y + bh * 0.3, tz * c + nz * (half + 0.03), red, a);
        for (let j = -2; j <= 2; j++) kit.box(0.035, bh * 0.42, 0.05, tx * (c + j * span * 0.032) + nx * (half + 0.035), y + bh * 0.51, tz * (c + j * span * 0.032) + nz * (half + 0.035), PAL.green, a);
      }
    }
  }
  brackets(kit, w, d, y + bh - 0.05, o.tiers ?? 3, red);
  const ry = y + bh + 0.08 + (o.tiers ?? 3) * 0.16;
  rafters(kit, w, d, ry, roofW * 0.97, roofD * 0.97, o.rafter || PAL.redDark);
  kit.geo(hipRoof(roofW, roofD, rh, up), 0, ry + 0.1, 0, '#ffffff', one, 0, 0, 0, true);
  hipRidges(kit, roofW, roofD, rh, up, ry + 0.1);
  // wind bells at the four corners
  if (o.bells !== false) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const cx = sx * roofW / 2 * 0.95, cz = sz * roofD / 2 * 0.95, cy = ry + 0.1 + up * 0.85;
    kit.limb(new V3(cx, cy, cz), new V3(cx, cy - 0.32, cz), 0.015, 0.015, PAL.bronze);
    kit.post(0.07, 0.16, cx, cy - 0.5, cz, PAL.bronze, 0.04);
  }
  return ry + 0.1; // where the roof begins
}

// the sōrin: the bronze spire with its nine rings, water flame and jewel
export function sorin(kit, y, s = 1) {
  kit.box(0.95 * s, 0.32 * s, 0.95 * s, 0, y + 0.16 * s, 0, PAL.bronze);
  kit.geo(GEO.half, 0, y + 0.32 * s, 0, PAL.bronze, new V3(0.44 * s, 0.3 * s, 0.44 * s));
  kit.post(0.3 * s, 0.24 * s, 0, y + 0.6 * s, 0, PAL.bronze, 0.46 * s);
  kit.post(0.07 * s, 4.9 * s, 0, y + 0.6 * s, 0, PAL.bronze);
  const ring = new THREE.TorusGeometry(1, 0.13, 6, 18).rotateX(Math.PI / 2);
  for (let k = 0; k < 9; k++) { const r = (0.4 - k * 0.016) * s; kit.geo(ring, 0, y + (1.05 + k * 0.36) * s, 0, PAL.bronze, new V3(r, r, r)); }
  for (let k = 0; k < 4; k++) kit.box(0.5 * s, 0.75 * s, 0.03 * s, 0, y + 4.55 * s, 0, PAL.bronze, k * Math.PI / 4);
  kit.geo(GEO.sph, 0, y + 5.1 * s, 0, PAL.bronze, new V3(0.13 * s, 0.13 * s, 0.13 * s));
  kit.geo(GEO.sph, 0, y + 5.35 * s, 0, PAL.gold, new V3(0.11 * s, 0.17 * s, 0.11 * s));
}

// a pagoda of n storeys on a stone platform with steps
export function pagoda(kit, n = 3, base = 5.2, o = {}) {
  const shrink = o.shrink || 0.84, P = base * 1.75;
  kit.box(P, 0.9, P, 0, 0.45, 0, PAL.stone); kit.box(P + 0.3, 0.12, P + 0.3, 0, 0.9, 0, PAL.stoneDark);
  for (let f = 0; f < 4; f++) { const a = f * Math.PI / 2; for (let s = 0; s < 3; s++) { const sh = 0.3 * (s + 1), o = P / 2 + 0.19 + (2 - s) * 0.38; kit.box(1.8, sh, 0.38, Math.sin(a) * o, sh / 2, Math.cos(a) * o, PAL.stoneDark, a); } }
  let y = 0.96;
  for (let i = 0; i < n; i++) {
    const w = base * Math.pow(shrink, i), bh = i === 0 ? (o.h0 || 2.7) : (o.h || 2.0), R = w * 1.7, rh = 0.85 + w * 0.09, up = 0.42 + w * 0.06;
    if (i > 0) { kit.box(w * 1.3, 0.14, w * 1.3, 0, y + 0.07, 0, PAL.redDark); railing(kit, w * 1.26, w * 1.26, y + 0.14); }
    else { kit.box(w * 1.36, 0.18, w * 1.36, 0, y + 0.09, 0, PAL.wood); }
    const roofY = storey(kit, w, w, y + (i > 0 ? 0.14 : 0.18), bh, R, R, rh, up, o);
    y = roofY + rh * 0.5;
  }
  sorin(kit, y + 0.1, o.spire || 1);
  return y;
}

// a myōjin torii: leaning pillars, a black kasagi with upturned ends, the nuki, the plaque
export function torii(kit, span = 3.6, h = 4.2, z = 0, col = PAL.red) {
  for (const sx of [-1, 1]) {
    kit.limb(new V3(sx * span / 2 * 1.04, 0, z), new V3(sx * span / 2 * 0.98, h, z), 0.17, 0.15, col);
    kit.post(0.25, 0.32, sx * span / 2 * 1.04, 0, z, PAL.black, 0.22);
  }
  kit.box(span * 1.18, 0.2, 0.26, 0, h * 0.78, z, col); // nuki
  kit.box(span * 1.36, 0.24, 0.34, 0, h + 0.02, z, col); // shimaki
  kit.box(span * 1.42, 0.2, 0.44, 0, h + 0.24, z, PAL.black); // kasagi
  for (const sx of [-1, 1]) kit.box(0.7, 0.18, 0.44, sx * span * 0.8, h + 0.33, z, PAL.black, 0, 0, -sx * 0.22);
  kit.box(0.2, h * 0.2, 0.18, 0, h * 0.89, z, col); // gakuzuka
  kit.box(0.62, 0.8, 0.1, 0, h * 0.89, z + 0.1, PAL.black); kit.box(0.5, 0.68, 0.11, 0, h * 0.89, z + 0.1, PAL.gold);
}

// a stone lantern (tōrō) for a kit: base, shaft, firebox, roof and jewel
export function lantern(kit, x, z, s = 1) {
  kit.post(0.32 * s, 0.16 * s, x, 0, z, PAL.stoneDark); kit.post(0.11 * s, 0.8 * s, x, 0.16 * s, z, PAL.stone);
  kit.box(0.5 * s, 0.12 * s, 0.5 * s, x, 1.0 * s, z, PAL.stone); kit.box(0.34 * s, 0.32 * s, 0.34 * s, x, 1.22 * s, z, '#d9c48f');
  kit.lights.push({ p: kit.at(x, 1.22 * s, z), s });
  kit.geo(GEO.pyr, x, 1.38 * s, z, PAL.stoneDark, new V3(0.52 * s, 0.3 * s, 0.52 * s), Math.PI / 4);
  kit.geo(GEO.sph, x, 1.72 * s, z, PAL.stone, new V3(0.07 * s, 0.09 * s, 0.07 * s));
}
