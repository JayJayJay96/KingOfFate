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

/** Limits one cursor spin must respect. */
export interface SpinLimits {
  readonly minLandMs: number;
  readonly maxSpinMs: number;
  readonly maxBrakeMs: number;
}

export const NORMAL_SPIN_LIMITS: SpinLimits = {
  minLandMs: MIN_LAND_MS,
  maxSpinMs: MAX_SPIN_MS,
  maxBrakeMs: MAX_BRAKE_MS,
};

/**
 * Turbo spins (owner decision 2026-10-16): a setup toggle for big rosters. Each cursor lands
 * after 1.5–3 s and never exceeds 4 s. Presentation only; odds are unchanged.
 */
export const TURBO_SPIN_LIMITS: SpinLimits = {
  minLandMs: 1500,
  maxSpinMs: 4000,
  maxBrakeMs: 2000,
};
