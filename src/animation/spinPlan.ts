import { createSeededRng } from '../game/rng/rng';

export interface SpinStep {
  readonly id: string;
  /** Milliseconds from spin start when the cursor moves onto `id`. */
  readonly atMs: number;
}

/** How one spin travels. Visual only: it never influences who is selected. */
export interface SpinStyle {
  /** Total time until the cursor lands (approved window: 4–5 s). */
  readonly durationMs: number;
  /** Fewest cursor moves; extra whole laps are added to reach it. */
  readonly minSteps: number;
  /** Ease-out strength: higher = brakes earlier and crawls longer at the end. */
  readonly easePower: number;
  /** ≥ 1. Stretches the final move ("fake-out": it lingers, then steps onto the target). */
  readonly teaseFactor: number;
}

/** The final move may take at most this share of the spin, even with a fake-out. */
const MAX_FINAL_SHARE = 0.3;

export const DEFAULT_SPIN_STYLE: SpinStyle = {
  durationMs: 4500,
  minSteps: 24,
  easePower: 2,
  teaseFactor: 1,
};

/**
 * Picks a random-looking style for a turn, seeded from its (random, unguessable) turn ID so a
 * replay after refresh is identical. Cosmetic randomness only; outcomes use the crypto RNG.
 */
export function spinStyleFor(
  turnId: string,
  durationRangeMs: readonly [number, number],
): SpinStyle {
  const rng = createSeededRng(hashString(turnId));
  const [minMs, maxMs] = durationRangeMs;
  return {
    durationMs: minMs + rng.nextInt(Math.max(0, maxMs - minMs) + 1),
    minSteps: 20 + rng.nextInt(17), // 20–36
    easePower: 1.5 + rng.nextInt(10) / 10, // 1.5–2.4
    teaseFactor: rng.nextInt(100) < 35 ? 1.4 + rng.nextInt(7) / 10 : 1, // ~1 in 3: 1.4–2.0×
  };
}

/**
 * Visual-only roulette path: the cursor walks the living fighters in grid order (wrapping),
 * starting on `startId` and decelerating until it stops on the ALREADY COMMITTED `targetId`.
 */
export function buildSpinPlan(
  orderedIds: readonly string[],
  startId: string,
  targetId: string,
  style: SpinStyle = DEFAULT_SPIN_STYLE,
): SpinStep[] {
  const n = orderedIds.length;
  const start = orderedIds.indexOf(startId);
  const target = orderedIds.indexOf(targetId);
  if (start < 0 || target < 0) throw new Error('Spin start and target must be on the grid');

  // Moves needed = distance to target plus whole laps, at least `minSteps`.
  const offset = (target - start + n) % n;
  const laps = Math.max(0, Math.ceil((style.minSteps - offset) / n));
  const moves = offset + laps * n;
  if (moves === 0) return [{ id: startId, atMs: style.durationMs }];

  // Ease-out position curve s(x) = 1 - (1 - x)^(1/p): gaps between moves only ever grow.
  const progress = (i: number) => 1 - (1 - i / moves) ** (1 / style.easePower);
  const gaps = Array.from({ length: moves }, (_, k) => progress(k + 1) - progress(k));

  // Fake-out: stretch the final move, capped so it never dominates the spin.
  const finalShare = gaps[moves - 1]!;
  const maxFactor = (MAX_FINAL_SHARE * (1 - finalShare)) / (finalShare * (1 - MAX_FINAL_SHARE));
  gaps[moves - 1] = finalShare * Math.max(1, Math.min(style.teaseFactor, maxFactor));

  const total = gaps.reduce((a, b) => a + b, 0);
  const steps: SpinStep[] = [{ id: startId, atMs: 0 }];
  let elapsed = 0;
  for (let i = 1; i <= moves; i++) {
    elapsed += gaps[i - 1]!;
    const atMs = i === moves ? style.durationMs : Math.round((style.durationMs * elapsed) / total);
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

/** FNV-1a 32-bit string hash (cosmetic seeding only). */
function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
