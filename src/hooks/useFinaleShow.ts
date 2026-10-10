import { useEffect, useRef, useState } from 'react';
import {
  finalePace,
  introTimeline,
  roundsWithoutWinner,
  roundTimeline,
  type ChantWord,
} from '../animation/finaleTimeline';
import type { FinaleThrow, MatchState } from '../game/engine/matchTypes';

export interface FinaleShowHandlers {
  readonly onNextRound: () => void;
  readonly onResolveRound: (roundId: string) => void;
  readonly onBeat: (word: ChantWord) => void;
}

export interface FinaleShowState {
  /** Chant word currently on screen, or null. */
  readonly word: ChantWord | null;
  /** Hands to show: the current reveal on "Juice!", or the last result between rounds. */
  readonly revealThrows: readonly FinaleThrow[] | null;
  /** Current pace: 1 = normal, smaller = faster (rising tension, owner request). */
  readonly paceScale: number;
}

/**
 * Drives the automated finale: intro chant (once, before the first reveal), then for every
 * committed round "1 · 2 · Juice!", a result hold, and the next round. Only plays back what is
 * already committed; `timeScale` < 1 is for tests.
 */
export function useFinaleShow(
  match: MatchState,
  timeScale: number,
  handlers: FinaleShowHandlers,
  /**
   * D4: pause takes effect at the next round boundary. A committed round in progress always
   * finishes and is scored; while paused no new round is started. Resume continues.
   */
  paused = false,
): FinaleShowState {
  const f = match.finale;
  const pending = f?.pendingRound ?? null;
  const roundsCount = f?.rounds.length ?? 0;
  const active = match.phase === 'FINALE' && !!f?.started;
  const pace = finalePace(roundsWithoutWinner(f?.rounds ?? []));
  // A running round must not restart when pause toggles, so `paused` only keys the idle state.
  const key = pending
    ? `${active}|round|${pending.roundId}`
    : `${active}|idle|${roundsCount}|${paused}`;

  const [frame, setFrame] = useState<{ key: string; word: ChantWord | null; reveal: boolean }>({
    key: '',
    word: null,
    reveal: false,
  });
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!active) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms * timeScale));
    const show = (word: ChantWord | null, reveal: boolean) => {
      setFrame({ key, word, reveal });
      if (word) handlersRef.current.onBeat(word);
    };

    if (pending) {
      const { cues, resolveMs } = roundTimeline(pace);
      for (const cue of cues) at(cue.atMs, () => show(cue.word, cue.reveal));
      const roundId = pending.roundId;
      at(resolveMs, () => handlersRef.current.onResolveRound(roundId));
    } else if (paused) {
      // Hold here until resumed.
    } else if (roundsCount === 0) {
      const { cues, doneMs } = introTimeline();
      for (const cue of cues) at(cue.atMs, () => show(cue.word, false));
      at(doneMs, () => handlersRef.current.onNextRound());
    } else {
      at(pace.pauseMs, () => handlersRef.current.onNextRound());
    }
    return () => timers.forEach(clearTimeout);
    // `key` captures every input that changes the schedule.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, timeScale]);

  const current = frame.key === key ? frame : { word: null, reveal: false };
  let revealThrows: readonly FinaleThrow[] | null = null;
  if (pending && current.reveal) revealThrows = pending.throws;
  else if (!pending && roundsCount > 0) revealThrows = f!.rounds[roundsCount - 1]!.throws;
  return { word: current.word, revealThrows, paceScale: pace.scale };
}
