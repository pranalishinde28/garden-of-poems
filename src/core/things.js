/* ================= things you can touch that are not poems, animals or swings ================= */
// The fountain, the shrine bell, the temple bell. Each registers its root, the cue's words and what a
// click does; ui/input.js picks them and ui/helpers.js shows the cue. Small animations tick here.

export const things = [];
// near: { x, z, r } — within r metres the walk cue offers it (press E)
export function regThing(root, label, act, near) {
  const t = { root, label, act, near };
  root.traverse(o => { o.userData.thing = t; });
  things.push(t); return t;
}

// per-frame work; a tick returns false when it has finished. Quiet ticks (a sound's distance) don't
// count as motion, so they never keep the frame rate up (core/power.js)
const ticks = new Map();
export const addTick = (f, quiet = false) => { ticks.set(f, quiet); };
export function updateThings(dt) { ticks.forEach((q, f) => { if (f(dt) === false) ticks.delete(f); }); }
export const thingsBusy = () => { for (const q of ticks.values()) if (!q) return true; return false; };
