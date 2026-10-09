import type { FatePresetId } from '../game/config/presets';
import { beginFinale, resolveFinaleRound, startFinaleRound } from '../game/engine/finale';
import { beginTurn, createMatch, resolveTurn } from '../game/engine/match';
import type { MatchState } from '../game/engine/matchTypes';
import { createSeededRng } from '../game/rng/rng';
import type { FighterResult, MatchSummary } from '../game/history/history';
import { toCompletedRecord, type CompletedMatchRecord } from '../storage/matchStorage';

export interface FixtureOptions {
  readonly matchId: string;
  /** Roster entries: [id, name]. */
  readonly players: readonly (readonly [string, string])[];
  readonly winnerCount?: number;
  readonly presetId?: FatePresetId;
  readonly seed?: number;
  readonly startedAt?: string;
  readonly completedAt?: string;
}

/** Plays a whole match through the real engine with a seeded RNG and returns its record. */
export function playCompletedMatch(o: FixtureOptions): CompletedMatchRecord {
  return toCompletedRecord(playToVictory(o));
}

export function playToVictory(o: FixtureOptions): MatchState {
  const rng = createSeededRng(o.seed ?? 1);
  let s = createMatch(
    {
      players: o.players.map(([id, name]) => ({ id, name })),
      winnerCount: o.winnerCount ?? 1,
      presetId: o.presetId ?? 'normal',
    },
    { matchId: o.matchId, startedAt: o.startedAt ?? '2026-10-09T07:00:00.000Z' },
  );
  let n = 0;
  while (s.phase === 'READY') {
    const id = `${o.matchId}-t${++n}`;
    s = resolveTurn(beginTurn(s, rng, id), id);
    if (n > 5000) throw new Error('Match did not finish');
  }
  s = beginFinale(s);
  n = 0;
  while (s.phase === 'FINALE') {
    const id = `${o.matchId}-r${++n}`;
    s = resolveFinaleRound(
      startFinaleRound(s, rng, id),
      id,
      o.completedAt ?? '2026-10-09T07:05:00.000Z',
    );
    if (n > 5000) throw new Error('Finale did not finish');
  }
  return s;
}

/**
 * Hand-made summary for history maths. Each fighter: [id, name, won, overrides]. Winners are
 * finalists; everyone else was knocked out on turn 1 unless overridden.
 */
export function fakeSummary(
  matchId: string,
  completedAt: string,
  winnerCount: number,
  fighters: readonly (readonly [
    id: string,
    name: string,
    won: boolean,
    extra?: Partial<FighterResult>,
  ])[],
  duels: MatchSummary['duels'] = [],
): MatchSummary {
  return {
    matchId,
    startedAt: completedAt,
    completedAt,
    durationMs: 0,
    presetId: 'normal',
    winnerCount,
    fighterCount: fighters.length,
    turns: 0,
    finaleRounds: 0,
    winnerIds: fighters.filter((f) => f[2]).map((f) => f[0]),
    duels,
    fighters: fighters.map(([id, name, won, extra]) => ({
      id,
      name,
      won,
      finalist: won,
      eliminatedOnTurn: won ? null : 1,
      selected: 1,
      shieldsGained: 0,
      shieldBlocks: 0,
      vsFought: 0,
      vsWon: 0,
      finalePoints: 0,
      flawless: false,
      ...extra,
    })),
  };
}
