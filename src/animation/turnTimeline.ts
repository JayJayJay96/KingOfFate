import { FATE_SLOT_COUNT } from '../game/config/presets';
import type { CommittedTurn } from '../game/engine/matchTypes';
import { buildSpinPlan, spinStyleFor, type SpinStep } from './spinPlan';

/** "VS!" is shown on its own before the opponent cursor starts. */
export const VS_ANNOUNCE_MS = 1000;
/** The Fate cursor starts this far into the fighter cursor's travel (owner: overlap to save time). */
export const FATE_START_FRACTION = 0.5;
/** …but the Fate cursor always stops at least this long after the fighter is revealed. */
export const FATE_LANDS_AFTER_FIGHTER_MS = 400;
/** Duel presentation: intro, one beat per throw (draws rethrow), then the result. */
export const DUEL_INTRO_MS = 700;
export const DUEL_THROW_MS = 900;
export const DUEL_RESULT_HOLD_MS = 1300;

/**
 * Presentation timeline for one committed turn, revealed step by step (owner decisions):
 *   1. fighter cursor spins and lands;
 *   2. the Fate cursor starts midway through the fighter spin but always stops AFTER the fighter
 *      is revealed, so the chosen fighter is known before their Fate;
 *   3. VS only: "VS!" announce → opponent cursor over the other fighters → throws → result.
 * All times are absolute ms from the turn start. Deterministic from the saved turn, so a refresh
 * replays the identical show. It never changes the outcome (everything is already committed).
 */
export interface TurnTimeline {
  readonly playerSteps: readonly SpinStep[];
  /** Fate cursor steps; ids are slot indices as strings ("0"–"19"). */
  readonly fateSteps: readonly SpinStep[];
  /** When the chosen fighter is revealed (fighter cursor landed and dwelled). */
  readonly playerRevealMs: number;
  readonly fateStartMs: number;
  /** When the Fate has landed and dwelled. */
  readonly fateDoneMs: number;
  /** VS only (null otherwise). */
  readonly vsAnnounceMs: number | null;
  readonly opponentSteps: readonly SpinStep[];
  readonly opponentStartMs: number | null;
  readonly duelStartMs: number | null;
  readonly duelThrowsAtMs: readonly number[];
  /** When the turn's result is applied. */
  readonly completeMs: number;
}

export const FATE_SLOT_IDS: readonly string[] = Array.from({ length: FATE_SLOT_COUNT }, (_, i) =>
  String(i),
);

/** Next Fate cursor start: the slot after the previous turn's slot, or slot 0. */
export function fateStartIndex(previousSlotIndex: number | null): number {
  return previousSlotIndex === null ? 0 : (previousSlotIndex + 1) % FATE_SLOT_COUNT;
}

const shift = (steps: readonly SpinStep[], by: number) =>
  steps.map((s) => ({ id: s.id, atMs: s.atMs + by }));

export function buildTurnTimeline(
  turn: CommittedTurn,
  aliveIdsInGridOrder: readonly string[],
  playerStartId: string,
  fateStart: number,
): TurnTimeline {
  const player = buildSpinPlan(
    aliveIdsInGridOrder,
    playerStartId,
    turn.playerId,
    spinStyleFor(turn.turnId),
  );
  const fate = buildSpinPlan(
    FATE_SLOT_IDS,
    String(fateStart),
    String(turn.fateSlotIndex),
    spinStyleFor(`${turn.turnId}:fate`),
  );
  const fateStartMs = Math.max(
    Math.round(player.landMs * FATE_START_FRACTION),
    player.revealMs + FATE_LANDS_AFTER_FIGHTER_MS - fate.landMs,
  );
  const fateDoneMs = fateStartMs + fate.revealMs;
  const base = {
    playerSteps: player.steps,
    fateSteps: shift(fate.steps, fateStartMs),
    playerRevealMs: player.revealMs,
    fateStartMs,
    fateDoneMs,
  };

  if (!turn.duel) {
    return {
      ...base,
      vsAnnounceMs: null,
      opponentSteps: [],
      opponentStartMs: null,
      duelStartMs: null,
      duelThrowsAtMs: [],
      completeMs: fateDoneMs,
    };
  }

  // The opponent cursor walks the OTHER living fighters, starting just after the challenger.
  // (Ordinary turns always have at least 3 alive, so that neighbour is never the challenger.)
  const n = aliveIdsInGridOrder.length;
  const others = aliveIdsInGridOrder.filter((id) => id !== turn.playerId);
  const opponentStartId =
    aliveIdsInGridOrder[(aliveIdsInGridOrder.indexOf(turn.playerId) + 1) % n]!;
  const opponentStartMs = fateDoneMs + VS_ANNOUNCE_MS;
  const opponent = buildSpinPlan(
    others,
    opponentStartId,
    turn.duel.opponentId,
    spinStyleFor(`${turn.turnId}:opponent`),
  );
  const duelStartMs = opponentStartMs + opponent.revealMs;
  const duelThrowsAtMs = turn.duel.throws.map(
    (_, i) => duelStartMs + DUEL_INTRO_MS + i * DUEL_THROW_MS,
  );
  return {
    ...base,
    vsAnnounceMs: fateDoneMs,
    opponentSteps: shift(opponent.steps, opponentStartMs),
    opponentStartMs,
    duelStartMs,
    duelThrowsAtMs,
    completeMs: duelThrowsAtMs.at(-1)! + DUEL_RESULT_HOLD_MS,
  };
}
