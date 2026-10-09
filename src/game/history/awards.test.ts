import { describe, expect, it } from 'vitest';
import { fakeSummary } from '../../test/historyFixtures';
import { toCompletedRecord } from '../../storage/matchStorage';
import { beginFinale, resolveFinaleRound, startFinaleRound } from '../engine/finale';
import { createMatch } from '../engine/match';
import type { MatchState } from '../engine/matchTypes';
import { createScriptedRng } from '../rng/rng';
import { careerBadges, headToHead, matchAwards, rivalries } from './awards';
import { aggregateStats, summarizeMatch } from './history';

const ROCK = 0;
const PAPER = 1;
const SCISSORS = 2;

/** Two-finalist match (opens in the finale) with scripted reveals, played to victory. */
function finaleMatch(reveals: [number, number][]): MatchState {
  let s = beginFinale(
    createMatch(
      {
        players: [
          { id: 'a', name: 'Aisyah' },
          { id: 'b', name: 'Wei Jie' },
        ],
        winnerCount: 1,
        presetId: 'normal',
      },
      { matchId: 'f', startedAt: '2026-10-10T00:00:00.000Z' },
    ),
  );
  reveals.forEach(([x, y], i) => {
    s = startFinaleRound(s, createScriptedRng([x, y]), `r${i}`);
    s = resolveFinaleRound(s, `r${i}`, '2026-10-10T00:01:00.000Z');
  });
  expect(s.phase).toBe('VICTORY');
  return s;
}

describe('Flawless (won the finale race without anyone else scoring)', () => {
  it('3–0 (draws allowed) is flawless', () => {
    const won = finaleMatch([
      [ROCK, SCISSORS],
      [PAPER, PAPER],
      [ROCK, SCISSORS],
      [ROCK, SCISSORS],
    ]);
    const s = summarizeMatch(toCompletedRecord(won));
    expect(s.fighters.find((f) => f.id === 'a')!.flawless).toBe(true);
    expect(matchAwards(s)).toContainEqual({ badge: 'flawless', playerIds: ['a'] });
  });

  it('3–1 is not', () => {
    const won = finaleMatch([
      [ROCK, SCISSORS],
      [SCISSORS, ROCK],
      [ROCK, SCISSORS],
      [ROCK, SCISSORS],
    ]);
    const s = summarizeMatch(toCompletedRecord(won));
    expect(s.fighters.every((f) => !f.flawless)).toBe(true);
    expect(matchAwards(s).some((a) => a.badge === 'flawless')).toBe(false);
  });
});

describe('match awards', () => {
  it('First Blood, Magnet (2+), Iron Wall (2+ blocks), Duelist (2+ VS wins)', () => {
    const s = fakeSummary('m', '2026-10-10T00:00:00.000Z', 1, [
      ['a', 'Aisyah', true, { selected: 4, vsWon: 2, shieldBlocks: 2 }],
      ['b', 'Wei Jie', false, { eliminatedOnTurn: 3, selected: 4 }],
      ['c', 'Kavitha', false, { eliminatedOnTurn: 1 }],
      ['d', 'Hafiz', false, { eliminatedOnTurn: 2, vsWon: 1, shieldBlocks: 1 }],
    ]);
    expect(matchAwards(s)).toEqual([
      { badge: 'firstBlood', playerIds: ['c'] },
      { badge: 'magnet', playerIds: ['a', 'b'] },
      { badge: 'ironWall', playerIds: ['a'] },
      { badge: 'duelist', playerIds: ['a'] },
    ]);
  });

  it('no Magnet when nobody was picked twice; no First Blood when the match opened in the finale', () => {
    const s = fakeSummary('m', '2026-10-10T00:00:00.000Z', 1, [
      ['a', 'Aisyah', true, { selected: 0 }],
      ['b', 'Wei Jie', false, { finalist: true, eliminatedOnTurn: null, selected: 0 }],
    ]);
    expect(matchAwards(s)).toEqual([]);
  });
});

