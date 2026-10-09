import { describe, expect, it } from 'vitest';
import { isStageChoice, STAGE_IDS, stageForMatch } from './stages';

describe('stages (owner decision: random per match, host can pin)', () => {
  it('a pinned stage always wins', () => {
    for (const id of STAGE_IDS) expect(stageForMatch(id, 'any-match')).toBe(id);
  });

  it('random is stable per match (same after a refresh) and uses every stage', () => {
    expect(stageForMatch('random', 'm-1')).toBe(stageForMatch('random', 'm-1'));
    const seen = new Set(
      Array.from({ length: 200 }, (_, i) => stageForMatch('random', `match-${i}`)),
    );
    expect(seen).toEqual(new Set(STAGE_IDS));
  });

  it('validates choices', () => {
    expect(isStageChoice('random')).toBe(true);
    expect(isStageChoice('mamak')).toBe(true);
    expect(isStageChoice('moon')).toBe(false);
    expect(isStageChoice(undefined)).toBe(false);
  });
});
