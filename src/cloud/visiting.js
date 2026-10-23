import { $ } from '../core/util.js';
import { cleanSettings, poems, replaceSettings, resolveSeason, setPoems, setThemeName, SETTINGS, THEME } from '../settings/storage.js';
import { state } from '../core/state.js';
import { createPlant, plants, preparePoem, removePlant } from '../plants/registry.js';
import { rebuildConnections, rebuildPetals } from '../world/particles.js';
import { toast } from '../ui/helpers.js';
import { applyFilter, computeSeason } from '../ui/filter.js';
import { closeReader } from '../ui/reading.js';
import { leaveSwing } from '../ui/swinging.js';
import { applyThemeMaterials, setThemeUI } from '../ui/themes.js';
import { Cloud, fromRow } from './cloud.ts';
import { closeGardens } from './gardensPanel.js';
import { late, provide } from '../core/late.js';

// names other modules reach through late (see core/late.js)
provide({
  get swapPlants() { return swapPlants; },
  get visitGarden() { return visitGarden; },
  get returnHome() { return returnHome; },
  get maybeVisitFromLink() { return maybeVisitFromLink; },
});

/* ---------- visiting ---------- */
function swapPlants(list, grow) {
  [...plants.values()].forEach(pl => removePlant(pl));
  setPoems(list);
  poems.forEach(p => preparePoem(p));
  poems.forEach((p, i) => { const pl = createPlant(p, { visible: !grow }); if (grow) { pl.target = 1; pl.speed = 1 / 2.2; pl.delay = 0.2 + i * 0.1; } });
  rebuildConnections(); rebuildPetals(); late.updateSign(); state.season = computeSeason();
}
async function visitGarden(g) {
  if (!Cloud.ready) return;
  const { data, error } = await Cloud.sb.from('poems').select('*').eq('owner', g.owner).order('created_at').limit(300);
  if (error || !data) { toast('That garden could not be opened just now.'); return; }
  if (!data.length) { toast('This garden has no poems to read yet.'); return; }
  closeGardens(); if (state.mode === 'focus') closeReader(); if (state.mode === 'swing') leaveSwing();
  if (!state.visiting) { state.ownSaved = poems; state.ownSettings = SETTINGS; }
  const list = data.map(r => { const q = fromRow(r); q._oid = q.id; q.id = 'v.' + q.id; return q; });
  replaceSettings(cleanSettings(Object.assign({}, g.settings || {}, { season: (g.settings && g.settings.season) || g.theme || 'spring', music: state.ownSettings.music })));
  state.visiting = { owner: g.owner, username: g.username || '', name: g.name || 'A quiet garden', by: g.display_name || 'A poet', sign: { name: g.name || 'A quiet garden', desc: g.description || '', by: g.display_name || '', links: SETTINGS.links, own: false } };
  applyFilter('all', false);
  if (resolveSeason(SETTINGS.season) !== THEME) { setThemeName(resolveSeason(SETTINGS.season)); applyThemeMaterials(); setThemeUI(); }
  swapPlants(list, true); late.applyAllSettings();
  $('#visit-name').textContent = `${state.visiting.name}, by ${state.visiting.by}`;
  const vb = $('#visitbar'); vb.hidden = false; requestAnimationFrame(() => vb.classList.add('show'));
  toast(g.description ? g.description : `Welcome to ${state.visiting.name}. Walk up to any plant to read it.`, 6000);
}
function returnHome(quiet) {
  if (!state.visiting) return;
  if (state.mode === 'focus') closeReader();
  const own = state.ownSaved; replaceSettings(state.ownSettings || SETTINGS); state.visiting = null; state.ownSaved = null; state.ownSettings = null;
  if (resolveSeason(SETTINGS.season) !== THEME) { setThemeName(resolveSeason(SETTINGS.season)); applyThemeMaterials(); setThemeUI(); }
  swapPlants(own, true); late.applyAllSettings();
  const vb = $('#visitbar'); vb.classList.remove('show'); vb.hidden = true;
  if (!quiet) toast('Welcome back to your own garden.');
}
$('#visit-home').onclick = () => returnHome(false);
async function maybeVisitFromLink() {
  const name = new URLSearchParams(location.search).get('garden'); if (!name || !Cloud.ready) return;
  const { data } = await Cloud.sb.from('public_gardens').select('*').eq('username', name.toLowerCase()).maybeSingle();
  if (!data) { toast('That garden is private or does not exist.'); return; }
  const go = () => visitGarden(data);
  if (state.mode === 'intro') { $('#intro-visit').hidden = false; $('#intro-visit').textContent = `Visit ${data.name || 'this garden'}`; $('#intro-visit').onclick = () => { late.enterGarden(false); setTimeout(go, 4800); }; }
  else go();
}

