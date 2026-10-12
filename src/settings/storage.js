import { late } from '../core/late.js';

/* ================= storage ================= */
export const KEY = 'garden-of-poems:v1';
function loadPoems() { try { const a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a.filter(p => p && p.id && typeof p.content === 'string') : []; } catch (e) { return []; } }
export function savePoems() { if (typeof late.state !== 'undefined' && late.state.visiting) return; try { localStorage.setItem(late.storageKey(), JSON.stringify(poems)); } catch (e) { late.toast('This browser is not saving poems, so they will be gone when you close the page.'); } if (typeof late.queueSync === 'function') late.queueSync(); }
export const flag = { get: k => { try { return localStorage.getItem('garden-of-poems:' + k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem('garden-of-poems:' + k, v); } catch (e) {} } };
export const IDB = {
  open() { return new Promise((res, rej) => { try { const r = indexedDB.open('garden-of-poems', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } }); },
  async get(k) { const db = await this.open(); return new Promise((res, rej) => { const q = db.transaction('kv', 'readonly').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); },
  async set(k, v) { const db = await this.open(); return new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); },
  async del(k) { const db = await this.open(); return new Promise(res => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').delete(k); tx.oncomplete = () => res(); tx.onerror = () => res(); }); }
};
// poems, SETTINGS and THEME are replaced from other modules through setPoems, replaceSettings and setThemeName
export let poems = loadPoems();
const DEFAULT_SETTINGS = { season: 'auto', view: 'fuji', light: 'auto', weather: 'clear', tree: 'sakura', blossom: 'pink', music: 'piano', fuji: true, mist: true, drift: true, name: '', desc: '', links: [],
  show: { wisteria: true, tulips: true, roses: true, hydrangeas: true, lilies: true, orchids: true, lamps: true, swings: true, land: true, air: true, water: true } };
const ENUMS = { season: ['auto', 'spring', 'summer', 'autumn', 'winter'], view: ['fuji', 'sea'], light: ['auto', 'day', 'night'], weather: ['clear', 'showers', 'rain'], tree: ['sakura', 'maple', 'green'], blossom: ['pink', 'white'], music: ['piano', 'own', 'off'] };
export function cleanSettings(s) {
  const d = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)); if (!s || typeof s !== 'object') return d;
  for (const k in ENUMS) if (ENUMS[k].includes(s[k])) d[k] = s[k];
  for (const k of ['fuji', 'mist', 'drift']) if (typeof s[k] === 'boolean') d[k] = s[k];
  if (s.show && typeof s.show === 'object') for (const k in d.show) if (typeof s.show[k] === 'boolean') d.show[k] = s.show[k];
  if (typeof s.name === 'string') d.name = s.name.slice(0, 60); if (typeof s.desc === 'string') d.desc = s.desc.slice(0, 280);
  if (Array.isArray(s.links)) d.links = s.links.filter(l => l && typeof l.url === 'string' && /^https?:\/\/[^\s<>"]+$/i.test(l.url)).slice(0, 6).map(l => ({ label: String(l.label || '').slice(0, 40), url: l.url.slice(0, 200) }));
  return d;
}
export let SETTINGS = cleanSettings((() => { try { return JSON.parse(localStorage.getItem('garden-of-poems:settings') || 'null'); } catch (e) { return null; } })() || { season: flag.get('theme') === 'autumn' ? 'autumn' : 'auto', music: flag.get('muted') === '1' ? 'off' : 'piano' });
// the season the garden shows: the chosen one, or for 'auto' the calendar's (northern hemisphere)
export function resolveSeason(s) {
  if (s !== 'auto') return s;
  const m = new Date().getMonth(); return m >= 2 && m <= 4 ? 'spring' : m >= 5 && m <= 7 ? 'summer' : m >= 8 && m <= 10 ? 'autumn' : 'winter';
}
export let THEME = resolveSeason(SETTINGS.season);
export const POST = { on: flag.get('cine') !== '0' };

export function setPoems(v) { return (poems = v); }
export function replaceSettings(v) { return (SETTINGS = v); }
export function setThemeName(v) { return (THEME = v); }
