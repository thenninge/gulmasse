/**
 * «Ta-da-da-DAAA!» fanfare for when the wheel picks someone. Fully synthesized
 * with Web Audio (no sound files): brass section (detuned saws through an
 * opening low-pass), chord + bass on the final note with vibrato, timpani,
 * crash cymbal, a sparkle arpeggio on top, and a short hall reverb.
 * Works on a live AudioContext or an OfflineAudioContext (for rendering).
 */
const NOTE = { C3: 130.81, G3: 196.0, C4: 261.63, E4: 329.63, G4: 392.0, C5: 523.25, E5: 659.25, G5: 783.99, C6: 1046.5, E6: 1318.51, G6: 1567.98, C7: 2093.0 };

function noiseBuffer(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function hallImpulse(ctx: BaseAudioContext, seconds = 2.2, decay = 3): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

/** One brass note: 3 detuned saws + a soft square an octave down, filter "blare" envelope. */
function brass(ctx: BaseAudioContext, out: AudioNode, freq: number, start: number, dur: number, level: number, vibrato = false) {
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 2;
  filter.frequency.setValueAtTime(500, start);
  filter.frequency.exponentialRampToValueAtTime(Math.min(5200, freq * 7), start + 0.06);
  filter.frequency.exponentialRampToValueAtTime(Math.min(2600, freq * 4), start + 0.25);

  const amp = ctx.createGain();
  const end = start + dur;
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(level, start + 0.03);
  amp.gain.exponentialRampToValueAtTime(level * 0.7, start + 0.18);
  amp.gain.setValueAtTime(level * 0.7, Math.max(start + 0.18, end - 0.12));
  amp.gain.exponentialRampToValueAtTime(0.0001, end + 0.25);
  filter.connect(amp).connect(out);

  const voices: Array<[OscillatorType, number, number]> = [
    ['sawtooth', 1, -8],
    ['sawtooth', 1, 0],
    ['sawtooth', 1, 7],
    ['square', 0.5, 0],
  ];
  let lfo: OscillatorNode | null = null;
  let lfoGain: GainNode | null = null;
  if (vibrato) {
    lfo = ctx.createOscillator();
    lfo.frequency.value = 5.5;
    lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0, start);
    lfoGain.gain.linearRampToValueAtTime(freq * 0.006, start + 0.45); // ~10 cents, fades in
    lfo.connect(lfoGain);
    lfo.start(start);
    lfo.stop(end + 0.3);
  }
  for (const [type, mult, cents] of voices) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq * mult;
    o.detune.value = cents;
    if (lfoGain) lfoGain.connect(o.frequency);
    const g = ctx.createGain();
    g.gain.value = type === 'square' ? 0.25 : 0.33;
    o.connect(g).connect(filter);
    o.start(start);
    o.stop(end + 0.3);
  }
}

function timpani(ctx: BaseAudioContext, out: AudioNode, start: number, level: number) {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(110, start);
  o.frequency.exponentialRampToValueAtTime(58, start + 0.35);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(level, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + 1.2);
  o.connect(g).connect(out);
  o.start(start);
  o.stop(start + 1.3);
  // mallet thump
  const n = ctx.createBufferSource();
  n.buffer = noiseBuffer(ctx, 0.1);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(level * 0.6, start);
  ng.gain.exponentialRampToValueAtTime(0.0001, start + 0.08);
  n.connect(lp).connect(ng).connect(out);
  n.start(start);
}

function crash(ctx: BaseAudioContext, out: AudioNode, start: number, level: number) {
  const n = ctx.createBufferSource();
  n.buffer = noiseBuffer(ctx, 2.2);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 5500;
  const peak = ctx.createBiquadFilter();
  peak.type = 'peaking';
  peak.frequency.value = 8000;
  peak.gain.value = 6;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(level, start + 0.005);
  g.gain.exponentialRampToValueAtTime(level * 0.35, start + 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, start + 2.1);
  n.connect(hp).connect(peak).connect(g).connect(out);
  n.start(start);
}

function sparkle(ctx: BaseAudioContext, out: AudioNode, start: number, level: number) {
  [NOTE.C6, NOTE.E6, NOTE.G6, NOTE.C7, NOTE.G6, NOTE.C7].forEach((f, i) => {
    const t = start + i * 0.07;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const o2 = ctx.createOscillator(); // bell overtone
    o2.type = 'sine';
    o2.frequency.value = f * 2.76;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    const g2 = ctx.createGain();
    g2.gain.value = 0.25;
    o.connect(g);
    o2.connect(g2).connect(g);
    g.connect(out);
    o.start(t);
    o2.start(t);
    o.stop(t + 0.7);
    o2.stop(t + 0.7);
  });
}

/** Schedule the fanfare on `ctx`. Returns its length in seconds. */
export function playFanfare(ctx: BaseAudioContext, when = ctx.currentTime + 0.02): number {
  // master chain: dry + reverb → compressor → output (keeps phone speakers from clipping)
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 8;
  comp.ratio.value = 6;
  comp.attack.value = 0.003;
  comp.release.value = 0.25;
  const master = ctx.createGain();
  master.gain.value = 0.9;
  comp.connect(master).connect(ctx.destination);

  const bus = ctx.createGain();
  const dry = ctx.createGain();
  dry.gain.value = 0.85;
  const reverb = ctx.createConvolver();
  reverb.buffer = hallImpulse(ctx);
  const wet = ctx.createGain();
  wet.gain.value = 0.28;
  bus.connect(dry).connect(comp);
  bus.connect(reverb).connect(wet).connect(comp);

  const t0 = when;
  // pickup: da-da-da
  brass(ctx, bus, NOTE.G4, t0, 0.11, 0.22);
  brass(ctx, bus, NOTE.G4, t0 + 0.14, 0.11, 0.22);
  brass(ctx, bus, NOTE.G4, t0 + 0.28, 0.11, 0.24);
  // DAAA: C major chord, melody on top, bass below
  const big = t0 + 0.44;
  const hold = 1.35;
  brass(ctx, bus, NOTE.C5, big, hold, 0.26, true);
  brass(ctx, bus, NOTE.E5, big, hold, 0.16, true);
  brass(ctx, bus, NOTE.G5, big, hold, 0.13, true);
  brass(ctx, bus, NOTE.C4, big, hold, 0.17);
  brass(ctx, bus, NOTE.G3, big, hold, 0.1);
  brass(ctx, bus, NOTE.C3, big, hold, 0.14);
  timpani(ctx, bus, big, 0.9);
  crash(ctx, bus, big, 0.22);
  sparkle(ctx, bus, big + 0.12, 0.09);
  return 0.44 + hold + 0.6;
}
