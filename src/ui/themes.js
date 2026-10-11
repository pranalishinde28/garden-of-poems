import { $ } from '../core/util.js';
import { SETTINGS, THEME, setThemeName } from '../settings/storage.js';
import { state } from '../core/state.js';
import { groundMat } from '../world/ground.js';
import { grassMat } from '../world/grass.js';
import { createPlant, plants, removePlant } from '../plants/registry.js';
import { recolorDecor } from '../plants/autumnLeaves.js';
import { petalU, rebuildConnections, rebuildPetals } from '../world/particles.js';
import { toast } from './helpers.js';
import { late } from '../core/late.js';

/* ================= themes ================= */
export function airSeason() { return THEME === 'autumn' ? 'autumn' : state.season; }
export function applyThemeMaterials() { const a = THEME === 'autumn'; grassMat.color.set(a ? '#f2dca6' : '#ffffff'); groundMat.color.set(a ? '#f0e0c2' : '#ffffff'); petalU.uAutumn.value = (a || SETTINGS.tree === 'maple') ? 1 : 0; }
export function setThemeUI() { const a = THEME === 'autumn', b = $('#h-theme'); b.setAttribute('aria-pressed', a ? 'true' : 'false'); b.dataset.tip = a ? 'Back to spring' : 'Autumn'; b.setAttribute('aria-label', a ? 'Switch to spring' : 'Switch to autumn'); }
export function setTheme(t, quiet) {
  setThemeName(t); SETTINGS.season = t; if (typeof late.updateVeils === 'function') late.updateVeils();
  [...plants.values()].filter(p => !p.dying).forEach(pl => { const tg = pl.target; removePlant(pl); const np = createPlant(pl.poem, { visible: tg === 1 }); np.target = tg; });
  rebuildPetals(); rebuildConnections(); recolorDecor(); applyThemeMaterials(); setThemeUI();
  if (!quiet) { toast(t === 'autumn' ? 'Autumn has come to the garden.' : 'Spring has returned to the garden.'); late.persistSettings(); }
}
$('#h-theme').onclick = () => { if (state.visiting) { toast('You are visiting. Return to your own garden to change its season.'); return; } setTheme(THEME === 'autumn' ? 'spring' : 'autumn'); };

