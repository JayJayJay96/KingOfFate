import { useEffect, useRef, useState } from 'react';
import { buildSpinPlan, spinStyleFor } from '../animation/spinPlan';
import type { CommittedTurn } from '../game/engine/matchTypes';

/**
 * Drives the selection cursor for a committed turn and calls `onComplete(turnId)` at the reveal
 * time. Pure presentation: it cannot change the committed target. `timeScale` < 1 speeds
 * everything up proportionally (tests only).
 */
export function useSpinCursor(
  pendingTurn: CommittedTurn | null,
  orderedIds: readonly string[],
  startId: string | null,
  timeScale: number,
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
    const plan = buildSpinPlan(orderKey.split('\u0000'), startId, targetId, spinStyleFor(turnId));
    const timers = plan.steps.map((step) =>
      setTimeout(() => setHighlight({ turnId, id: step.id }), step.atMs * timeScale),
    );
    timers.push(setTimeout(() => onCompleteRef.current(turnId), plan.revealMs * timeScale));
    return () => timers.forEach(clearTimeout);
  }, [turnId, targetId, startId, orderKey, timeScale]);

  return highlight && highlight.turnId === turnId ? highlight.id : null;
}
