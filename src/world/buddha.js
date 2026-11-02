import * as THREE from 'three';

/* ================= the seated Buddha, sculpted from a distance field ================= */
// Modelled after public photographs of Thai gilded Buddhas (the Wat Arun ubosot, Bangkok): seated with the
// right leg over the left, the right hand over the knee touching the earth (bhumisparsha), the left in
// the lap, the sash over the left shoulder, long earlobes, curls, the ushnisha and its flame. The figure
// is a smooth union of rounded shapes (a signed distance field), meshed once with surface nets.
// Unit height: the crossed legs sit on y = 0, the top of the head is near y = 0.9, facing +z.

const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const smax = (a, b, k) => -smin(-a, -b, k);
function ell(x, y, z, cx, cy, cz, rx, ry, rz) {
  const px = (x - cx) / rx, py = (y - cy) / ry, pz = (z - cz) / rz, k0 = Math.sqrt(px * px + py * py + pz * pz);
  const qx = px / rx, qy = py / ry, qz = pz / rz, k1 = Math.sqrt(qx * qx + qy * qy + qz * qz);
  return k1 < 1e-9 ? -Math.min(rx, ry, rz) : k0 * (k0 - 1) / k1;
}
// a capsule whose radius runs from r0 at a to r1 at b
function cone(x, y, z, a, b, r0, r1) {
  const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2], px = x - a[0], py = y - a[1], pz = z - a[2];
  const t = Math.max(0, Math.min(1, (px * bx + py * by + pz * bz) / (bx * bx + by * by + bz * bz)));
  const dx = px - bx * t, dy = py - by * t, dz = pz - bz * t;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - (r0 + (r1 - r0) * t);
}

