import type { Rng } from '../rng/rng';

export type Gesture = 'ROCK' | 'PAPER' | 'SCISSORS';
export const GESTURES: readonly Gesture[] = ['ROCK', 'PAPER', 'SCISSORS'];

const BEATS: Readonly<Record<Gesture, Gesture>> = {
  ROCK: 'SCISSORS',
  PAPER: 'ROCK',
  SCISSORS: 'PAPER',
};

export function beats(a: Gesture, b: Gesture): boolean {
  return BEATS[a] === b;
}

export function isGesture(value: unknown): value is Gesture {
  return typeof value === 'string' && (GESTURES as readonly string[]).includes(value);
}

export interface DuelThrow {
  readonly challenger: Gesture;
  readonly opponent: Gesture;
}

/** Each fighter throws independently and uniformly. */
export function sampleThrow(rng: Rng): DuelThrow {
  return { challenger: GESTURES[rng.nextInt(3)]!, opponent: GESTURES[rng.nextInt(3)]! };
}

/**
 * Throws until decisive: identical hands are a draw and are rethrown. Terminates almost surely
 * (each throw is decisive with probability 2/3). The last throw is the decisive one.
 */
export function sampleDuelThrows(rng: Rng): DuelThrow[] {
  const throws: DuelThrow[] = [];
  for (;;) {
    const t = sampleThrow(rng);
    throws.push(t);
    if (t.challenger !== t.opponent) return throws;
  }
}

/** True when the challenger won the (decisive) last throw. */
export function challengerWins(throws: readonly DuelThrow[]): boolean {
  const last = throws.at(-1);
  if (!last || last.challenger === last.opponent) throw new Error('Duel has no decisive throw');
  return beats(last.challenger, last.opponent);
}
