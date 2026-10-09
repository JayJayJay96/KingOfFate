import { useEffect, useRef, useState } from 'react';
import { buildTurnTimeline } from '../animation/turnTimeline';
import type { CommittedTurn } from '../game/engine/matchTypes';

export interface TurnAnimationState {
  /** Player cursor position, or null when idle. */
  readonly playerCursorId: string | null;
  /** Fate cursor slot index, or null when idle. */
  readonly fateCursorIndex: number | null;
  /** VS only: -1 = intro ("X VS Y"), 0..n-1 = that throw is showing; null = no duel on screen. */
  readonly duelThrowIndex: number | null;
}

const IDLE: TurnAnimationState = {
  playerCursorId: null,
  fateCursorIndex: null,
  duelThrowIndex: null,
};

/**
 * Plays a committed turn: both cursors, then the VS duel, then `onComplete(turnId)`.
 * Pure presentation; `timeScale` < 1 speeds everything up proportionally (tests only).
 */
export function useTurnAnimation(
  pendingTurn: CommittedTurn | null,
  aliveIdsInGridOrder: readonly string[],
  playerStartId: string | null,
  fateStart: number,
  timeScale: number,
  onComplete: (turnId: string) => void,
): TurnAnimationState {
  const [frame, setFrame] = useState<{ turnId: string; state: TurnAnimationState } | null>(null);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  const orderKey = aliveIdsInGridOrder.join('\u0000');

  useEffect(() => {
    if (!pendingTurn || !playerStartId) return;
    const turnId = pendingTurn.turnId;
    const timeline = buildTurnTimeline(
      pendingTurn,
      orderKey.split('\u0000'),
      playerStartId,
      fateStart,
    );

    let current: TurnAnimationState = IDLE;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, change: Partial<TurnAnimationState>) =>
      timers.push(
        setTimeout(() => {
          current = { ...current, ...change };
          setFrame({ turnId, state: current });
        }, ms * timeScale),
      );

    for (const step of timeline.playerSteps) at(step.atMs, { playerCursorId: step.id });
    for (const step of timeline.fateSteps) at(step.atMs, { fateCursorIndex: Number(step.id) });
    if (timeline.duelThrowsAtMs.length > 0) {
      at(timeline.cursorsDoneMs, { duelThrowIndex: -1 });
      timeline.duelThrowsAtMs.forEach((ms, i) => at(ms, { duelThrowIndex: i }));
    }
    timers.push(setTimeout(() => onCompleteRef.current(turnId), timeline.completeMs * timeScale));
    return () => timers.forEach(clearTimeout);
    // pendingTurn identity is stable for a committed turn; key on its id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTurn?.turnId, playerStartId, fateStart, orderKey, timeScale]);

  return frame && frame.turnId === pendingTurn?.turnId ? frame.state : IDLE;
}