describe('rivalries and head-to-head (VS duels only)', () => {
  const m1 = fakeSummary(
    'm1',
    '2026-10-01T00:00:00.000Z',
    1,
    [
      ['a', 'Aisyah', true],
      ['b', 'Wei Jie', false],
      ['c', 'Kavitha', false],
    ],
    [
      { winnerId: 'b', loserId: 'a' },
      { winnerId: 'a', loserId: 'c' },
    ],
  );
  const m2 = fakeSummary(
    'm2',
    '2026-10-02T00:00:00.000Z',
    1,
    [
      ['a', 'Aisyah', false],
      ['b', 'WJ', true],
    ],
    [
      { winnerId: 'b', loserId: 'a' },
      { winnerId: 'a', loserId: 'b' },
      { winnerId: 'b', loserId: 'a' },
    ],
  );

  it('pairs up duels, leader first, most duels first, latest names', () => {
    expect(rivalries([m1, m2])).toEqual([
      {
        aId: 'b',
        bId: 'a',
        aName: 'WJ',
        bName: 'Aisyah',
        aWins: 3,
        bWins: 1,
        duels: 4,
        lastAt: '2026-10-02T00:00:00.000Z',
      },
      {
        aId: 'a',
        bId: 'c',
        aName: 'Aisyah',
        bName: 'Kavitha',
        aWins: 1,
        bWins: 0,
        duels: 1,
        lastAt: '2026-10-01T00:00:00.000Z',
      },
    ]);
  });

  it("gives each person's record from their side", () => {
    expect(headToHead([m1, m2], 'a')).toEqual([
      { opponentId: 'b', opponentName: 'WJ', wins: 1, losses: 3 },
      { opponentId: 'c', opponentName: 'Kavitha', wins: 1, losses: 0 },
    ]);
    expect(headToHead([m1, m2], 'c')).toEqual([
      { opponentId: 'a', opponentName: 'Aisyah', wins: 0, losses: 1 },
    ]);
    expect(headToHead([m1, m2], 'nobody')).toEqual([]);
  });

  it('is empty without duels', () => {
    const lone = fakeSummary('x', '2026-10-01T00:00:00.000Z', 1, [['a', 'A', true]]);
    expect(rivalries([lone])).toEqual([]);
  });
});

describe('career badges', () => {
  const at = (d: number) => `2026-10-0${d}T00:00:00.000Z`;
  const ms = [
    fakeSummary('m1', at(1), 1, [
      ['a', 'Aisyah', true, { shieldsGained: 1 }],
      ['b', 'Wei Jie', false, { finalist: true, eliminatedOnTurn: null }],
      ['c', 'Kavitha', false, { eliminatedOnTurn: 1 }],
    ]),
    // c sits out; a wins again → back-to-back for a.
    fakeSummary('m2', at(2), 1, [
      ['a', 'Aisyah', true, { shieldsGained: 2 }],
      ['b', 'Wei Jie', false, { finalist: true, eliminatedOnTurn: null, shieldsGained: 2 }],
    ]),
    fakeSummary('m3', at(3), 1, [
      ['a', 'Aisyah', false, { eliminatedOnTurn: 1 }],
      ['b', 'Wei Jie', true],
      ['c', 'Kavitha', false, { finalist: true, eliminatedOnTurn: null }],
    ]),
  ];
  const badges = careerBadges(ms, aggregateStats(ms));

  it('Back-to-back counts wins in a row among the matches each person played', () => {
    expect(badges.get('a')).toContainEqual({ badge: 'backToBack', count: 2 });
    expect(badges.get('b')?.some((x) => x.badge === 'backToBack')).toBe(false);
  });

  it('Survivor needs 3+ finales; Shield Hoarder goes to everyone tied for the most', () => {
    expect(badges.get('b')).toContainEqual({ badge: 'survivor', count: 3 });
    expect(badges.get('a')?.some((x) => x.badge === 'survivor')).toBe(false);
    expect(badges.get('a')).toContainEqual({ badge: 'shieldHoarder', count: 3 });
    expect(badges.get('b')?.some((x) => x.badge === 'shieldHoarder')).toBe(false);
  });

  it('counts match awards over time', () => {
    expect(badges.get('c')).toContainEqual({ badge: 'firstBlood', count: 1 });
    expect(badges.get('a')).toContainEqual({ badge: 'firstBlood', count: 1 });
  });
});
