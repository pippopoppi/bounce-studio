// Procedurally generated sounds and a small demo music loop, so the demo scene ships no audio files.

function render(ctx: OfflineAudioContext, fn: (ctx: OfflineAudioContext) => void): Promise<AudioBuffer> {
  fn(ctx);
  return ctx.startRendering();
}

function tone(ctx: BaseAudioContext, type: OscillatorType, freq: number, t0: number, dur: number, gain: number, endFreq?: number): void {
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (endFreq) o.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + dur);
  g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + dur + 0.01);
}

function noise(ctx: BaseAudioContext, t0: number, dur: number, gain: number, filterHz: number): void {
  const len = Math.ceil(ctx.sampleRate * dur); const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0); let seed = 7;
  for (let i = 0; i < len; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; d[i] = (seed / 4294967296) * 2 - 1; }
  const s = ctx.createBufferSource(); s.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterHz;
  const g = ctx.createGain(); g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f).connect(g).connect(ctx.destination); s.start(t0); s.stop(t0 + dur);
}

export async function builtinSound(name: string, sampleRate: number): Promise<AudioBuffer | null> {
  const mk = (dur: number, fn: (c: OfflineAudioContext) => void) => render(new OfflineAudioContext(1, Math.ceil(sampleRate * dur), sampleRate), fn);
  switch (name) {
    case 'builtin:blip-low': return mk(0.25, (c) => tone(c, 'sine', 220, 0, 0.22, 0.8, 180));
    case 'builtin:blip-mid': return mk(0.2, (c) => tone(c, 'sine', 440, 0, 0.18, 0.8, 380));
    case 'builtin:blip-high': return mk(0.18, (c) => tone(c, 'sine', 880, 0, 0.15, 0.7, 760));
    case 'builtin:pop': return mk(0.12, (c) => { tone(c, 'sine', 600, 0, 0.1, 0.9, 120); });
    case 'builtin:knock': return mk(0.15, (c) => { tone(c, 'triangle', 160, 0, 0.12, 0.8, 60); noise(c, 0, 0.06, 0.4, 1200); });
    case 'builtin:tick': return mk(0.08, (c) => { tone(c, 'square', 1800, 0, 0.05, 0.4, 1200); });
    case 'builtin:whoosh': return mk(0.5, (c) => noise(c, 0, 0.5, 0.8, 900));
    case 'builtin:chime': return mk(0.6, (c) => { tone(c, 'sine', 1046, 0, 0.6, 0.5); tone(c, 'sine', 1568, 0, 0.5, 0.3); });
    case 'builtin:buzz': return mk(0.35, (c) => { tone(c, 'sawtooth', 110, 0, 0.35, 0.6, 70); });
    case 'builtin:fanfare': return mk(1.6, (c) => { [523, 659, 784, 1046].forEach((f, i) => tone(c, 'triangle', f, i * 0.18, 0.5, 0.5)); tone(c, 'triangle', 1318, 0.75, 0.8, 0.5); });
    case 'builtin:demo-music': return demoMusic(sampleRate);
    default: return null;
  }
}

// 8 bars at 112 BPM: kick, bass and a bright arpeggio. Loops cleanly.
async function demoMusic(sampleRate: number): Promise<AudioBuffer> {
  const bpm = 112, beat = 60 / bpm, bars = 8, dur = bars * 4 * beat;
  const ctx = new OfflineAudioContext(2, Math.ceil(sampleRate * dur), sampleRate);
  const chords = [[0, 4, 7, 11], [5, 9, 12, 16], [7, 11, 14, 17], [9, 12, 16, 19]]; // Cmaj7 F G Am
  const base = 261.63;
  const f = (semi: number) => base * Math.pow(2, semi / 12);
  for (let bar = 0; bar < bars; bar++) {
    const chord = chords[bar % chords.length];
    for (let b = 0; b < 4; b++) {
      const t = (bar * 4 + b) * beat;
      tone(ctx, 'sine', 70, t, 0.25, 0.9, 40);                         // kick
      if (b === 1 || b === 3) noise(ctx, t, 0.12, 0.25, 4000);          // snare-ish
      tone(ctx, 'triangle', f(chord[0]) / 2, t, beat * 0.9, 0.35);      // bass
      for (let s = 0; s < 4; s++) {                                     // arpeggio, 16ths
        const semi = chord[(b * 4 + s) % chord.length] + 12;
        tone(ctx, 'square', f(semi), t + (s * beat) / 4, beat / 4 * 0.8, 0.07);
      }
    }
  }
  return ctx.startRendering();
}

export const BUILTIN_LABELS: Record<string, string> = {
  'builtin:blip-low': 'Blip (low)', 'builtin:blip-mid': 'Blip (mid)', 'builtin:blip-high': 'Blip (high)', 'builtin:pop': 'Pop',
  'builtin:knock': 'Knock', 'builtin:tick': 'Tick', 'builtin:whoosh': 'Whoosh', 'builtin:chime': 'Chime', 'builtin:buzz': 'Buzz',
  'builtin:fanfare': 'Fanfare', 'builtin:demo-music': 'Demo music (generated)'
};
