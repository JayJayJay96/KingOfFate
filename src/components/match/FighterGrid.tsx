import type { MatchPlayer } from '../../game/engine/matchTypes';
import { FighterSprite } from '../sprites/icons';

interface FighterGridProps {
  readonly players: readonly MatchPlayer[];
  /** Cursor position during a spin. */
  readonly highlightId: string | null;
  /** VS opponent while the duel is on screen. */
  readonly opponentId?: string | null;
  /** Target of the most recently resolved turn. */
  readonly lastTargetId: string | null;
  /** Fighter just knocked out: plays the knock-back fall once. */
  readonly fallingId?: string | null;
}

/** Every match participant; eliminated fighters stay visible, greyed and X-marked. */
export function FighterGrid({
  players,
  highlightId,
  opponentId = null,
  lastTargetId,
  fallingId = null,
}: FighterGridProps) {
  return (
    <ul className="fighter-grid" aria-label="Fighters">
      {players.map((p) => {
        const classes = ['fighter'];
        if (!p.alive) classes.push('fighter--out');
        if (p.id === highlightId) classes.push('fighter--cursor');
        if (p.id === opponentId) classes.push('fighter--opponent');
        if (!highlightId && p.id === lastTargetId) classes.push('fighter--selected');
        if (p.id === fallingId) classes.push('fighter--falling');
        return (
          <li
            key={p.id}
            className={classes.join(' ')}
            data-state={p.alive ? 'alive' : 'out'}
            data-cursor={p.id === highlightId ? 'true' : undefined}
            data-shield={p.shield ? 'true' : undefined}
          >
            <FighterSprite seed={p.name} size={40} idle={p.alive} />
            <span className="fighter__name">{p.name}</span>
            {p.shield && (
              <span className="fighter__shield" title="Has a Shield">
                <span aria-hidden="true">🛡️</span>
                <span className="sr-only"> (Shield)</span>
              </span>
            )}
            {!p.alive && (
              <>
                <span className="fighter__x" aria-hidden="true">
                  ✕
                </span>
                <span className="sr-only"> (eliminated)</span>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
