import { describe, expect, it } from 'vitest';
import { fakeSummary as summary, playCompletedMatch } from '../../test/historyFixtures';
import { FATE_PRESET_IDS } from '../config/presets';
import type { CompletedMatchRecord } from '../../storage/matchStorage';
import {
  aggregateStats,
  historyLog,
  isHistoryRecord,
  sortSummaries,
  summarizeMatch,
} from './history';

const ROSTER = [
  'Aisyah',
  'Wei Jie',
  'Kavitha',
  'Hafiz',
  'Mei Ling',
  'Arjun',
  'Siti',
  'Ravi',
  'Farah',
  'Jun Hao',
  'Nurul',
  'Priya',
].map((name, i) => [`id-${i}`, name] as const);

describe('summarizeMatch', () => {
  it('agrees with the engine for many seeded matches (every preset, W = 1..5)', () => {
    for (const presetId of FATE_PRESET_IDS) {
      for (let w = 1; w <= 5; w++) {
        for (const n of [w + 1, w + 3, 12]) {
          const record = playCompletedMatch({
            matchId: `m-${presetId}-${w}-${n}`,
            players: ROSTER.slice(0, n),
            winnerCount: w,
            presetId,
            seed: w * 100 + n,
          });
          const s = summarizeMatch(record);
          const turns = record.match.events.filter((e) => e.type === 'TURN_RESOLVED');
          const vsTurns = turns.filter(
            (e) => e.type === 'TURN_RESOLVED' && e.outcome.fate === 'VS',
          );
          const sum = (key: 'selected' | 'vsWon' | 'vsFought' | 'finalePoints') =>
            s.fighters.reduce((acc, f) => acc + f[key], 0);

          expect(s.fighterCount).toBe(n);
          expect(s.fighters.filter((f) => f.won).map((f) => f.id)).toEqual(
            s.fighters.filter((f) => s.winnerIds.includes(f.id)).map((f) => f.id),
          );
          expect(s.winnerIds).toHaveLength(w);
          expect(s.fighters.filter((f) => f.finalist)).toHaveLength(w + 1);
          expect(s.fighters.every((f) => !f.won || f.finalist)).toBe(true);
          // Everyone who missed the finale was knocked out on a real turn.
          for (const f of s.fighters.filter((x) => !x.finalist)) {
            expect(f.eliminatedOnTurn).toBeGreaterThanOrEqual(1);
            expect(f.eliminatedOnTurn).toBeLessThanOrEqual(s.turns);
          }
          expect(sum('selected')).toBe(s.turns);
          expect(turns).toHaveLength(s.turns);
          expect(sum('vsWon')).toBe(vsTurns.length);
          expect(sum('vsFought')).toBe(2 * vsTurns.length);
          expect(sum('finalePoints')).toBe(
            record.match.finale!.rounds.reduce((acc, r) => acc + r.scorerIds.length, 0),
          );
          expect(s.durationMs).toBe(5 * 60 * 1000);
        }
      }
    }
  });

  it('counts Shields gained and blocks from the event log', () => {
    const record = playCompletedMatch({
      matchId: 'chaos',
      players: ROSTER,
      presetId: 'chaotic',
      seed: 7,
    });
    const s = summarizeMatch(record);
    let gained = 0;
    let blocked = 0;
    for (const e of record.match.events) {
      if (e.type !== 'TURN_RESOLVED') continue;
      const o = e.outcome;
      if (o.fate === 'SHIELD' && o.result === 'GAINED') gained++;
      if (o.fate === 'KO' && o.result === 'BLOCKED') blocked++;
      if (o.fate === 'VS' && o.winnerShield === 'GAINED') gained++;
      if (o.fate === 'VS' && o.loserResult === 'BLOCKED') blocked++;
      if (o.fate === 'BOMB' && o.result === 'BLOCKED') blocked++;
      if (o.fate === 'BOMB' && o.neighbourResult === 'BLOCKED') blocked++;
    }
    expect(s.fighters.reduce((a, f) => a + f.shieldsGained, 0)).toBe(gained);
    expect(s.fighters.reduce((a, f) => a + f.shieldBlocks, 0)).toBe(blocked);
    // Never more Shields than the supply of 1 per 5 fighters.
    expect(gained).toBeLessThanOrEqual(Math.ceil(ROSTER.length / 5));
  });
});

