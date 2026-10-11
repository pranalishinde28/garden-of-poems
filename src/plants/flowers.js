import * as THREE from 'three';
import { C, V3 } from '../core/util.js';
import { DS, GEO, M, part } from '../world/geometry.js';

/* ================= flowers ================= */
export function buildFlower(g, R, color, s, lean, petals = 8) {
  const h = (0.55 + R() * 0.3) * s, bend = lean ? lean * s : (R() - 0.5) * 0.25 * s;
  const curve = new THREE.QuadraticBezierCurve3(new V3(0, 0, 0), new V3(bend * 0.25, h * 0.55, 0), new V3(bend, h, 0));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.012 * s, 5), M('#55703f')));
  const lm = M('#5d7a44', { side: DS });
  for (let i = 0; i < 3; i++) {
    const p = curve.getPoint(0.12 + i * 0.2), lf = part(g, GEO.petal, lm, [p.x, p.y, p.z], [0.2 * s, 0.25 * s, 0.07 * s]);
    lf.rotation.set(0, i * 2.2 + R(), 0.35 + R() * 0.3);
  }
  const head = new THREE.Group(); head.position.copy(curve.getPoint(1)); head.rotation.set(0.25, 0, -bend * 0.7 / s); g.add(head);
  const pm = M(color, { side: DS });
  for (let i = 0; i < petals; i++) {
    const piv = new THREE.Group(); piv.rotation.y = i / petals * Math.PI * 2 + R() * 0.15; head.add(piv);
    part(piv, GEO.petal, pm, [0.015 * s, 0, 0], [0.13 * s, 0.13 * s, (petals > 10 ? 0.07 : 0.13) * s], [0, 0, 0.18 + R() * 0.12]);
  }
  part(head, GEO.sph, M('#e2b74e'), [0, 0.012 * s, 0], [0.032 * s, 0.022 * s, 0.032 * s]);
  return head.position.y;
}
export function flowerColor(p, R, season, opts) {
  if (p.color) return p.color;
  const c = C(opts[Math.floor(R() * opts.length)]);
  if (season === 'winter') c.lerp(C('#f1f3f6'), 0.35);
  if (season === 'autumn') c.lerp(C('#d9a070'), 0.18);
  return '#' + c.getHexString();
}

