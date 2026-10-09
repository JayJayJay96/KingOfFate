import { isWinnerCount, MAX_ACTIVE_PLAYERS, MIN_ACTIVE_PLAYERS } from '../config/limits';
import type { FatePresetId } from '../config/presets';
import type { Rng } from '../rng/rng';
import {
  MATCH_SCHEMA_VERSION,
  type CommittedTurn,
  type MatchPlayer,
  type MatchState,
  type NewMatchEvent,
} from './matchTypes';

export interface MatchLaunch {
  readonly players: readonly { readonly id: string; readonly name: string }[];
  readonly winnerCount: number;
  readonly presetId: FatePresetId;
}

export class IllegalTransitionError extends Error {
  override name = 'IllegalTransitionError';
}

export function alivePlayers(state: MatchState): readonly MatchPlayer[] {
  return state.players.filter((p) => p.alive);
}

export function createMatch(
  launch: MatchLaunch,
  ids: { readonly matchId: string; readonly startedAt: string },
): MatchState {
  const n = launch.players.length;
  const w = launch.winnerCount;
  if (n < MIN_ACTIVE_PLAYERS || n > MAX_ACTIVE_PLAYERS) {
    throw new IllegalTransitionError(
      `Player count ${n} outside ${MIN_ACTIVE_PLAYERS}–${MAX_ACTIVE_PLAYERS}`,
    );
  }
  if (!isWinnerCount(w)) throw new IllegalTransitionError(`Invalid winner count ${w}`);
  if (n < w + 1)
    throw new IllegalTransitionError(`Need at least ${w + 1} players for ${w} winners`);
  if (new Set(launch.players.map((p) => p.id)).size !== n) {
    throw new IllegalTransitionError('Player IDs must be unique');
  }

  let state: MatchState = {
    schemaVersion: MATCH_SCHEMA_VERSION,
    matchId: ids.matchId,
    startedAt: ids.startedAt,
    presetId: launch.presetId,
    winnerCount: w,
    players: launch.players.map((p) => ({
      id: p.id,
      name: p.name,
      alive: true,
      eliminatedOnTurn: null,
    })),
    phase: 'READY',
    completedTurns: 0,
    pendingTurn: null,
    lastTurn: null,
    noEliminationStreak: 0,
    events: [],
  };
  state = appendEvent(state, {
    type: 'MATCH_STARTED',
    playerIds: state.players.map((p) => p.id),
    winnerCount: w,
    presetId: launch.presetId,
  });
  return enterFinaleIfReached(state);
}

/**
 * Samples the turn's player uniformly among living players (independent of earlier turns) and
 * commits it. The caller persists the result BEFORE starting any animation.
 */
export function beginTurn(state: MatchState, rng: Rng, turnId: string): MatchState {
  if (state.phase !== 'READY') {
    throw new IllegalTransitionError(`Cannot begin a turn in phase ${state.phase}`);
  }
  const alive = alivePlayers(state);
  if (alive.length <= state.winnerCount + 1) {
    throw new IllegalTransitionError('Ordinary turns are not allowed at W + 1 alive');
  }
  const player = alive[rng.nextInt(alive.length)]!;
  const turn: CommittedTurn = {
    turnId,
    turnNumber: state.completedTurns + 1,
    playerId: player.id,
    fate: 'KO',
  };
  return appendEvent(
    { ...state, phase: 'SPINNING', pendingTurn: turn },
    { type: 'TURN_COMMITTED', turn },
  );
}

/**
 * Applies the committed turn exactly once. Calling it again with the same (or a stale) turnId
 * returns the state unchanged, so recovery/replays can never double-apply an elimination.
 */
export function resolveTurn(state: MatchState, turnId: string): MatchState {
  const turn = state.pendingTurn;
  if (state.phase !== 'SPINNING' || !turn || turn.turnId !== turnId) return state;

  // Phase 2: KO with no Shields in play always eliminates.
  let next: MatchState = {
    ...state,
    players: state.players.map((p) =>
      p.id === turn.playerId ? { ...p, alive: false, eliminatedOnTurn: turn.turnNumber } : p,
    ),
    phase: 'READY',
    completedTurns: turn.turnNumber,
    pendingTurn: null,
    lastTurn: { turn, eliminated: true },
    noEliminationStreak: 0,
  };
  next = appendEvent(next, {
    type: 'PLAYER_ELIMINATED',
    turnId: turn.turnId,
    turnNumber: turn.turnNumber,
    playerId: turn.playerId,
  });
  return enterFinaleIfReached(next);
}

function enterFinaleIfReached(state: MatchState): MatchState {
  const alive = alivePlayers(state);
  if (state.phase !== 'READY' || alive.length !== state.winnerCount + 1) return state;
  return appendEvent(
    { ...state, phase: 'FINALE_GATE' },
    { type: 'FINALE_REACHED', finalistIds: alive.map((p) => p.id) },
  );
}

function appendEvent(state: MatchState, event: NewMatchEvent): MatchState {
  const seq = state.events.length + 1;
  return { ...state, events: [...state.events, { ...event, id: `${state.matchId}#${seq}`, seq }] };
}
