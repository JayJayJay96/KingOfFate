import type { CompletedMatchRecord } from '../../storage/matchStorage';
import { presetLabel, type FighterStats, type MatchSummary } from './history';

export const EXPORT_VERSION = 1;

/** Full, lossless backup: every stored record exactly as saved (states, events, throws). */
export function historyToJson(
  records: readonly CompletedMatchRecord[],
  exportedAt: string,
): string {
  const matches = [...records].sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  return JSON.stringify(
    { app: 'kof-king-of-fate', exportVersion: EXPORT_VERSION, exportedAt, matches },
    null,
    2,
  );
}

/** One row per match, oldest first. */
export function matchesToCsv(summaries: readonly MatchSummary[]): string {
  const nameOf = (s: MatchSummary, id: string) => s.fighters.find((f) => f.id === id)?.name ?? '';
  const header = [
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
    'title',
  ];
  const rows = [...summaries]
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt))
    .map((s) => [
      s.matchId,
      s.startedAt,
      s.completedAt,
      Math.round(s.durationMs / 1000),
      presetLabel(s.presetId),
      s.fighterCount,
      s.winnerCount,
      s.turns,
      s.finaleRounds,
      s.winnerIds.map((id) => nameOf(s, id)).join('; '),
      s.fighters
        .filter((f) => f.finalist)
        .map((f) => f.name)
        .join('; '),
      s.title ?? '',
    ]);
  return toCsv([header, ...rows]);
}

/** Leaderboard rows in ranked order. */
export function statsToCsv(stats: readonly FighterStats[]): string {
  const header = [
    'rank',
    'fighter_id',
    'name',
    'played',
    'wins',
    'win_rate',
    'expected_wins',
    'luck',
    'finals',
    'times_selected',
    'shields_gained',
    'vs_fought',
    'vs_won',
    'last_played_at',
  ];
  const rows = stats.map((s, i) => [
    i + 1,
    s.id,
    s.name,
    s.played,
    s.wins,
    round3(s.winRate),
    round3(s.expectedWins),
    round3(s.luck),
    s.finals,
    s.selected,
    s.shieldsGained,
    s.vsFought,
    s.vsWon,
    s.lastPlayedAt,
  ]);
  return toCsv([header, ...rows]);
}

/** Numbers stay numeric (a negative value must not hit the formula guard below). */
function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** RFC 4180 with CRLF; a UTF-8 BOM so Excel shows Malay/Chinese/Vietnamese text correctly. */
function toCsv(rows: readonly (readonly (string | number)[])[]): string {
  return '﻿' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/**
 * Quotes when needed, and neutralises spreadsheet formulas: a text cell starting with
 * = + - @ (or tab/CR) gets a leading apostrophe so a name can never run as a formula.
 */
export function csvCell(value: string | number): string {
  if (typeof value === 'number') return String(value);
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** File-name friendly local date stamp, e.g. 2026-10-09_1830. */
export function fileStamp(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}_${p(date.getHours())}${p(date.getMinutes())}`;
}
