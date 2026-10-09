import { describe, expect, it } from 'vitest';
import { createSeededRng } from '../game/rng/rng';
import { buildSpinPlan } from './spinPlan';

const ids = ['a', 'b', 'c', 'd', 'e'];
const cosmetic = (seed: number) => {
  const rng = createSeededRng(seed);
  return () => rng.nextInt(1_000_000) / 1_000_000;
};

describe('buildSpinPlan', () => {
  it.each(ids)('always lands on the committed target %s at exactly the spin duration', (target) => {
    for (let seed = 0; seed < 20; seed++) {
      const plan = buildSpinPlan(ids, target, 4500, cosmetic(seed));
      expect(plan.at(-1)).toEqual({ id: target, atMs: 4500 });
    }
  });

  it('slows down: gaps between moves never shrink', () => {
    const plan = buildSpinPlan(ids, 'c', 4500, cosmetic(1));
    const gaps = plan.slice(1).map((s, i) => s.atMs - plan[i]!.atMs);
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]).toBeGreaterThanOrEqual(gaps[i - 1]!);
  });

  it('only visits candidates and never repeats a cell back to back', () => {
    const plan = buildSpinPlan(ids, 'a', 4500, cosmetic(2));
    for (let i = 0; i < plan.length; i++) {
      expect(ids).toContain(plan[i]!.id);
      if (i > 0) expect(plan[i]!.id).not.toBe(plan[i - 1]!.id);
    }
  });

  it('works with only two candidates', () => {
    const plan = buildSpinPlan(['x', 'y'], 'y', 1000, cosmetic(3));
    expect(plan.at(-1)?.id).toBe('y');
    expect(plan.at(-2)?.id).toBe('x');
  });

  it('rejects a target that is not a candidate', () => {
    expect(() => buildSpinPlan(ids, 'zzz', 4500)).toThrow();
  });
});
