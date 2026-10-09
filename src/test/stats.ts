/** Chi-square statistic of observed counts against a uniform expectation. */
export function chiSquareUniform(counts: readonly number[]): number {
  return chiSquare(
    counts,
    counts.map(() => 1 / counts.length),
  );
}

/** Chi-square statistic of observed counts against expected probabilities (must sum to 1). */
export function chiSquare(counts: readonly number[], probabilities: readonly number[]): number {
  const total = counts.reduce((a, b) => a + b, 0);
  return counts.reduce((sum, c, i) => {
    const expected = total * probabilities[i]!;
    return sum + (c - expected) ** 2 / expected;
  }, 0);
}

/** Critical chi-square values at p = 0.001 by degrees of freedom (fixed seeds keep tests stable). */
export const CHI2_P001: Readonly<Record<number, number>> = {
  1: 10.83,
  2: 13.82,
  3: 16.27,
  4: 18.47,
  5: 20.52,
  6: 22.46,
  7: 24.32,
};
