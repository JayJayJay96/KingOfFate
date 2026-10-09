import { describeOutcome } from '../../game/engine/describeEvent';
import type { MatchState, ResolvedTurn } from '../../game/engine/matchTypes';
import type { TurnStage } from '../../hooks/useTurnAnimation';
import { FighterSprite } from '../sprites/icons';

interface PreviewPanelProps {
  readonly match: MatchState;
  readonly highlightId: string | null;
  readonly stage?: TurnStage;
}

/** Large nameplate with the selected fighter's pixel portrait. */
export function PreviewPanel({ match, highlightId, stage = 'idle' }: PreviewPanelProps) {
  const nameOf = (id: string | null) => match.players.find((p) => p.id === id)?.name ?? '???';
  const last = match.lastTurn;

  let name: string | null;
  let caption: string;
  let tone = '';
  if (match.phase === 'SPINNING') {
    name = highlightId ? nameOf(highlightId) : null;
    // The fighter is revealed first; only then does Fate decide what happens to them.
    caption = stage === 'fate' ? 'Fate is choosing…' : 'Choosing a fighter…';
    if (stage === 'fate') tone = 'preview--chosen';
  } else if (last) {
    name = nameOf(last.turn.playerId);
    ({ caption, tone } = shortOutcome(last, nameOf));
  } else {
    name = null;
    caption = 'Press ? or Space to begin';
  }

  const announcement =
    match.phase !== 'SPINNING' && last
      ? `Turn ${last.turn.turnNumber}: ${describeOutcome(last.outcome, last.turn.playerId, last.turn.duel, nameOf)}`
      : '';

  return (
    <section className={`panel preview ${tone}`} aria-label="Selected fighter">
      {name ? (
        <span className="preview__portrait">
          <FighterSprite seed={name} size={136} idle={match.phase !== 'SPINNING'} />
        </span>
      ) : (
        <div className="preview__silhouette" aria-hidden="true" />
      )}
      <div className="preview__text" aria-hidden="true">
        <p className="preview__name" data-testid="preview-name">
          {name ?? '???'}
        </p>
        <p className="preview__caption">{caption}</p>
      </div>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}

function shortOutcome(
  last: ResolvedTurn,
  nameOf: (id: string) => string,
): { caption: string; tone: string } {
  const o = last.outcome;
  switch (o.fate) {
    case 'KO':
      return o.result === 'ELIMINATED'
        ? { caption: 'KO! Eliminated', tone: 'preview--ko' }
        : { caption: 'KO blocked by Shield', tone: 'preview--shield' };
    case 'SHIELD':
      return o.result === 'GAINED'
        ? { caption: 'Gains a Shield', tone: 'preview--shield' }
        : { caption: 'Shield wasted (already protected)', tone: '' };
    case 'VS': {
      const selectedWon = o.winnerId === last.turn.playerId;
      const other = nameOf(selectedWon ? o.loserId : o.winnerId);
      if (selectedWon) {
        return {
          caption: `Wins the duel vs ${other}${o.loserResult === 'ELIMINATED' ? ` · ${other} eliminated` : ''}`,
          tone: 'preview--shield',
        };
      }
      return o.loserResult === 'ELIMINATED'
        ? { caption: `Loses the duel vs ${other} · Eliminated`, tone: 'preview--ko' }
        : { caption: `Loses the duel vs ${other} · Shield absorbs it`, tone: 'preview--shield' };
    }
  }
}
