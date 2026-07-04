// sfx.js — synthesized sound effects. No audio files: every sound is generated
// with WebAudio oscillators + filtered noise, so the game stays a zero-asset
// static site. Browsers block audio until the first user gesture, so the
// AudioContext is created lazily on the first pointer press. 🔊 toggle persists.

const Sfx = {
  ctx: null,
  master: null,
  enabled: (localStorage.getItem('mindbox.sfx') ?? '1') === '1',
  _last: {},           // name -> time, to rate-limit spammy events

  _init() {
    if (this.ctx) return true;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      return true;
    } catch (e) { return false; }
  },

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('mindbox.sfx', this.enabled ? '1' : '0');
    return this.enabled;
  },

  // --- primitives ---------------------------------------------------------
  _tone(freq, dur, { type = 'sine', to = freq, gain = 0.5, delay = 0 } = {}) {
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (to !== freq) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  },

  _noise(dur, { freq = 800, q = 1, gain = 0.5, to = freq, delay = 0 } = {}) {
    const t0 = this.ctx.currentTime + delay;
    const n = Math.ceil(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t0);
    if (to !== freq) f.frequency.exponentialRampToValueAtTime(Math.max(40, to), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0);
  },

  // --- the sound recipes ---------------------------------------------------
  RECIPES: {
    meteor(S)   { S._noise(0.8, { freq: 3000, to: 120, gain: 0.7 }); S._tone(160, 0.9, { type: 'sine', to: 34, gain: 0.8, delay: 0.12 }); },
    bomb(S)     { S._noise(0.5, { freq: 2200, to: 100, gain: 0.8 }); S._tone(120, 0.5, { type: 'square', to: 40, gain: 0.4 }); },
    volcano(S)  { S._tone(70, 1.4, { type: 'sawtooth', to: 28, gain: 0.7 }); S._noise(1.4, { freq: 500, to: 90, gain: 0.55 }); },
    lightning(S){ S._noise(0.16, { freq: 8000, to: 2500, gain: 0.7, q: 2 }); S._tone(900, 0.3, { type: 'sawtooth', to: 90, gain: 0.35, delay: 0.03 }); },
    tornado(S)  { S._noise(1.2, { freq: 300, to: 1800, gain: 0.5, q: 4 }); S._noise(1.2, { freq: 1800, to: 250, gain: 0.4, q: 4, delay: 0.25 }); },
    tsunami(S)  { S._noise(1.3, { freq: 150, to: 900, gain: 0.65, q: 0.7 }); S._noise(0.9, { freq: 900, to: 200, gain: 0.5, delay: 0.5 }); },
    plague(S)   { S._tone(220, 0.7, { type: 'triangle', to: 180, gain: 0.3 }); S._tone(233, 0.7, { type: 'triangle', to: 170, gain: 0.3, delay: 0.06 }); },
    blessing(S) { [523, 659, 784, 1047].forEach((f, i) => S._tone(f, 0.5, { type: 'sine', gain: 0.28, delay: i * 0.09 })); },
    summon(S)   { S._tone(55, 1.0, { type: 'sawtooth', to: 110, gain: 0.55 }); S._tone(58, 1.0, { type: 'sawtooth', to: 116, gain: 0.4, delay: 0.05 }); },
    raid(S)     { S._noise(0.25, { freq: 1500, to: 500, gain: 0.5 }); S._tone(392, 0.4, { type: 'square', to: 330, gain: 0.3, delay: 0.1 }); },
    smite(S)    { S._tone(600, 0.25, { type: 'square', to: 60, gain: 0.4 }); },
    fire(S)     { S._noise(0.5, { freq: 1200, to: 700, gain: 0.35, q: 2 }); },
    build(S)    { S._tone(180, 0.09, { type: 'square', gain: 0.25 }); S._tone(230, 0.09, { type: 'square', gain: 0.25, delay: 0.11 }); },
    craft(S)    { S._tone(880, 0.25, { type: 'sine', gain: 0.3 }); S._tone(1320, 0.35, { type: 'sine', gain: 0.25, delay: 0.1 }); },
    conquest(S) { [392, 392, 523, 659].forEach((f, i) => S._tone(f, 0.3, { type: 'square', gain: 0.22, delay: i * 0.14 })); },
    war(S)      { S._noise(0.2, { freq: 900, to: 300, gain: 0.4 }); S._tone(196, 0.5, { type: 'square', to: 185, gain: 0.25, delay: 0.08 }); },
    click(S)    { S._tone(700, 0.05, { type: 'square', gain: 0.12 }); },
  },

  play(name, limitMs = 90) {
    if (!this.enabled || !this.RECIPES[name]) return;
    if (!this._init()) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const now = performance.now();
    if (now - (this._last[name] || 0) < limitMs) return;   // rate-limit
    this._last[name] = now;
    try { this.RECIPES[name](this); } catch (e) {}
  },
};

// browsers unlock audio on the first gesture — warm the context then
window.addEventListener('pointerdown', () => { if (Sfx.enabled) Sfx._init(); }, { once: true });
