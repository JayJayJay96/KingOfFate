import { isWinnerCount, MAX_ACTIVE_PLAYERS, MIN_ACTIVE_PLAYERS } from '../config/limits';
import { FATE_PRESETS, FATE_SLOT_COUNT, type FatePresetId } from '../config/presets';
import type { Rng } from '../rng/rng';
import { spreadSlots, toSuddenDeathSlots } from './fateSlots';
import {
  MATCH_SCHEMA_VERSION,
  type CommittedDuel,
  type CommittedTurn,
  type MatchPlayer,
  type MatchState,
  type NewMatchEvent,
  type TurnOutcome,
} from './matchTypes';
import { challengerWins, sampleDuelThrows } from './rps';

/** Consecutive no-elimination ordinary turns that trigger Sudden Death (PROJECT.md §4). */
export const SUDDEN_DEATH_STREAK = 3;

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
      shield: false,
      eliminatedOnTurn: null,
    })),
    fateSlots: spreadSlots(FATE_PRESETS[launch.presetId].normal),
    phase: 'READY',
    completedTurns: 0,
    pendingTurn: null,
    lastTurn: null,
    noEliminationStreak: 0,
    suddenDeath: false,
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
 * Samples EVERYTHING random about the turn and commits it before any animation:
 * the player (uniform over living), the Fate slot (uniform over 20), and for VS the opponent
 * (uniform over other living players) plus every RPS throw until a decisive one.
 * Sampling order is fixed: player, slot, [opponent, throws...].
 */
export function beginTurn(state: MatchState, rng: Rng, turnId: string): MatchState {
  if (state.phase !== 'READY') {
    throw new IllegalTransitionError(`Cannot begin a turn in phase ${state.phase}`);
  }
  const alive = alivePlayers(state);
  if (alive.length <= state.winnerCount + 1) {
    throw new IllegalTransitionError('Ordinary turns are not allowed at W + 1 alive');
  }
  if (state.fateSlots.length !== FATE_SLOT_COUNT) {
    throw new IllegalTransitionError('Fate strip must have exactly 20 slots');
  }

  const player = alive[rng.nextInt(alive.length)]!;
  const fateSlotIndex = rng.nextInt(FATE_SLOT_COUNT);
  const fate = state.fateSlots[fateSlotIndex]!;

  let duel: CommittedDuel | null = null;
  if (fate === 'VS') {
    const others = alive.filter((p) => p.id !== player.id);
    const opponent = others[rng.nextInt(others.length)]!;
    duel = { opponentId: opponent.id, throws: sampleDuelThrows(rng) };
  }

  const turn: CommittedTurn = {
    turnId,
    turnNumber: state.completedTurns + 1,
    playerId: player.id,
    fateSlotIndex,
    fate,
    suddenDeath: state.suddenDeath,
    duel,
  };
  return appendEvent(
    { ...state, phase: 'SPINNING', pendingTurn: turn },
    { type: 'TURN_COMMITTED', turn },
  );
}

/**
 * Applies the committed turn exactly once. Calling it again with the same (or a stale) turnId
 * returns the state unchanged, so recovery/replays can never double-apply anything.
 */
