/** Chant words of the Vietnamese countdown. */
export type ChantWord = 'MOT' | 'HAI' | 'BA' | 'YO';

export const CHANT_LABEL: Readonly<Record<ChantWord, string>> = {
  MOT: 'Một',
  HAI: 'Hai',
  BA: 'Ba',
  YO: 'Yo!',
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
  /** True on "Yo!" of a round: hands are revealed. */
  readonly reveal: boolean;
}

/** Opening cue "Một Hai Ba Yo!" with no throw (PROJECT.md §5). */
export function introTimeline(): { cues: ChantCue[]; doneMs: number } {
  const words: ChantWord[] = ['MOT', 'HAI', 'BA', 'YO'];
  const cues: ChantCue[] = words.map((word, i) => ({
    word,
    atMs: i * CHANT_BEAT_MS,
    reveal: false,
  }));
  const clearAt = words.length * CHANT_BEAT_MS;
  cues.push({ word: null, atMs: clearAt, reveal: false });
  return { cues, doneMs: clearAt + FINALE_INTRO_PAUSE_MS };
}

/** Each reveal: "Hai" (fists bounce), "Ba" (bounce), "Yo!" (all hands shown at once). */
export function roundTimeline(): { cues: ChantCue[]; resolveMs: number } {
  const cues: ChantCue[] = [
    { word: 'HAI', atMs: 0, reveal: false },
    { word: 'BA', atMs: CHANT_BEAT_MS, reveal: false },
    { word: 'YO', atMs: 2 * CHANT_BEAT_MS, reveal: true },
  ];
  return { cues, resolveMs: 2 * CHANT_BEAT_MS + FINALE_REVEAL_HOLD_MS };
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
