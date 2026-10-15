// Fully synthesized WebAudio sound effects (no audio files).
let ctx = null, master = null, filter = null, noiseBuf = null;
let lastEnemyShot = 0;

export function initAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.55;
      filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 18000;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 6;
      master.connect(filter); filter.connect(comp); comp.connect(ctx.destination);
      const len = ctx.sampleRate * 1.5;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      // iOS unlock: play a silent buffer inside the user gesture
      const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(0);
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch (e) { ctx = null; }
}

export function setMuffled(on) { if (filter) filter.frequency.value = on ? 2600 : 18000; }

function env(g, t, peak, decay, attack = 0.002) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function noise(t, dur, type, freq, peak, out = master, q = 0.7, sweepTo = null) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  const g = ctx.createGain(); env(g, t, peak, dur);
  s.connect(f); f.connect(g); g.connect(out);
  s.start(t, Math.random() * 0.8); s.stop(t + dur + 0.05);
}

function tone(t, type, f0, f1, dur, peak, out = master, attack = 0.002) {
  const o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
  const g = ctx.createGain(); env(g, t, peak, dur, attack);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + attack + 0.05);
}

function bus(vol, lp) {
  const g = ctx.createGain(); g.gain.value = vol;
  if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; g.connect(f); f.connect(master); }
  else g.connect(master);
  return g;
}

export function playShot(sfx, vol = 1, lp = 0) {
  if (!ctx) return;
  const t = ctx.currentTime, out = bus(vol, lp);
  const v = 0.92 + Math.random() * 0.16;
  switch (sfx.t) {
    case 'gun':
      noise(t, sfx.decay, 'lowpass', sfx.f * v, sfx.gain, out, 0.8, sfx.f * 0.25);
      noise(t, 0.03, 'highpass', 4000, sfx.gain * 0.5, out);
      tone(t, 'sine', sfx.thump * v, sfx.thump * 0.35, sfx.decay * 1.1, sfx.gain * 0.9, out);
      break;
    case 'smart':
      noise(t, sfx.decay, 'bandpass', sfx.f * v, sfx.gain, out, 1.5);
      tone(t, 'square', 1800 * v, 600, 0.05, 0.12, out);
      tone(t, 'sine', sfx.thump, 50, 0.1, 0.6, out);
      break;
    case 'rail':
      tone(t, 'sawtooth', 3200, 90, 0.45, 0.35, out);
      tone(t, 'sine', 140, 30, 0.6, 1.0, out);
      noise(t, 0.35, 'bandpass', 5000, 0.8, out, 0.6, 400);
      break;
    case 'laser':
      tone(t, 'sawtooth', 2200 * v, 500, 0.07, 0.22, out);
      tone(t, 'sine', 1100 * v, 900, 0.06, 0.25, out);
      break;
    case 'plasma':
      tone(t, 'square', 950 * v, 110, 0.2, 0.28, out);
      noise(t, 0.15, 'bandpass', 1500, 0.5, out, 2, 300);
      tone(t, 'sine', 90, 40, 0.15, 0.6, out);
      break;
    case 'coil':
      tone(t, 'sine', 900, 4200, 0.06, 0.35, out);
      noise(t, 0.05, 'highpass', 6000, 0.7, out);
      tone(t, 'triangle', 200, 40, 0.25, 0.9, out);
      break;
    case 'missile':
      noise(t, 0.7, 'bandpass', 1200, 0.9, out, 0.8, 250);
      tone(t, 'sine', 80, 35, 0.3, 0.8, out);
      break;
  }
}

export function playEnemyShot(sfx, dist) {
  if (!ctx) return;
  const now = performance.now(); if (now - lastEnemyShot < 60) return; lastEnemyShot = now;
  const vol = Math.max(0.08, 0.55 - dist * 0.01);
  playShot(sfx, vol, 2200);
}

export function playExplosion(dist = 5) {
  if (!ctx) return;
  const t = ctx.currentTime, out = bus(Math.max(0.2, 1 - dist * 0.02));
  noise(t, 1.0, 'lowpass', 1400, 1.0, out, 0.7, 80);
  tone(t, 'sine', 70, 25, 0.9, 1.0, out);
}

export function playReload(dur) {
  if (!ctx) return;
  const t = ctx.currentTime;
  noise(t + 0.05, 0.04, 'highpass', 3000, 0.4);
  noise(t + dur * 0.45, 0.05, 'bandpass', 1800, 0.5, master, 3);
  noise(t + dur * 0.85, 0.04, 'highpass', 2500, 0.55);
  tone(t + dur * 0.85, 'square', 300, 200, 0.03, 0.08);
}

