import { $, monthYear, uid } from '../core/util.js';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { Database, Json } from './database.types';
import { cleanSettings, flag, KEY, poems, replaceSettings, resolveSeason, savePoems, setPoems, setThemeName, SETTINGS, THEME } from '../settings/storage.js';
import { state as stateJS } from '../core/state.js';
import { createPlant, plants, preparePoem, removePlant } from '../plants/registry.js';
import { toast } from '../ui/helpers.js';
import { applyThemeMaterials, setThemeUI } from '../ui/themes.js';
import { openPanel, closePanel } from '../ui/reading.js';
import { late as lateNames, provide } from '../core/late.js';

// functions other modules register for this one (core/late.js); untyped JavaScript on their side
type Fn = (...args: any[]) => any;
// the shared state object (core/state.js), with the fields this module uses typed
const state = stateJS as Omit<typeof stateJS, 'visiting' | 'ownSaved'> & { visiting: { owner: string; name?: string } | null; ownSaved: Poem[] | null };
const late = lateNames as Record<'renderAccount' | 'openGardens' | 'maybeVisitFromLink' | 'returnHome' | 'localSettings' | 'settingsKey' | 'swapPlants' | 'applyAllSettings' | 'persistSettings' | 'useProfileAvatar', Fn>;

/* ================= accounts & public gardens (Supabase) ================= */
// Typed against the schema (database.types.ts, from `npm run db:types`). Poems sync through a queue
// kept on this device: every save goes through save_poem() with the server time this device last saw,
// so newer work elsewhere comes back as a conflict to choose from, and a poem removed elsewhere is
// never brought back. Removing is soft (recently removed, 30 days). Failed sends retry with backoff.

type PoemRow = Database['public']['Tables']['poems']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];
type Garden = Database['public']['Tables']['gardens']['Row'];
export type PublicGarden = Database['public']['Views']['public_gardens']['Row'];
export type Poem = {
  id: string; title: string; content: string; mood?: string; theme?: string; important?: boolean; private?: boolean;
  plantType?: string; position?: { x: number; y: number; z: number }; createdAt: string; updatedAt?: string;
};
type SaveResult = { status: 'saved' | 'conflict' | 'deleted'; row: PoemRow };
type Op = { op: 'save' | 'remove' | 'restore'; id: string };
type SyncState = { base: Record<string, string>; sigs: Record<string, string>; queue: Op[]; removed: string[] };

// names other modules reach through late (see core/late.js)
provide({
  get storageKey() { return storageKey; },
  get queueSync() { return queueSync; },
});

export const Cloud: {
  sb: SupabaseClient<Database> | null; user: User | null; profile: Profile | null; garden: Garden | null;
  timer: number; busy: boolean; again: boolean; warned: boolean; recovering: boolean; ready: boolean; tries: number;
} = { sb: null, user: null, profile: null, garden: null, timer: 0, busy: false, again: false, warned: false, recovering: false, ready: false, tries: 0 };
export const ownPoems = (): Poem[] => state.visiting ? (state.ownSaved || []) : poems;
const storageKey = () => Cloud.user ? KEY + ':u:' + Cloud.user.id : KEY;
const payload = (p: Poem) => ({ id: String(p.id).slice(0, 64), title: String(p.title || 'Untitled').slice(0, 120), content: String(p.content).slice(0, 10000), mood: p.mood || null, theme: p.theme || null, important: !!p.important, private: !!p.private, plant_type: p.plantType || null, position: (p.position || null) as Json, created_at: p.createdAt });
export const fromRow = (r: PoemRow): Poem => ({ id: r.id, title: r.title, content: r.content, mood: r.mood || undefined, theme: r.theme || undefined, important: r.important || undefined, private: r.private || undefined, plantType: r.plant_type || undefined, position: (r.position as Poem['position']) || undefined, createdAt: r.created_at, updatedAt: r.updated_at });
// what counts as a change worth sending (not the server's own timestamps)
const sig = (p: Poem) => JSON.stringify(payload(p));

// ---------- before the database update ----------
// A live database still on the original schema has no save_poem() or deleted_at. The page then saves
// the old way (upsert and delete) and leaves out what needs the update, until the database is migrated.
export const db = { legacy: false };
type PgErr = { code?: string; message?: string } | null;
const missing = (e: PgErr) => !!e && (e.code === 'PGRST202' || e.code === 'PGRST204' || e.code === 'PGRST205' || e.code === '42883' || e.code === '42703' || e.code === '42P01' || /does not exist|could not find/i.test(e.message || ''));
export const NEEDS_UPDATE = 'This arrives with the next database update. Everything else works as before.';

