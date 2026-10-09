import { describe, expect, it } from 'vitest';
import { buildSpinPlan, MIN_SPIN_STEPS, spinStartId } from './spinPlan';

const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const gaps = (plan: { atMs: number }[]) => plan.slice(1).map((s, i) => s.atMs - plan[i]!.atMs);

describe('buildSpinPlan (sequential roulette)', () => {
  it('walks the grid in order, wrapping, from start to the committed target', () => {
    const plan = buildSpinPlan(ids, 'c', 'b', 4500);
    expect(plan[0]).toEqual({ id: 'c', atMs: 0 });
    for (let i = 1; i < plan.length; i++) {
      const prev = ids.indexOf(plan[i - 1]!.id);
      expect(plan[i]!.id).toBe(ids[(prev + 1) % ids.length]);
    }
    expect(plan.at(-1)).toEqual({ id: 'b', atMs: 4500 });
  });

  it.each(ids)('lands on target %s from every start, at exactly the duration', (target) => {
    for (const start of ids) {
      const plan = buildSpinPlan(ids, start, target, 4500);
      expect(plan.at(-1)).toEqual({ id: target, atMs: 4500 });
      expect(plan.length - 1).toBeGreaterThanOrEqual(MIN_SPIN_STEPS);
      expect(plan.length - 1).toBeLessThan(MIN_SPIN_STEPS + ids.length);
    }
  });

  it('decelerates: quick first moves, gaps never shrink, crawling final moves', () => {
    const plan = buildSpinPlan(ids, 'a', 'e', 4500);
    const g = gaps(plan);
    // ±1 ms tolerance for rounding to whole milliseconds.
    for (let i = 1; i < g.length; i++) expect(g[i]).toBeGreaterThanOrEqual(g[i - 1]! - 1);
    expect(g[0]).toBeLessThan(150);
    expect(g.at(-1)).toBeGreaterThan(600);
  });

  it('loops several laps on tiny rosters', () => {
    const plan = buildSpinPlan(['x', 'y', 'z'], 'x', 'x', 4500);
    expect(plan.length - 1).toBe(24); // 8 full laps, landing back on the start
    expect(plan.at(-1)?.id).toBe('x');
  });

  it('handles the full 32-fighter grid', () => {
    const big = Array.from({ length: 32 }, (_, i) => `p${i}`);
    const plan = buildSpinPlan(big, 'p31', 'p30', 4500);
    expect(plan.length - 1).toBe(31);
    expect(plan[1]!.id).toBe('p0');
  });

  it('rejects ids that are not on the grid', () => {
    expect(() => buildSpinPlan(ids, 'zzz', 'a', 4500)).toThrow();
    expect(() => buildSpinPlan(ids, 'a', 'zzz', 4500)).toThrow();
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
