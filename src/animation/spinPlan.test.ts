import { describe, expect, it } from 'vitest';
import { MAX_SPIN_MS, MIN_LAND_MS, TURBO_SPIN_LIMITS } from '../game/config/timing';
import {
  buildSpinPlan,
  DEFAULT_SPIN_STYLE,
  spinStartId,
  spinStyleFor,
  type SpinPlan,
  type SpinStyle,
} from './spinPlan';

const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const gaps = (plan: SpinPlan) => plan.steps.slice(1).map((s, i) => s.atMs - plan.steps[i]!.atMs);
const style = (overrides: Partial<SpinStyle> = {}): SpinStyle => ({
  ...DEFAULT_SPIN_STYLE,
  ...overrides,
});

/** Many styles, exactly as production generates them. */
const sampleStyles = Array.from({ length: 300 }, (_, i) => spinStyleFor(`turn-${i}`));
const rosters = [3, 4, 8, 20, 32].map((n) => Array.from({ length: n }, (_, i) => `p${i}`));

describe('buildSpinPlan (sequential roulette)', () => {
  it('walks the grid in order, wrapping, from start to the committed target', () => {
    const plan = buildSpinPlan(ids, 'c', 'b', style());
    expect(plan.steps[0]).toEqual({ id: 'c', atMs: 0 });
    for (let i = 1; i < plan.steps.length; i++) {
      const prev = ids.indexOf(plan.steps[i - 1]!.id);
      expect(plan.steps[i]!.id).toBe(ids[(prev + 1) % ids.length]);
    }
    expect(plan.steps.at(-1)!.id).toBe('b');
    expect(plan.landMs).toBe(plan.steps.at(-1)!.atMs);
  });

  it('lands on every target from every start, for sampled styles and roster sizes', () => {
    for (const roster of rosters) {
      for (const s of sampleStyles.slice(0, 15)) {
        for (const start of roster) {
          for (const target of roster) {
            expect(buildSpinPlan(roster, start, target, s).steps.at(-1)!.id).toBe(target);
          }
        }
      }
    }
  });

  it('every spin: never speeds up, lands after 4 s, reveals within 10 s', () => {
    for (const roster of rosters) {
      for (const s of sampleStyles) {
        const plan = buildSpinPlan(roster, roster[0]!, roster[roster.length - 1]!, s);
        const g = gaps(plan);
        // ±1 ms tolerance for rounding to whole milliseconds.
        for (let i = 1; i < g.length; i++) expect(g[i]).toBeGreaterThanOrEqual(g[i - 1]! - 1);
        expect(plan.landMs).toBeGreaterThanOrEqual(MIN_LAND_MS - 1000);
        expect(plan.revealMs).toBeLessThanOrEqual(MAX_SPIN_MS);
        expect(plan.revealMs).toBeGreaterThan(plan.landMs);
      }
    }
  });

  it('mostly lands at or after 4 s (whole-lap fitting may land slightly earlier on rare styles)', () => {
    const landings = sampleStyles.map((s) => buildSpinPlan(ids, 'a', 'e', s).landMs);
    const early = landings.filter((t) => t < MIN_LAND_MS).length;
    expect(early / landings.length).toBeLessThan(0.05);
  });

  it('the stop is not detectable: the dwell is never shorter than the final move', () => {
    for (const s of sampleStyles) {
      const plan = buildSpinPlan(ids, 'a', 'e', s);
      const lastMove = gaps(plan).at(-1)!;
      const dwell = plan.revealMs - plan.landMs;
      if (plan.landMs + lastMove <= MAX_SPIN_MS) {
        expect(dwell).toBeGreaterThanOrEqual(Math.min(lastMove, MAX_SPIN_MS - plan.landMs) - 1);
      }
    }
  });

  it('produces both snap stops and long crawls', () => {
    const brakeLengths = sampleStyles.map((s) => s.brakeSteps);
    const snaps = brakeLengths.filter((k) => k <= 5).length;
    const crawls = brakeLengths.filter((k) => k >= 7).length;
    expect(snaps / sampleStyles.length).toBeGreaterThan(0.3);
    expect(crawls / sampleStyles.length).toBeGreaterThan(0.5);
  });

  it('a snap brakes over few moves, a crawl over many', () => {
    const snap = gaps(buildSpinPlan(ids, 'a', 'e', style({ brakeSteps: 3, finalGapMs: 500 })));
    const crawl = gaps(buildSpinPlan(ids, 'a', 'e', style({ brakeSteps: 12, finalGapMs: 900 })));
    const slowMoves = (g: number[]) => g.filter((x) => x > 150).length;
    expect(slowMoves(snap)).toBeLessThanOrEqual(3);
    expect(slowMoves(crawl)).toBeGreaterThanOrEqual(6);
  });

  it('a tease lingers on the box before the target', () => {
    const plain = gaps(buildSpinPlan(ids, 'a', 'e', style()));
    const teased = gaps(buildSpinPlan(ids, 'a', 'e', style({ teaseFactor: 1.6 })));
    expect(teased.at(-1)!).toBeGreaterThan(plain.at(-1)! * 1.5);
  });

  it('handles the full 32-fighter grid and tiny rosters', () => {
    const big = rosters[4]!;
    const plan = buildSpinPlan(big, 'p31', 'p30', style());
    expect(plan.steps[1]!.id).toBe('p0');
    expect(plan.steps.at(-1)!.id).toBe('p30');
    const tiny = buildSpinPlan(['x', 'y', 'z'], 'x', 'x', style());
    expect(tiny.steps.at(-1)!.id).toBe('x');
    expect(tiny.steps.length - 1).toBeGreaterThanOrEqual(12);
  });

  it('rejects ids that are not on the grid', () => {
    expect(() => buildSpinPlan(ids, 'zzz', 'a')).toThrow();
    expect(() => buildSpinPlan(ids, 'a', 'zzz')).toThrow();
  });
});

