import { Music } from './music.js';
import { SFX } from '../animals/animals.js';
import { state } from '../core/state.js';
import { addTick } from '../core/things.js';

/* ================= the sound of being inside a pagoda ================= */
// While you are inside (state.world 'temple' or 'shrine') the piano hushes and the room has its own sound,
// all generated here, nothing recorded or borrowed:
//  - the Buddha's temple: a low drone in a long reverb, a hum of voices rising and falling on one vowel to
//    the next (no melody), a singing bowl now and then, and far off, the deep temple bell;
//  - the shrine: a sho chord (the gagaku mouth organ's cluster) breathing in and out, a soft draught, now and
//    then a distant suzu, the wooden clappers, or one stroke of a taiko.
// It fades with the sound button like everything else.

let amb = null, cur = null, timers = [], voices = [];
function bus() {
  if (amb) return amb;
  const ctx = Music.ctx; amb = ctx.createGain(); amb.gain.value = 0;
  const conv = ctx.createConvolver(); conv.buffer = Music.impulse(5.5);
  const wet = ctx.createGain(); wet.gain.value = 0.8; const dry = ctx.createGain(); dry.gain.value = 0.5;
  amb.in = ctx.createGain(); amb.in.connect(dry); amb.in.connect(conv); conv.connect(wet); dry.connect(amb); wet.connect(amb); amb.connect(ctx.destination);
  return amb;
}
const later = (f, s) => timers.push(setTimeout(f, s * 1000));
const rand = (a, b) => a + Math.random() * (b - a);

function start(kind) {
  stop(); cur = kind; const ctx = Music.ctx, a = bus(), t = ctx.currentTime;
  a.gain.cancelScheduledValues(t); a.gain.setTargetAtTime(1, t, 1.5);
  const tone = (f, type, gain, lfo = 0.07) => {
    const o = ctx.createOscillator(), g = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain();
    o.type = type; o.frequency.value = f; g.gain.value = gain; l.frequency.value = lfo * rand(0.7, 1.3); lg.gain.value = gain * 0.45;
    l.connect(lg); lg.connect(g.gain); o.connect(g); g.connect(a.in); o.start(); l.start(); voices.push(o, l); return g;
  };
  if (kind === 'temple') {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.connect(a.in);
    for (const [f, g] of [[73.4, 0.05], [110.2, 0.035], [146.6, 0.02], [220.6, 0.008]]) { const o = ctx.createOscillator(), gg = ctx.createGain(); o.frequency.value = f; gg.gain.value = g; o.connect(gg); gg.connect(lp); o.start(); voices.push(o); }
    const hum = () => { if (cur !== 'temple') return; chant(); later(hum, rand(9, 14)); }; later(hum, 2);
    const bowl = () => { if (cur !== 'temple') return; SFX.rin && SFX.rin(); later(bowl, rand(16, 26)); }; later(bowl, 5);
    const gong = () => { if (cur !== 'temple') return; deepBell(); later(gong, rand(40, 60)); }; later(gong, 14);
  } else {
    // aitake: A B E F# A B, breathing
    const chord = [440, 493.9, 659.3, 740, 880, 987.8].map(f => tone(f, 'triangle', 0.006, 0.05));
    const breathe = () => { if (cur !== 'shrine') return; const now = ctx.currentTime; chord.forEach((g, i) => { g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(g.gain.value, now); g.gain.linearRampToValueAtTime(0.011 - i * 0.0009, now + 4); g.gain.linearRampToValueAtTime(0.0015, now + 10); }); later(breathe, rand(11, 14)); }; breathe();
    draught();
    const suzu = () => { if (cur !== 'shrine') return; quiet(() => SFX.suzu && SFX.suzu(), 0.35); later(suzu, rand(22, 34)); }; later(suzu, 6);
    const clap = () => { if (cur !== 'shrine') return; clappers(); later(clap, rand(30, 45)); }; later(clap, 15);
    const don = () => { if (cur !== 'shrine') return; quiet(() => SFX.taiko && SFX.taiko(), 0.3); later(don, rand(35, 55)); }; later(don, 24);
  }
}
function stop() {
  timers.forEach(clearTimeout); timers = []; cur = null;
  if (!amb) return; const t = Music.ctx.currentTime; amb.gain.cancelScheduledValues(t); amb.gain.setTargetAtTime(0, t, 0.8);
  const vs = voices; voices = []; setTimeout(() => vs.forEach(v => { try { v.stop(); } catch (e) { /* already stopped */ } }), 4000);
}
// play an SFX more softly, from further away: route its output through a quieter gain for a moment
function quiet(f, k) { const o = SFX.out(); if (!o) return; const v = o.gain.value; o.gain.value = v * k; f(); setTimeout(() => { o.gain.value = v; }, 60); }

// voices humming together on an open vowel, gliding from one to the next
function chant() {
  const ctx = Music.ctx, t = ctx.currentTime + 0.05, dur = rand(5, 7.5), f0 = [98, 98, 110, 87.3][Math.floor(Math.random() * 4)];
  const out = ctx.createGain(); out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(0.05, t + 1.2); out.gain.setValueAtTime(0.05, t + dur - 1.6); out.gain.linearRampToValueAtTime(0, t + dur); out.connect(amb.in);
  const forms = [[700, 1100], [500, 900], [400, 750]].map(([a, b], i) => { const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 6; f.frequency.setValueAtTime(a, t); f.frequency.linearRampToValueAtTime(b * 0.6, t + dur); const g = ctx.createGain(); g.gain.value = [1, 0.6, 0.3][i]; f.connect(g); g.connect(out); return f; });
  for (let v = 0; v < 4; v++) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f0 * (v === 3 ? 0.5 : 1) * (1 + (v - 1.5) * 0.004);
    const g = ctx.createGain(); g.gain.value = 0.25; o.connect(g); forms.forEach(f => g.connect(f)); o.start(t); o.stop(t + dur + 0.1);
  }
}
// the great bell, far away: low partials, a slow beat, a long decay
function deepBell() {
  const ctx = Music.ctx, t = ctx.currentTime + 0.02;
  [[65.4, 0.08, 14], [66.1, 0.06, 14], [130.8, 0.03, 9], [176, 0.025, 7], [262, 0.012, 5]].forEach(([f, a, d]) => {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0005, t + d);
    o.connect(g); g.connect(amb.in); o.start(t); o.stop(t + d + 0.1);
  });
}
// a soft draught through the hall: filtered noise that swells and settles
function draught() {
  const ctx = Music.ctx, n = ctx.sampleRate * 4, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = b; src.loop = true; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
  const g = ctx.createGain(); g.gain.value = 0.02; const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 0.06; lg.gain.value = 0.014; l.connect(lg); lg.connect(g.gain);
  src.connect(lp); lp.connect(g); g.connect(amb.in); src.start(); l.start(); voices.push(src, l);
}
// hyōshigi: two blocks of wood struck together, twice
function clappers() {
  const ctx = Music.ctx;
  [0, 0.42].forEach(dt => {
    const t = ctx.currentTime + 0.02 + dt, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square'; o.frequency.value = 1450;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 8;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(bp); bp.connect(g); g.connect(amb.in); o.start(t); o.stop(t + 0.12);
  });
}

addTick(() => {
  const want = (state.world === 'temple' || state.world === 'shrine') && Music.ctx && !Music.muted ? state.world : null;
  Music.hush = !!(state.world === 'temple' || state.world === 'shrine');
  if (want !== cur) { if (want) start(want); else stop(); }
}, true);
