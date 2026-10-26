import { $, V3, clamp } from '../core/util.js';
import { state, T } from '../core/state.js';
import { camera } from '../world/renderer.js';
import { GORGE, JETTY, gorgeWorld } from '../world/terrain.js';
import { CAVE, boatWater, caveDepth, myBoat } from '../world/gorge.js';
import { camTween, curLook, floorH, player, syncPlayerFromCamera } from '../player/camera.js';
import { jv, keys, isTyping } from './input.js';
import { setCue } from './helpers.js';
import { late, provide } from '../core/late.js';

provide({ get rowBoat() { return rowBoat; }, get updateBoat() { return updateBoat; }, get mooreBoat() { return moor; } });

/* ================= rowing a boat in Takachiho Gorge ================= */
// From the jetty you take your own boat out: W (or ↑) rows, S backs water, A and D turn; on a phone the
// joystick does the same. Drag to look about; V sees yourself in the boat. Row through Manai Falls into the
// cave behind it and the light at its end carries you on to the Sunflower Garden (ui/worlds.js).
// "Step ashore" (or Esc) brings you back to the jetty.
const pill = $('#boatui'), B = myBoat, FLOOR = GORGE.floor;
let vel = 0, spin = 0, stroke = 0, wet = 0, leaving = false;
const fwd = () => new V3(Math.sin(B.yaw), 0, Math.cos(B.yaw));
state.boat = null;

function rowBoat() {
  if (state.mode !== 'walk' || !B.moored) return;
  late.closePops(); setCue(null);
  B.moored = false; vel = 0; spin = 0; leaving = false;
  state.boat = { yaw: B.yaw, seat: B.pos.clone() };
  state.mode = 'cinematic';
  // step down into the boat
  const eye = seatEye(), look = eye.clone().addScaledVector(fwd(), 8).setY(eye.y - 0.3);
  camTween(eye, look, 1.6, () => { player.yaw = B.yaw + Math.PI; player.pitch = -0.04; state.mode = 'boat'; });
  pill.hidden = false; requestAnimationFrame(() => pill.classList.add('show'));
}
const seatEye = () => B.pos.clone().addScaledVector(fwd(), -0.15).setY(FLOOR + 1.12);

function updateBoat(dt) {
  let ix = 0, iz = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) iz += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) iz -= 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
  ix += jv.x; iz += jv.y; ix = clamp(ix, -1, 1); iz = clamp(iz, -1, 1);
  // a rowing boat gathers way slowly and glides on; turning is easier when it is moving
  vel += (iz * (iz > 0 ? 2.3 : 1.1) - vel) * (1 - Math.exp(-dt * (iz ? 0.9 : 0.35)));
  spin += (-ix * 0.75 - spin) * (1 - Math.exp(-dt * 2.5));
  const dy = spin * dt * (0.45 + Math.min(1, Math.abs(vel) / 1.5)); B.yaw += dy; player.yaw += dy;
  const f = fwd(), next = B.pos.clone().addScaledVector(f, vel * dt);
  if (boatWater(next.x, next.z)) B.pos.copy(next);
  else {
    // a soft bump against rock or shore: try sliding along it, else stop
    const side = new V3(f.z, 0, -f.x), a = B.pos.clone().addScaledVector(side, 0.35 * dt * 3), b = B.pos.clone().addScaledVector(side, -0.35 * dt * 3);
    if (boatWater(a.x, a.z)) B.pos.copy(a); else if (boatWater(b.x, b.z)) B.pos.copy(b);
    vel *= -0.2;
  }
  // the boat on the water: a slow bob, a roll as it turns, the oars sweeping while you row
  const rowing = Math.abs(iz) > 0.1; stroke += dt * (rowing ? 2.6 : 0);
  const sw = Math.sin(stroke), lift = Math.max(0, Math.cos(stroke));
  B.oars.forEach((o, k) => { const sx = k ? -1 : 1; o.rotation.set(0, sx * (rowing ? sw * 0.55 : 0.5) * (iz < 0 ? -1 : 1), sx * -(rowing ? 0.12 + lift * 0.28 : 0.35)); });
  const bob = Math.sin(T * 1.3) * 0.03;
  B.pos.y = FLOOR - 0.12 + bob; B.g.position.copy(B.pos); B.g.rotation.set(Math.sin(T * 0.8) * 0.012, B.yaw, Math.sin(T * 0.9) * 0.02 - spin * 0.05);
  state.boat.yaw = B.yaw; state.boat.seat.copy(B.pos).addScaledVector(f, -0.1).setY(B.pos.y + 0.32);
  // the camera: in your seat, or behind the boat
  if (state.thirdPerson) {
    const p = B.pos.clone().addScaledVector(f, -5.2).setY(FLOOR + 2.3);
    camera.position.lerp(p, 1 - Math.exp(-dt * 4)); curLook.copy(B.pos).addScaledVector(f, 5).setY(FLOOR + 1.1); camera.lookAt(curLook);
  } else {
    camera.position.copy(seatEye()).setY(FLOOR + 1.12 + bob);
    camera.rotation.set(player.pitch, player.yaw, Math.sin(T * 0.9) * 0.012 - spin * 0.02);
    curLook.copy(camera.position).add(new V3(-Math.sin(player.yaw), Math.sin(player.pitch), -Math.cos(player.yaw)));
  }
  // passing through the falls: a moment of white spray
  const d = caveDepth(B.pos.x, B.pos.z), curtain = d > -2.6 && d < -0.4;
  wet = Math.max(wet - dt * 1.4, curtain ? 0.75 : 0);
  late.setVeil && late.setVeil(wet, 'spray');
  // the light at the end of the cave
  if (d > CAVE.depth - 3.2 && !leaving) { leaving = true; late.enterSunWorld && late.enterSunWorld(); }
}

// tie the boat up again at the jetty (also when you come back from the other world)
function moor() { B.pos.copy(B.home); B.yaw = B.homeYaw; B.g.position.copy(B.home); B.g.rotation.set(0, B.yaw, 0); B.moored = true; state.boat = null; vel = 0; leaving = false; hide(); }
function hide() { pill.classList.remove('show'); setTimeout(() => { if (!pill.classList.contains('show')) pill.hidden = true; }, 500); }

function stepAshore() {
  if (state.mode !== 'boat') return;
  hide(); late.setVeil && late.setVeil(0, 'spray');
  state.mode = 'cinematic';
  const to = gorgeWorld(JETTY.u0 + 1.2, 0); to.y = floorH(to.x, to.z) + 1.6;
  camTween(to, gorgeWorld(JETTY.u0 - 10, 0, to.y), 2.2, () => { moor(); state.mode = 'walk'; syncPlayerFromCamera(); });
}
$('#bt-ashore').onclick = stepAshore;
addEventListener('keydown', e => {
  if (state.mode !== 'boat' || isTyping(e)) return;
  if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); stepAshore(); }
  else if (e.code === 'KeyV' && !e.repeat) { late.toggleView && late.toggleView(); }
  else if (/^(Arrow|Space)/.test(e.code)) e.preventDefault();
}, true);
