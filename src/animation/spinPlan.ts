import { MAX_SPIN_MS, MIN_DWELL_MS, MIN_LAND_MS } from '../game/config/timing';
import { createSeededRng } from '../game/rng/rng';

export interface SpinStep {
  readonly id: string;
  /** Milliseconds from spin start when the cursor moves onto `id`. */
  readonly atMs: number;
}

export interface SpinPlan {
  readonly steps: readonly SpinStep[];
  /** When the cursor lands on the target (= last step). */
  readonly landMs: number;
  /** When the KO is revealed. The dwell before it looks like any other slow step. */
  readonly revealMs: number;
}

/**
 * How one spin travels. Visual only: it never influences who is selected.
 * Timeline: constant-speed cruise → geometric braking over `brakeSteps` → dwell → reveal.
 */
export interface SpinStyle {
  /** Preferred landing time; actual is the nearest whole-lap fit within limits. */
  readonly targetLandMs: number;
  /** Gap between moves while cruising. */
  readonly cruiseGapMs: number;
  /** Moves spent braking: few = "snap" stop, many = long crawl. */
  readonly brakeSteps: number;
  /** Gap before the final move (the slowest move). */
  readonly finalGapMs: number;
  /** ≥ 1: extra linger on the box just before the target. */
  readonly teaseFactor: number;
  /** Dwell on the target = final gap × this (1.0–1.8), so stopping looks like "maybe one more". */
  readonly dwellFactor: number;
}

const MIN_CRUISE_STEPS = 4;
const MAX_BRAKE_MS = 6000;

export const DEFAULT_SPIN_STYLE: SpinStyle = {
  targetLandMs: 6000,
  cruiseGapMs: 60,
  brakeSteps: 8,
  finalGapMs: 800,
  teaseFactor: 1,
  dwellFactor: 1.4,
};

/**
 * Random-looking style for a turn, seeded from its (random, unguessable) turn ID so a replay
 * after refresh is identical. Cosmetic randomness only; outcomes use the crypto RNG.
 */
export function spinStyleFor(turnId: string): SpinStyle {
  const rng = createSeededRng(hashString(turnId));
  const snap = rng.nextInt(100) < 40;
  return {
    targetLandMs: MIN_LAND_MS + rng.nextInt(4001), // 4–8 s
    cruiseGapMs: 45 + rng.nextInt(31), // 45–75 ms
    brakeSteps: snap ? 3 + rng.nextInt(3) : 7 + rng.nextInt(8), // snap 3–5, crawl 7–14
    finalGapMs: snap ? 300 + rng.nextInt(301) : 600 + rng.nextInt(501), // 300–600 / 600–1100
    teaseFactor: rng.nextInt(100) < 25 ? 1.3 + rng.nextInt(6) / 10 : 1, // ~1 in 4: 1.3–1.8×
    dwellFactor: 1 + rng.nextInt(9) / 10, // 1.0–1.8×
  };
}

/**
 * Visual-only roulette path: the cursor walks the living fighters in grid order (wrapping),
 * starting on `startId`, cruising, then braking until it stops on the ALREADY COMMITTED
 * `targetId`. Gaps never shrink. The whole spin (to reveal) never exceeds MAX_SPIN_MS.
 */
export function buildSpinPlan(
  orderedIds: readonly string[],
  startId: string,
  targetId: string,
  style: SpinStyle = DEFAULT_SPIN_STYLE,
): SpinPlan {
  const n = orderedIds.length;
  const start = orderedIds.indexOf(startId);
  const target = orderedIds.indexOf(targetId);
  if (start < 0 || target < 0) throw new Error('Spin start and target must be on the grid');

  // Braking gaps grow geometrically from cruise speed to the final gap.
  let brakeSteps = style.brakeSteps;
  let brake = brakeGaps(style, brakeSteps);
  while (sum(brake) > MAX_BRAKE_MS && brakeSteps > 3) brake = brakeGaps(style, --brakeSteps);
  const brakeMs = sum(brake);

  // Choose whole laps so the landing time is in bounds and closest to the preferred time.
  const offset = (target - start + n) % n;
  const latestLand = MAX_SPIN_MS - MIN_DWELL_MS;
  const landFor = (moves: number) => (moves - brakeSteps) * style.cruiseGapMs + brakeMs;
  let laps = Math.max(0, Math.ceil((brakeSteps + MIN_CRUISE_STEPS - offset) / n));
  let best = laps;
  for (; landFor(offset + laps * n) <= latestLand; laps++) {
    const land = landFor(offset + laps * n);
    const bestLand = landFor(offset + best * n);
    const inRange = (t: number) => t >= MIN_LAND_MS && t <= latestLand;
    if (
      (inRange(land) && !inRange(bestLand)) ||
      (inRange(land) === inRange(bestLand) &&
        Math.abs(land - style.targetLandMs) < Math.abs(bestLand - style.targetLandMs))
    ) {
      best = laps;
    }
  }
  const moves = offset + best * n;

  const steps: SpinStep[] = [{ id: startId, atMs: 0 }];
  let t = 0;
  for (let i = 1; i <= moves; i++) {
    const brakeIndex = i - (moves - brakeSteps) - 1;
    t += brakeIndex >= 0 ? brake[brakeIndex]! : style.cruiseGapMs;
    steps.push({ id: orderedIds[(start + i) % n]!, atMs: Math.round(t) });
  }
  const landMs = steps.at(-1)!.atMs;
  const lastGap = brake.at(-1)!;
  const dwell = Math.max(MIN_DWELL_MS, Math.min(lastGap * style.dwellFactor, MAX_SPIN_MS - landMs));
  return { steps, landMs, revealMs: Math.round(landMs + dwell) };
}

function brakeGaps(style: SpinStyle, brakeSteps: number): number[] {
  const ratio = (style.finalGapMs / style.cruiseGapMs) ** (1 / brakeSteps);
  const gaps = Array.from({ length: brakeSteps }, (_, j) => style.cruiseGapMs * ratio ** (j + 1));
  gaps[brakeSteps - 1] = style.finalGapMs * Math.max(1, style.teaseFactor);
  return gaps;
}

function sum(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0);
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
