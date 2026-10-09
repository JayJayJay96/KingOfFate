import type { MatchPlayer } from '../../game/engine/matchTypes';

interface FighterGridProps {
  readonly players: readonly MatchPlayer[];
  /** Cursor position during a spin. */
  readonly highlightId: string | null;
  /** Target of the most recently resolved turn. */
  readonly lastTargetId: string | null;
}

/** Every match participant; eliminated fighters stay visible, greyed and X-marked. */
export function FighterGrid({ players, highlightId, lastTargetId }: FighterGridProps) {
  return (
    <ul className="fighter-grid" aria-label="Fighters">
      {players.map((p) => {
        const classes = ['fighter'];
        if (!p.alive) classes.push('fighter--out');
        if (p.id === highlightId) classes.push('fighter--cursor');
        if (!highlightId && p.id === lastTargetId) classes.push('fighter--selected');
        return (
          <li
            key={p.id}
            className={classes.join(' ')}
            data-state={p.alive ? 'alive' : 'out'}
            data-cursor={p.id === highlightId ? 'true' : undefined}
          >
            <span className="fighter__name">{p.name}</span>
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
