import { useEffect, useRef, useState } from 'react';
import { buildTurnTimeline } from '../animation/turnTimeline';
import type { CommittedTurn } from '../game/engine/matchTypes';

/** Which part of the turn's reveal is on screen. */
export type TurnStage = 'idle' | 'player' | 'fate' | 'vs' | 'opponent' | 'duel';

export interface TurnAnimationState {
  readonly stage: TurnStage;
  /** Fighter cursor (stays on the chosen fighter once landed). */
  readonly playerCursorId: string | null;
  /** Fate cursor slot index, or null before the Fate spin starts. */
  readonly fateCursorIndex: number | null;
  /** VS opponent cursor (stays on the opponent once landed). */
  readonly opponentCursorId: string | null;
  /** VS only: -1 = duel intro, 0..n-1 = that throw is showing; null = no throws on screen. */
  readonly duelThrowIndex: number | null;
}

const IDLE: TurnAnimationState = {
  stage: 'idle',
  playerCursorId: null,
  fateCursorIndex: null,
  opponentCursorId: null,
  duelThrowIndex: null,
};

/** Moments of a turn's show, for sound effects. */
export type TurnCue =
  | { readonly kind: 'player' }
  | { readonly kind: 'fate' }
  | { readonly kind: 'vsAnnounce' }
  | { readonly kind: 'opponent' }
  | { readonly kind: 'duelIntro' }
  | { readonly kind: 'duelThrow'; readonly index: number };

/**
 * Plays a committed turn one step at a time: fighter cursor, then Fate cursor, then (VS) the
 * "VS!" announce, opponent cursor and throws, then `onComplete(turnId)`.
 * Pure presentation; `timeScale` < 1 speeds everything up proportionally (tests only).
 */
export function useTurnAnimation(
  pendingTurn: CommittedTurn | null,
  aliveIdsInGridOrder: readonly string[],
  playerStartId: string | null,
  fateStart: number,
  timeScale: number,
  onComplete: (turnId: string) => void,
  onCue: (cue: TurnCue) => void = () => undefined,
): TurnAnimationState {
  const [frame, setFrame] = useState<{ turnId: string; state: TurnAnimationState } | null>(null);
  const onCompleteRef = useRef(onComplete);
  const onCueRef = useRef(onCue);
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onCueRef.current = onCue;
  });

  const orderKey = aliveIdsInGridOrder.join('\u0000');

  useEffect(() => {
    if (!pendingTurn || !playerStartId) return;
    const turnId = pendingTurn.turnId;
    const t = buildTurnTimeline(pendingTurn, orderKey.split('\u0000'), playerStartId, fateStart);

    let current: TurnAnimationState = { ...IDLE, stage: 'player' };
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, change: Partial<TurnAnimationState>, cue: TurnCue | null) =>
      timers.push(
        setTimeout(() => {
          current = { ...current, ...change };
          setFrame({ turnId, state: current });
          if (cue) onCueRef.current(cue);
        }, ms * timeScale),
      );

    for (const s of t.playerSteps) at(s.atMs, { playerCursorId: s.id }, { kind: 'player' });
    // The Fate cursor may already be moving; the caption switches once the fighter is revealed.
    at(t.playerRevealMs, { stage: 'fate' }, null);
    for (const s of t.fateSteps) {
      at(s.atMs, { fateCursorIndex: Number(s.id) }, { kind: 'fate' });
    }
    if (t.vsAnnounceMs !== null && t.opponentStartMs !== null && t.duelStartMs !== null) {
      at(t.vsAnnounceMs, { stage: 'vs' }, { kind: 'vsAnnounce' });
      at(t.opponentStartMs, { stage: 'opponent' }, null);
      for (const s of t.opponentSteps) {
        at(s.atMs, { opponentCursorId: s.id }, { kind: 'opponent' });
      }
      at(t.duelStartMs, { stage: 'duel', duelThrowIndex: -1 }, { kind: 'duelIntro' });
      t.duelThrowsAtMs.forEach((ms, i) =>
        at(ms, { duelThrowIndex: i }, { kind: 'duelThrow', index: i }),
      );
    }
    timers.push(setTimeout(() => onCompleteRef.current(turnId), t.completeMs * timeScale));
    return () => timers.forEach(clearTimeout);
    // pendingTurn identity is stable for a committed turn; key on its id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTurn?.turnId, playerStartId, fateStart, orderKey, timeScale]);

  if (frame && frame.turnId === pendingTurn?.turnId) return frame.state;
  return pendingTurn ? { ...IDLE, stage: 'player' } : IDLE;
}
