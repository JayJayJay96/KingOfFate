/** Chi-square statistic of observed counts against a uniform expectation. */
export function chiSquareUniform(counts: readonly number[]): number {
  const total = counts.reduce((a, b) => a + b, 0);
  const expected = total / counts.length;
  return counts.reduce((sum, c) => sum + (c - expected) ** 2 / expected, 0);
}