describe('aggregateStats (owner decisions: roster identity, luck vs expected)', () => {
  const first = summary('m1', '2026-10-01T10:00:00.000Z', 1, [
    ['a', 'Aisyah', true],
    ['b', 'Wei Jie', false],
    ['c', 'Kavitha', false],
    ['d', 'Hafiz', false],
  ]);
  const second = summary('m2', '2026-10-02T10:00:00.000Z', 1, [
    ['a', 'Aisyah', false],
    ['b', 'WJ', true], // renamed in the roster: same entry, same stats
  ]);

  it('adds up per roster entry and shows the latest name', () => {
    const stats = aggregateStats([second, first]);
    const wj = stats.find((s) => s.id === 'b')!;
    expect(wj.name).toBe('WJ');
    expect(wj.played).toBe(2);
    expect(wj.wins).toBe(1);
    expect(wj.lastPlayedAt).toBe('2026-10-02T10:00:00.000Z');
  });

  it('expected wins = sum of W/N; luck = wins − expected; ranked luckiest first', () => {
    const stats = aggregateStats([first, second]);
    const by = Object.fromEntries(stats.map((s) => [s.id, s]));
    expect(by.a!.expectedWins).toBeCloseTo(1 / 4 + 1 / 2);
    expect(by.a!.luck).toBeCloseTo(1 - 0.75);
    expect(by.b!.luck).toBeCloseTo(1 - 0.75);
    expect(by.c!.luck).toBeCloseTo(-0.25);
    expect(by.c!.winRate).toBe(0);
    expect(by.a!.winRate).toBe(0.5);
    // a and b tie on luck, wins and played → by name (Aisyah before WJ, Hafiz before Kavitha).
    expect(stats.map((s) => s.id)).toEqual(['a', 'b', 'd', 'c']);
  });

  it('breaks a luck tie by wins, then by fewer matches played', () => {
    const third = summary('m3', '2026-10-03T10:00:00.000Z', 1, [
      ['e', 'Arjun', true],
      ['f', 'Siti', false],
      ['g', 'Ravi', false],
      ['h', 'Farah', false],
    ]);
    const stats = aggregateStats([first, third]);
    expect(stats[0]!.luck).toBeCloseTo(0.75);
    expect(stats.slice(0, 2).map((s) => s.name)).toEqual(['Aisyah', 'Arjun']);
  });

  it('is empty without matches', () => {
    expect(aggregateStats([])).toEqual([]);
  });
});

describe('sortSummaries', () => {
  it('puts the newest match first', () => {
    const a = summary('old', '2026-10-01T10:00:00.000Z', 1, [['a', 'A', true]]);
    const b = summary('new', '2026-10-05T10:00:00.000Z', 1, [['a', 'A', true]]);
    expect(sortSummaries([a, b]).map((s) => s.matchId)).toEqual(['new', 'old']);
  });
});

describe('isHistoryRecord / historyLog', () => {
  const record = playCompletedMatch({ matchId: 'm1', players: ROSTER.slice(0, 9), seed: 3 });

  it('accepts a real record and rejects damaged ones', () => {
    expect(isHistoryRecord(record)).toBe(true);
    expect(isHistoryRecord(null)).toBe(false);
    expect(isHistoryRecord({ ...record, matchId: 'other' })).toBe(false);
    expect(isHistoryRecord({ ...record, match: { ...record.match, finale: null } })).toBe(false);
    expect(isHistoryRecord({ ...record, match: { ...record.match, presetId: 'nope' } })).toBe(
      false,
    );
    expect(
      isHistoryRecord({
        ...record,
        match: { ...record.match, players: [{ id: 1, name: 'x' }, ...record.match.players] },
      }),
    ).toBe(false);
  });

  it('reads the full log of a current record', () => {
    const lines = historyLog(record).map((l) => l.text);
    expect(lines[0]).toMatch(/^Match started: 9 fighters, 1 winner/);
    expect(lines.at(-1)).toMatch(/^Winner: /);
    expect(lines.some((l) => /^Turn 1: /.test(l))).toBe(true);
  });

  it('still reads records saved under the old 3-turn-streak rules (schema 3)', () => {
    const { shieldSupply: _s, suddenDeathAt: _d, ...oldMatch } = record.match;
    const legacy = {
      ...record,
      match: {
        ...oldMatch,
        schemaVersion: 3,
        noEliminationStreak: 0,
        events: [
          ...record.match.events.slice(0, 1),
          {
            id: 'm1#legacy',
            seq: 999,
            type: 'SUDDEN_DEATH_STARTED',
            fateSlots: Array.from({ length: 20 }, (_, i) => (i < 18 ? 'KO' : 'VS')),
          },
          ...record.match.events.slice(1),
        ],
      },
    } as unknown as CompletedMatchRecord;
    expect(isHistoryRecord(legacy)).toBe(true);
    const lines = historyLog(legacy).map((l) => l.text);
    expect(lines[1]).toBe(
      'SUDDEN DEATH! 3 turns without a knockout. No more Shields. Fate is now KO 90% · VS 10%.',
    );
    expect(summarizeMatch(legacy).winnerIds).toEqual(record.winnerIds);
  });
});

describe('history performance (Phase 7)', () => {
  it('summarises and ranks 300 stored 20-fighter matches well within a second', () => {
    const crowd = Array.from({ length: 20 }, (_, i) => [`p${i}`, `Person ${i}`] as const);
    const records = Array.from({ length: 30 }, (_, i) =>
      playCompletedMatch({ matchId: `perf${i}`, players: crowd, presetId: 'chaotic', seed: i }),
    );
    // 300 records (each match stored 10×, as an office would accumulate over a year).
    const many = Array.from({ length: 10 }, (_, k) =>
      records.map((r) => ({ ...r, matchId: `${r.matchId}-${k}` })),
    ).flat();
    const started = performance.now();
    const summaries = sortSummaries(many.map(summarizeMatch));
    const stats = aggregateStats(summaries);
    const elapsed = performance.now() - started;
    expect(stats).toHaveLength(20);
    // Generous budget so slow CI machines do not flake; typical is a few milliseconds.
    expect(elapsed).toBeLessThan(1000);
  });
});