export function seatedSDF(x, y, z) {
  // the folded legs: thighs, shins (right over left), the right sole upturned on the left thigh, the lap
  let d = ell(x, y, z, 0, 0.075, 0.05, 0.47, 0.078, 0.25);
  d = smin(d, cone(x, y, z, [-0.1, 0.12, -0.02], [-0.42, 0.085, 0.12], 0.115, 0.08), 0.06);
  d = smin(d, cone(x, y, z, [0.1, 0.12, -0.02], [0.42, 0.085, 0.12], 0.115, 0.08), 0.06);
  d = smin(d, cone(x, y, z, [0.42, 0.08, 0.13], [-0.14, 0.07, 0.23], 0.075, 0.05), 0.04);
  d = smin(d, cone(x, y, z, [-0.42, 0.095, 0.13], [0.16, 0.14, 0.2], 0.078, 0.05), 0.035);
  d = smin(d, ell(x, y, z, 0.26, 0.155, 0.17, 0.1, 0.028, 0.045), 0.03);
  d = smin(d, ell(x, y, z, 0, 0.055, 0.27, 0.09, 0.055, 0.025), 0.04); // the robe's fan between the knees
  // the body
  d = smin(d, ell(x, y, z, 0, 0.17, -0.02, 0.19, 0.1, 0.14), 0.06);
  d = smin(d, ell(x, y, z, 0, 0.3, -0.01, 0.152, 0.12, 0.108), 0.07);
  d = smin(d, ell(x, y, z, 0, 0.43, 0, 0.198, 0.13, 0.118), 0.07);
  d = smin(d, cone(x, y, z, [-0.17, 0.495, -0.01], [0.17, 0.495, -0.01], 0.074, 0.074), 0.06);
  d = smin(d, cone(x, y, z, [0, 0.52, 0], [0, 0.64, 0.006], 0.05, 0.047), 0.04);
  // the robe's edge across the chest and the sash falling from the left shoulder
  d = smin(d, cone(x, y, z, [-0.15, 0.405, 0.105], [0.13, 0.525, 0.065], 0.009, 0.009), 0.012);
  d = smin(d, cone(x, y, z, [0.1, 0.535, 0.075], [0.035, 0.27, 0.115], 0.022, 0.018), 0.02);
  // arms: the right over the knee, fingers to the earth; the left resting in the lap
  d = smin(d, cone(x, y, z, [-0.2, 0.49, -0.01], [-0.265, 0.31, 0.05], 0.062, 0.046), 0.04);
  d = smin(d, cone(x, y, z, [-0.265, 0.31, 0.05], [-0.33, 0.17, 0.25], 0.046, 0.032), 0.025);
  d = smin(d, cone(x, y, z, [-0.33, 0.17, 0.25], [-0.338, 0.115, 0.29], 0.032, 0.026), 0.02);
  for (let f = 0; f < 4; f++) { const fx = -0.36 + f * 0.016; d = smin(d, cone(x, y, z, [fx, 0.12, 0.288], [fx + 0.002, 0.04 + f * 0.004, 0.312], 0.0095, 0.008), 0.008); }
  d = smin(d, cone(x, y, z, [0.2, 0.49, -0.01], [0.255, 0.29, 0.04], 0.062, 0.046), 0.04);
  d = smin(d, cone(x, y, z, [0.255, 0.29, 0.04], [0.1, 0.172, 0.15], 0.046, 0.032), 0.03);
  d = smin(d, ell(x, y, z, 0.02, 0.158, 0.16, 0.078, 0.021, 0.05), 0.025);
  // the head: an oval face, a pointed chin, brows, nose and lips, long ears
  let h = ell(x, y, z, 0, 0.735, 0.01, 0.088, 0.116, 0.1);
  h = smin(h, ell(x, y, z, 0, 0.657, 0.05, 0.043, 0.036, 0.042), 0.03);
  h = smin(h, cone(x, y, z, [0, 0.758, 0.1], [0, 0.71, 0.114], 0.011, 0.016), 0.01);
  for (const s of [-1, 1]) {
    h = smin(h, cone(x, y, z, [s * 0.008, 0.758, 0.1], [s * 0.062, 0.764, 0.08], 0.009, 0.007), 0.01);
    h = smin(h, ell(x, y, z, s * 0.094, 0.75, 0.0, 0.014, 0.045, 0.03), 0.012);
    h = smin(h, ell(x, y, z, s * 0.1, 0.665, 0.012, 0.013, 0.036, 0.02), 0.014);
    h = smax(h, -ell(x, y, z, s * 0.034, 0.736, 0.1, 0.024, 0.0055, 0.012), 0.006); // downcast eyes
  }
  h = smin(h, ell(x, y, z, 0, 0.684, 0.098, 0.023, 0.009, 0.011), 0.008);
  h = smax(h, -ell(x, y, z, 0, 0.684, 0.108, 0.02, 0.0025, 0.01), 0.004);
  // the ushnisha, and a scalp of small curls above the hairline
  h = smin(h, ell(x, y, z, 0, 0.848, 0, 0.066, 0.052, 0.066), 0.03);
  const hair = Math.max(0, Math.min(1, (y - 0.785 + Math.max(0, -z) * 0.9 - Math.max(0, z - 0.05) * 0.4) / 0.015));
  if (hair > 0) h -= hair * 0.0045 * (Math.sin(x * 120) * Math.sin(y * 120 + 1.3) * Math.sin(z * 120 + 0.7) + 0.35);
  return smin(d, h, 0.03);
}

// a disciple standing with hands joined (unit height: feet at 0, head near 1)
export function standingSDF(x, y, z) {
  let d = cone(x, y, z, [0, 0.02, 0], [0, 0.55, 0], 0.13, 0.12); // the robe falling to the feet
  d = smin(d, ell(x, y, z, 0, 0.62, 0, 0.135, 0.13, 0.085), 0.06);
  d = smin(d, cone(x, y, z, [-0.11, 0.73, 0], [0.11, 0.73, 0], 0.05, 0.05), 0.04);
  d = smin(d, cone(x, y, z, [0, 0.74, 0], [0, 0.82, 0.004], 0.033, 0.03), 0.03);
  d = smin(d, ell(x, y, z, 0, 0.885, 0.008, 0.058, 0.075, 0.066), 0.03);
  d = smin(d, ell(x, y, z, 0, 0.958, 0, 0.035, 0.03, 0.035), 0.02);
  d = smin(d, cone(x, y, z, [0, 0.02, 0.06], [0, 0.07, 0.13], 0.03, 0.03), 0.03); // toes under the hem
  for (const s of [-1, 1]) {
    d = smin(d, cone(x, y, z, [s * 0.13, 0.72, 0], [s * 0.12, 0.57, 0.05], 0.042, 0.034), 0.03);
    d = smin(d, cone(x, y, z, [s * 0.12, 0.57, 0.05], [s * 0.012, 0.64, 0.12], 0.032, 0.022), 0.03);
    d = smin(d, ell(x, y, z, s * 0.062, 0.89, 0.0, 0.01, 0.04, 0.02), 0.01);
  }
  d = smin(d, ell(x, y, z, 0, 0.68, 0.125, 0.022, 0.06, 0.018), 0.02); // palms together
  return d;
}