// ---------- the sync queue, kept per person on this device ----------
let sync: SyncState = { base: {}, sigs: {}, queue: [], removed: [] };
const syncKey = () => 'garden-of-poems:sync:' + Cloud.user!.id;
function loadSync(): SyncState { try { const s = JSON.parse(localStorage.getItem(syncKey()) || 'null'); if (s && s.base && s.sigs && Array.isArray(s.queue)) return { removed: [], ...s }; } catch (e) { /* fresh */ } return { base: {}, sigs: {}, queue: [], removed: [] }; }
function keepSync() { try { localStorage.setItem(syncKey(), JSON.stringify(sync)); } catch (e) { /* storage full: the queue still lives in memory */ } }
function enqueue(op: Op['op'], id: string) { sync.queue = sync.queue.filter(o => !(o.id === id && o.op === op)); sync.queue.push({ op, id }); }

export function cloudInit() {
  // set in .env (see .env.example); without them the garden lives on this device only
  const url = import.meta.env.VITE_SUPABASE_URL, key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key || /YOUR_/.test(url + key)) { late.renderAccount(); return; }
  Cloud.sb = createClient<Database>(url, key);
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
    Cloud.profile = Cloud.garden = null; sync = { base: {}, sigs: {}, queue: [], removed: [] }; setSaveState(null);
    replaceSettings(late.localSettings(late.settingsKey()) || cleanSettings(null));
    late.swapPlants(loadLocal(KEY), false); late.applyAllSettings(); late.renderAccount(); return;
  }
  try {
    const sb = Cloud.sb!, id = Cloud.user.id;
    const [{ data: prof }, { data: gard }] = await Promise.all([
      sb.from('profiles').select('*').eq('id', id).maybeSingle(),
      sb.from('gardens').select('*').eq('owner', id).maybeSingle(),
    ]);
    let res = await sb.from('poems').select('*').eq('owner', id).is('deleted_at', null).order('created_at');
    db.legacy = missing(res.error);
    if (db.legacy) res = await sb.from('poems').select('*').eq('owner', id).order('created_at');
    const { data: rows, error } = res;
    if (error) throw error;
    Cloud.profile = prof; Cloud.garden = gard;
    if (late.useProfileAvatar) late.useProfileAvatar(prof);
    sync = loadSync();
    // the server's poems, with this device's unsent work laid over them
    const pending = new Set(sync.queue.map(o => o.id)), cached = new Map(loadLocal(storageKey()).map(p => [p.id, p]));
    let list = (rows || []).map(fromRow).filter(p => !sync.queue.some(o => o.id === p.id && o.op === 'remove'));
    for (const r of rows || []) if (!pending.has(r.id)) { sync.base[r.id] = r.updated_at; sync.sigs[r.id] = sig(fromRow(r)); }
    for (const o of sync.queue) if (o.op === 'save' && cached.has(o.id)) { const p = cached.get(o.id)!; list = list.filter(q => q.id !== p.id).concat(p); }
    const guest = loadLocal(KEY);
    if (!(rows || []).length && guest.length && !flag.get('imported:' + id)) { list = guest; flag.set('imported:' + id, '1'); toast('Your poems from this device were moved into your account.', 5000); }
    keepSync();
    const cloudS = gard && gard.settings && Object.keys(gard.settings).length ? gard.settings : null;
    replaceSettings(cleanSettings(cloudS ? Object.assign({}, cloudS, { season: (cloudS as { season?: string }).season || gard!.theme }) : (late.localSettings('garden-of-poems:settings') || { season: (gard && gard.theme) || 'spring' })));
    if (resolveSeason(SETTINGS.season) !== THEME) { setThemeName(resolveSeason(SETTINGS.season)); applyThemeMaterials(); setThemeUI(); }
    late.swapPlants(list, true); late.applyAllSettings();
    if (!cloudS) late.persistSettings();
    savePoems();
    late.renderAccount();
    toast(`Welcome, ${(prof && prof.display_name) || 'poet'}.`);
  } catch (e) { toast('Your garden could not be loaded from your account just now.'); late.renderAccount(); }
}
function loadLocal(key: string): Poem[] { try { const a = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(a) ? a.filter(p => p && p.id && typeof p.content === 'string') : []; } catch (e) { return []; } }

