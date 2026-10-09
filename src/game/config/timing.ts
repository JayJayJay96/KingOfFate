/**
 * Selection spin timing. Owner decision 2026-10-09: spins vary randomly between 4 s and a
 * hard maximum of 10 s (supersedes the earlier fixed 4–5 s), so the rhythm is not learnable.
 */

/** Earliest the cursor may land. */
export const MIN_LAND_MS = 4000;

/** Hard ceiling from button press to KO reveal (cursor travel + final dwell). */
export const MAX_SPIN_MS = 10_000;

/** Shortest dwell on the landed fighter before the KO is revealed. */
export const MIN_DWELL_MS = 350;
