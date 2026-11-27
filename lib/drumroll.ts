/**
 * A proper snare drum roll for «Avslør min stemme»: alternating hand strokes
 * that speed up and crescendo, ending on a crash cymbal + bass drum exactly
 * when the vote is revealed. Synthesized with Web Audio, scheduled on the
 * audio clock (tight timing, unlike setInterval). Works offline too.
 */
function noiseBuffer(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function roomImpulse(ctx: BaseAudioContext, seconds = 0.9): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.5);
  }
  return b;
}

/** One snare stroke: crisp wires (filtered noise) + drum body (short tone). */
function snareStroke(ctx: BaseAudioContext, out: AudioNode, noise: AudioBuffer, t: number, level: number) {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = 0.9 + Math.random() * 0.2;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1200;
  const bp = ctx.createBiquadFilter();
  bp.type = 'peaking';
  bp.frequency.value = 3500;
  bp.gain.value = 5;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(level, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  src.connect(hp).connect(bp).connect(g).connect(out);
  src.start(t, Math.random() * 0.05, 0.1);

  const body = ctx.createOscillator();
  body.type = 'triangle';
  body.frequency.setValueAtTime(240, t);
  body.frequency.exponentialRampToValueAtTime(170, t + 0.05);
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(0.0001, t);
  bg.gain.exponentialRampToValueAtTime(level * 0.45, t + 0.002);
  bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  body.connect(bg).connect(out);
  body.start(t);
  body.stop(t + 0.07);
}

function finale(ctx: BaseAudioContext, out: AudioNode, t: number) {
  // crash cymbal
  const c = ctx.createBufferSource();
  c.buffer = noiseBuffer(ctx, 1.6);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 4500;
  const cg = ctx.createGain();
  cg.gain.setValueAtTime(0.0001, t);
  cg.gain.exponentialRampToValueAtTime(0.3, t + 0.004);
  cg.gain.exponentialRampToValueAtTime(0.1, t + 0.25);
  cg.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
  c.connect(hp).connect(cg).connect(out);
  c.start(t);
  // bass drum
  const k = ctx.createOscillator();
  k.type = 'sine';
  k.frequency.setValueAtTime(130, t);
  k.frequency.exponentialRampToValueAtTime(45, t + 0.25);
  const kg = ctx.createGain();
  kg.gain.setValueAtTime(0.0001, t);
  kg.gain.exponentialRampToValueAtTime(0.5, t + 0.005);
  kg.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  k.connect(kg).connect(out);
  k.start(t);
  k.stop(t + 0.5);
}

/** Schedules the roll; the crash lands `duration` seconds after `when`. */
export function playRevealDrumroll(ctx: BaseAudioContext, duration = 1.0, when = ctx.currentTime + 0.02) {
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 5;
  comp.attack.value = 0.002;
  comp.release.value = 0.12;
  const master = ctx.createGain();
  master.gain.value = 0.75;
  comp.connect(master).connect(ctx.destination);
  const bus = ctx.createGain();
  const rev = ctx.createConvolver();
  rev.buffer = roomImpulse(ctx);
  const wet = ctx.createGain();
  wet.gain.value = 0.18;
  bus.connect(comp);
  bus.connect(rev).connect(wet).connect(comp);

  const noise = noiseBuffer(ctx, 0.2);
  // strokes speed up from ~16 to ~30 per second and swell in volume
  let t = 0;
  let i = 0;
  while (t < duration - 0.02) {
    const k = t / duration;
    const rate = 16 + 14 * k;
    const level = (0.12 + 0.55 * k * k) * (i % 2 === 0 ? 1 : 0.82); // alternating hands
    snareStroke(ctx, bus, noise, when + t, level);
    t += 1 / rate;
    i++;
  }
  snareStroke(ctx, bus, noise, when + duration, 0.5); // accent with the crash
  finale(ctx, bus, when + duration);
}