export function playPing() { if (!ctx) return; const t = ctx.currentTime + 0.05; tone(t, 'sine', 2600, 2500, 0.6, 0.18); tone(t, 'sine', 3900, 3850, 0.4, 0.08); }
export function playDry() { if (!ctx) return; noise(ctx.currentTime, 0.03, 'highpass', 5000, 0.3); }
export function playHit(kill, head) { if (!ctx) return; const t = ctx.currentTime; tone(t, 'sine', kill ? 900 : (head ? 2400 : 1700), kill ? 600 : 1500, kill ? 0.15 : 0.05, 0.2); if (kill) tone(t + 0.05, 'triangle', 1400, 1200, 0.12, 0.12); }
export function playHurt() { if (!ctx) return; const t = ctx.currentTime; tone(t, 'sine', 120, 50, 0.2, 0.6); noise(t, 0.08, 'lowpass', 600, 0.4); }
export function playSwap() { if (!ctx) return; const t = ctx.currentTime; noise(t, 0.05, 'bandpass', 1200, 0.3, master, 2); noise(t + 0.12, 0.04, 'highpass', 3000, 0.3); }
export function playHorn(good) {
  if (!ctx) return; const t = ctx.currentTime;
  const notes = good ? [440, 554, 659] : [330, 247];
  notes.forEach((n, i) => tone(t + i * 0.16, 'square', n, n, 0.22, 0.09, master, 0.01));
}

export function playThrow() { if (!ctx) return; const t = ctx.currentTime; noise(t, 0.25, 'bandpass', 900, 0.35, master, 1.2, 2500); }
export function playBounce(v = 0.5) { if (!ctx) return; const t = ctx.currentTime; tone(t, 'triangle', 1700 + Math.random() * 600, 900, 0.06, 0.15 * v); noise(t, 0.03, 'highpass', 4000, 0.2 * v); }
export function playPin() { if (!ctx) return; const t = ctx.currentTime; tone(t, 'square', 3200, 2800, 0.03, 0.05); noise(t + 0.08, 0.03, 'highpass', 5000, 0.2); }
export function playFlashbang(dist = 5) {
  if (!ctx) return; const t = ctx.currentTime, out = bus(Math.max(0.25, 1 - dist * 0.03));
  noise(t, 0.5, 'highpass', 2500, 1.0, out, 0.5); tone(t, 'sine', 90, 40, 0.4, 0.8, out);
  if (dist < 10) tone(t + 0.1, 'sine', 3800, 3700, 2.2, 0.06 * (1 - dist / 10), master, 0.05);
}
export function playSmoke() { if (!ctx) return; const t = ctx.currentTime; noise(t, 1.6, 'highpass', 1800, 0.35, master, 0.4, 4000); tone(t, 'sine', 140, 80, 0.1, 0.3); }
export function playCannon(dist = 0) {
  if (!ctx) return; const t = ctx.currentTime, out = bus(Math.max(0.3, 1 - dist * 0.015));
  noise(t, 0.9, 'lowpass', 2200, 1.2, out, 0.7, 90); tone(t, 'sine', 65, 22, 0.8, 1.2, out); noise(t, 0.05, 'highpass', 3000, 0.6, out);
}
export function playClunk() { if (!ctx) return; const t = ctx.currentTime; tone(t, 'square', 180, 90, 0.12, 0.15); noise(t, 0.08, 'lowpass', 900, 0.4); }

// continuous engine rumble for vehicles
let eng = null;
export function engine(on, throttle = 0, hover = false) {
  if (!ctx) return;
  if (on && !eng) {
    const o = ctx.createOscillator(); o.type = hover ? 'triangle' : 'sawtooth';
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = hover ? 900 : 380;
    const g = ctx.createGain(); g.gain.value = 0;
    o.connect(f); f.connect(g); g.connect(master); o.start();
    eng = { o, g, f, hover };
  }
  if (!on && eng) { const e = eng; eng = null; e.g.gain.setTargetAtTime(0, ctx.currentTime, 0.1); e.o.stop(ctx.currentTime + 0.5); return; }
  if (eng) {
    const k = Math.min(1, Math.abs(throttle));
    eng.o.frequency.setTargetAtTime((eng.hover ? 110 : 38) + k * (eng.hover ? 90 : 34), ctx.currentTime, 0.15);
    eng.g.gain.setTargetAtTime(0.1 + k * 0.12, ctx.currentTime, 0.15);
  }
}
