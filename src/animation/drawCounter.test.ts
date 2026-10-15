import { describe, expect, it } from 'vitest';
import { drawBurstLabel, drawBurstScale, finaleDrawStreak, isClash } from './drawCounter';

describe('draw counter (owner request 2026-10-16)', () => {
  const draw = (stageNumber = 1) => ({ winningGesture: null, stageNumber });
  const won = (stageNumber = 1) => ({ winningGesture: 'ROCK' as const, stageNumber });

  it('counts the draws in a row at the end of the current race only', () => {
    expect(finaleDrawStreak([], 1)).toBe(0);
    expect(finaleDrawStreak([draw(), draw(), draw()], 1)).toBe(3);
    expect(finaleDrawStreak([draw(), won(), draw()], 1)).toBe(1);
    expect(finaleDrawStreak([draw(1), draw(2)], 2)).toBe(1);
  });

  it('a clash is everyone showing the same hand', () => {
    expect(isClash(['ROCK', 'ROCK', 'ROCK'])).toBe(true);
    expect(isClash(['ROCK', 'PAPER', 'SCISSORS'])).toBe(false);
  });

  it('labels and grows', () => {
    expect(drawBurstLabel(1, false)).toBe('Draw!');
    expect(drawBurstLabel(3, false)).toBe('Draw ×3!');
    expect(drawBurstLabel(2, true)).toBe('Clash ×2!');
    expect(drawBurstScale(1)).toBe(1);
    expect(drawBurstScale(3)).toBeCloseTo(1.4);
    expect(drawBurstScale(20)).toBe(1.8);
  });
});
