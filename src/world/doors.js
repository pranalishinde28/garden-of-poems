import * as THREE from 'three';
import { state } from '../core/state.js';
import { canvasTex } from './textures.js';
import { addTick } from '../core/things.js';
import { player } from '../player/camera.js';

/* ================= doors that swing open as you come to them ================= */
// Used by the castle's gate and the Hall of Mirrors' door out (castleHall.js) and the pagodas (templeInterior.js).
// Each pair hangs in an arched opening and opens inward as you come near, so you get a glimpse of what lies
// beyond before you go through (asked after round 63: "when you go through any door, there should be an action of
// the door opening and a little sneak peek of what's inside").
export const swingDoors = [];
// a pair of doors in an arched opening, w wide, the arch springing at `spring`; hinged at the jambs, opening
// inward (toward the group's -z); near(x, z) says when they should be open
export function makeDoors(group, w, spring, near, wood = '#6a4026', world = 'sun') {
  const r = w / 2;
  const shape = sx => { const sh = new THREE.Shape(); if (sx < 0) { sh.moveTo(0, 0); sh.lineTo(r, 0); sh.lineTo(r, spring + r); sh.absarc(r, spring, r, Math.PI / 2, Math.PI, false); sh.lineTo(0, 0); } else { sh.moveTo(0, 0); sh.lineTo(-r, 0); sh.lineTo(-r, spring + r); sh.absarc(-r, spring, r, Math.PI / 2, 0, true); sh.lineTo(0, 0); } return sh; };
  const woodTex = canvasTex(256, 512, (g, W2, H2) => { g.fillStyle = wood; g.fillRect(0, 0, W2, H2); for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(0,0,0,${0.1 + (i % 2) * 0.08})`; g.fillRect(i * W2 / 6, 0, 3, H2); } g.globalAlpha = 0.18; for (let i = 0; i < 160; i++) { g.strokeStyle = i % 2 ? '#2a160a' : '#a0704a'; g.beginPath(); const x = (i * 37) % W2; g.moveTo(x, 0); g.bezierCurveTo(x + 6, H2 / 3, x - 6, H2 * 2 / 3, x + 3, H2); g.stroke(); } g.globalAlpha = 1; for (const y of [0.18, 0.5, 0.82]) { g.fillStyle = '#2a2420'; g.fillRect(0, y * H2 - 10, W2, 20); for (let x = 12; x < W2; x += 24) { g.fillStyle = '#5a524a'; g.beginPath(); g.arc(x, y * H2, 5, 0, 7); g.fill(); } } }, true);
  const mat = new THREE.MeshLambertMaterial({ map: woodTex, side: THREE.DoubleSide, emissive: '#2a1a10', emissiveIntensity: 0.4 });
  const leaves = [-1, 1].map(sx => {
    const g = new THREE.ExtrudeGeometry(shape(sx), { depth: 0.18, bevelEnabled: false, curveSegments: 16 });
    const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, Math.abs(p.getX(i)) / r, p.getY(i) / (spring + r));
    const hinge = new THREE.Group(); hinge.position.set(sx * r, 0, 0); group.add(hinge);
    const mesh = new THREE.Mesh(g, mat); mesh.position.z = -0.09; hinge.add(mesh);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.035, 6, 16), new THREE.MeshPhongMaterial({ color: '#c9a040', shininess: 80 })); ring.position.set(-sx * (r - 0.45), spring * 0.48, 0.12); hinge.add(ring);
    return { hinge, sx };
  });
  const d = { open: 0, near, leaves, world };
  swingDoors.push(d); return d;
}
addTick(dt => {
  for (const d of swingDoors) {
    if (d.world !== (state.world === 'sun' ? 'sun' : state.world === 'temple' || state.world === 'shrine' ? 'inside' : 'garden')) continue;
    const want = d.near(player.pos.x, player.pos.z) ? 1 : 0;
    if (Math.abs(want - d.open) < 0.001) continue;
    d.open += (want - d.open) * (1 - Math.exp(-dt * (want ? 2.4 : 1.6)));
    const e = d.open * d.open * (3 - 2 * d.open);
    for (const l of d.leaves) l.hinge.rotation.y = -l.sx * e * 1.75;
  }
}, true);
