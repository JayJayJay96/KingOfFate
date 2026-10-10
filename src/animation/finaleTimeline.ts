/** Chant words of the finale countdown: "1, 2, Juice!" (owner decision 2026-10-10). */
export type ChantWord = 'ONE' | 'TWO' | 'JUICE';

export const CHANT_LABEL: Readonly<Record<ChantWord, string>> = {
  ONE: '1',
  TWO: '2',
  JUICE: 'Juice!',
};

export const CHANT_BEAT_MS = 600;
/** Hands stay revealed and scores update before the next chant. */
/** With the 0.7 s pause before the next chant, leaves room for the 2.4 s hand attack. */
export const FINALE_REVEAL_HOLD_MS = 2000;
export const FINALE_NEXT_ROUND_PAUSE_MS = 700;
export const FINALE_INTRO_PAUSE_MS = 800;

export interface ChantCue {
  readonly word: ChantWord | null;
  readonly atMs: number;
  /** True on "Juice!" of a round: hands are revealed. */
  readonly reveal: boolean;
}

/** Opening cue "1, 2, Juice!" with no throw (PROJECT.md §5). */
export function introTimeline(): { cues: ChantCue[]; doneMs: number } {
  const words: ChantWord[] = ['ONE', 'TWO', 'JUICE'];
  const cues: ChantCue[] = words.map((word, i) => ({
    word,
    atMs: i * CHANT_BEAT_MS,
    reveal: false,
  }));
  const clearAt = words.length * CHANT_BEAT_MS;
  cues.push({ word: null, atMs: clearAt, reveal: false });
  return { cues, doneMs: clearAt + FINALE_INTRO_PAUSE_MS };
}

/**
 * Rising pace (owner request 2026-10-10): every finale round in a row that ends without anyone
 * taking a winner slot makes the next one faster: the chant beat shortens by 50 ms and the result
 * hold, pause, hand attack and music speed up in proportion, down to 60 % of the normal length.
 * A new winner (or a tiebreak, which starts a new race) resets it. Derived from the saved rounds,
 * so a refresh replays the same pace. Presentation only.
 */
export const FINALE_PACE_STEP_MS = 50;
export const FINALE_MIN_BEAT_MS = 360;

export interface FinalePace {
  readonly beatMs: number;
  readonly holdMs: number;
  readonly pauseMs: number;
  /** 1 = normal speed; smaller = faster (multiply durations by it). */
  readonly scale: number;
}

export const NORMAL_PACE: FinalePace = {
  beatMs: CHANT_BEAT_MS,
  holdMs: FINALE_REVEAL_HOLD_MS,
  pauseMs: FINALE_NEXT_ROUND_PAUSE_MS,
  scale: 1,
};

/** Most recent rounds in a row where nobody qualified and no tiebreak started. */
export function roundsWithoutWinner(
  rounds: readonly {
    readonly qualifiedIds: readonly string[];
    readonly tiebreakIds: readonly string[] | null;
  }[],
): number {
  let n = 0;
  for (let i = rounds.length - 1; i >= 0; i--) {
    const r = rounds[i]!;
    if (r.qualifiedIds.length > 0 || r.tiebreakIds) break;
    n++;
  }
  return n;
}

export function finalePace(streak: number): FinalePace {
  const beatMs = Math.max(FINALE_MIN_BEAT_MS, CHANT_BEAT_MS - FINALE_PACE_STEP_MS * streak);
  const scale = beatMs / CHANT_BEAT_MS;
  return {
    beatMs,
    holdMs: Math.round(FINALE_REVEAL_HOLD_MS * scale),
    pauseMs: Math.round(FINALE_NEXT_ROUND_PAUSE_MS * scale),
    scale,
  };
}

/** Each reveal: "1" (fists bounce), "2" (bounce), "Juice!" (all hands shown at once). */
export function roundTimeline(pace: FinalePace = NORMAL_PACE): {
  cues: ChantCue[];
  resolveMs: number;
} {
  const cues: ChantCue[] = [
    { word: 'ONE', atMs: 0, reveal: false },
    { word: 'TWO', atMs: pace.beatMs, reveal: false },
    { word: 'JUICE', atMs: 2 * pace.beatMs, reveal: true },
  ];
  return { cues, resolveMs: 2 * pace.beatMs + pace.holdMs };
}

/** Stage positions (percent of the arena) for 2–6 finalists: 1v1, triangle, then a ring. */
export function stagePositions(count: number): { x: number; y: number }[] {
  if (count === 2) {
    return [
      { x: 20, y: 50 },
      { x: 80, y: 50 },
    ];
  }
  if (count === 3) {
    return [
      { x: 50, y: 25 },
      { x: 78, y: 74 },
      { x: 22, y: 74 },
    ];
  }
  // 4–6: two rows facing each other, with the chant word in the gap between them.
  const top = Math.ceil(count / 2);
  const bottom = count - top;
  const row = (n: number, y: number) =>
    Array.from({ length: n }, (_, i) => ({ x: ((i + 1) * 100) / (n + 1), y }));
  return [...row(top, 24), ...row(bottom, 76)];
}
