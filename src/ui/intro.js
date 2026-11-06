import { $, V3, isTouch, reduceMotion } from '../core/util.js';
import { groundH } from '../world/terrain.js';
import { flag, poems, savePoems } from '../settings/storage.js';
import { state } from '../core/state.js';
import { SEASON } from '../world/renderer.js';
import { createPlant, preparePoem } from '../plants/registry.js';
import { airU, rebuildConnections, rebuildPetals } from '../world/particles.js';
import { Music } from '../audio/music.js';
import { SPAWN, camTween, syncPlayerFromCamera } from '../player/camera.js';
import { joy } from './input.js';
import { showHint, toast } from './helpers.js';
import { computeSeason } from './filter.js';
import { applyThemeMaterials, setThemeUI } from './themes.js';
import { applyLight, applyVisibility, drawBoard, updateVeils } from '../settings/customize.js';
import { setMusicMenu, setNightUI, setSoundUI } from './hud.js';
import { plantSamples, updateSign } from '../plants/samples.js';
import { offerSuggestion } from '../cloud/gardensPanel.js';
import { late, provide } from '../core/late.js';

// names other modules reach through late (see core/late.js)
provide({
  get enterGarden() { return enterGarden; },
});

/* ================= init plants ================= */
poems.forEach(p => { const before = JSON.stringify([p.plantType, p.position]); preparePoem(p); if (before !== JSON.stringify([p.plantType, p.position])) savePoems(); });
poems.forEach(p => createPlant(p));
updateSign(); rebuildConnections(); rebuildPetals(); state.season = state.seasonCur = computeSeason();
setNightUI(); setSoundUI(); setMusicMenu(); applyThemeMaterials(); setThemeUI(); updateVeils(); applyVisibility(); applyLight(); drawBoard();
{ const pp = SEASON[state.seasonCur].particle; airU.uFall.value = pp.fall; airU.uSway.value = pp.sway; airU.uSize.value = pp.size; airU.uLeaf.value = pp.leaf; airU.uColor.value.copy(pp.color); }

/* ================= intro ================= */
const intro = $('#intro');
if (!poems.length) $('#enter-sample').hidden = false;
else { const c = $('#intro-count'); c.hidden = false; c.textContent = poems.length === 1 ? 'One poem is growing here.' : `${poems.length} poems are growing here.`; }
function enterGarden(withSamples) {
  if (state.mode !== 'intro') return;
  Music.init();
  intro.classList.add('leaving'); setTimeout(() => intro.hidden = true, 1700);
  state.mode = 'cinematic';
  const pos = SPAWN.pos.clone(); pos.y = groundH(pos.x, pos.z) + 1.6;
  camTween(pos, new V3(0, pos.y - 0.45, 25), reduceMotion ? 0.8 : 4.6, () => {
    state.mode = 'walk'; syncPlayerFromCamera();
    $('#hud').hidden = false; if (isTouch) joy.hidden = false;
    if (withSamples) plantSamples(true);
    late.maybeStartSteps(); offerSuggestion();
    if (!poems.length) setTimeout(() => !document.body.classList.contains('panel-open') && !state.visiting && !poems.length && toast('Nothing grows here yet. The white bench marked “Sit here”, to your left past the tulips, is where poems begin.', 6000), 4000);
  });
}
$('#enter').onclick = () => enterGarden(false);
$('#enter-sample').onclick = () => enterGarden(true);

