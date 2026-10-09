import type { MatchState } from '../../game/engine/matchTypes';

interface PreviewPanelProps {
  readonly match: MatchState;
  readonly highlightId: string | null;
}

/** Large nameplate with a generic silhouette (placeholder art until Phase 5). */
export function PreviewPanel({ match, highlightId }: PreviewPanelProps) {
  const nameOf = (id: string | null) => match.players.find((p) => p.id === id)?.name ?? null;
  const last = match.lastTurn;

  let name: string | null;
  let caption: string;
  let tone = '';
  if (match.phase === 'SPINNING') {
    name = nameOf(highlightId);
    caption = 'Fate is choosing…';
  } else if (last) {
    name = nameOf(last.turn.playerId);
    caption = last.eliminated ? 'KO! Eliminated' : 'Survived';
    tone = last.eliminated ? 'preview--ko' : '';
  } else {
    name = null;
    caption = 'Press ? or Space to begin';
  }

  const announcement =
    match.phase !== 'SPINNING' && last
      ? `Turn ${last.turn.turnNumber}: ${nameOf(last.turn.playerId)}, ${caption}.`
      : '';

  return (
    <section className={`panel preview ${tone}`} aria-label="Selected fighter">
      <div className="preview__silhouette" aria-hidden="true" />
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
