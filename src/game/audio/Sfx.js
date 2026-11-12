/**
 * Tiny synthesized sound effects (WebAudio, no audio files).
 * Audio starts on the first key press / click (browser autoplay rules).
 */
let ctx = null;
let master = null;
let noise = null;
let muted = false;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function unlockAudio() {
  ac();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.32;
  return muted;
}

function env(node, t, a, peak, d) {
  node.gain.setValueAtTime(0.0001, t);
  node.gain.exponentialRampToValueAtTime(peak, t + a);
  node.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function tone(type, f0, f1, dur, vol = 0.5, delay = 0) {
  const c = ac();
  if (!c || muted) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  env(g, t, 0.005, vol, dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function hiss(dur, vol, filterType, f0, f1, delay = 0) {
  const c = ac();
  if (!c || muted) return;
  const t = c.currentTime + delay;
  const s = c.createBufferSource();
  s.buffer = noise;
  const f = c.createBiquadFilter();
  f.type = filterType;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  f.Q.value = 1.2;
  const g = c.createGain();
  env(g, t, 0.004, vol, dur);
  s.connect(f).connect(g).connect(master);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.05);
}

export const Sfx = {
  swing(heavy) {
    hiss(heavy ? 0.16 : 0.1, heavy ? 0.35 : 0.22, 'bandpass', heavy ? 900 : 1600, heavy ? 300 : 700);
  },
  hit(heavy) {
    tone('sine', heavy ? 140 : 190, 45, heavy ? 0.22 : 0.12, 0.9);
    hiss(heavy ? 0.14 : 0.08, 0.6, 'lowpass', 3000, 400);
    if (heavy) tone('square', 90, 40, 0.18, 0.25);
  },
  block() {
    tone('square', 1400, 900, 0.06, 0.18);
    tone('triangle', 2400, 1800, 0.09, 0.2, 0.01);
    hiss(0.05, 0.25, 'highpass', 3000, 5000);
  },
  land() {
    hiss(0.12, 0.35, 'lowpass', 600, 120);
  },
  dash() {
    hiss(0.12, 0.2, 'bandpass', 500, 1500);
  },
  projectile() {
    tone('sawtooth', 300, 900, 0.25, 0.18);
    tone('sine', 600, 1400, 0.3, 0.2, 0.02);
  },
  grab() {
    tone('square', 220, 160, 0.08, 0.2);
  },
  ko() {
    tone('sine', 120, 30, 1.2, 1);
    hiss(0.8, 0.5, 'lowpass', 1800, 80);
  },
  announce() {
    tone('square', 523, 523, 0.08, 0.12);
    tone('square', 784, 784, 0.14, 0.12, 0.08);
  },
  fight() {
    tone('sawtooth', 330, 660, 0.25, 0.18);
    hiss(0.3, 0.3, 'bandpass', 800, 3000);
  },
  move() {
    tone('square', 660, 660, 0.04, 0.08);
  },
  confirm() {
    tone('square', 660, 660, 0.05, 0.1);
    tone('square', 990, 990, 0.08, 0.1, 0.05);
  },
  back() {
    tone('square', 440, 300, 0.08, 0.08);
  },
};
