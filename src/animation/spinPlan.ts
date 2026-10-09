export interface SpinStep {
  readonly id: string;
  /** Milliseconds from spin start when the cursor moves onto `id`. */
  readonly atMs: number;
}

/**
 * Visual-only cursor path that decelerates onto an ALREADY COMMITTED target.
 * `cosmeticRandom` only varies the path's look; it never influences who is selected.
 */
export function buildSpinPlan(
  candidateIds: readonly string[],
  targetId: string,
  durationMs: number,
  cosmeticRandom: () => number = Math.random,
  stepCount = 32,
): SpinStep[] {
  if (!candidateIds.includes(targetId)) throw new Error('Spin target must be a candidate');
  const steps: SpinStep[] = [];
  let previous: string | null = null;

  for (let i = 1; i <= stepCount; i++) {
    const isLast = i === stepCount;
    let id: string;
    if (isLast) {
      id = targetId;
    } else {
      // Avoid standing still, and avoid sitting on the target just before landing on it.
      const avoid = new Set([previous, i === stepCount - 1 ? targetId : null]);
      const options = candidateIds.filter((c) => !avoid.has(c));
      const pool = options.length > 0 ? options : candidateIds;
      id = pool[Math.min(pool.length - 1, Math.floor(cosmeticRandom() * pool.length))]!;
    }
    // Ease-out: gaps between moves grow, so the cursor visibly slows into the target.
    const atMs = Math.round(durationMs * (i / stepCount) ** 2.2);
    steps.push({ id, atMs });
    previous = id;
  }
  return steps;
}
