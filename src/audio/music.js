import { clamp } from '../core/util.js';
import { IDB, flag } from '../settings/storage.js';
import { late, provide } from '../core/late.js';

// names other modules reach through late (see core/late.js)
provide({
  get Music() { return Music; },
});

/* ================= music ================= */
const KEYN = 63, SCALE = [0, 2, 4, 5, 7, 9, 11];
const PROGS = [[5, 3, 0, 4], [0, 4, 5, 3], [3, 0, 4, 5], [5, 4, 3, 4], [0, 5, 3, 4], [3, 4, 0, 5], [5, 3, 4, 0]];
const deg = d => SCALE[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
export const Music = {
  ctx: null, muted: flag.get('muted') === '1', mode: flag.get('music') === 'own' ? 'own' : 'piano', ducked: false, timer: null,
  nextBar: 0, bar: 0, prog: PROGS[0], mel: 3, files: [], fileIdx: 0, src: null, starting: false,
  async init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    const ctx = this.ctx;
    this.master = ctx.createGain(); this.master.gain.value = 0;
    const warm = ctx.createBiquadFilter(); warm.type = 'lowpass'; warm.frequency.value = 7500;
    this.master.connect(warm); warm.connect(ctx.destination);
    this.pianoBus = ctx.createGain();
    const conv = ctx.createConvolver(); conv.buffer = this.impulse(3.6);
    const wet = ctx.createGain(); wet.gain.value = 0.55; const dry = ctx.createGain(); dry.gain.value = 0.7;
    this.pianoBus.connect(dry); dry.connect(this.master); this.pianoBus.connect(conv); conv.connect(wet); wet.connect(this.master);
    this.ownBus = ctx.createGain(); this.ownBus.gain.value = 0.9; this.ownBus.connect(this.master);
    if (this.mode === 'own') { const ok = await this.loadStored(); if (ok) { this.playOwn(); return; } this.mode = 'piano'; }
    if (!this.muted) this.startPiano();
  },
  impulse(sec) {
    const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.8); }
    return b;
  },
  note(m, t, vel, dur) {
    const ctx = this.ctx, f = 440 * Math.pow(2, (m - 69) / 12);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.2;
    lp.frequency.setValueAtTime(Math.min(11000, f * (4 + vel * 12)), t); lp.frequency.exponentialRampToValueAtTime(Math.max(260, f * 1.3), t + Math.min(dur, 3.5));
    lp.connect(this.pianoBus);
    const P = [[1, 1], [2, .36], [3, .15], [4, .07], [5, .035], [7, .012]];
    const decay = dur * (m < 52 ? 1.4 : 1);
    P.forEach(([k, a]) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), end = t + decay / (1 + k * 0.55);
      o.frequency.value = f * k * (1 + 0.00035 * k * k);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(a * vel * 0.3, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, end);
      o.connect(g); g.connect(lp); o.start(t); o.stop(end + 0.05);
    });
  },
  writeBar(t) {
    if (this.bar % 4 === 0) this.prog = PROGS[Math.floor(Math.random() * PROGS.length)];
    const pos = this.bar % 4, phraseEnd = pos === 3 && Math.floor(this.bar / 4) % 2 === 1;
    const beat = 60 / (56 + Math.random() * 6), len = beat * 4 * (phraseEnd ? 1.3 : 1);
    const d = this.prog[pos], root = KEYN + deg(d);
    const tones = [0, 2, 4].map(k => KEYN + deg(d + k)); if (Math.random() < 0.35) tones.push(KEYN + deg(d + 8));
    let b = root - 24; while (b < 38) b += 12; while (b > 50) b -= 12;
    this.note(b, t, 0.5, len * 1.6);
    if (!phraseEnd && Math.random() < 0.55) this.note(b + 7, t + beat * 2 + Math.random() * 0.03, 0.26, len);
    const arp = [...new Set(tones.map(x => { let y = x; while (y < 58) y += 12; while (y > 71) y -= 12; return y; }))].sort((a, c) => a - c);
    const pat = [[0, 1, 2, 1, 3, 1, 2, 1], [0, 2, 1, 2, 3, 2, 1, 2], [0, 1, 2, 3, 2, 1, 2, 1]][Math.floor(Math.random() * 3)];
    for (let i = 0; i < 8; i++) {
      if (phraseEnd && i > 2) break; if (Math.random() < 0.2) continue;
      const pi = pat[i], n = arp[pi % arp.length] + (pi >= arp.length ? 12 : 0);
      this.note(n, t + i * beat / 2 * (1 + (Math.random() - .5) * 0.05) + Math.random() * 0.02, 0.15 + Math.random() * 0.1, beat * 3);
    }
    if (Math.random() < 0.6 && !phraseEnd) {
      const PD = [0, 1, 2, 4, 5, 7, 8, 9]; let mt = t + (Math.random() < 0.5 ? 0 : beat), c = 1 + Math.floor(Math.random() * 3);
      for (let k = 0; k < c; k++) {
        this.mel = clamp(this.mel + Math.round((Math.random() - 0.5) * 3), 0, PD.length - 1);
        const m = Math.random() < 0.45 ? arp[Math.floor(Math.random() * arp.length)] + 12 : KEYN + 12 + deg(PD[this.mel]) - 12 * (deg(PD[this.mel]) > 14 ? 1 : 0);
        this.note(m, mt, 0.3 + Math.random() * 0.12, beat * 4);
        mt += beat * (1 + Math.floor(Math.random() * 2)); if (mt > t + len - 0.3) break;
      }
    }
    this.bar++; return len;
  },
  startPiano() {
    if (!this.ctx) return; this.stopOwn(); this.stopPiano();
    this.nextBar = this.ctx.currentTime + 0.5; this.bar = 0;
    this.timer = setInterval(() => { while (this.nextBar < this.ctx.currentTime + 1.6) this.nextBar += this.writeBar(this.nextBar); }, 200);
  },
  stopPiano() { clearInterval(this.timer); this.timer = null; },
  async loadStored() { try { const f = await IDB.get('music'); if (f && f.length) { this.files = f; return true; } } catch (e) {} return false; },
  async useFiles(list) {
    const arr = [...list].filter(f => /^audio\//.test(f.type) || /\.(mp3|m4a|aac|wav|ogg|oga|flac|opus)$/i.test(f.name));
    if (!arr.length) { late.toast('Those files are not audio files. Choose MP3, M4A, WAV or OGG files.'); return; }
    this.files = arr; this.fileIdx = 0; this.mode = 'own'; flag.set('music', 'own');
    try { await IDB.set('music', arr); } catch (e) {}
    if (this.muted) { this.muted = false; flag.set('muted', '0'); late.setSoundUI(); }
    await this.init(); if (this.ctx.state === 'suspended') this.ctx.resume();
    this.playOwn(); late.setMusicMenu();
  },
  playOwn() { this.stopPiano(); this.stopOwn(); if (!this.muted) this.playNextOwn(); },
  async playNextOwn() {
    if (this.mode !== 'own' || !this.files.length || this.muted) return;
    const f = this.files[this.fileIdx % this.files.length], ctx = this.ctx;
    try {
      const buf = await f.arrayBuffer();
      const audio = await new Promise((res, rej) => ctx.decodeAudioData(buf, res, rej));
      if (this.mode !== 'own' || this.muted) return;
      this.stopOwn();
      const src = ctx.createBufferSource(); src.buffer = audio; src.connect(this.ownBus);
      src.onended = () => { if (this.src === src && this.mode === 'own') { this.src = null; this.fileIdx++; this.playNextOwn(); } };
      src.start(); this.src = src;
      late.toast(`Now playing ${f.name.replace(/\.[^.]+$/, '')}.`, 3500);
    } catch (e) {
      late.toast(`This browser could not play ${f.name}. Try an MP3 or M4A file.`);
      if (this.files.length > 1 && this.fileIdx < this.files.length * 2) { this.fileIdx++; this.playNextOwn(); }
    }
  },
  stopOwn() { if (this.src) { this.src.onended = null; try { this.src.stop(); } catch (e) {} this.src = null; } },
  backToPiano() { this.mode = 'piano'; flag.set('music', 'piano'); this.stopOwn(); this.files = []; IDB.del('music'); if (!this.muted) this.startPiano(); late.setMusicMenu(); },
  setMuted(m) {
    this.muted = m; flag.set('muted', m ? '1' : '0');
    if (m) { this.stopPiano(); this.stopOwn(); }
    else { this.init().then(() => { if (this.mode === 'own') this.playOwn(); else this.startPiano(); }); }
  },
  // rain: looped noise in three layers (low wash, hiss, patter); it follows the sound button but not the reading duck
  makeRain() {
    const ctx = this.ctx, sr = ctx.sampleRate, n = sr * 3;
    const buf = (fill) => { const b = ctx.createBuffer(2, n, sr); for (let ch = 0; ch < 2; ch++) fill(b.getChannelData(ch)); return b; };
    const white = buf(d => { for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; });
    const patter = buf(d => { for (let i = 0; i < n; i++) if (Math.random() < 0.0016) { const a = 0.3 + Math.random() * 0.7, len = 60 + Math.random() * 200; for (let k = 0; k < len && i + k < n; k++) d[i + k] += (Math.random() * 2 - 1) * a * Math.exp(-k / (len * 0.25)); } });
    this.rainOut = ctx.createGain(); this.rainOut.gain.value = 0; this.rainOut.connect(ctx.destination);
    [[white, 'lowpass', 700, 0.5, 0.55], [white, 'bandpass', 2600, 0.6, 0.16], [patter, 'highpass', 1400, 0.7, 0.32]].forEach(([b, type, f, q, g], i) => {
      const src = ctx.createBufferSource(); src.buffer = b; src.loop = true; src.loopStart = 0; src.loopEnd = 3;
      const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const gn = ctx.createGain(); gn.gain.value = g; src.connect(fl); fl.connect(gn); gn.connect(this.rainOut); src.start(ctx.currentTime, i * 0.9);
    });
  },
  update(rain = 0) {
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.ducked ? 0.32 : 0.6, this.ctx.currentTime, 0.8);
    if (!this.rainOut && rain > 0.01 && !this.muted) this.makeRain();
    if (this.rainOut) this.rainOut.gain.setTargetAtTime(this.muted ? 0 : rain * 0.5, this.ctx.currentTime, 0.5);
  }
};

