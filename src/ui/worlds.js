import { $, V3 } from '../core/util.js';
import { addTick } from '../core/things.js';
import { isTyping, jv, keys } from './input.js';
import { castleFront, hallArrive, showHall } from '../world/castleHall.js';
import { state } from '../core/state.js';
import { camera, renderer, scene, view } from '../world/renderer.js';
import { worlds } from '../core/worlds.js';
import { LOOKOUT } from '../world/gorge.js';
import { curLook, floorH, player } from '../player/camera.js';
import { moveFigureTo } from '../player/figure.js';
import { setCue, showRegion, toast } from './helpers.js';
import { late, provide } from '../core/late.js';

provide({ get hopTo() { return hopTo; }, get enterHallFromMap() { return enterHallFromMap; }, get enterHall() { return enterHall; }, get leaveHall() { return leaveHall; }, get startRide() { return startRide; }, get enterSunWorld() { return enterSunWorld; }, get leaveSunWorld() { return leaveSunWorld; }, get setVeil() { return setVeil; } });

/* ================= between worlds ================= */
// Rowing into the light at the end of the cave behind Manai Falls carries you to the Sunflower Garden;
// opening its white door brings you home to the lookout. Each crossing is a slow fade through white.
const veil = $('#veil'), spray = $('#spray');
// a moment of spray as the boat passes through a waterfall
export function setVeil(k) { spray.style.opacity = String(Math.max(0, Math.min(1, k))); }

function place(pos, yaw) {
  player.pos.set(pos.x, 0, pos.z); player.yaw = yaw; player.pitch = -0.03; player.vel.set(0, 0, 0); player.alt = 0; player.vy = 0;
  player.eyeY = floorH(pos.x, pos.z) + 1.6;
  camera.position.set(pos.x, player.eyeY, pos.z); camera.rotation.set(player.pitch, yaw, 0);
  curLook.copy(camera.position).add({ x: -Math.sin(yaw), y: 0, z: -Math.cos(yaw) });
}
function cross(words, swap, after) {
  state.mode = 'cinematic'; setCue(null);
  veil.querySelector('.t').textContent = words; veil.hidden = false;
  requestAnimationFrame(() => veil.classList.add('on'));
  setTimeout(() => {
    swap(); state.mode = 'walk';
    setTimeout(() => { veil.classList.remove('on'); setTimeout(() => { if (!veil.classList.contains('on')) veil.hidden = true; }, 1800); after && after(); }, 500);
  }, 2000);
}

worlds.sun.announce = () => showRegion({ name: 'The Starlight Fair', sub: 'The wheel, the carousel, the coaster, the swings, the teacups, the drop tower and the storybook boats. Fireworks at the striped kiosk.' });
function enterSunWorld() {
  cross('The light beyond the falls…', () => {
    late.mooreBoat && late.mooreBoat(); setVeil(0);
    view.scene = worlds.sun.scene; state.world = 'sun'; document.body.classList.add('otherworld');
    moveFigureTo(worlds.sun.scene); worlds.sun.enter();
    place(worlds.sun.arrive.pos, worlds.sun.arrive.yaw);
  }, () => showRegion({ name: 'The Sunflower Garden', sub: 'Walk up through the sunflowers. A white door home stands among them; a fair lies beyond the arch.' }));
}

function leaveSunWorld() {
  if (state.world !== 'sun' || state.mode !== 'walk') return;
  state.mode = 'cinematic'; setCue(null); worlds.sun.openDoor();
  setTimeout(() => cross('Home again…', () => {
    worlds.sun.leave(); showHall(false); view.scene = scene; state.world = 'garden'; document.body.classList.remove('otherworld');
    moveFigureTo(scene); renderer.setClearColor(scene.fog.color);
    // at the lookout, facing back into the garden
    place(LOOKOUT, Math.atan2(LOOKOUT.x, LOOKOUT.z));
  }, () => toast('Back in your garden, at the gorge lookout.', 3600)), 1300);
}

