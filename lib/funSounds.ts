/**
 * Silly dice sounds, synthesized with Web Audio (no files to load).
 * `pitch` (≈0.85–1.15) lets a higher die sound a bit brighter.
 * Works on a live AudioContext or an OfflineAudioContext (for previews/tests).
 */
export type FunSoundId = 'honk' | 'doink' | 'clown' | 'slide' | 'pssh';

export const FUN_SOUNDS: Array<{ id: FunSoundId; emoji: string; label: string }> = [
  { id: 'honk', emoji: '🪿', label: 'Gåsehonk' },
  { id: 'doink', emoji: '🌀', label: 'Doink' },
  { id: 'clown', emoji: '🤡', label: 'Klovnehorn' },
  { id: 'slide', emoji: '🎺', label: 'Slidefløyte' },
  { id: 'pssh', emoji: '🍺', label: 'Ptsssh!' },
];
export const DEFAULT_FUN_SOUND: FunSoundId = 'honk';
export const isFunSoundId = (v: unknown): v is FunSoundId => FUN_SOUNDS.some((s) => s.id === v);

/** Pitch factor for a die face 1–6 (1 = a bit lower, 6 = a bit higher). */
export const pitchForDie = (n: number) => 0.85 + (Math.min(6, Math.max(1, n)) - 1) * 0.06;

function outChain(ctx: BaseAudioContext, level: number) {
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.ratio.value = 5;
  comp.attack.value = 0.003;
  comp.release.value = 0.15;
  const g = ctx.createGain();
  g.gain.value = level;
  g.connect(comp).connect(ctx.destination);
  return g;
}

function env(g: GainNode, t: number, peak: number, attack: number, hold: number, release: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.setValueAtTime(peak, t + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  return t + attack + hold + release;
}

function noise(ctx: BaseAudioContext, seconds: number) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = b;
  return src;
}

function rasp(ctx: BaseAudioContext, amount: number) {
  const ws = ctx.createWaveShaper();
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * amount);
  }
  ws.curve = curve;
  return ws;
}

/** 🪿 Nasal, raspy goose HONK with a pitch bend. */
function honk(ctx: BaseAudioContext, t: number, p: number, out: AudioNode) {
  const g = ctx.createGain();
  const end = env(g, t, 0.5, 0.015, 0.2, 0.08);
  const shaper = rasp(ctx, 4);
  const f1 = ctx.createBiquadFilter();
  f1.type = 'bandpass';
  f1.frequency.value = 1100 * p;
  f1.Q.value = 3;
  const f2 = ctx.createBiquadFilter();
  f2.type = 'bandpass';
  f2.frequency.value = 2600 * p;
  f2.Q.value = 5;
  const mix = ctx.createGain();
  shaper.connect(f1).connect(mix);
  shaper.connect(f2).connect(mix);
  mix.connect(g).connect(out);
  for (const det of [-12, 10]) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.detune.value = det;
    o.frequency.setValueAtTime(300 * p, t);
    o.frequency.exponentialRampToValueAtTime(430 * p, t + 0.05);
    o.frequency.exponentialRampToValueAtTime(390 * p, t + 0.18);
    o.frequency.exponentialRampToValueAtTime(280 * p, end);
    o.connect(shaper);
    o.start(t);
    o.stop(end + 0.02);
  }
}

/** 🌀 Springy «boi-oi-oing». */
function doink(ctx: BaseAudioContext, t: number, p: number, out: AudioNode) {
  const g = ctx.createGain();
  const end = env(g, t, 0.55, 0.005, 0.05, 0.45);
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(220 * p, t);
  o.frequency.exponentialRampToValueAtTime(880 * p, t + 0.05);
  o.frequency.exponentialRampToValueAtTime(260 * p, end);
  // wobble that dies out, like a spring
  const lfo = ctx.createOscillator();
  lfo.frequency.setValueAtTime(18, t);
  lfo.frequency.linearRampToValueAtTime(9, end);
  const depth = ctx.createGain();
  depth.gain.setValueAtTime(90 * p, t + 0.05);
  depth.gain.exponentialRampToValueAtTime(1, end);
  lfo.connect(depth).connect(o.frequency);
  o.connect(g).connect(out);
  o.start(t);
  lfo.start(t);
  o.stop(end + 0.02);
  lfo.stop(end + 0.02);
}

