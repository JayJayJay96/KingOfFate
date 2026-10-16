import { isFighterLook, type FighterLook } from '../config/looks';
import { isFatePresetId, presetName, type FatePresetId } from '../config/presets';
import { countSlots } from '../engine/fateSlots';
import { describeEvent } from '../engine/describeEvent';
import type { MatchEvent, MatchState } from '../engine/matchTypes';
import type { CompletedMatchRecord } from '../../storage/matchStorage';

/** How one fighter did in one completed match. Selection outcomes only, never "skill". */
export interface FighterResult {
  /** Roster entry ID: identity across matches (owner decision, Phase 6). */
  readonly id: string;
  readonly name: string;
  readonly won: boolean;
  readonly finalist: boolean;
  /** Turn on which the fighter was knocked out before the finale, or null. */
  readonly eliminatedOnTurn: number | null;
  /** Times the fighter cursor landed on them. */
  readonly selected: number;
  readonly shieldsGained: number;
  /** KOs or VS losses absorbed by a Shield. */
  readonly shieldBlocks: number;
  readonly vsFought: number;
  readonly vsWon: number;
  /** Finale rounds in which they scored. */
  readonly finalePoints: number;
  /** Won their finale race without anyone else scoring a point in it (3–0 in a 1v1). */
  readonly flawless: boolean;
  /** Cosmetic look at the time of the match, if the host picked one. */
  readonly look?: FighterLook;
}

/** One decided VS duel. */
export interface DuelResult {
  readonly winnerId: string;
  readonly loserId: string;
}

export interface MatchSummary {
  readonly matchId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
  readonly presetId: FatePresetId;
  readonly winnerCount: number;
  readonly fighterCount: number;
  readonly turns: number;
  readonly finaleRounds: number;
  readonly winnerIds: readonly string[];
  /** Prize / title line, if the host set one. */
  readonly title?: string;
  /** Every VS duel of the match, in order. */
  readonly duels: readonly DuelResult[];
  /** In starting (roster) order. */
  readonly fighters: readonly FighterResult[];
}

export interface FighterStats {
  readonly id: string;
  /** Name in the most recent match they played. */
  readonly name: string;
  readonly played: number;
  readonly wins: number;
  /** wins / played, 0..1. */
  readonly winRate: number;
  /** Sum of W/N over the matches played. */
  readonly expectedWins: number;
  /** wins − expectedWins. Positive = luckier than chance would suggest on average. */
  readonly luck: number;
  readonly finals: number;
  readonly selected: number;
  readonly shieldsGained: number;
  readonly vsFought: number;
  readonly vsWon: number;
  readonly lastPlayedAt: string;
}

/**
 * Lenient check for a stored completion record. Records written by older rule versions are
 * accepted as long as the fields history needs are present.
 */
export function isHistoryRecord(value: unknown): value is CompletedMatchRecord {
  if (!isObj(value)) return false;
  const m = value.match;
  if (
    typeof value.matchId !== 'string' ||
    typeof value.completedAt !== 'string' ||
    !isStringArray(value.winnerIds) ||
    !isObj(m) ||
    m.matchId !== value.matchId ||
    typeof m.startedAt !== 'string' ||
    !isFatePresetId(m.presetId) ||
    !Number.isInteger(m.winnerCount) ||
    !Number.isInteger(m.completedTurns) ||
    !Array.isArray(m.events) ||
    !m.events.every((e) => isObj(e) && typeof e.type === 'string' && typeof e.id === 'string') ||
    !Array.isArray(m.players) ||
    m.players.length < 2 ||
    !m.players.every(
      (p) =>
        isObj(p) &&
        typeof p.id === 'string' &&
        typeof p.name === 'string' &&
        (p.eliminatedOnTurn === null || Number.isInteger(p.eliminatedOnTurn)),
    )
  ) {
    return false;
  }
  const f = m.finale;
  return (
    isObj(f) &&
    isStringArray(f.finalistIds) &&
    isStringArray(f.winnerIds) &&
    Array.isArray(f.rounds) &&
    f.rounds.every((r) => isObj(r) && isStringArray(r.scorerIds))
  );
}

type Tally = {
  selected: number;
  shieldsGained: number;
  shieldBlocks: number;
  vsFought: number;
  vsWon: number;
  finalePoints: number;
};

