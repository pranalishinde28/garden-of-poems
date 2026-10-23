import { $, V3, clamp } from '../core/util.js';
import { state } from '../core/state.js';
import { camera } from '../world/renderer.js';
import { GORGE, gorgeHalf, gorgeWorld } from '../world/terrain.js';
import { FALLS, LOOKOUT } from '../world/gorge.js';
import { camTween, floorH, player, syncPlayerFromCamera } from '../player/camera.js';
import { setCue } from './helpers.js';
import { isTyping } from './input.js';
import { late, provide } from '../core/late.js';

provide({ get lookIntoGorge() { return lookIntoGorge; } });

/* ================= looking into Takachiho Gorge ================= */
// From the lookout, the view drifts down into the gorge, low over the water like a boat's, looking up
// the basalt walls to Manai Falls and the bridge. Step back (Esc, E or the button) to the lookout.
const pill = $('#gview');
let back = null;
function lookIntoGorge() {
  if (state.mode !== 'walk') return;
  late.closePops(); setCue(null);
  back = { pos: camera.position.clone(), yaw: player.yaw };
  state.mode = 'gorge';
  // down the meadow and out over the pool, low like a boat, looking up the canyon to the falls
  const pos = gorgeWorld(GORGE.r0 - 7, 3.5, GORGE.floor + 2.4);
  const look = gorgeWorld(FALLS.along - 4, FALLS.side * (gorgeHalf(FALLS.along) - 3), GORGE.floor + 10);
  camTween(pos, look, clamp(2.4 + camera.position.distanceTo(pos) * 0.03, 2.6, 3.8));
  pill.hidden = false; requestAnimationFrame(() => pill.classList.add('show'));
  $('#gv-back').focus({ preventScroll: true });
}
function stepBack() {
  if (state.mode !== 'gorge') return;
  pill.classList.remove('show'); setTimeout(() => { if (!pill.classList.contains('show')) pill.hidden = true; }, 500);
  const to = back ? back.pos.clone() : new V3(LOOKOUT.x, 0, LOOKOUT.z); to.y = floorH(to.x, to.z) + 1.6;
  const look = gorgeWorld(GORGE.r0 + 20, 0, to.y + 5);
  state.mode = 'cinematic';
  camTween(to, look, 2.6, () => { state.mode = 'walk'; syncPlayerFromCamera(); });
}
$('#gv-back').onclick = stepBack;
addEventListener('keydown', e => {
  if (state.mode !== 'gorge' || isTyping(e)) return;
  if (e.code === 'Escape' || e.code === 'KeyE') { e.preventDefault(); e.stopImmediatePropagation(); stepBack(); }
}, true);
