import type { FatePresetId } from '../game/config/presets';
import { beginFinale, resolveFinaleRound, startFinaleRound } from '../game/engine/finale';
import { beginTurn, createMatch, resolveTurn } from '../game/engine/match';
import type { MatchState } from '../game/engine/matchTypes';
import { createSeededRng } from '../game/rng/rng';
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