export function summarizeMatch(record: CompletedMatchRecord): MatchSummary {
  const m = record.match;
  const finale = m.finale!;
  const tally = new Map<string, Tally>(
    m.players.map((p) => [
      p.id,
      { selected: 0, shieldsGained: 0, shieldBlocks: 0, vsFought: 0, vsWon: 0, finalePoints: 0 },
    ]),
  );
  const bump = (id: string, key: keyof Tally) => {
    const t = tally.get(id);
    if (t) t[key]++;
  };

  const duels: DuelResult[] = [];
  for (const event of m.events) {
    if (event.type !== 'TURN_RESOLVED') continue;
    bump(event.playerId, 'selected');
    const o = event.outcome;
    if (o.fate === 'KO' && o.result === 'BLOCKED') bump(event.playerId, 'shieldBlocks');
    if (o.fate === 'SHIELD' && o.result === 'GAINED') bump(event.playerId, 'shieldsGained');
    if (o.fate === 'BOMB') {
      if (o.result === 'BLOCKED') bump(event.playerId, 'shieldBlocks');
      if (o.neighbourResult === 'BLOCKED') bump(o.neighbourId, 'shieldBlocks');
    }
    if (o.fate === 'VS') {
      duels.push({ winnerId: o.winnerId, loserId: o.loserId });
      bump(o.winnerId, 'vsFought');
      bump(o.loserId, 'vsFought');
      bump(o.winnerId, 'vsWon');
      if (o.loserResult === 'BLOCKED') bump(o.loserId, 'shieldBlocks');
      if (o.winnerShield === 'GAINED') bump(o.winnerId, 'shieldsGained');
    }
  }
  for (const round of finale.rounds) {
    for (const id of round.scorerIds) bump(id, 'finalePoints');
  }

  const winners = new Set(record.winnerIds);
  const finalists = new Set(finale.finalistIds);
  return {
    matchId: record.matchId,
    startedAt: m.startedAt,
    completedAt: record.completedAt,
    durationMs: Math.max(0, Date.parse(record.completedAt) - Date.parse(m.startedAt)) || 0,
    presetId: m.presetId,
    winnerCount: m.winnerCount,
    fighterCount: m.players.length,
    turns: m.completedTurns,
    finaleRounds: finale.rounds.length,
    winnerIds: record.winnerIds,
    ...(typeof m.title === 'string' && m.title ? { title: m.title } : {}),
    duels,
    fighters: m.players.map((p) => ({
      id: p.id,
      name: p.name,
      won: winners.has(p.id),
      finalist: finalists.has(p.id),
      eliminatedOnTurn: finalists.has(p.id) ? null : p.eliminatedOnTurn,
      ...tally.get(p.id)!,
      flawless: winners.has(p.id) && isFlawless(finale.rounds, p.id),
      ...(isFighterLook(p.look) ? { look: p.look } : {}),
    })),
  };
}

/**
 * True when the winner qualified in a race (stage) where nobody else scored before they did.
 * Draws do not matter. Automatic (D2) qualification is never flawless.
 */
function isFlawless(
  rounds: readonly {
    stageNumber: number;
    scorerIds: readonly string[];
    qualifiedIds?: readonly string[];
  }[],
  winnerId: string,
): boolean {
  const at = rounds.findIndex((r) => (r.qualifiedIds ?? []).includes(winnerId));
  if (at < 0) return false;
  const stage = rounds[at]!.stageNumber;
  return rounds
    .slice(0, at + 1)
    .filter((r) => r.stageNumber === stage)
    .every((r) => r.scorerIds.every((id) => id === winnerId));
}

/**
 * Names of the most recent match's winners (owner request 2026-10-16: the last champion wears a
 * crown in the next match). Invalid records are skipped.
 */
export function lastChampionNames(records: readonly unknown[]): string[] {
  const valid = records.filter(isHistoryRecord);
  if (valid.length === 0) return [];
  const latest = valid.reduce((a, b) => (b.completedAt > a.completedAt ? b : a));
  return latest.winnerIds.map((id) => latest.match.players.find((p) => p.id === id)?.name ?? '');
}

/** Newest first. */
export function sortSummaries(summaries: readonly MatchSummary[]): MatchSummary[] {
  return [...summaries].sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}

/**
 * Per-person totals across matches, keyed by roster entry ID (owner decision), ranked by luck
 * (wins − expected wins), then wins, then fewer matches played, then name.
 */
export function aggregateStats(summaries: readonly MatchSummary[]): FighterStats[] {
  const byId = new Map<string, Omit<FighterStats, 'winRate' | 'luck'>>();
  // Oldest first so the latest name wins.
  const ordered = [...summaries].sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  for (const s of ordered) {
    const share = s.winnerCount / s.fighterCount;
    for (const f of s.fighters) {
      const prev = byId.get(f.id);
      byId.set(f.id, {
        id: f.id,
        name: f.name,
        played: (prev?.played ?? 0) + 1,
        wins: (prev?.wins ?? 0) + (f.won ? 1 : 0),
        expectedWins: (prev?.expectedWins ?? 0) + share,
        finals: (prev?.finals ?? 0) + (f.finalist ? 1 : 0),
        selected: (prev?.selected ?? 0) + f.selected,
        shieldsGained: (prev?.shieldsGained ?? 0) + f.shieldsGained,
        vsFought: (prev?.vsFought ?? 0) + f.vsFought,
        vsWon: (prev?.vsWon ?? 0) + f.vsWon,
        lastPlayedAt: s.completedAt,
      });
    }
  }
  return [...byId.values()]
    .map((s) => ({ ...s, winRate: s.wins / s.played, luck: s.wins - s.expectedWins }))
    .sort(
      (a, b) =>
        b.luck - a.luck || b.wins - a.wins || a.played - b.played || a.name.localeCompare(b.name),
    );
}

/** Readable log of a stored match, tolerant of records written by older rule versions. */
export function historyLog(record: CompletedMatchRecord): { id: string; text: string }[] {
  const m = record.match;
  return m.events.flatMap((event) => {
    const text = describeStored(event, m);
    return text ? [{ id: event.id, text }] : [];
  });
}

function describeStored(event: MatchEvent, match: MatchState): string | null {
  // Before match schema 4 Sudden Death came from a 3-turn streak and had no alive count.
  if (event.type === 'SUDDEN_DEATH_STARTED' && !Array.isArray(event.shatteredIds)) {
    const c = countSlots(event.fateSlots);
    return `SUDDEN DEATH! 3 turns without a knockout. No more Shields. Fate is now KO ${c.KO * 5}% · VS ${c.VS * 5}%.`;
  }
  try {
    return describeEvent(event, match);
  } catch {
    return null;
  }
}

export function presetLabel(id: FatePresetId): string {
  return presetName(id);
}

function isObj(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}
