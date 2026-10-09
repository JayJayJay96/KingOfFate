/**
 * Normal selection spin: approved 4–5 s regardless of roster size (PROJECT.md §1, §4).
 * Each spin picks its own duration inside this window so the rhythm is not learnable.
 */
export const SPIN_DURATION_RANGE_MS: readonly [number, number] = [4000, 5000];

/** Pause on the landed target before the KO is applied and shown. */
export const REVEAL_HOLD_MS = 400;
