import { createClient } from '@supabase/supabase-js';
import { KEY, SETTINGS, THEME, cleanSettings, flag, poems, replaceSettings, savePoems, setThemeName } from '../settings/storage.js';
import { state } from '../core/state.js';
import { toast } from '../ui/helpers.js';
import { applyThemeMaterials, setThemeUI } from '../ui/themes.js';
import { late, provide } from '../core/late.js';

// names other modules reach through late (see core/late.js)
provide({
  get storageKey() { return storageKey; },
  get queueSync() { return queueSync; },
});

/* ================= accounts & public gardens (Supabase) ================= */
export const Cloud = { sb: null, user: null, profile: null, garden: null, last: new Map(), timer: null, busy: false, again: false, warned: false, recovering: false, ready: false };
export const ownPoems = () => state.visiting ? state.ownSaved : poems;
const storageKey = () => Cloud.user ? KEY + ':u:' + Cloud.user.id : KEY;
const toRow = p => ({ owner: Cloud.user.id, id: String(p.id).slice(0, 64), title: String(p.title || 'Untitled').slice(0, 120), content: String(p.content).slice(0, 10000), mood: p.mood || null, theme: p.theme || null, important: !!p.important, private: !!p.private, plant_type: p.plantType || null, position: p.position || null, created_at: p.createdAt, updated_at: p.updatedAt || p.createdAt });
export const fromRow = r => ({ id: r.id, title: r.title, content: r.content, mood: r.mood || undefined, theme: r.theme || undefined, important: r.important || undefined, private: r.private || undefined, plantType: r.plant_type || undefined, position: r.position || undefined, createdAt: r.created_at, updatedAt: r.updated_at });
const sig = p => JSON.stringify(toRow(p));

export function cloudInit() {
  // set in .env (see .env.example); without them the garden lives on this device only
  const url = import.meta.env.VITE_SUPABASE_URL, key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key || /YOUR_/.test(url + key)) { late.renderAccount(); return; }
  Cloud.sb = createClient(url, key);
  Cloud.ready = true;
  Cloud.sb.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') { Cloud.recovering = true; late.openGardens(); }
    const u = session ? session.user : null;
    if ((u && u.id) !== (Cloud.user && Cloud.user.id)) { Cloud.user = u; setTimeout(onAuthChanged, 0); }
  });
  Cloud.sb.auth.getSession().then(({ data }) => { const u = data && data.session ? data.session.user : null; if ((u && u.id) !== (Cloud.user && Cloud.user.id)) { Cloud.user = u; onAuthChanged(); } else late.renderAccount(); late.maybeVisitFromLink(); });
}
async function onAuthChanged() {
  if (state.visiting) late.returnHome(true);
  if (!Cloud.user) {
    Cloud.profile = Cloud.garden = null; Cloud.last.clear();
    replaceSettings(late.localSettings(late.settingsKey()) || cleanSettings(null));
    late.swapPlants(loadLocal(KEY), false); late.applyAllSettings(); late.renderAccount(); return;
  }
  try {
    const uid = Cloud.user.id;
    const [{ data: prof }, { data: gard }, { data: rows, error }] = await Promise.all([
      Cloud.sb.from('profiles').select('*').eq('id', uid).maybeSingle(),
      Cloud.sb.from('gardens').select('*').eq('owner', uid).maybeSingle(),
      Cloud.sb.from('poems').select('*').eq('owner', uid).order('created_at')
    ]);
    if (error) throw error;
    Cloud.profile = prof; Cloud.garden = gard;
    let list = (rows || []).map(fromRow);
    Cloud.last = new Map(list.map(p => [p.id, sig(p)]));
    const guest = loadLocal(KEY);
    if (!list.length && guest.length && !flag.get('imported:' + uid)) { list = guest; flag.set('imported:' + uid, '1'); toast('Your poems from this device were moved into your account.', 5000); }
    const cloudS = gard && gard.settings && Object.keys(gard.settings).length ? gard.settings : null;
    replaceSettings(cleanSettings(cloudS ? Object.assign({}, cloudS, { season: gard.theme || cloudS.season }) : (late.localSettings('garden-of-poems:settings') || { season: (gard && gard.theme) || 'spring' })));
    if (SETTINGS.season !== THEME) { setThemeName(SETTINGS.season); applyThemeMaterials(); setThemeUI(); }
    late.swapPlants(list, true); late.applyAllSettings();
    if (!cloudS) late.persistSettings();
    savePoems();
    late.renderAccount();
    toast(`Welcome, ${(prof && prof.display_name) || 'poet'}.`);
  } catch (e) { toast('Your garden could not be loaded from your account just now.'); late.renderAccount(); }
}
function loadLocal(key) { try { const a = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(a) ? a.filter(p => p && p.id && typeof p.content === 'string') : []; } catch (e) { return []; } }
function queueSync() { if (!Cloud.user || state.visiting) return; clearTimeout(Cloud.timer); Cloud.timer = setTimeout(syncNow, 1200); }
export async function syncNow() {
  if (!Cloud.user) return;
  if (Cloud.busy) { Cloud.again = true; return; }
  Cloud.busy = true;
  try {
    const mine = ownPoems(), now = new Map(mine.map(p => [String(p.id), sig(p)]));
    const changed = mine.filter(p => Cloud.last.get(String(p.id)) !== now.get(String(p.id))).map(toRow);
    const removed = [...Cloud.last.keys()].filter(id => !now.has(id));
    if (changed.length) { const { error } = await Cloud.sb.from('poems').upsert(changed); if (error) throw error; }
    if (removed.length) { const { error } = await Cloud.sb.from('poems').delete().eq('owner', Cloud.user.id).in('id', removed); if (error) throw error; }
    Cloud.last = now; Cloud.warned = false;
  } catch (e) { if (!Cloud.warned) { Cloud.warned = true; toast('Some changes have not reached your account yet. They are safe on this device and will be sent again.'); } setTimeout(queueSync, 8000); }
  Cloud.busy = false; if (Cloud.again) { Cloud.again = false; queueSync(); }
}
export async function saveGardenSettings(patch) {
  if (!Cloud.user) return false;
  const { data, error } = await Cloud.sb.from('gardens').update(patch).eq('owner', Cloud.user.id).select().maybeSingle();
  if (error) { toast('Your garden settings could not be saved just now.'); return false; }
  Cloud.garden = data; return true;
}

