import { describe, expect, it } from 'vitest';
import type { WinnerCount } from '../config/limits';
import type { Participant } from './roster';
import type { SetupConfig } from './setupConfig';
import { describeSetupIssue, validateSetup } from './validation';

function config(active: number, winnerCount: number, inactive = 0): SetupConfig {
  const roster: Participant[] = [];
  for (let i = 0; i < active; i++) roster.push({ id: `a${i}`, name: `A${i}`, active: true });
  for (let i = 0; i < inactive; i++) roster.push({ id: `i${i}`, name: `I${i}`, active: false });
  return { roster, winnerCount: winnerCount as WinnerCount, presetId: 'normal' };
}

describe('validateSetup', () => {
  it.each([
    [2, 1],
    [3, 2],
    [6, 5],
    [20, 3],
    [32, 5],
  ])('allows %i active players with %i winners', (active, winners) => {
    const v = validateSetup(config(active, winners));
    expect(v.canStart).toBe(true);
    expect(v.issues).toEqual([]);
  });

  it.each([0, 1])('rejects %i active players', (active) => {
    const v = validateSetup(config(active, 1));
    expect(v.canStart).toBe(false);
    expect(v.issues.map((i) => i.code)).toEqual(['too-few-players']);
  });

  it('rejects 33 active players', () => {
    const v = validateSetup(config(33, 1));
    expect(v.canStart).toBe(false);
    expect(v.issues.map((i) => i.code)).toEqual(['too-many-players']);
  });

  it('counts only active players: 40 stored with 32 active is fine', () => {
    const v = validateSetup(config(32, 2, 8));
    expect(v.activeCount).toBe(32);
    expect(v.canStart).toBe(true);
  });

  it('rejects N = W instead of auto-awarding', () => {
    const v = validateSetup(config(3, 3));
    expect(v.canStart).toBe(false);
    expect(v.issues).toEqual([{ code: 'not-enough-for-winners', activeCount: 3, winnerCount: 3 }]);
  });

  it('rejects N < W', () => {
    expect(validateSetup(config(2, 5)).issues.map((i) => i.code)).toEqual([
      'not-enough-for-winners',
    ]);
  });

  it.each([0, 6, 2.5, Number.NaN])('rejects invalid winner count %s', (w) => {
    const v = validateSetup(config(10, w));
    expect(v.canStart).toBe(false);
    expect(v.issues.map((i) => i.code)).toEqual(['invalid-winner-count']);
  });

  it('flags a start that goes straight to the finale at N = W + 1', () => {
    expect(validateSetup(config(3, 2)).startsInFinale).toBe(true);
    expect(validateSetup(config(4, 2)).startsInFinale).toBe(false);
    expect(validateSetup(config(2, 2)).startsInFinale).toBe(false);
  });

  it('describes every issue with an actionable message', () => {
    for (const cfg of [config(1, 1), config(33, 1), config(3, 3), config(5, 9)]) {
      for (const issue of validateSetup(cfg).issues) {
        expect(describeSetupIssue(issue)).toMatch(/\w/);
      }
    }
  });
});
