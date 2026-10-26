import * as THREE from 'three';
import { POND_R, RIVER, WORLD_R, gorgeLocal, groundH, riverDist } from './terrain.js';
import { POINT_VS_HEAD, pointsMat, scene } from './renderer.js';
import { glowTex } from './textures.js';
import { GEO, M } from './geometry.js';
import { decor, inTulip, regBegin, regEnd } from './paths.js';
import { nightGlow, nightSprites } from '../plants/registry.js';

/* ================= garden lamps ================= */
export const lampGlowU = { uOpacity: { value: 0 } };
regBegin('lamps');
(function buildLamps() {
  const pts = [];
  // only where light is wanted: the path's two ends, around the pond, a ring at the edge, along the
  // stream, and the bench. There used to be about seventy, and they read as a forest of poles.
  pts.push([2.1, 12], [-2.1, 12], [2.4, 35], [-2.4, 35]);
  for (let a = 0.2; a < 6.28; a += Math.PI / 2) pts.push([Math.cos(a) * 11.8, Math.sin(a) * 11.8]);
  for (let a = 0.1; a < 6.28; a += Math.PI / 4) pts.push([Math.cos(a) * 45.6, Math.sin(a) * 45.6]);
  for (let i = 12; i < 80; i += 16) { const p = RIVER[i], q = RIVER[i + 1]; let tx = q.x - p.x, tz = q.z - p.z; const L = Math.hypot(tx, tz); pts.push([p.x + tz / L * 5.5, p.z - tx / L * 5.5]); }
  pts.push([-6.8, 15.4]);
  const ok = pts.filter(([x, z]) => riverDist(x, z) > 3 && !inTulip(x, z, 0.3) && !decor.some(o => o.collide > 0 && Math.hypot(o.x - x, o.z - z) < 0.8) && Math.hypot(x, z) < WORLD_R && Math.hypot(x, z) > POND_R + 1);
  // a ring of lamps all round the boundary, just inside the hedge, so the garden's edge glows at night
  // (not at the gate, the stream or the opening to the gorge)
  for (let k = 0; k < 28; k++) {
    const a = k / 28 * Math.PI * 2 + 0.06, x = Math.cos(a) * 73.6, z = Math.sin(a) * 73.6;
    if ((Math.abs(x) < 6 && z > 0) || riverDist(x, z) < 6 || (x > 50 && Math.abs(gorgeLocal(x, z).across) < 7)) continue;
    ok.push([x, z]);
  }
  const N = ok.length, iron = M('#2c2925');
  const posts = new THREE.InstancedMesh(GEO.cylB, iron, N), bases = new THREE.InstancedMesh(GEO.hexB, iron, N), caps = new THREE.InstancedMesh(GEO.pyr6, iron, N);
  const glassMat = new THREE.MeshLambertMaterial({ color: '#fbe9c6', emissive: '#f3b25e', emissiveIntensity: 0.2 });
  nightGlow.push({ m: glassMat, day: 0.12, night: 1.5 });
  const heads = new THREE.InstancedMesh(GEO.box, glassMat, N);
  const poolMat = new THREE.MeshBasicMaterial({ map: glowTex, color: '#ffc77c', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  nightSprites.push({ s: { material: poolMat }, day: 0, night: 0.38 });
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), poolMat, N);
  const d = new THREE.Object3D(), gp = [];
  ok.forEach(([x, z], i) => {
    const y = groundH(x, z);
    d.rotation.set(0, 0, 0);
    d.position.set(x, y, z); d.scale.set(0.045, 2.15, 0.045); d.updateMatrix(); posts.setMatrixAt(i, d.matrix);
    d.scale.set(0.12, 0.22, 0.12); d.updateMatrix(); bases.setMatrixAt(i, d.matrix);
    d.position.set(x, y + 2.3, z); d.scale.set(0.2, 0.3, 0.2); d.rotation.set(0, Math.PI / 4, 0); d.updateMatrix(); heads.setMatrixAt(i, d.matrix);
    d.position.set(x, y + 2.44, z); d.scale.set(0.24, 0.2, 0.24); d.updateMatrix(); caps.setMatrixAt(i, d.matrix);
    d.rotation.set(0, 0, 0); d.position.set(x, y + 0.06, z); d.scale.set(5.5, 1, 5.5); d.updateMatrix(); pools.setMatrixAt(i, d.matrix);
    gp.push(x, y + 2.3, z);
    decor.push({ x, z, r: 0.4, collide: 0.12 });
  });
  [posts, bases, caps, heads].forEach(m => { m.castShadow = true; m.frustumCulled = false; scene.add(m); });
  pools.frustumCulled = false; scene.add(pools);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
  const pm = pointsMat(lampGlowU, `${POINT_VS_HEAD}void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=min(1.4*uScale/-mv.z,220.);}`,
    'uniform float uOpacity;void main(){float d=length(gl_PointCoord-.5);float a=pow(smoothstep(.5,0.,d),2.2);gl_FragColor=vec4(1.,.82,.55,a*uOpacity);}', true);
  const pts2 = new THREE.Points(g, pm); pts2.frustumCulled = false; scene.add(pts2);
})();

regEnd();
regBegin('fuji');
