import type { Gesture } from '../../game/engine/rps';

/**
 * Winning-hand attack animation (owner request 2026-10-10): the winner's hand flies at the loser
 * and acts on it. Rock crushes scissors, paper wraps rock, scissors cut paper. Presentation only:
 * the hands and the result were committed before anything was drawn.
 */
export type AttackAction = 'crush' | 'wrap' | 'cut';

export const ATTACK_OF: Readonly<Record<Gesture, AttackAction>> = {
  ROCK: 'crush',
  PAPER: 'wrap',
  SCISSORS: 'cut',
};

/** Share of the distance the winning hand travels (it stops on top of the loser's hand). */
const REACH = 0.82;

/**
 * Points every `[data-attack="winner"]` hand inside `container` at its nearest
 * `[data-attack="loser"]` hand by setting `--ax` / `--ay` (px) for the CSS keyframes.
 */
export function aimAttacks(container: HTMLElement | null): void {
  if (!container) return;
  const centre = (el: Element) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  const losers = [...container.querySelectorAll('[data-attack="loser"]')].map(centre);
  if (losers.length === 0) return;
  for (const el of container.querySelectorAll<HTMLElement>('[data-attack="winner"]')) {
    const from = centre(el);
    let best = losers[0]!;
    for (const l of losers) {
      if (Math.hypot(l.x - from.x, l.y - from.y) < Math.hypot(best.x - from.x, best.y - from.y)) {
        best = l;
      }
    }
    el.style.setProperty('--ax', `${Math.round((best.x - from.x) * REACH)}px`);
    el.style.setProperty('--ay', `${Math.round((best.y - from.y) * REACH)}px`);
  }
}
