import { lineCount } from '../core/util.js';

/* ================= poem → plant ================= */
export const MOODS = [['love', 'Love'], ['joy', 'Joy'], ['sorrow', 'Sorrow'], ['anger', 'Anger'], ['childhood', 'Childhood'], ['dream', 'Dream'], ['reflection', 'Reflection']];
const KW = {
  love: ['love', 'kiss', 'your hands', 'heart', 'beloved', 'together', 'darling', 'yours'],
  sorrow: ['gone', 'lonely', 'alone', 'grief', 'miss you', 'tears', 'cry', 'you left', 'lost', 'empty', 'goodbye', 'funeral'],
  anger: ['angry', 'rage', 'burn', 'hate', 'scream', 'furious', 'matches', 'not fine'],
  childhood: ['child', 'grandmother', 'grandfather', 'school', 'kite', 'toy', 'childhood', 'when i was small', 'young'],
  dream: ['dream', 'sleep', 'stars', 'floating', 'asleep', 'whale', 'strange', 'ceiling'],
  joy: ['joy', 'laugh', 'bloom', 'blossom', 'bright', 'dance', 'glow', 'yes'],
  reflection: ['wonder', 'years', 'remember', 'life', 'learn', 'train', 'city', 'time']
};
function inferMood(p) {
  const t = (p.title + ' ' + p.content).toLowerCase(); let best = null, bs = 0;
  for (const k in KW) { let s = 0; KW[k].forEach(w => { if (t.includes(w)) s++; }); if (s > bs) { bs = s; best = k; } }
  return best || (lineCount(p) <= 6 ? 'joy' : 'reflection');
}
export function plantTypeFor(p) {
  if (p.important) return 'oldtree';
  const m = p.mood || inferMood(p), n = lineCount(p);
  return { love: 'twin', joy: n > 14 ? 'bigtree' : 'flower', sorrow: 'willow', anger: 'thorn', childhood: 'treehouse', dream: 'mushrooms', reflection: n >= 12 ? 'bigtree' : 'orchard' }[m] || 'flower';
}
export const REGIONS = {
  meadow:  { name: 'The Meadow', sub: 'love and bright memories', a: 0.25, sa: 0.6, r0: 12, r1: 32 },
  willow:  { name: 'The Weeping Cherries', sub: 'by the water, for what aches', a: -2.9, sa: 0.45, r0: 10, r1: 17 },
  orchard: { name: 'The Cherry Grove', sub: 'reflections on a life', a: -1.45, sa: 0.42, r0: 14, r1: 36 },
  moon:    { name: 'The Moon Garden', sub: 'dreams and stranger things', a: -2.35, sa: 0.3, r0: 18, r1: 36 },
  wild:    { name: 'The Wild Garden', sub: 'where anger is allowed to grow', a: -0.75, sa: 0.3, r0: 22, r1: 40 },
  nest:    { name: 'The Old Hollow', sub: 'childhood, kept safe', a: 2.75, sa: 0.28, r0: 17, r1: 33 },
  elder:   { name: 'The Old Cherry', sub: 'the poems that matter most', a: 1.0, sa: 0.25, r0: 18, r1: 28 }
};
export const TYPE_REGION = { flower: 'meadow', twin: 'meadow', willow: 'willow', orchard: 'orchard', bigtree: 'orchard', mushrooms: 'moon', thorn: 'wild', treehouse: 'nest', oldtree: 'elder' };
export const RAD = { flower: 0.9, twin: 1.0, willow: 2.8, thorn: 1.5, treehouse: 2.9, mushrooms: 1.2, orchard: 2.6, bigtree: 3.8, oldtree: 5.0 };
export const COL = { flower: 0, twin: 0, willow: 0.35, thorn: 0.8, treehouse: 0.45, mushrooms: 0, orchard: 0.3, bigtree: 0.5, oldtree: 0.9 };
export const seasonOf = iso => { const m = new Date(iso).getMonth(); return m >= 2 && m <= 4 ? 'spring' : m >= 5 && m <= 7 ? 'summer' : m >= 8 && m <= 10 ? 'autumn' : 'winter'; };

