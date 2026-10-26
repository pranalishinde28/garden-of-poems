import { $ } from '../core/util.js';
import { SETTINGS, THEME, resolveSeason, setThemeName } from '../settings/storage.js';
import { state } from '../core/state.js';
import { groundMat } from '../world/ground.js';
import { grassMat } from '../world/grass.js';
import { createPlant, plants, removePlant } from '../plants/registry.js';
import { recolorDecor } from '../plants/autumnLeaves.js';
import { setTempleSeason } from '../world/temples.js';
import { setGorgeSeason } from '../world/gorge.js';
import { petalU, rebuildConnections, rebuildPetals } from '../world/particles.js';
import { toast } from './helpers.js';
import { setSkyButton } from './icons.js';
import { late } from '../core/late.js';

/* ================= themes ================= */
// the owner's three seasons: spring, the monsoon, autumn (winter was taken out; summer became the monsoon)
export const SEASONS = ['spring', 'monsoon', 'autumn'];
const NEXT = { spring: 'monsoon', monsoon: 'autumn', autumn: 'spring' };
const WORDS = { spring: 'Spring has returned to the garden.', monsoon: 'The monsoon. Everything is green, and the rain comes and goes.', autumn: 'Autumn has come to the garden.' };
export function airSeason() { return THEME; } // pollen, drifting leaves or snow follow the garden's season
export function applyThemeMaterials() {
  // ground and grass take the season's light: warm in autumn, frosted in winter
  const tint = { spring: ['#ffffff', '#ffffff', '#000000', '#000000'], monsoon: ['#e9f6dc', '#eefae2', '#000000', '#000000'], autumn: ['#f2dca6', '#f0e0c2', '#000000', '#000000'], winter: ['#c9d3d6', '#dfe6ea', '#6f7a80', '#9aa4aa'] }[THEME];
  setTempleSeason(THEME); setGorgeSeason(THEME);
  grassMat.color.set(tint[0]); groundMat.color.set(tint[1]); grassMat.emissive.set(tint[2]); groundMat.emissive.set(tint[3]);
  petalU.uAutumn.value = THEME === 'autumn' ? 1 : 0; petalU.uOpacity.value = THEME === 'monsoon' ? 0 : 1;
}
const CAP = s => s[0].toUpperCase() + s.slice(1);
export function setThemeUI() { setSkyButton('h-theme', THEME, CAP(THEME), 'turn to ' + NEXT[THEME], 'Y'); }
export function setTheme(t, quiet) {
  SETTINGS.season = t; setThemeName(resolveSeason(t)); if (typeof late.updateVeils === 'function') late.updateVeils();
  [...plants.values()].filter(p => !p.dying).forEach(pl => { const tg = pl.target; removePlant(pl); const np = createPlant(pl.poem, { visible: tg === 1 }); np.target = tg; });
  rebuildPetals(); rebuildConnections(); recolorDecor(); applyThemeMaterials(); setThemeUI(); if (typeof late.applyVisibility === 'function') late.applyVisibility();
  if (!quiet) { toast(WORDS[THEME]); late.persistSettings(); }
}
$('#h-theme').onclick = () => { if (state.visiting) { toast('You are visiting. Return to your own garden to change its season.'); return; } setTheme(NEXT[THEME]); };

