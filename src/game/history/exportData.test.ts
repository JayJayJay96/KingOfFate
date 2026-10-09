import { describe, expect, it } from 'vitest';
import { playCompletedMatch } from '../../test/historyFixtures';
import { csvCell, fileStamp, historyToJson, matchesToCsv, statsToCsv } from './exportData';
import { aggregateStats, isHistoryRecord, summarizeMatch } from './history';

const players = [
  ['a', 'Aisyah'],
  ['b', 'Wei Jie, "WJ"'],
  ['c', '=HYPERLINK("x")'],
  ['d', 'Nguyễn Văn An'],
  ['e', 'Hafiz'],
] as const;

const r1 = playCompletedMatch({
  matchId: 'm1',
  players,
  seed: 1,
  completedAt: '2026-10-09T07:05:00.000Z',
});
const r2 = playCompletedMatch({
  matchId: 'm2',
  players,
  winnerCount: 2,
  seed: 2,
  startedAt: '2026-10-09T08:00:00.000Z',
  completedAt: '2026-10-09T08:03:30.000Z',
});

/** Minimal RFC 4180 parser for round-trip checks. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const body = text.replace(/^﻿/, '');
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]!;
    if (quoted) {
      if (ch === '"' && body[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\r' && body[i + 1] === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i++;
    } else cell += ch;
  }
  return rows;
}

describe('historyToJson', () => {
  it('is a lossless, versioned backup of every record (oldest first)', () => {
    const json = JSON.parse(historyToJson([r2, r1], '2026-10-09T09:00:00.000Z'));
    expect(json.app).toBe('kof-king-of-fate');
    expect(json.exportVersion).toBe(1);
    expect(json.exportedAt).toBe('2026-10-09T09:00:00.000Z');
    expect(json.matches).toEqual([r1, r2]);
    expect(json.matches.every(isHistoryRecord)).toBe(true);
  });
});

describe('matchesToCsv', () => {
  it('has one row per match that matches the summaries', () => {
    const rows = parseCsv(matchesToCsv([summarizeMatch(r2), summarizeMatch(r1)]));
    expect(rows[0]).toEqual([
      'match_id',
      'started_at',
      'completed_at',
      'duration_seconds',
      'preset',
      'fighters',
      'winner_slots',
      'turns',
      'finale_rounds',
      'winners',
      'finalists',
    ]);
    expect(rows).toHaveLength(3);
    const [, first, second] = rows;
    expect(first!.slice(0, 7)).toEqual([
      'm1',
      '2026-10-09T07:00:00.000Z',
      '2026-10-09T07:05:00.000Z',
      '300',
      'Normal',
      '5',
      '1',
    ]);
    expect(second![0]).toBe('m2');
    expect(second![3]).toBe('210');
    expect(second![9]!.split('; ')).toHaveLength(2);
    expect(Number(first![7])).toBe(r1.match.completedTurns);
  });

  it('starts with a UTF-8 BOM and keeps Vietnamese/Malay names intact', () => {
    const csv = matchesToCsv([summarizeMatch(r1)]);
    expect(csv.startsWith('﻿')).toBe(true);
    const finalists = parseCsv(csv)[1]![10]!;
    const names = summarizeMatch(r1)
      .fighters.filter((f) => f.finalist)
      .map((f) => f.name);
    expect(finalists).toBe(names.join('; '));
  });
});

describe('statsToCsv', () => {
  it('exports the ranked luck board', () => {
    const stats = aggregateStats([summarizeMatch(r1), summarizeMatch(r2)]);
    const rows = parseCsv(statsToCsv(stats));
    expect(rows[0]!.slice(0, 8)).toEqual([
      'rank',
      'fighter_id',
      'name',
      'played',
      'wins',
      'win_rate',
      'expected_wins',
      'luck',
    ]);
    expect(rows).toHaveLength(1 + 5);
    rows.slice(1).forEach((row, i) => {
      const s = stats[i]!;
      expect(row[0]).toBe(String(i + 1));
      expect(row[1]).toBe(s.id);
      expect(Number(row[3])).toBe(2);
      expect(Number(row[4])).toBe(s.wins);
      expect(Number(row[6])).toBeCloseTo(1 / 5 + 2 / 5, 3);
      expect(Number(row[7])).toBeCloseTo(s.luck, 3);
    });
    const totalWins = rows.slice(1).reduce((a, r) => a + Number(r[4]), 0);
    expect(totalWins).toBe(3);
    // The formula-like name is neutralised.
    expect(rows.find((r) => r[1] === 'c')![2]).toBe('\'=HYPERLINK("x")');
  });
});

describe('csvCell', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('Wei Jie, "WJ"')).toBe('"Wei Jie, ""WJ"""');
    expect(csvCell('a\nb')).toBe('"a\nb"');
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell(42)).toBe('42');
  });

  it('neutralises spreadsheet formulas in names', () => {
    expect(csvCell('=1+1')).toBe("'=1+1");
    expect(csvCell('+60123')).toBe("'+60123");
    expect(csvCell('-x')).toBe("'-x");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
  });
});

describe('fileStamp', () => {
  it('formats a local date for file names', () => {
    expect(fileStamp(new Date(2026, 9, 9, 18, 5))).toBe('2026-10-09_1805');
  });
});
