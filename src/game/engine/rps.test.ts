import { describe, expect, it } from 'vitest';
import { createScriptedRng } from '../rng/rng';
import { beats, challengerWins, GESTURES, sampleDuelThrows } from './rps';

describe('RPS', () => {
  it('each gesture beats exactly one other', () => {
    expect(beats('ROCK', 'SCISSORS')).toBe(true);
    expect(beats('SCISSORS', 'PAPER')).toBe(true);
    expect(beats('PAPER', 'ROCK')).toBe(true);
    for (const a of GESTURES) {
      expect(beats(a, a)).toBe(false);
      expect(GESTURES.filter((b) => beats(a, b))).toHaveLength(1);
    }
  });

  it('rethrows draws until decisive; the decisive throw is last', () => {
    // challenger, opponent per throw: R/R draw, S/S draw, P/R decisive.
    const throws = sampleDuelThrows(createScriptedRng([0, 0, 2, 2, 1, 0]));
    expect(throws).toEqual([
      { challenger: 'ROCK', opponent: 'ROCK' },
      { challenger: 'SCISSORS', opponent: 'SCISSORS' },
      { challenger: 'PAPER', opponent: 'ROCK' },
    ]);
    expect(challengerWins(throws)).toBe(true);
  });

  it('reports the opponent winning', () => {
    expect(challengerWins([{ challenger: 'ROCK', opponent: 'PAPER' }])).toBe(false);
  });

  it('refuses a duel without a decisive throw', () => {
    expect(() => challengerWins([])).toThrow();
    expect(() => challengerWins([{ challenger: 'ROCK', opponent: 'ROCK' }])).toThrow();
  });
});
