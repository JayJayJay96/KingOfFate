import type { StageId } from '../game/config/stages';
import { bars } from './chiptune';

/**
 * ORIGINAL victory fanfares, one per stage (owner request 2026-10-10). Two bars of 16th steps,
 * played once on the victory screen; the last lead note rings out. Not transcriptions of any
 * existing music.
 */
export type FanfareHit = 'K' | 'S' | 'H' | 'T' | 'G' | 'C';

export interface Fanfare {
  readonly bpm: number;
  readonly lead: readonly (string | null)[];
  readonly bass: readonly (string | null)[];
  /** K kick, S snare, H hat, T tom, G gong, C crash. */
  readonly drums: readonly (FanfareHit | null)[];
  /** Lead waveform: square (arcade), triangle (soft), sawtooth (bright). */
  readonly wave: OscillatorType;
  /** How many steps the final lead note rings. */
  readonly ringSteps: number;
}

export const FANFARE_STEPS = 32;

function hits(...barStrings: string[]): (FanfareHit | null)[] {
  return barStrings
    .join('')
    .split('')
    .map((c) => (c === '.' ? null : (c as FanfareHit)));
}

export const FANFARES: Readonly<Record<StageId, Fanfare>> = {
  /** Synthwave arpeggio rising to a bright C major. */
  'kl-night': {
    bpm: 132,
    wave: 'sawtooth',
    lead: bars(
      'C5 E5 G5 C6 E6 C6 G5 E5 F5 A5 C6 A5 F5 . . .',
      'G5 B5 D6 B5 G5 . E6 . C6 . . . . . . .',
    ),
    bass: bars('C3 . C3 . C3 . C3 . F2 . F2 . F2 . F2 .', 'G2 . G2 . G2 . . . C3 . . . . . . .'),
    drums: hits('K.H.S.H.K.H.S.H.', 'K.H.S.HKS.SSC...'),
    ringSteps: 8,
  },
  /** Playful D-major pentatonic over tabla-like toms. */
  mamak: {
    bpm: 140,
    wave: 'square',
    lead: bars(
      'D5 . E5 F#5 A5 . F#5 . B5 A5 F#5 E5 D5 . . .',
      'E5 F#5 A5 . B5 . D6 . B5 A5 D6 . . . . .',
    ),
    bass: bars('D3 . . D3 A2 . . . G2 . . G2 A2 . . .', 'B2 . . B2 A2 . . . D3 . . . . . . .'),
    drums: hits('T.TT.T.TT.T.T.TT', 'T.TT.T.TK.S.C...'),
    ringSteps: 6,
  },
  /** Cheeky elevator-jazz: F major 7th, walking bass. */
  pantry: {
    bpm: 124,
    wave: 'triangle',
    lead: bars(
      'A5 . C6 . E6 . D6 C6 A5 . G5 . F5 . . .',
      'E5 . G5 . A#5 . A5 G5 F5 . A5 . F6 . . .',
    ),
    bass: bars('F2 . A2 . C3 . E3 . D3 . C3 . A2 . G2 .', 'C3 . E3 . G2 . C3 . F2 . . . . . . .'),
    drums: hits('H.H.H.H.H.H.H.H.', 'H.H.H.H.H.H.K.C.'),
    ringSteps: 8,
  },
  /** Festive night market: gong hits and bright G pentatonic. */
  'pasar-malam': {
    bpm: 150,
    wave: 'square',
    lead: bars(
      'G5 A5 B5 D6 E6 D6 B5 A5 G5 . E5 . D5 . . .',
      'G5 . A5 . B5 D6 E6 . G6 . . . . . . .',
    ),
    bass: bars('G2 . D3 . G2 . D3 . C3 . G2 . D3 . . .', 'G2 . . . D3 . . . G2 . . . . . . .'),
    drums: hits('G..TT.T.K.TT.T..', 'K.T.S.T.TTTTG...'),
    ringSteps: 8,
  },
  /** Heroic B-flat anthem with a snare roll and a long final chord. */
  rooftop: {
    bpm: 126,
    wave: 'square',
    lead: bars('F5 . . A#5 . . D6 . C6 . A#5 . C6 . D6 .', 'F6 . . . D6 . . . F6 . . . . . . .'),
    bass: bars('A#2 . . . F2 . . . G2 . . . D#2 . . .', 'A#2 . . . F2 . . . A#2 . . . . . . .'),
    drums: hits('K...S...K...S.SS', 'K.SSSSSSC.......'),
    ringSteps: 8,
  },
};

/** Seconds from the first note to the end of the ringing last note. */
export function fanfareSeconds(f: Fanfare): number {
  return ((FANFARE_STEPS + f.ringSteps) * 60) / f.bpm / 4;
}
