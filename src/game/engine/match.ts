import { cleanLook, isFighterLook, type FighterLook } from '../config/looks';
import { isWinnerCount, MAX_ACTIVE_PLAYERS, MIN_ACTIVE_PLAYERS } from '../config/limits';
import {
  CUSTOM_PRESET_ID,
  FATE_SLOT_COUNT,
  isValidCustomOdds,
  oddsFor,
  type FateOdds,
  type FatePresetId,
} from '../config/presets';
import type { Rng } from '../rng/rng';
import { IllegalTransitionError } from './errors';
import { spreadSlots, toSuddenDeathSlots } from './fateSlots';
import { initialFinale } from './finale';
import { appendEvent } from './matchEvents';
import {
  MATCH_SCHEMA_VERSION,
  type CommittedBomb,
  type CommittedDuel,
  type CommittedTurn,
  type MatchPlayer,
  type MatchState,
  type ResolvedTurn,
  type TurnOutcome,
} from './matchTypes';
import { challengerWins, sampleDuelThrows } from './rps';

/** Owner decision 2026-10-09: 1 Shield per 5 starting fighters (rounded up) for the whole match. */
export function shieldSupplyFor(fighters: number): number {
  return Math.ceil(fighters / 5);
}

/** Owner decision 2026-10-09: Sudden Death when one-third of the starting fighters remain. */
export function suddenDeathAtFor(fighters: number): number {
  return Math.round(fighters / 3);
}

export interface MatchLaunch {
  readonly players: readonly {
    readonly id: string;
    readonly name: string;
    readonly look?: FighterLook;
  }[];
  readonly winnerCount: number;
  readonly presetId: FatePresetId;
  /** Required for the Custom preset (owner decision 2026-10-16). */
  readonly customOdds?: FateOdds;
  /** Prize / title line (owner request 2026-10-16); cosmetic. */
  readonly title?: string;
  /** Players who won the previous match: they wear a crown (cosmetic only). */
  readonly championIds?: readonly string[];
}

export { IllegalTransitionError };

