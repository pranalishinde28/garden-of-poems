import { SETTINGS } from '../settings/storage.js';
import { late, provide } from './late.js';

// names other modules reach through late (see core/late.js)
provide({
  get state() { return state; },
});

/* ================= shared state: mode, time of day, weather, the clock ================= */
// Other modules change tween, seed, introA and T through the setters at the bottom.
export const state = { visiting: null, ownSaved: null, mode: 'intro', night: 0, nightTarget: 0, rain: SETTINGS.weather === 'clear' ? 0 : 1, showerAt: 0, filter: 'all', season: 'monsoon', seasonCur: 'monsoon', reading: null, reflection: false, editing: null, lastReflect: null };
{ const h = new Date().getHours() + new Date().getMinutes() / 60, night = h >= 18.5 || h < 5.5, dusk = !night && (h >= 17 || h < 7); state.night = state.nightTarget = night ? 1 : 0; state.dusk = state.duskTarget = dusk ? 1 : 0; state.lightMode = night ? 'night' : dusk ? 'sunset' : 'day'; }
export let tween = null, seed = null, introA = 0, T = 0;
export function setTween(v) { return (tween = v); }
export function setSeed(v) { return (seed = v); }
export function setIntroA(v) { return (introA = v); }
export function setTime(v) { return (T = v); }
