import { $ } from '../core/util.js';
import { state } from '../core/state.js';
import { camera, renderer, scene, view } from '../world/renderer.js';
import { worlds } from '../core/worlds.js';
import { LOOKOUT } from '../world/gorge.js';
import { curLook, floorH, player } from '../player/camera.js';
import { moveFigureTo } from '../player/figure.js';
import { setCue, showRegion, toast } from './helpers.js';
import { late, provide } from '../core/late.js';

provide({ get enterSunWorld() { return enterSunWorld; }, get leaveSunWorld() { return leaveSunWorld; }, get setVeil() { return setVeil; } });

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

function enterSunWorld() {
  cross('The light beyond the falls…', () => {
    late.mooreBoat && late.mooreBoat(); setVeil(0);
    view.scene = worlds.sun.scene; state.world = 'sun'; document.body.classList.add('otherworld');
    moveFigureTo(worlds.sun.scene); worlds.sun.enter();
    place(worlds.sun.arrive.pos, worlds.sun.arrive.yaw);
  }, () => showRegion({ name: 'The Sunflower Garden', sub: 'Somewhere among the flowers, a white door leads home.' }));
}

function leaveSunWorld() {
  if (state.world !== 'sun' || state.mode !== 'walk') return;
  state.mode = 'cinematic'; setCue(null); worlds.sun.openDoor();
  setTimeout(() => cross('Home again…', () => {
    worlds.sun.leave(); view.scene = scene; state.world = 'garden'; document.body.classList.remove('otherworld');
    moveFigureTo(scene); renderer.setClearColor(scene.fog.color);
    // at the lookout, facing back into the garden
    place(LOOKOUT, Math.atan2(LOOKOUT.x, LOOKOUT.z));
  }, () => toast('Back in your garden, at the gorge lookout.', 3600)), 1300);
}