/** 🤡 Bike/clown horn: «honk-honk». */
function clown(ctx: BaseAudioContext, t: number, p: number, out: AudioNode) {
  for (const [start, f] of [[0, 470], [0.2, 420]] as const) {
    const s = t + start;
    const g = ctx.createGain();
    const end = env(g, s, 0.7, 0.01, 0.1, 0.05);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1300 * p;
    bp.Q.value = 1.4;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(f * p, s);
    o.frequency.linearRampToValueAtTime(f * 0.92 * p, end);
    o.connect(bp).connect(g).connect(out);
    o.start(s);
    o.stop(end + 0.02);
  }
}

/** 🎺 Slide whistle going up: «fuuiiiit!». */
function slide(ctx: BaseAudioContext, t: number, p: number, out: AudioNode) {
  const g = ctx.createGain();
  const end = env(g, t, 0.4, 0.03, 0.35, 0.08);
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(500 * p, t);
  o.frequency.exponentialRampToValueAtTime(1900 * p, t + 0.42);
  const vib = ctx.createOscillator();
  vib.frequency.value = 7;
  const vd = ctx.createGain();
  vd.gain.value = 18 * p;
  vib.connect(vd).connect(o.frequency);
  o.connect(g).connect(out);
  // a little breath
  const br = noise(ctx, 0.5);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2500;
  bp.Q.value = 1;
  const bg = ctx.createGain();
  bg.gain.value = 0.05;
  br.connect(bp).connect(bg).connect(g);
  o.start(t);
  vib.start(t);
  br.start(t);
  o.stop(end + 0.02);
  vib.stop(end + 0.02);
  br.stop(end + 0.02);
}

/** 🍺 A can/bottle being opened: tab click, gas hiss, a bit of fizz. */
function pssh(ctx: BaseAudioContext, t: number, p: number, out: AudioNode) {
  // «pt» – the tab/cap click
  const click = noise(ctx, 0.03);
  const cbp = ctx.createBiquadFilter();
  cbp.type = 'bandpass';
  cbp.frequency.value = 1800 * p;
  cbp.Q.value = 1.2;
  const cg = ctx.createGain();
  env(cg, t, 0.9, 0.001, 0.004, 0.02);
  click.connect(cbp).connect(cg).connect(out);
  click.start(t);
  // «sssh» – gas rushing out: bright hiss that softens as pressure drops
  const hiss = noise(ctx, 0.8);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 2500;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 0.8;
  bp.frequency.setValueAtTime(7500 * p, t + 0.02);
  bp.frequency.exponentialRampToValueAtTime(4200 * p, t + 0.55);
  const hg = ctx.createGain();
  hg.gain.setValueAtTime(0.0001, t + 0.015);
  hg.gain.exponentialRampToValueAtTime(0.75, t + 0.04);
  hg.gain.exponentialRampToValueAtTime(0.3, t + 0.2);
  hg.gain.exponentialRampToValueAtTime(0.0001, t + 0.62);
  hiss.connect(hp).connect(bp).connect(hg).connect(out);
  hiss.start(t + 0.015);
  hiss.stop(t + 0.7);
  // fizz – a few tiny bubble pops
  for (let i = 0; i < 9; i++) {
    const bt = t + 0.12 + i * 0.045 + ((i * 37) % 10) / 400;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime((2200 + ((i * 53) % 9) * 180) * p, bt);
    o.frequency.exponentialRampToValueAtTime((3200 + ((i * 29) % 7) * 200) * p, bt + 0.015);
    const g = ctx.createGain();
    env(g, bt, 0.06, 0.001, 0.002, 0.018);
    o.connect(g).connect(out);
    o.start(bt);
    o.stop(bt + 0.03);
  }
}

const PLAYERS: Record<FunSoundId, (ctx: BaseAudioContext, t: number, p: number, out: AudioNode) => void> = {
  honk,
  doink,
  clown,
  slide,
  pssh,
};

export function playFunSound(ctx: BaseAudioContext, id: FunSoundId, pitch = 1, when = ctx.currentTime + 0.01) {
  const out = outChain(ctx, 0.9);
  PLAYERS[id](ctx, when, pitch, out);
}