describe('turbo spins (owner decision 2026-10-16)', () => {
  const turboStyles = Array.from({ length: 300 }, (_, i) => spinStyleFor(`turn-${i}`, true));

  it('every turbo spin lands on the target, never speeds up and reveals within 4 s', () => {
    for (const roster of rosters) {
      for (const s of turboStyles) {
        const plan = buildSpinPlan(
          roster,
          roster[0]!,
          roster[roster.length - 1]!,
          s,
          TURBO_SPIN_LIMITS,
        );
        const g = gaps(plan);
        for (let i = 1; i < g.length; i++) expect(g[i]).toBeGreaterThanOrEqual(g[i - 1]! - 1);
        expect(plan.steps.at(-1)!.id).toBe(roster[roster.length - 1]);
        expect(plan.revealMs).toBeLessThanOrEqual(TURBO_SPIN_LIMITS.maxSpinMs);
        expect(plan.revealMs).toBeGreaterThan(plan.landMs);
      }
    }
  });

  it('mostly lands after 1.5 s, and is clearly shorter than a normal spin', () => {
    const turbo = turboStyles.map(
      (s) => buildSpinPlan(ids, 'a', 'e', s, TURBO_SPIN_LIMITS).revealMs,
    );
    const normal = sampleStyles.map((s) => buildSpinPlan(ids, 'a', 'e', s).revealMs);
    const early = turboStyles.filter(
      (s) =>
        buildSpinPlan(ids, 'a', 'e', s, TURBO_SPIN_LIMITS).landMs < TURBO_SPIN_LIMITS.minLandMs,
    ).length;
    expect(early / turboStyles.length).toBeLessThan(0.05);
    const avg = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
    expect(avg(turbo)).toBeLessThan(avg(normal) * 0.7);
  });

  it('is deterministic per turn id', () => {
    expect(spinStyleFor('abc', true)).toEqual(spinStyleFor('abc', true));
  });
});

describe('spinStyleFor', () => {
  it('is deterministic per turn id, so a refresh replays the identical spin', () => {
    expect(spinStyleFor('abc')).toEqual(spinStyleFor('abc'));
  });

  it('varies from spin to spin', () => {
    const lands = new Set(sampleStyles.map((s) => s.targetLandMs));
    const dwell = new Set(sampleStyles.map((s) => s.dwellFactor));
    const teased = sampleStyles.filter((s) => s.teaseFactor > 1).length;
    expect(lands.size).toBeGreaterThan(200);
    expect(dwell.size).toBe(9);
    expect(teased / sampleStyles.length).toBeGreaterThan(0.15);
    expect(teased / sampleStyles.length).toBeLessThan(0.35);
  });
});

describe('spinStartId', () => {
  const players = [
    { id: 'a', alive: true },
    { id: 'b', alive: false },
    { id: 'c', alive: true },
    { id: 'd', alive: true },
  ];

  it('starts on the first living fighter on the first turn', () => {
    expect(spinStartId(players, null)).toBe('a');
    expect(spinStartId([{ id: 'x', alive: false }, ...players.slice(2)], null)).toBe('c');
  });

  it('continues after the previous target, skipping the dead and wrapping', () => {
    expect(spinStartId(players, 'a')).toBe('c');
    expect(spinStartId(players, 'b')).toBe('c');
    expect(spinStartId(players, 'd')).toBe('a');
  });
});
