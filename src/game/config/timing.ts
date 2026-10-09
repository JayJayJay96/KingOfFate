/**
 * Selection spin timing. Owner decisions 2026-10-09:
 * - spins vary randomly so the rhythm is not learnable;
 * - the fighter, then the Fate (and for VS, the opponent) are revealed ONE AFTER ANOTHER, so each
 *   individual spin is shorter: it lands after 2.5–5 s and never exceeds 6.5 s.
 */

/** Earliest a cursor may land. */
export const MIN_LAND_MS = 2500;

/** Hard ceiling for one cursor, from its start to its reveal (travel + final dwell). */
export const MAX_SPIN_MS = 6500;

/** Longest a cursor may spend braking (keeps long crawls inside the cap). */
export const MAX_BRAKE_MS = 3500;

/** Shortest dwell on the landed box before the reveal. */
export const MIN_DWELL_MS = 350;