/* ================= riding the fair's rides ================= */
// The ride (world/sunWorld.js) says where your seat is each frame; here the camera sits in it. Drag to look
// about; on most rides the view turns with the seat (follow), on the coaster it looks along the track.
// "Step off" or Esc sets you down beside the ride.
const rideUI = $('#rideui');
let ride = null, head = 0;
const seat = new V3(), prev = new V3(), fwd = new V3();
function startRide(r) {
  if (state.mode !== 'walk' || state.world !== 'sun') return;
  late.closePops && late.closePops(); setCue(null);
  ride = r; r.board && r.board(); r.seat(prev);
  head = r.yaw0 !== undefined ? r.yaw0 : player.yaw; player.yaw = 0; player.pitch = r.fwd ? 0 : -0.05;
  state.mode = 'ride';
  $('#ride-name').textContent = r.name; rideUI.hidden = false; requestAnimationFrame(() => rideUI.classList.add('show'));
  $('#ride-off').focus({ preventScroll: true });
}
function stopRide() {
  if (state.mode !== 'ride' || !ride) return;
  rideUI.classList.remove('show'); setTimeout(() => { if (!rideUI.classList.contains('show')) rideUI.hidden = true; }, 500);
  const e = ride.exit, c = new V3(); ride.seat(c); ride.leave && ride.leave();
  place(e, Math.atan2(e.x - c.x, e.z - c.z)); ride = null; state.mode = 'walk';
}
addTick(dt => {
  if (state.mode !== 'ride' || !ride) return;
  // a ride you drive (the bumper cars) reads the keys or the joystick
  if (ride.drive) { let ix = jv.x, iz = jv.y; if (keys.has('KeyW') || keys.has('ArrowUp')) iz += 1; if (keys.has('KeyS') || keys.has('ArrowDown')) iz -= 1; if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1; if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1; ride.ix = Math.max(-1, Math.min(1, ix)); ride.iz = Math.max(-1, Math.min(1, iz)); }
  ride.seat(seat); camera.position.copy(seat);
  if (ride.fwd) { ride.fwd(fwd); curLook.copy(seat).addScaledVector(fwd, 10); curLook.y -= 0.35; camera.lookAt(curLook); }
  else {
    if (ride.follow && dt > 0) {
      const vx = (seat.x - prev.x) / dt, vz = (seat.z - prev.z) / dt;
      if (vx * vx + vz * vz > 0.04) { const h = Math.atan2(-vx, -vz); let d = h - head; d = Math.atan2(Math.sin(d), Math.cos(d)); head += d * Math.min(1, dt * 3); }
    }
    const y = head + player.yaw; camera.rotation.set(player.pitch, y, 0);
    curLook.copy(seat).add(new V3(-Math.sin(y), Math.sin(player.pitch), -Math.cos(y)));
  }
  prev.copy(seat);
}, true);
$('#ride-off').onclick = stopRide;
addEventListener('keydown', e => {
  if (state.mode !== 'ride' || isTyping(e)) return;
  if (e.code === 'Escape' || e.code === 'KeyE') { e.preventDefault(); e.stopImmediatePropagation(); stopRide(); }
}, true);

/* ================= into the castle and out again ================= */
function enterHall() {
  if (state.world !== 'sun' || state.mode !== 'walk') return;
  cross('Through the castle doors…', () => { showHall(true); place(hallArrive.pos, hallArrive.yaw); },
    () => showRegion({ name: 'The Hall of Mirrors', sub: 'Walk the gallery. The door at the far end leads back out to the fair.' }));
}
function leaveHall() {
  if (state.mode !== 'walk') return;
  cross('Back out under the sky…', () => { showHall(false); place(castleFront.pos, castleFront.yaw); });
}

/* ================= from the secret world's map: a quick fade to the chosen place ================= */
function hopTo(pos, yaw, name) {
  if (state.world !== 'sun') return;
  state.mode = 'cinematic'; setCue(null); veil.querySelector('.t').textContent = name || ''; veil.hidden = false;
  requestAnimationFrame(() => veil.classList.add('on'));
  setTimeout(() => { showHall(false); place(pos, yaw); state.mode = 'walk'; setTimeout(() => { veil.classList.remove('on'); setTimeout(() => { if (!veil.classList.contains('on')) veil.hidden = true; }, 1800); }, 300); }, 1300);
}
function enterHallFromMap() { if (state.world !== 'sun') return; state.mode = 'walk'; enterHall(); }
