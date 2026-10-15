/**
 * ORIGINAL chiptune loops composed for this project (not transcriptions of any existing game
 * music). Each theme is 4 bars of 16 sixteenth-note steps; the sound engine schedules them.
 */
export type MusicTheme = 'select' | 'finale';
export type DrumHit = 'K' | 'S' | 'H' | 'T';

export interface Theme {
  readonly bpm: number;
  /** One entry per 16th step: a note name ("A4", "G#5") or null for silence. */
  readonly lead: readonly (string | null)[];
  readonly bass: readonly (string | null)[];
  /** One entry per step: K kick, S snare, H hat, T tom, or null. */
  readonly drums: readonly (DrumHit | null)[];
  /**
   * Layered themes build with the music intensity (owner request 2026-10-10): level 0 = drums +
   * bass, 1 = + lead, 2 = + arp and extra hats, 3 = everything one semitone higher.
   * Non-layered themes always play every track.
   */
  readonly layered?: boolean;
  readonly arp?: readonly (string | null)[];
  readonly drumsExtra?: readonly (DrumHit | null)[];
}

export const STEPS_PER_LOOP = 64;

/** Parses a compact bar string: tokens separated by spaces; "." = rest. */
export function bars(...barStrings: string[]): (string | null)[] {
  const steps = barStrings.flatMap((b) => b.trim().split(/\s+/));
  return steps.map((t) => (t === '.' ? null : t));
}

export function drums(...barStrings: string[]): (DrumHit | null)[] {
  return barStrings
    .join('')
    .split('')
    .map((c) => (c === '.' ? null : (c as DrumHit)));
}

/** Character-select loop: bright, driving, A minor, 150 bpm. */
const SELECT: Theme = {
  bpm: 150,
  lead: bars(
    'A4 . C5 . E5 . A5 . G5 . E5 . C5 . D5 .',
    'F5 . E5 . C5 . A4 . C5 . . . F5 . . .',
    'G5 . F5 . D5 . B4 . D5 . G5 . F5 . D5 .',
    'E5 . G#5 . B5 . E6 . D6 . B5 . G#5 . E5 .',
  ),
  bass: bars(
    'A2 . A3 . A2 . A3 . A2 . A3 . A2 . A3 .',
    'F2 . F3 . F2 . F3 . F2 . F3 . F2 . F3 .',
    'G2 . G3 . G2 . G3 . G2 . G3 . G2 . G3 .',
    'E2 . E3 . E2 . E3 . E2 . E3 . E2 . E3 .',
  ),
  drums: drums('K.H.S.H.K.HKS.H.', 'K.H.S.H.K.HKS.H.', 'K.H.S.H.K.HKS.H.', 'K.H.S.H.KKS.S.SS'),
};

/**
 * Finale loop: "final showdown" (owner request 2026-10-10: more energetic). D minor, 172 bpm,
 * Dm – B♭ – C – A (harmonic-minor turn for tension), galloping octave bass, heroic lead with
 * arpeggios, kick on the beat, backbeat snare, and a snare/tom fill closing every loop.
 */
const FINALE: Theme = {
  bpm: 172,
  lead: bars(
    'D5 . A4 . D5 F5 A5 . G5 F5 E5 . F5 . D5 .',
    'A#4 . F5 . A#5 . A5 G5 F5 . D5 . F5 . A#5 .',
    'C5 . G5 . C6 . A#5 A5 G5 . E5 . G5 . C6 .',
    'A5 . G#5 A5 . E5 . C#5 . E5 A5 . G#5 . E5 C#5',
  ),
  bass: bars(
    'D2 D2 D3 D2 D2 D2 D3 D2 D2 D2 D3 D2 D2 D3 D2 D3',
    'A#1 A#1 A#2 A#1 A#1 A#1 A#2 A#1 A#1 A#1 A#2 A#1 A#1 A#2 A#1 A#2',
    'C2 C2 C3 C2 C2 C2 C3 C2 C2 C2 C3 C2 C2 C3 C2 C3',
    'A1 A1 A2 A1 A1 A1 A2 A1 A1 A1 A2 A1 A1 A2 A1 A2',
  ),
  drums: drums('K.H.S.HKK.H.S.H.', 'K.H.S.HKK.H.S.HK', 'K.H.S.HKK.H.S.H.', 'K.H.S.HKS.SSTTTT'),
  layered: true,
  // Level 2+: 16th-note arpeggio on each chord's tones, and hats on every off-16th.
  arp: bars(
    'D5 F5 A5 D6 A5 F5 D5 F5 A5 D6 A5 F5 D5 F5 A5 F5',
    'A#4 D5 F5 A#5 F5 D5 A#4 D5 F5 A#5 F5 D5 A#4 D5 F5 D5',
    'C5 E5 G5 C6 G5 E5 C5 E5 G5 C6 G5 E5 C5 E5 G5 E5',
    'A4 C#5 E5 A5 E5 C#5 A4 C#5 E5 A5 E5 C#5 A4 C#5 E5 C#5',
  ),
  drumsExtra: drums('.H.H.H.H.H.H.H.H', '.H.H.H.H.H.H.H.H', '.H.H.H.H.H.H.H.H', '.H.H.H.H........'),
};

export const THEMES: Readonly<Record<MusicTheme, Theme>> = { select: SELECT, finale: FINALE };

const NOTE_INDEX: Readonly<Record<string, number>> = {
  C: 0,
  'C#': 1,
  D: 2,
  'D#': 3,
  E: 4,
  F: 5,
  'F#': 6,
  G: 7,
  'G#': 8,
  A: 9,
  'A#': 10,
  B: 11,
};

/** "A4" → 440 Hz (equal temperament). */
export function noteToFrequency(note: string): number {
  const match = /^([A-G]#?)(-?\d)$/.exec(note);
  if (!match) throw new Error(`Bad note "${note}"`);
  const midi = (Number(match[2]) + 1) * 12 + NOTE_INDEX[match[1]!]!;
  return 440 * 2 ** ((midi - 69) / 12);
}

export function stepSeconds(theme: Theme): number {
  return 60 / theme.bpm / 4;
}