// ---------- the quiet line under the HUD ----------
const saveEl = $('#savestate'); let saveFade = 0;
export function setSaveState(s: 'saving' | 'saved' | 'offline' | 'retry' | null) {
  if (!s || !Cloud.user || state.visiting) { saveEl.hidden = true; return; }
  const text = { saving: 'Saving…', saved: 'Saved', offline: 'Not saved yet: you are offline', retry: 'Not saved yet: trying again' }[s];
  saveEl.hidden = false; saveEl.dataset.s = s; saveEl.textContent = text; saveEl.classList.remove('quiet');
  clearTimeout(saveFade); if (s === 'saved') saveFade = window.setTimeout(() => saveEl.classList.add('quiet'), 3500);
}

// ---------- noticing changes ----------
function queueSync() {
  if (!Cloud.user || state.visiting) return;
  const mine = ownPoems(), here = new Set(mine.map(p => String(p.id)));
  for (const p of mine) {
    const id = String(p.id);
    if (sync.removed.includes(id)) { sync.removed = sync.removed.filter(x => x !== id); enqueue('restore', id); enqueue('save', id); continue; }
    if (sync.sigs[id] !== sig(p)) enqueue('save', id);
  }
  for (const id of Object.keys(sync.sigs)) if (!here.has(id)) { enqueue('remove', id); delete sync.sigs[id]; if (!sync.removed.includes(id)) sync.removed.push(id); }
  keepSync();
  if (!sync.queue.length) return;
  setSaveState(navigator.onLine === false ? 'offline' : 'saving');
  clearTimeout(Cloud.timer); Cloud.timer = window.setTimeout(syncNow, 1200);
}
addEventListener('offline', () => { if (!Cloud.user) return; setSaveState('offline'); toast('You are offline. Your poems stay safe on this device and will be saved when you are back.', 6000); });
addEventListener('online', () => { if (!Cloud.user) return; toast('Back online. Saving your garden.', 3000); Cloud.tries = 0; queueSync(); syncNow(); });

// ---------- sending ----------
export async function syncNow() {
  if (!Cloud.user || !Cloud.sb) return;
  if (Cloud.busy) { Cloud.again = true; return; }
  Cloud.busy = true;
  const sb = Cloud.sb;
  try {
    while (sync.queue.length) {
      const o = sync.queue[0];
      if (db.legacy) { await sendLegacy(o); sync.queue.shift(); keepSync(); continue; }
      if (o.op === 'save') {
        const p = ownPoems().find(q => String(q.id) === o.id);
        if (p) {
          const { data, error } = await sb.rpc('save_poem', { p: payload(p) as Json, base: sync.base[o.id] ?? undefined });
          if (missing(error)) { db.legacy = true; continue; }
          if (error) throw error;
          const r = data as unknown as SaveResult;
          if (r.status === 'saved') { sync.base[o.id] = r.row.updated_at; sync.sigs[o.id] = sig(p); }
          else if (r.status === 'conflict') { conflicts.push({ local: { ...p }, server: fromRow(r.row) }); showConflict(); }
          else { dropLocal(o.id); delete sync.base[o.id]; delete sync.sigs[o.id]; toast(`“${p.title}” was removed on another device, so it stays removed here too.`, 6000); }
        }
      } else if (o.op === 'remove') {
        const { error } = await sb.rpc('remove_poem', { poem_id: o.id }); if (error) throw error;
        delete sync.base[o.id];
      } else {
        const { data, error } = await sb.rpc('restore_poem', { poem_id: o.id }); if (error) throw error;
        if (data && (data as PoemRow).updated_at) sync.base[o.id] = (data as PoemRow).updated_at;
      }
      sync.queue.shift(); keepSync();
    }
    Cloud.tries = 0; Cloud.warned = false; setSaveState('saved');
  } catch (e) {
    // keep the queue; try again later, waiting longer each time (2 s, 4 s, 8 s … up to a minute)
    const offline = navigator.onLine === false; setSaveState(offline ? 'offline' : 'retry');
    if (!Cloud.warned && !offline) { Cloud.warned = true; toast('Some changes have not reached your account yet. They are safe on this device and will be sent again.'); }
    const wait = Math.min(60000, 2000 * 2 ** Cloud.tries++) * (0.75 + Math.random() * 0.5);
    clearTimeout(Cloud.timer); if (!offline) Cloud.timer = window.setTimeout(syncNow, wait);
  }
  Cloud.busy = false; if (Cloud.again) { Cloud.again = false; queueSync(); }
}
// change your own poems; while visiting another garden, only the saved copy of yours changes
// the old way, for a database without save_poem(): last write wins, removing deletes
async function sendLegacy(o: Op) {
  const sb = Cloud.sb!, owner = Cloud.user!.id;
  if (o.op === 'remove') { const { error } = await sb.from('poems').delete().eq('owner', owner).eq('id', o.id); if (error) throw error; delete sync.base[o.id]; return; }
  if (o.op === 'restore') return; // the save that follows puts it back
  const p = ownPoems().find(q => String(q.id) === o.id); if (!p) return;
  const { error } = await sb.from('poems').upsert({ ...payload(p), owner, updated_at: new Date().toISOString() } as Database['public']['Tables']['poems']['Insert']);
  if (error) throw error; sync.sigs[o.id] = sig(p);
}
function dropLocal(id: string) {
  if (state.visiting) { state.ownSaved = (state.ownSaved || []).filter((p: Poem) => String(p.id) !== id); return; }
  const pl = plants.get(id); if (pl) removePlant(pl);
  setPoems(poems.filter((p: Poem) => String(p.id) !== id)); savePoems();
}
function placeLocal(p: Poem) { // replace a poem here (or add it) and grow its plant again
  if (state.visiting) { state.ownSaved = (state.ownSaved || []).filter((q: Poem) => q.id !== p.id).concat(p); return; }
  const old = plants.get(p.id); if (old) removePlant(old);
  setPoems(poems.filter((q: Poem) => q.id !== p.id).concat(p)); preparePoem(p);
  const pl = createPlant(p, { visible: false }); pl.target = 1; pl.speed = 1 / 2; savePoems();
}

