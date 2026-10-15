import type { Gesture } from '../game/engine/rps';

/**
 * Draw counter (owner request 2026-10-16): "DRAW ×3!" grows with every draw in a row, and
 * "CLASH!" when everyone threw the same hand. Presentation only.
 */
export function finaleDrawStreak(
  rounds: readonly { readonly winningGesture: Gesture | null; readonly stageNumber: number }[],
  stageNumber: number,
): number {
  let n = 0;
  for (let i = rounds.length - 1; i >= 0; i--) {
    const r = rounds[i]!;
    if (r.stageNumber !== stageNumber || r.winningGesture !== null) break;
    n++;
  }
  return n;
}

/** Everyone showed the same hand. */
export function isClash(gestures: readonly Gesture[]): boolean {
  return gestures.length > 1 && gestures.every((g) => g === gestures[0]);
}

export function drawBurstLabel(count: number, clash: boolean): string {
  const word = clash ? 'Clash' : 'Draw';
  return count >= 2 ? `${word} ×${count}!` : `${word}!`;
}

/** Text grows 20 % per extra draw, up to 1.8×. */
export function drawBurstScale(count: number): number {
  return Math.min(1.8, 1 + 0.2 * Math.max(0, count - 1));
}