// surface nets: one vertex per cell that the surface crosses, a quad across every crossed grid edge
export function meshSDF(f, min, max, h) {
  const nx = Math.ceil((max[0] - min[0]) / h) + 1, ny = Math.ceil((max[1] - min[1]) / h) + 1, nz = Math.ceil((max[2] - min[2]) / h) + 1;
  const sx = 1, sy = nx, sz = nx * ny, F = new Float32Array(nx * ny * nz);
  // blocks of 4³ far from the surface take their centre's value; only blocks near it are sampled finely
  const B = 4, far = h * 6;
  for (let K = 0; K < nz; K += B) for (let J = 0; J < ny; J += B) for (let I = 0; I < nx; I += B) {
    const c = f(min[0] + (I + 1.5) * h, min[1] + (J + 1.5) * h, min[2] + (K + 1.5) * h), fine = Math.abs(c) < far;
    for (let k = K; k < Math.min(nz, K + B); k++) for (let j = J; j < Math.min(ny, J + B); j++) for (let i = I; i < Math.min(nx, I + B); i++)
      F[i + j * sy + k * sz] = fine ? f(min[0] + i * h, min[1] + j * h, min[2] + k * h) : c;
  }
  const cell = new Int32Array(nx * ny * nz).fill(-1), pos = [];
  const C = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const v = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const n = i + j * sy + k * sz; let mask = 0;
    for (let c = 0; c < 8; c++) { v[c] = F[n + C[c][0] * sx + C[c][1] * sy + C[c][2] * sz]; if (v[c] < 0) mask |= 1 << c; }
    if (mask === 0 || mask === 255) continue;
    let ax = 0, ay = 0, az = 0, m = 0;
    for (const [a, b] of E) {
      if ((v[a] < 0) === (v[b] < 0)) continue;
      const t = v[a] / (v[a] - v[b]); ax += C[a][0] + (C[b][0] - C[a][0]) * t; ay += C[a][1] + (C[b][1] - C[a][1]) * t; az += C[a][2] + (C[b][2] - C[a][2]) * t; m++;
    }
    cell[n] = pos.length / 3; pos.push(min[0] + (i + ax / m) * h, min[1] + (j + ay / m) * h, min[2] + (k + az / m) * h);
  }
  const idx = [];
  const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d); };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const n = i + j * sy + k * sz, inside = F[n] < 0;
    if (inside !== (F[n + sx] < 0)) quad(cell[n], cell[n - sy], cell[n - sy - sz], cell[n - sz], !inside);
    if (inside !== (F[n + sy] < 0)) quad(cell[n], cell[n - sz], cell[n - sx - sz], cell[n - sx], !inside);
    if (inside !== (F[n + sz] < 0)) quad(cell[n], cell[n - sx], cell[n - sx - sy], cell[n - sy], !inside);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

let seated = null, standing = null;
export const seatedBuddha = () => seated || (seated = meshSDF(seatedSDF, [-0.56, -0.01, -0.2], [0.56, 0.93, 0.36], 0.0062));
export const standingDisciple = () => standing || (standing = meshSDF(standingSDF, [-0.2, -0.01, -0.13], [0.2, 1.0, 0.2], 0.008));