// ---------- conflicts: the same poem changed in two places ----------
const conflicts: { local: Poem; server: Poem }[] = [];
const cPanel = $('#conflict');
const excerpt = (p: Poem) => p.content.split('\n').filter(l => l.trim()).slice(0, 4).join('\n');
function showConflict() {
  const c = conflicts[0]; if (!c) { closePanel(cPanel); return; }
  $('#cf-title').textContent = c.local.title;
  $('#cf-local').textContent = excerpt(c.local); $('#cf-server').textContent = excerpt(c.server);
  $('#cf-server-when').textContent = c.server.updatedAt ? 'Changed ' + new Date(c.server.updatedAt).toLocaleString('en', { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }) : '';
  if (cPanel.hidden || !cPanel.classList.contains('open')) openPanel(cPanel);
}
function resolve(choice: 'local' | 'server' | 'both') {
  const c = conflicts.shift(); if (!c) return;
  const id = c.local.id;
  sync.base[id] = c.server.updatedAt!;
  if (choice === 'local') { sync.sigs[id] = ''; enqueue('save', id); }
  else { placeLocal(c.server); sync.sigs[id] = sig(c.server); }
  if (choice === 'both') { const copy = { ...c.local, id: uid(), position: undefined, createdAt: new Date().toISOString() }; placeLocal(copy); }
  keepSync(); showConflict(); queueSync();
}
$('#cf-local-btn').onclick = () => resolve('local');
$('#cf-server-btn').onclick = () => resolve('server');
$('#cf-both-btn').onclick = () => resolve('both');

// ---------- recently removed (30 days) ----------
export async function removedPoems(): Promise<PoemRow[]> {
  if (!Cloud.user || !Cloud.sb || db.legacy) return [];
  const { data } = await Cloud.sb.from('poems').select('*').eq('owner', Cloud.user.id).not('deleted_at', 'is', null).order('deleted_at', { ascending: false }).limit(60);
  return data || [];
}
export async function restoreRemoved(row: PoemRow) {
  const { data, error } = await Cloud.sb!.rpc('restore_poem', { poem_id: row.id });
  if (error || !data) { toast('That poem could not be brought back just now.'); return false; }
  const r = data as PoemRow; sync.removed = sync.removed.filter(x => x !== r.id); sync.base[r.id] = r.updated_at;
  const p = fromRow(r); sync.sigs[r.id] = sig(p); placeLocal(p); keepSync(); toast(`“${p.title}” is growing again.`, 3000); return true;
}