export function resolveTurn(state: MatchState, turnId: string): MatchState {
  const turn = state.pendingTurn;
  if (state.phase !== 'SPINNING' || !turn || turn.turnId !== turnId) return state;

  const byId = new Map(state.players.map((p) => [p.id, p]));
  const update = (id: string, change: Partial<MatchPlayer>) =>
    byId.set(id, { ...byId.get(id)!, ...change });
  const eliminate = (id: string) =>
    update(id, { alive: false, shield: false, eliminatedOnTurn: turn.turnNumber });

  let outcome: TurnOutcome;
  let eliminatedId: string | null = null;
  const selected = byId.get(turn.playerId)!;

  if (turn.fate === 'KO') {
    if (selected.shield) {
      update(selected.id, { shield: false });
      outcome = { fate: 'KO', result: 'BLOCKED' };
    } else {
      eliminate(selected.id);
      eliminatedId = selected.id;
      outcome = { fate: 'KO', result: 'ELIMINATED' };
    }
  } else if (turn.fate === 'SHIELD') {
    if (selected.shield) {
      outcome = { fate: 'SHIELD', result: 'WASTED' };
    } else {
      update(selected.id, { shield: true });
      outcome = { fate: 'SHIELD', result: 'GAINED' };
    }
  } else {
    const duel = turn.duel!;
    const winnerId = challengerWins(duel.throws) ? selected.id : duel.opponentId;
    const loserId = winnerId === selected.id ? duel.opponentId : selected.id;
    const loser = byId.get(loserId)!;
    const winner = byId.get(winnerId)!;

    let loserResult: 'ELIMINATED' | 'BLOCKED';
    if (loser.shield) {
      update(loserId, { shield: false });
      loserResult = 'BLOCKED';
    } else {
      eliminate(loserId);
      eliminatedId = loserId;
      loserResult = 'ELIMINATED';
    }

    let winnerShield: 'GAINED' | 'ALREADY' | 'SUDDEN_DEATH';
    if (state.suddenDeath) winnerShield = 'SUDDEN_DEATH';
    else if (winner.shield) winnerShield = 'ALREADY';
    else {
      update(winnerId, { shield: true });
      winnerShield = 'GAINED';
    }
    outcome = { fate: 'VS', winnerId, loserId, loserResult, winnerShield };
  }

  const streak = eliminatedId ? 0 : state.noEliminationStreak + 1;
  let next: MatchState = {
    ...state,
    players: state.players.map((p) => byId.get(p.id)!),
    phase: 'READY',
    completedTurns: turn.turnNumber,
    pendingTurn: null,
    lastTurn: { turn, outcome, eliminatedId },
    noEliminationStreak: streak,
  };
  next = appendEvent(next, {
    type: 'TURN_RESOLVED',
    turnId: turn.turnId,
    turnNumber: turn.turnNumber,
    playerId: turn.playerId,
    outcome,
    duel: turn.duel,
  });

  const finale = enterFinaleIfReached(next);
  if (finale !== next) return finale;

  if (!next.suddenDeath && streak >= SUDDEN_DEATH_STREAK) {
    const fateSlots = toSuddenDeathSlots(next.fateSlots, FATE_PRESETS[next.presetId].suddenDeath);
    next = appendEvent(
      { ...next, suddenDeath: true, fateSlots },
      {
        type: 'SUDDEN_DEATH_STARTED',
        fateSlots,
      },
    );
  }
  return next;
}

/**
 * Shuffles fighter positions AND Fate slot positions (Fisher–Yates with the injected RNG).
 * Visual fairness only: selection stays uniform over living players and over the 20 slots.
 * A fighter order identical to the current one is redrawn so Shuffle always visibly acts.
 */
export function shufflePositions(state: MatchState, rng: Rng): MatchState {
  if (state.phase !== 'READY') {
    throw new IllegalTransitionError(`Cannot shuffle in phase ${state.phase}`);
  }
  let players = [...state.players];
  for (let attempt = 0; attempt < 10; attempt++) {
    players = fisherYates(state.players, rng);
    if (players.some((p, i) => p.id !== state.players[i]!.id)) break;
  }
  const fateSlots = fisherYates(state.fateSlots, rng);
  return appendEvent(
    { ...state, players, fateSlots },
    { type: 'POSITIONS_SHUFFLED', playerOrder: players.map((p) => p.id), fateSlots },
  );
}

function fisherYates<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** At exactly W + 1 alive: stop ordinary turns, clear all Shields (finale starts equal). */
function enterFinaleIfReached(state: MatchState): MatchState {
  const alive = alivePlayers(state);
  if (state.phase !== 'READY' || alive.length !== state.winnerCount + 1) return state;
  let next = state;
  const shielded = state.players.filter((p) => p.shield).map((p) => p.id);
  if (shielded.length > 0) {
    next = appendEvent(
      { ...next, players: next.players.map((p) => (p.shield ? { ...p, shield: false } : p)) },
      { type: 'SHIELDS_CLEARED', playerIds: shielded },
    );
  }
  return appendEvent(
    { ...next, phase: 'FINALE_GATE', suddenDeath: false },
    { type: 'FINALE_REACHED', finalistIds: alive.map((p) => p.id) },
  );
}

function appendEvent(state: MatchState, event: NewMatchEvent): MatchState {
  const seq = state.events.length + 1;
  return { ...state, events: [...state.events, { ...event, id: `${state.matchId}#${seq}`, seq }] };
}
