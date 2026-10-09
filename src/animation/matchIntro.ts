/**
 * Character-select intro at match start (owner decision 2026-10-10): a cursor flashes across the
 * portraits, then "ROUND 1", then "FIGHT!". About 4 s; the host may skip it. Pure presentation:
 * it never touches the match state or any random outcome.
 */
export const INTRO_STEP_MS = 110;
export const INTRO_ROUND_AT_MS = 2600;
export const INTRO_FIGHT_AT_MS = 3400;
export const INTRO_DONE_MS = 4200;

export type IntroBanner = 'ROUND 1' | 'FIGHT!' | null;

export interface IntroCue {
  readonly atMs: number;
  /** Index into the fighter list the select cursor sits on, or null once it stops. */
  readonly cursor: number | null;
  readonly banner: IntroBanner;
}

export function matchIntroTimeline(fighterCount: number): {
  cues: IntroCue[];
  doneMs: number;
} {
  const cues: IntroCue[] = [];
  if (fighterCount > 0) {
    for (let i = 0; i * INTRO_STEP_MS < INTRO_ROUND_AT_MS; i++) {
      cues.push({ atMs: i * INTRO_STEP_MS, cursor: i % fighterCount, banner: null });
    }
  }
  cues.push({ atMs: INTRO_ROUND_AT_MS, cursor: null, banner: 'ROUND 1' });
  cues.push({ atMs: INTRO_FIGHT_AT_MS, cursor: null, banner: 'FIGHT!' });
  return { cues, doneMs: INTRO_DONE_MS };
}

/** Finale "FINAL ROUND" splash before the Start button is pressed. */
export const FINALE_SPLASH_MS = 2600;
/** Slow-motion final blow between the last finale reveal and the victory ceremony. */
export const FINAL_BLOW_MS = 1400;
