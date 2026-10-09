import type { Rivalry } from '../../game/history/awards';

/** Head-to-head VS records (owner decision 2026-10-10: VS duels only). */
export function Rivalries({
  items,
  onOpen,
}: {
  readonly items: readonly Rivalry[];
  readonly onOpen: (personId: string) => void;
}) {
  return (
    <section className="panel history-panel" aria-labelledby="rivalries-title">
      <h2 id="rivalries-title" className="panel__title">
        Rivalries
      </h2>
      <p className="hint">
        Every VS duel ever fought, by pair. Pure luck: the rock-paper-scissors hands are random.
      </p>
      {items.length === 0 ? (
        <p className="empty">No VS duels yet.</p>
      ) : (
        <ol className="rivalry-list" data-testid="rivalries">
          {items.map((r) => (
            <li key={`${r.aId}|${r.bId}`} className="rivalry">
              <button type="button" className="link-button" onClick={() => onOpen(r.aId)}>
                {r.aName}
              </button>
              <span className="rivalry__score">
                {r.aWins} – {r.bWins}
              </span>
              <button type="button" className="link-button" onClick={() => onOpen(r.bId)}>
                {r.bName}
              </button>
              <span className="rivalry__meta">
                {r.duels} duel{r.duels === 1 ? '' : 's'}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
