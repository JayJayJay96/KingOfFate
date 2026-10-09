import { useEffect, useRef, useState } from 'react';
import { buildSpinPlan } from '../animation/spinPlan';
import type { CommittedTurn } from '../game/engine/matchTypes';

/**
 * Drives the selection cursor for a committed turn and calls `onComplete(turnId)` once the
 * cursor has landed and held. Pure presentation: it cannot change the committed target.
 */
export function useSpinCursor(
  pendingTurn: CommittedTurn | null,
  orderedIds: readonly string[],
  startId: string | null,
  durationMs: number,
  holdMs: number,
  onComplete: (turnId: string) => void,
): string | null {
  const [highlight, setHighlight] = useState<{ turnId: string; id: string } | null>(null);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  const turnId = pendingTurn?.turnId ?? null;
  const targetId = pendingTurn?.playerId ?? null;
  const orderKey = orderedIds.join('\u0000');

  useEffect(() => {
    if (!turnId || !targetId || !startId) return;
    const plan = buildSpinPlan(orderKey.split('\u0000'), startId, targetId, durationMs);
    const timers = plan.map((step) =>
      setTimeout(() => setHighlight({ turnId, id: step.id }), step.atMs),
    );
    timers.push(setTimeout(() => onCompleteRef.current(turnId), durationMs + holdMs));
    return () => timers.forEach(clearTimeout);
  }, [turnId, targetId, startId, orderKey, durationMs, holdMs]);

  return highlight && highlight.turnId === turnId ? highlight.id : null;
}
