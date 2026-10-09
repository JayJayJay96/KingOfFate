import { describe, expect, it } from 'vitest';
import { chiSquareUniform } from '../../test/stats';
import { boundedInt, createCryptoRng, createScriptedRng, createSeededRng } from './rng';

describe('boundedInt', () => {
  it('rejects values in the incomplete top bucket instead of folding them (no modulo bias)', () => {
    // 2^32 % 3 === 1, so 2^32 - 1 is the single biased value and must be redrawn.
    const values = [2 ** 32 - 1, 2 ** 32 - 1, 7];
    let i = 0;
    expect(boundedInt(() => values[i++]!, 3)).toBe(7 % 3);
    expect(i).toBe(3);
  });

  it('accepts the largest unbiased value', () => {
    expect(boundedInt(() => 2 ** 32 - 2, 3)).toBe((2 ** 32 - 2) % 3);
  });

  it.each([0, -1, 1.5, Number.NaN, 2 ** 32 + 1])('rejects bound %s', (bound) => {
    expect(() => boundedInt(() => 0, bound)).toThrow(RangeError);
  });

  it('a bound of 1 always yields 0', () => {
    expect(boundedInt(() => 123456, 1)).toBe(0);
  });
});

describe('createCryptoRng', () => {
  it('draws from crypto.getRandomValues and stays in range', () => {
    let calls = 0;
    const fake = {
      getRandomValues<T extends ArrayBufferView | null>(array: T): T {
        calls++;
        (array as unknown as Uint32Array)[0] = 41;
        return array;
      },
    } as Pick<Crypto, 'getRandomValues'>;
    expect(createCryptoRng(fake).nextInt(10)).toBe(1);
    expect(calls).toBe(1);
  });

  it('works with the real Web Crypto API', () => {
    const rng = createCryptoRng();
    for (let i = 0; i < 1000; i++) {
      const v = rng.nextInt(32);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(32);
    }
  });
});

describe('createSeededRng', () => {
  it('is deterministic per seed', () => {
    const a = createSeededRng(42);
    const b = createSeededRng(42);
    const c = createSeededRng(43);
    const seqA = Array.from({ length: 20 }, () => a.nextInt(1000));
    expect(Array.from({ length: 20 }, () => b.nextInt(1000))).toEqual(seqA);
    expect(Array.from({ length: 20 }, () => c.nextInt(1000))).not.toEqual(seqA);
  });

  it('is uniform over 7 buckets (seeded, so the check is not flaky)', () => {
    const rng = createSeededRng(20261009);
    const counts = new Array<number>(7).fill(0);
    for (let i = 0; i < 70_000; i++) counts[rng.nextInt(7)]!++;
    // Critical chi-square value for df = 6 at p = 0.001 is 22.46.
    expect(chiSquareUniform(counts)).toBeLessThan(22.46);
  });
});

describe('createScriptedRng', () => {
  it('replays values and validates their range', () => {
    const rng = createScriptedRng([2, 0]);
    expect(rng.nextInt(3)).toBe(2);
    expect(rng.nextInt(1)).toBe(0);
    expect(() => rng.nextInt(1)).toThrow(/exhausted/);
    expect(() => createScriptedRng([5]).nextInt(3)).toThrow(RangeError);
  });
});
