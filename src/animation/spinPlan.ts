export interface SpinStep {
  readonly id: string;
  /** Milliseconds from spin start when the cursor moves onto `id`. */
  readonly atMs: number;
}

/** Fewest cursor moves per spin, so small rosters still loop a few times. */
export const MIN_SPIN_STEPS = 24;

/**
 * Visual-only roulette path: the cursor walks the living fighters in grid order (wrapping),
 * starting on `startId` and decelerating until it stops on the ALREADY COMMITTED `targetId`.
 * Deterministic, so a replay after refresh shows the identical path. It never decides outcomes.
 */
export function buildSpinPlan(
  orderedIds: readonly string[],
  startId: string,
  targetId: string,
  durationMs: number,
  minSteps = MIN_SPIN_STEPS,
): SpinStep[] {
  const n = orderedIds.length;
  const start = orderedIds.indexOf(startId);
  const target = orderedIds.indexOf(targetId);
  if (start < 0 || target < 0) throw new Error('Spin start and target must be on the grid');

  // Moves needed = distance to target plus whole laps, at least `minSteps`.
  const offset = (target - start + n) % n;
  const laps = Math.max(0, Math.ceil((minSteps - offset) / n));
  const moves = offset + laps * n;

  const steps: SpinStep[] = [{ id: startId, atMs: 0 }];
  for (let i = 1; i <= moves; i++) {
    // Quadratic ease-out: time to reach move i is D * (1 - sqrt(1 - i/moves)),
    // so moves start quick and the last few crawl ("one more step…").
    const atMs = Math.round(durationMs * (1 - Math.sqrt(1 - i / moves)));
    steps.push({ id: orderedIds[(start + i) % n]!, atMs });
  }
  return steps;
}

/**
 * Where the cursor starts: the next living fighter after the previous turn's target in grid
 * order, or the first living fighter on the first turn. Pure function of match state.
 */
export function spinStartId(
  players: readonly { readonly id: string; readonly alive: boolean }[],
  previousTargetId: string | null,
): string | null {
  const n = players.length;
  if (n === 0) return null;
  const from = previousTargetId ? players.findIndex((p) => p.id === previousTargetId) : -1;
  for (let i = 1; i <= n; i++) {
    const p = players[(from + i + n) % n]!;
    if (p.alive) return p.id;
  }
  return null;
}
