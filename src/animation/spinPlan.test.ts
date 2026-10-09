import { describe, expect, it } from 'vitest';
import {
  buildSpinPlan,
  DEFAULT_SPIN_STYLE,
  spinStartId,
  spinStyleFor,
  type SpinStyle,
} from './spinPlan';

const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const gaps = (plan: { atMs: number }[]) => plan.slice(1).map((s, i) => s.atMs - plan[i]!.atMs);
const style = (overrides: Partial<SpinStyle> = {}): SpinStyle => ({
  ...DEFAULT_SPIN_STYLE,
  ...overrides,
});

/** Many different styles, as production would generate them. */
const sampleStyles = Array.from({ length: 200 }, (_, i) => spinStyleFor(`turn-${i}`, [4000, 5000]));

describe('buildSpinPlan (sequential roulette)', () => {
  it('walks the grid in order, wrapping, from start to the committed target', () => {
    const plan = buildSpinPlan(ids, 'c', 'b', style());
    expect(plan[0]).toEqual({ id: 'c', atMs: 0 });
    for (let i = 1; i < plan.length; i++) {
      const prev = ids.indexOf(plan[i - 1]!.id);
      expect(plan[i]!.id).toBe(ids[(prev + 1) % ids.length]);
    }
    expect(plan.at(-1)).toEqual({ id: 'b', atMs: 4500 });
  });

  it('lands on every target from every start with every sampled style', () => {
    for (const s of sampleStyles.slice(0, 40)) {
      for (const start of ids) {
        for (const target of ids) {
          const plan = buildSpinPlan(ids, start, target, s);
          expect(plan.at(-1)).toEqual({ id: target, atMs: s.durationMs });
          expect(plan.length - 1).toBeGreaterThanOrEqual(s.minSteps);
          expect(plan.length - 1).toBeLessThan(s.minSteps + ids.length);
        }
      }
    }
  });

  it('always decelerates (gaps never shrink) and the final move never exceeds 30% of the spin', () => {
    for (const s of sampleStyles) {
      const g = gaps(buildSpinPlan(ids, 'a', 'e', s));
      // ±1 ms tolerance for rounding to whole milliseconds.
      for (let i = 1; i < g.length; i++) expect(g[i]).toBeGreaterThanOrEqual(g[i - 1]! - 1);
      expect(g.at(-1)!).toBeLessThanOrEqual(s.durationMs * 0.3 + 1);
    }
  });

  it('a fake-out stretches only the final move', () => {
    const plain = gaps(buildSpinPlan(ids, 'a', 'e', style()));
    const teased = gaps(buildSpinPlan(ids, 'a', 'e', style({ teaseFactor: 1.8 })));
    expect(teased.length).toBe(plain.length);
    expect(teased.at(-1)!).toBeGreaterThan(plain.at(-1)! * 1.5);
    expect(teased.at(-2)!).toBeLessThan(plain.at(-2)!);
  });

  it('loops several laps on tiny rosters', () => {
    const plan = buildSpinPlan(['x', 'y', 'z'], 'x', 'x', style());
    expect(plan.length - 1).toBe(24); // 8 full laps, landing back on the start
    expect(plan.at(-1)?.id).toBe('x');
  });

  it('handles the full 32-fighter grid', () => {
    const big = Array.from({ length: 32 }, (_, i) => `p${i}`);
    const plan = buildSpinPlan(big, 'p31', 'p30', style());
    expect(plan.length - 1).toBe(31);
    expect(plan[1]!.id).toBe('p0');
  });

  it('rejects ids that are not on the grid', () => {
    expect(() => buildSpinPlan(ids, 'zzz', 'a')).toThrow();
    expect(() => buildSpinPlan(ids, 'a', 'zzz')).toThrow();
  });
});

describe('spinStyleFor', () => {
  it('is deterministic per turn id, so a refresh replays the identical spin', () => {
    expect(spinStyleFor('abc', [4000, 5000])).toEqual(spinStyleFor('abc', [4000, 5000]));
  });

  it('stays inside the approved 4–5 s window and the designed ranges', () => {
    for (const s of sampleStyles) {
      expect(s.durationMs).toBeGreaterThanOrEqual(4000);
      expect(s.durationMs).toBeLessThanOrEqual(5000);
      expect(s.minSteps).toBeGreaterThanOrEqual(20);
      expect(s.minSteps).toBeLessThanOrEqual(36);
      expect(s.easePower).toBeGreaterThanOrEqual(1.5);
      expect(s.easePower).toBeLessThanOrEqual(2.4 + 1e-9);
      expect(s.teaseFactor === 1 || (s.teaseFactor >= 1.4 && s.teaseFactor <= 2.0 + 1e-9)).toBe(
        true,
      );
    }
  });

  it('varies from spin to spin (not learnable)', () => {
    const durations = new Set(sampleStyles.map((s) => s.durationMs));
    const powers = new Set(sampleStyles.map((s) => s.easePower));
    const teased = sampleStyles.filter((s) => s.teaseFactor > 1).length;
    expect(durations.size).toBeGreaterThan(100);
    expect(powers.size).toBe(10);
    expect(teased).toBeGreaterThan(40); // ~35% of 200
    expect(teased).toBeLessThan(100);
  });

  it('honours a fixed duration (used by tests)', () => {
    expect(spinStyleFor('x', [40, 40]).durationMs).toBe(40);
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