// ---------- the public garden list: search, a page at a time ----------
export async function listGardens(q: string, after?: PublicGarden): Promise<PublicGarden[]> {
  const { data, error } = await Cloud.sb!.rpc('list_public_gardens', { q: q || undefined, after_updated: after?.updated_at ?? undefined, after_owner: after?.owner ?? undefined, lim: 12 });
  if (!missing(error)) { if (error) throw error; return (data || []) as PublicGarden[]; }
  // before the update: the view directly, newest first
  let req = Cloud.sb!.from('public_gardens').select('*').order('updated_at', { ascending: false }).limit(12);
  const t = (q || '').replace(/[,()%*]/g, ' ').trim();
  if (t) req = req.or(`name.ilike.%${t}%,username.ilike.%${t}%,display_name.ilike.%${t}%`);
  if (after?.updated_at) req = req.lt('updated_at', after.updated_at);
  const r2 = await req; if (r2.error) throw r2.error; return (r2.data || []) as PublicGarden[];
}

// ---------- your account ----------
export async function usernameAvailable(name: string) {
  const { data, error } = await Cloud.sb!.rpc('username_available', { name });
  if (!missing(error)) return !!data;
  const r = await Cloud.sb!.from('profiles').select('id').eq('username', name.toLowerCase()).maybeSingle(); return !r.data;
}
export async function changeUsername(name: string) {
  const { data, error } = await Cloud.sb!.rpc('change_username', { new_name: name });
  if (missing(error)) { // before the update: change it directly (row-level security allows your own profile)
    const n = name.trim().toLowerCase(), r = await Cloud.sb!.from('profiles').update({ username: n }).eq('id', Cloud.user!.id);
    if (r.error) throw new Error(r.error.code === '23505' ? 'That username is taken. Try another.' : 'That did not work just now.');
    if (Cloud.profile) Cloud.profile.username = n; return n;
  }
  if (error) throw new Error(error.message);
  if (Cloud.profile) Cloud.profile.username = data as string; return data as string;
}
export async function deleteAccount() {
  const id = Cloud.user!.id, { error } = await Cloud.sb!.rpc('delete_my_account');
  if (missing(error)) throw new Error('Deleting an account arrives with the next database update. Your garden is untouched.');
  if (error) throw new Error(error.message);
  for (const k of [KEY + ':u:' + id, 'garden-of-poems:sync:' + id, 'garden-of-poems:settings:u:' + id]) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  await Cloud.sb!.auth.signOut();
}
export async function exportGarden(kind: 'json' | 'md') {
  const mine = ownPoems().slice().sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  let notes: unknown[] = [];
  if (Cloud.user && Cloud.sb) { const { data } = await Cloud.sb.from('notes').select('poem_id,text,created_at,hidden,profiles(display_name,username)').eq('garden_owner', Cloud.user.id).order('created_at'); notes = data || []; }
  const name = (Cloud.garden && Cloud.garden.name) || SETTINGS.name || 'My garden';
  let body: string, type: string;
  if (kind === 'json') {
    body = JSON.stringify({ exported: new Date().toISOString(), garden: { name, description: Cloud.garden?.description ?? SETTINGS.desc, settings: SETTINGS }, profile: Cloud.profile && { username: Cloud.profile.username, display_name: Cloud.profile.display_name, avatar: Cloud.profile.avatar }, poems: mine, notes }, null, 2);
    type = 'application/json';
  } else {
    body = `# ${name}\n\n` + mine.map(p => `## ${p.title}\n\n*${monthYear(p.createdAt)}${p.mood ? ' · ' + p.mood : ''}${p.theme ? ' · ' + p.theme : ''}*\n\n${p.content.split('\n').map(l => l ? l + '  ' : '').join('\n')}\n`).join('\n---\n\n');
    type = 'text/markdown';
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([body], { type })); a.download = `garden-of-poems.${kind}`;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export async function saveGardenSettings(patch: Database['public']['Tables']['gardens']['Update']) {
  if (!Cloud.user || !Cloud.sb) return false;
  const { data, error } = await Cloud.sb.from('gardens').update(patch).eq('owner', Cloud.user.id).select().maybeSingle();
  if (error) { toast('Your garden settings could not be saved just now.'); return false; }
  Cloud.garden = data; return true;
}
