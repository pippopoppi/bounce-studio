// Melody mode: each bounce plays the next note. Notes are written like "C4 D#4 Bb3"; chords join with "+" ("C4+E4+G4").
// All built-in tunes are public-domain classical / traditional melodies.
export const MELODIES: { name: string; notes: string }[] = [
  { name: 'In the Hall of the Mountain King (Grieg)', notes:
    'B3 C#4 D4 E4 F#4 D4 F#4 F4 C#4 F4 E4 C4 E4 B3 C#4 D4 E4 F#4 D4 F#4 B4 A4 F#4 D4 F#4 A4 ' +
    'B3 C#4 D4 E4 F#4 D4 F#4 F4 C#4 F4 E4 C4 E4 B3 C#4 D4 E4 F#4 D4 F#4 B4 A4 F#4 D4 F#4 A4 ' +
    'F#4 G#4 A#4 B4 C#5 A#4 C#5 D5 A#4 D5 C#5 A#4 C#5 F#4 G#4 A#4 B4 C#5 A#4 C#5 D5 A#4 D5 C#5 ' +
    'B4 C#5 D5 E5 F#5 D5 F#5 F5 C#5 F5 E5 C5 E5 B4 C#5 D5 E5 F#5 D5 F#5 B5 A5 F#5 D5 F#5 A5' },
  { name: 'Ode to Joy (Beethoven)', notes:
    'E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4 D4 D4 E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4 C4 C4 ' +
    'D4 D4 E4 C4 D4 E4 F4 E4 C4 D4 E4 F4 E4 D4 C4 D4 G3 E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4 C4 C4' },
  { name: 'Für Elise (Beethoven)', notes:
    'E5 D#5 E5 D#5 E5 B4 D5 C5 A4 C4 E4 A4 B4 E4 G#4 B4 C5 E4 E5 D#5 E5 D#5 E5 B4 D5 C5 A4 C4 E4 A4 B4 E4 C5 B4 A4' },
  { name: 'Twinkle Twinkle Little Star', notes:
    'C4 C4 G4 G4 A4 A4 G4 F4 F4 E4 E4 D4 D4 C4 G4 G4 F4 F4 E4 E4 D4 G4 G4 F4 F4 E4 E4 D4 C4 C4 G4 G4 A4 A4 G4 F4 F4 E4 E4 D4 D4 C4' }
];

const SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// "F#4+A4" → [369.99, 440]; unknown tokens are skipped.
export function parseMelody(text: string): number[][] {
  const out: number[][] = [];
  for (const tok of text.split(/[\s,|]+/)) {
    if (!tok) continue;
    const freqs: number[] = [];
    for (const part of tok.split('+')) {
      const m = /^([A-Ga-g])(#|b)?(-?\d)$/.exec(part.trim());
      if (!m) continue;
      const midi = 12 * (parseInt(m[3], 10) + 1) + SEMI[m[1].toUpperCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
      freqs.push(440 * Math.pow(2, (midi - 69) / 12));
    }
    if (freqs.length) out.push(freqs);
  }
  return out;
}
