import { FINALE_TARGET_SCORE } from '../game/engine/finale';
import type { FinaleState } from '../game/engine/matchTypes';

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
  /** "Last point" drama: the screen darkens and the music drops out until "Juice!". */
  readonly dark?: boolean;
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
 * Rising pace (owner request 2026-10-10, curve 2026-10-16): every finale round in a row that ends
 * without anyone taking a winner slot makes the next one faster. The chant beat closes 30 % of the
 * remaining gap to the floor each round (600 → 528 → 478 → 442 → 418 ms …), so it speeds up
 * steeply at first, then levels off; the result hold, pause, hand attack and music follow in
 * proportion, down to 60 % of the normal length. A new winner (or a tiebreak, which starts a new
 * race) resets it. Derived from the saved rounds, so a refresh replays the same pace.
 * Presentation only.
 */
export const FINALE_PACE_KEEP = 0.7;
export const FINALE_MIN_BEAT_MS = 360;
/**
 * "Last point" (owner request 2026-10-16): when someone in the race is one point from a slot,
 * "2" is followed by a dark, silent pause before "Juice!". Fixed length: it is a held breath, not
 * part of the rising pace.
 */
export const LAST_POINT_PAUSE_MS = 900;

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
  const gap = (CHANT_BEAT_MS - FINALE_MIN_BEAT_MS) * FINALE_PACE_KEEP ** Math.max(0, streak);
  const beatMs = Math.max(FINALE_MIN_BEAT_MS, Math.round(FINALE_MIN_BEAT_MS + gap));
  const scale = beatMs / CHANT_BEAT_MS;
  return {
    beatMs,
    holdMs: Math.round(FINALE_REVEAL_HOLD_MS * scale),
    pauseMs: Math.round(FINALE_NEXT_ROUND_PAUSE_MS * scale),
    scale,
  };
}

/**
 * Each reveal: "1" (fists bounce), "2" (bounce), "Juice!" (all hands shown at once).
 * `lastPoint`: "2" darkens the stage and a held pause comes before "Juice!".
 */
export function roundTimeline(
  pace: FinalePace = NORMAL_PACE,
  lastPoint = false,
): {
  cues: ChantCue[];
  resolveMs: number;
} {
  const juiceAt = 2 * pace.beatMs + (lastPoint ? LAST_POINT_PAUSE_MS : 0);
  const cues: ChantCue[] = [
    { word: 'ONE', atMs: 0, reveal: false },
    { word: 'TWO', atMs: pace.beatMs, reveal: false, ...(lastPoint ? { dark: true } : {}) },
    { word: 'JUICE', atMs: juiceAt, reveal: true },
  ];
  return { cues, resolveMs: juiceAt + pace.holdMs };
}

/**
 * Fighters who JUST reached match point: they scored in the previous round of this race and now
 * sit one point from a slot. The "last point" drama plays once for them (owner feedback
 * 2026-10-16: repeating it on every draw at match point was a nuisance).
 */
export function newMatchPointIds(f: FinaleState): string[] {
  const last = f.rounds.at(-1);
  if (!last || last.stageNumber !== f.stageNumber) return [];
  return f.contenderIds.filter(
    (id) =>
      !f.winnerIds.includes(id) &&
      (f.scores[id] ?? 0) === FINALE_TARGET_SCORE - 1 &&
      last.scorerIds.includes(id),
  );
}

export function isLastPoint(f: FinaleState): boolean {
  return newMatchPointIds(f).length > 0;
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

/**
 * "Music that builds" (owner request 2026-10-10), from the saved finale state:
 * 0 = no points yet in this race (drums + bass), 1 = someone has a point (+ lead),
 * 2 = someone on match point (+ arpeggio, extra hats), 3 = two or more on match point or a
 * tiebreak race (everything one semitone up).
 */
export function finaleIntensity(f: FinaleState): 0 | 1 | 2 | 3 {
  if (f.stageNumber > 1) return 3;
  const scores = f.contenderIds
    .filter((id) => !f.winnerIds.includes(id))
    .map((id) => f.scores[id] ?? 0);
  const atMatchPoint = scores.filter((s) => s >= 2).length;
  const best = Math.max(0, ...scores);
  if (atMatchPoint >= 2) return 3;
  if (best >= 2) return 2;
  if (best >= 1) return 1;
  return 0;
}
