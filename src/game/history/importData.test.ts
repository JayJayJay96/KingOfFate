import { describe, expect, it } from 'vitest';
import { playCompletedMatch } from '../../test/historyFixtures';
import { historyToJson } from './exportData';
import { importSummary, parseHistoryFile, planImport, stableJson } from './importData';

const ROSTER = [
  ['a', 'Aisyah'],
  ['b', 'Wei Jie'],
  ['c', 'Kavitha'],
] as const;
const m1 = playCompletedMatch({ matchId: 'm1', players: ROSTER, seed: 1 });
const m2 = playCompletedMatch({ matchId: 'm2', players: ROSTER, seed: 2 });
const m3 = playCompletedMatch({ matchId: 'm3', players: ROSTER, seed: 3 });
const m2Changed = { ...m2, completedAt: '2026-10-09T09:00:00.000Z' };

describe('history import (owner decision 2026-10-29)', () => {
  it('reads back its own export losslessly', () => {
    const parsed = parseHistoryFile(historyToJson([m1, m2], '2026-10-29T00:00:00.000Z'));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.matches.map((m) => stableJson(m))).toEqual([m1, m2].map((m) => stableJson(m)));
  });

  it('refuses anything that is not this app’s export', () => {
    expect(parseHistoryFile('not json')).toMatchObject({ ok: false });
    expect(parseHistoryFile('{"matches":[]}')).toMatchObject({ ok: false });
    expect(parseHistoryFile('{"app":"kof-king-of-fate","exportVersion":9,"matches":[]}')).toEqual({
      ok: false,
      message: 'This export was made by a different version of the game.',
    });
  });

  it('merge: adds new, skips identical, file wins on a changed copy, counts invalid', () => {
    const roundTripped = JSON.parse(JSON.stringify(m1)) as unknown;
    const plan = planImport(
      [m1, m2],
      [roundTripped, m2Changed, m3, m3, { matchId: 'junk' }],
      'merge',
    );
    expect(plan).toMatchObject({ imported: 1, replaced: 1, duplicates: 2, invalid: 1 });
    expect(plan.records.map((r) => r.matchId)).toEqual(['m2', 'm3']);
    expect(plan.records[0]!.completedAt).toBe(m2Changed.completedAt);
    expect(importSummary(plan)).toBe('imported 1, replaced 1, skipped 2 duplicates, 1 invalid');
  });

  it('identical means same content, whatever the key order', () => {
    const reordered = Object.fromEntries(Object.entries(m1).reverse());
    expect(planImport([m1], [reordered], 'merge')).toMatchObject({ imported: 0, duplicates: 1 });
  });

  it('replace: the file becomes the whole history', () => {
    const plan = planImport([m1, m2], [m3, m3, 42], 'replace');
    expect(plan.records.map((r) => r.matchId)).toEqual(['m3']);
    expect(plan).toMatchObject({ imported: 1, replaced: 0, duplicates: 1, invalid: 1 });
  });
});
