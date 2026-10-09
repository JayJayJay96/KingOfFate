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
export const FINALE_REVEAL_HOLD_MS = 1500;
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
  return Array.from({ length: count }, (_, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count;
    return { x: 50 + 36 * Math.cos(angle), y: 50 + 38 * Math.sin(angle) };
  });
}
