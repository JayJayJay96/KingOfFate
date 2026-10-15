import type { CSSProperties } from 'react';
import { drawBurstLabel, drawBurstScale } from '../../animation/drawCounter';

/** "DRAW ×n!" / "CLASH!" stamp; bigger with every draw in a row. Decorative only. */
export function DrawBurst({ count, clash }: { readonly count: number; readonly clash: boolean }) {
  return (
    <p
      className={clash ? 'draw-burst draw-burst--clash' : 'draw-burst'}
      data-testid="draw-burst"
      aria-hidden="true"
      style={{ '--burst': drawBurstScale(count) } as CSSProperties}
    >
      {drawBurstLabel(count, clash)}
    </p>
  );
}
