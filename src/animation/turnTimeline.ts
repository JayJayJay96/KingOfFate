import { FATE_SLOT_COUNT } from '../game/config/presets';
import type { CommittedTurn } from '../game/engine/matchTypes';
import { buildSpinPlan, spinStyleFor, type SpinStep } from './spinPlan';

/** VS presentation: "X VS Y" intro, one beat per throw (draws rethrow), then the result. */
export const DUEL_INTRO_MS = 700;
export const DUEL_THROW_MS = 900;
export const DUEL_RESULT_HOLD_MS = 1300;

export interface TurnTimeline {
  readonly playerSteps: readonly SpinStep[];
  /** Fate cursor steps; ids are slot indices as strings ("0"–"19"). */
  readonly fateSteps: readonly SpinStep[];
  /** Both cursors have landed and dwelled. */
  readonly cursorsDoneMs: number;
  /** Times at which each committed throw is shown (VS only). */
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

/**
 * Presentation timeline for a committed turn. Player and Fate cursors start together, each with
 * its own seeded style; the result waits until both have landed (each ≤ 10 s). Deterministic
 * from the saved turn, so a refresh replays the same show. Never changes the outcome.
 */
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
  const cursorsDoneMs = Math.max(player.revealMs, fate.revealMs);

  const throws = turn.duel?.throws ?? [];
  const duelThrowsAtMs = throws.map((_, i) => cursorsDoneMs + DUEL_INTRO_MS + i * DUEL_THROW_MS);
  const completeMs =
    duelThrowsAtMs.length > 0 ? duelThrowsAtMs.at(-1)! + DUEL_RESULT_HOLD_MS : cursorsDoneMs;

  return {
    playerSteps: player.steps,
    fateSteps: fate.steps,
    cursorsDoneMs,
    duelThrowsAtMs,
    completeMs,
  };
}
