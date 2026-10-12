import { $ } from '../core/util.js';
import { SETTINGS, THEME, resolveSeason, setThemeName } from '../settings/storage.js';
import { state } from '../core/state.js';
import { groundMat } from '../world/ground.js';
import { grassMat } from '../world/grass.js';
import { createPlant, plants, removePlant } from '../plants/registry.js';
import { recolorDecor } from '../plants/autumnLeaves.js';
import { setTempleSeason } from '../world/temples.js';
import { petalU, rebuildConnections, rebuildPetals } from '../world/particles.js';
import { toast } from './helpers.js';
import { late } from '../core/late.js';

/* ================= themes ================= */
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const NEXT = { spring: 'summer', summer: 'autumn', autumn: 'winter', winter: 'spring' };
const WORDS = { spring: 'Spring has returned to the garden.', summer: 'Summer, and the cherries are in full leaf.', autumn: 'Autumn has come to the garden.', winter: 'Winter. The trees rest under snow.' };
export function airSeason() { return THEME; } // pollen, drifting leaves or snow follow the garden's season
export function applyThemeMaterials() {
  // ground and grass take the season's light: warm in autumn, frosted in winter
  const tint = { spring: ['#ffffff', '#ffffff', '#000000', '#000000'], summer: ['#f4fbe8', '#f6ffe6', '#000000', '#000000'], autumn: ['#f2dca6', '#f0e0c2', '#000000', '#000000'], winter: ['#c9d3d6', '#dfe6ea', '#6f7a80', '#9aa4aa'] }[THEME];
  setTempleSeason(THEME);
  grassMat.color.set(tint[0]); groundMat.color.set(tint[1]); grassMat.emissive.set(tint[2]); groundMat.emissive.set(tint[3]);
  petalU.uAutumn.value = THEME === 'autumn' ? 1 : 0; petalU.uOpacity.value = THEME === 'winter' || THEME === 'summer' ? 0 : 1;
}
export function setThemeUI() { const b = $('#h-theme'), n = NEXT[THEME]; b.setAttribute('aria-pressed', 'false'); b.dataset.tip = n[0].toUpperCase() + n.slice(1); b.setAttribute('aria-label', 'Turn to ' + n); }
export function setTheme(t, quiet) {
  SETTINGS.season = t; setThemeName(resolveSeason(t)); if (typeof late.updateVeils === 'function') late.updateVeils();
  [...plants.values()].filter(p => !p.dying).forEach(pl => { const tg = pl.target; removePlant(pl); const np = createPlant(pl.poem, { visible: tg === 1 }); np.target = tg; });
  rebuildPetals(); rebuildConnections(); recolorDecor(); applyThemeMaterials(); setThemeUI(); if (typeof late.applyVisibility === 'function') late.applyVisibility();
  if (!quiet) { toast(WORDS[THEME]); late.persistSettings(); }
}
$('#h-theme').onclick = () => { if (state.visiting) { toast('You are visiting. Return to your own garden to change its season.'); return; } setTheme(NEXT[THEME]); };