function championIdsFor(launch: MatchLaunch): string[] {
  const ids = new Set(launch.players.map((p) => p.id));
  return [...new Set(launch.championIds ?? [])].filter((id) => ids.has(id));
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
  const custom = launch.presetId === CUSTOM_PRESET_ID;
  if (custom && !isValidCustomOdds(launch.customOdds)) {
    throw new IllegalTransitionError('Custom odds must fill the 20 slots within the rules');
  }
  if (new Set(launch.players.map((p) => p.id)).size !== n) {
    throw new IllegalTransitionError('Player IDs must be unique');
  }

  let state: MatchState = {
    schemaVersion: MATCH_SCHEMA_VERSION,
    matchId: ids.matchId,
    startedAt: ids.startedAt,
    presetId: launch.presetId,
    ...(custom ? { customOdds: launch.customOdds! } : {}),
    winnerCount: w,
    ...(launch.title?.trim() ? { title: launch.title.trim() } : {}),
    ...(championIdsFor(launch).length > 0 ? { championIds: championIdsFor(launch) } : {}),
    players: launch.players.map((p) => ({
      id: p.id,
      name: p.name,
      alive: true,
      shield: false,
      eliminatedOnTurn: null,
      ...(p.look && isFighterLook(p.look) ? { look: cleanLook(p.look) } : {}),
    })),
    fateSlots: spreadSlots(oddsFor(launch.presetId, launch.customOdds).normal),
    phase: 'READY',
    completedTurns: 0,
    pendingTurn: null,
    lastTurn: null,
    shieldSupply: shieldSupplyFor(n),
    suddenDeathAt: suddenDeathAtFor(n),
    suddenDeath: false,
    finale: null,
    completedAt: null,
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
 * Sampling order is fixed: player, slot, [opponent, throws...] or [Bomb side].
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
  let bomb: CommittedBomb | null = null;
  if (fate === 'BOMB') {
    const [left, right] = livingNeighbours(state.players, player.id);
    bomb = { neighbourId: rng.nextInt(2) === 0 ? left : right };
  }

  const turn: CommittedTurn = {
    turnId,
    turnNumber: state.completedTurns + 1,
    playerId: player.id,
    fateSlotIndex,
    fate,
    suddenDeath: state.suddenDeath,
    duel,
    ...(bomb ? { bomb } : {}),
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
  let shieldSupply = state.shieldSupply;
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
  } else if (turn.fate === 'BOMB') {
    // The picked fighter takes a KO; the blast also hits the committed neighbour. A Shield
    // absorbs it for either. If both would fall and that left fewer than W + 1, the neighbour
    // is spared (owner decision 2026-10-16).
    const neighbourId = turn.bomb!.neighbourId;
    const neighbour = byId.get(neighbourId)!;
    const aliveBefore = state.players.filter((p) => p.alive).length;
    let result: 'ELIMINATED' | 'BLOCKED';
    if (selected.shield) {
      update(selected.id, { shield: false });
      result = 'BLOCKED';
    } else {
      eliminate(selected.id);
      eliminatedId = selected.id;
      result = 'ELIMINATED';
    }
    let neighbourResult: 'ELIMINATED' | 'BLOCKED' | 'SPARED';
    if (neighbour.shield) {
      update(neighbourId, { shield: false });
      neighbourResult = 'BLOCKED';
    } else if (result === 'ELIMINATED' && aliveBefore - 2 < state.winnerCount + 1) {
      neighbourResult = 'SPARED';
    } else {
      eliminate(neighbourId);
      eliminatedId ??= neighbourId;
      neighbourResult = 'ELIMINATED';
    }
    outcome = { fate: 'BOMB', result, neighbourId, neighbourResult };
  } else if (turn.fate === 'SHIELD') {
    // A Shield slot only exists while the supply lasts (slots flip to KO when it runs out).
    if (selected.shield || shieldSupply <= 0) {
      outcome = { fate: 'SHIELD', result: 'WASTED' };
    } else {
      update(selected.id, { shield: true });
      shieldSupply--;
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

    let winnerShield: 'GAINED' | 'ALREADY' | 'SUDDEN_DEATH' | 'NO_SUPPLY';
    if (state.suddenDeath) winnerShield = 'SUDDEN_DEATH';
    else if (winner.shield) winnerShield = 'ALREADY';
    else if (shieldSupply <= 0) winnerShield = 'NO_SUPPLY';
    else {
      update(winnerId, { shield: true });
      shieldSupply--;
      winnerShield = 'GAINED';
    }
    outcome = { fate: 'VS', winnerId, loserId, loserResult, winnerShield };
  }

  let next: MatchState = {
    ...state,
    players: state.players.map((p) => byId.get(p.id)!),
    phase: 'READY',
    completedTurns: turn.turnNumber,
    pendingTurn: null,
    lastTurn: { turn, outcome, eliminatedId },
    shieldSupply,
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

  // Last Shield earned: Shield slots turn into KO right away (visible odds stay truthful).
  if (shieldSupply === 0 && state.shieldSupply > 0 && next.fateSlots.includes('SHIELD')) {
    const fateSlots = next.fateSlots.map((k) => (k === 'SHIELD' ? 'KO' : k));
    next = appendEvent({ ...next, fateSlots }, { type: 'SHIELD_SUPPLY_EXHAUSTED', fateSlots });
  }

  // Sudden Death when only one-third of the starting fighters remain: every Shield shatters,
  // none can be earned, and the strip switches to the approved D1 odds.
  const aliveCount = alivePlayers(next).length;
  if (!next.suddenDeath && aliveCount <= next.suddenDeathAt) {
    const shatteredIds = next.players.filter((p) => p.shield).map((p) => p.id);
    const fateSlots = toSuddenDeathSlots(
      next.fateSlots,
      oddsFor(next.presetId, next.customOdds).suddenDeath,
    );
    next = appendEvent(
      {
        ...next,
        suddenDeath: true,
        shieldSupply: 0,
        fateSlots,
        players: next.players.map((p) => (p.shield ? { ...p, shield: false } : p)),
      },
      { type: 'SUDDEN_DEATH_STARTED', fateSlots, aliveCount, shatteredIds },
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

/** Everyone eliminated by a resolved turn (a Bomb can take out two). */
export function eliminatedThisTurn(last: ResolvedTurn): string[] {
  const o = last.outcome;
  if (o.fate === 'BOMB') {
    return [
      ...(o.result === 'ELIMINATED' ? [last.turn.playerId] : []),
      ...(o.neighbourResult === 'ELIMINATED' ? [o.neighbourId] : []),
    ];
  }
  return last.eliminatedId ? [last.eliminatedId] : [];
}

/** Nearest living fighters to the left and right of `id` in grid order (wrapping). */
export function livingNeighbours(
  players: readonly MatchPlayer[],
  id: string,
): [left: string, right: string] {
  const n = players.length;
  const at = players.findIndex((p) => p.id === id);
  const find = (step: number) => {
    for (let k = 1; k < n; k++) {
      const p = players[(at + step * k + n * n) % n]!;
      if (p.alive && p.id !== id) return p.id;
    }
    throw new IllegalTransitionError('A Bomb needs another living fighter');
  };
  return [find(-1), find(1)];
}

function fisherYates<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** At exactly W + 1 alive: stop ordinary turns, clear all Shields, set up the RPS finale. */
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
    {
      ...next,
      phase: 'FINALE',
      suddenDeath: false,
      finale: initialFinale(alive.map((p) => p.id)),
    },
    { type: 'FINALE_REACHED', finalistIds: alive.map((p) => p.id) },
  );
}
