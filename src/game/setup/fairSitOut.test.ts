import { describe, expect, it } from 'vitest';
import type { CompletedMatchRecord } from '../../storage/matchStorage';
import { playCompletedMatch } from '../../test/historyFixtures';
import { applyFairSitOut, EMPTY_FAIR_STATE, type FairState } from './fairSitOut';
import type { Roster } from './roster';

const roster: Roster = [
  { id: 'a', name: 'Aisyah', active: true },
  { id: 'b', name: 'Wei Jie', active: true },
  { id: 'c', name: 'Kavitha', active: true },
];
const base = playCompletedMatch({
  matchId: 'base',
  players: [
    ['a', 'Aisyah'],
    ['b', 'Wei Jie'],
  ],
});

/** A completed record where `winners` won, finished at minute `n`. */
function won(n: number, ...winners: string[]): CompletedMatchRecord {
  const completedAt = `2026-10-29T03:${String(n).padStart(2, '0')}:00.000Z`;
  return {
    ...base,
    matchId: `m${n}`,
    completedAt,
    winnerIds: winners,
    match: { ...base.match, matchId: `m${n}`, title: `Prize ${n}` },
  };
}

const active = (r: Roster) => r.filter((p) => p.active).map((p) => p.id);

describe('fair sit-outs (owner decision 2026-10-29)', () => {
  it('nobody sits out with no wins', () => {
    const result = applyFairSitOut(roster, [], EMPTY_FAIR_STATE);
    expect(result.roster).toBe(roster);
    expect(result.fair).toBe(EMPTY_FAIR_STATE);
    expect(result.sitOut.size).toBe(0);
  });

  it('a winner sits out while anyone has fewer wins, with dates and prize lines', () => {
    const result = applyFairSitOut(roster, [won(1, 'a')], EMPTY_FAIR_STATE);
    expect(active(result.roster)).toEqual(['b', 'c']);
    expect(result.sitOut.get('a')).toEqual([
      { completedAt: '2026-10-29T03:01:00.000Z', title: 'Prize 1' },
    ]);
    expect(result.fair.handled).toEqual({ a: { wins: 1, off: true } });
  });

  it('everyone above the lowest count sits out (2s and 1s out while someone has 0)', () => {
    const records = [won(1, 'a'), won(2, 'a'), won(3, 'b')];
    expect(active(applyFairSitOut(roster, records, EMPTY_FAIR_STATE).roster)).toEqual(['c']);
    const four: Roster = [...roster, { id: 'd', name: 'Hafiz', active: true }];
    // a=2, b=1, c=1, d=1: only a is above the lowest.
    const result = applyFairSitOut(four, [...records, won(4, 'c'), won(5, 'd')], EMPTY_FAIR_STATE);
    expect(active(result.roster)).toEqual(['b', 'c', 'd']);
  });

  it('when everyone is level a new cycle starts and the game puts back who it sat out', () => {
    const first = applyFairSitOut(roster, [won(1, 'a'), won(2, 'b')], EMPTY_FAIR_STATE);
    expect(active(first.roster)).toEqual(['c']);
    const records = [won(1, 'a'), won(2, 'b'), won(3, 'c')];
    const next = applyFairSitOut(first.roster, records, first.fair);
    expect(active(next.roster)).toEqual(['a', 'b', 'c']);
    expect(next.fair).toEqual({ cycleStart: '2026-10-29T03:03:00.000Z', handled: {} });
    expect(next.sitOut.size).toBe(0);
    // The new cycle counts only later matches.
    const later = applyFairSitOut(next.roster, [...records, won(4, 'b')], next.fair);
    expect(active(later.roster)).toEqual(['a', 'c']);
  });

  it('the host can switch a sat-out person back in; it is not undone until they win again', () => {
    const first = applyFairSitOut(roster, [won(1, 'a')], EMPTY_FAIR_STATE);
    const hostOverride = first.roster.map((p) => ({ ...p, active: true }));
    const again = applyFairSitOut(hostOverride, [won(1, 'a')], first.fair);
    expect(active(again.roster)).toEqual(['a', 'b', 'c']);
    expect(again.sitOut.has('a')).toBe(true); // the crown still shows why
    const afterWin = applyFairSitOut(again.roster, [won(1, 'a'), won(2, 'a')], again.fair);
    expect(active(afterWin.roster)).toEqual(['b', 'c']);
  });

  it('someone the host switched off (absent) is never switched on by the game', () => {
    const absent: Roster = roster.map((p) => (p.id === 'a' ? { ...p, active: false } : p));
    const first = applyFairSitOut(absent, [won(1, 'a')], EMPTY_FAIR_STATE);
    expect(first.fair.handled).toEqual({ a: { wins: 1, off: false } });
    const level = [won(1, 'a'), won(2, 'b'), won(3, 'c')];
    expect(active(applyFairSitOut(first.roster, level, first.fair).roster)).toEqual(['b', 'c']);
  });

  it('matches people by roster entry ID, not name; unknown IDs and bad records are ignored', () => {
    const renamed: Roster = roster.map((p) => (p.id === 'a' ? { ...p, name: 'Syah' } : p));
    const records = [won(1, 'a'), won(2, 'zz'), { junk: true }];
    expect(active(applyFairSitOut(renamed, records, EMPTY_FAIR_STATE).roster)).toEqual(['b', 'c']);
  });

  it('is stable: running it again changes nothing', () => {
    const first = applyFairSitOut(roster, [won(1, 'a')], EMPTY_FAIR_STATE);
    const fair: FairState = first.fair;
    const again = applyFairSitOut(first.roster, [won(1, 'a')], fair);
    expect(again.roster).toBe(first.roster);
    expect(again.fair).toBe(fair);
  });
});
