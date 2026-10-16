import { $, V3, clamp } from '../core/util.js';
import { state } from '../core/state.js';
import { camera } from '../world/renderer.js';
import { FOUNTAIN, fountainGroup, fountainState, tossCoin } from '../world/fountain.js';
import { camTween, floorH, player, syncPlayerFromCamera } from '../player/camera.js';
import { setCue } from './helpers.js';
import { isTyping } from './input.js';
import { late, provide } from '../core/late.js';

provide({ get lookIntoFountain() { return lookIntoFountain; } });

/* ================= looking into the fountain ================= */
// Lean over the pool: the camera glides above the water on your side, the surface stills and clears,
// and the koi swim up to you. Toss a coin from here, or step back to walking (Esc, or the button).
const pill = $('#fview');
let back = null;
function lookIntoFountain() {
  if (state.mode !== 'walk') return;
  late.closePops(); setCue(null);
  const c = fountainGroup.position, side = new V3(player.pos.x - c.x, 0, player.pos.z - c.z); if (side.lengthSq() < 0.01) side.set(0, 0, 1); side.normalize();
  back = { pos: camera.position.clone(), yaw: player.yaw };
  state.mode = 'fountain';
  const pos = c.clone().addScaledVector(side, 3.5); pos.y = c.y + 2.6;
  const look = c.clone().addScaledVector(side, 1.0); look.y = c.y + 0.3;
  camTween(pos, look, clamp(1.2 + camera.position.distanceTo(pos) * 0.06, 1.4, 2.6));
  fountainState.lure = { x: side.x * 1.4, z: side.z * 1.4 };
  pill.hidden = false; requestAnimationFrame(() => pill.classList.add('show'));
  $('#fv-coin').focus({ preventScroll: true });
}
function stepBack() {
  if (state.mode !== 'fountain') return;
  pill.classList.remove('show'); setTimeout(() => { if (!pill.classList.contains('show')) pill.hidden = true; }, 500);
  fountainState.lure = null;
  const to = back ? back.pos.clone() : camera.position.clone(); to.y = floorH(to.x, to.z) + 1.6;
  const look = new V3(FOUNTAIN.x, to.y - 0.4, FOUNTAIN.z);
  state.mode = 'cinematic';
  camTween(to, look, 1.4, () => { state.mode = 'walk'; syncPlayerFromCamera(); });
}
// the water goes still while you look, and wakes again when you step back
(function ease() { const want = state.mode === 'fountain' ? 1 : 0, v = fountainState.calm; v.value += (want - v.value) * 0.05; requestAnimationFrame(ease); })();
$('#fv-coin').onclick = () => tossCoin();
$('#fv-back').onclick = stepBack;
addEventListener('keydown', e => {
  if (state.mode !== 'fountain' || isTyping(e)) return;
  if (e.code === 'Escape' || e.code === 'KeyE') { e.preventDefault(); e.stopImmediatePropagation(); stepBack(); }
  else if (e.code === 'Space' || e.code === 'KeyC') { e.preventDefault(); tossCoin(); }
}, true);
