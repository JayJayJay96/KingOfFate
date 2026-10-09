import { useId } from 'react';
import {
  removeParticipant,
  setAllActive,
  toggleParticipant,
  type Roster,
} from '../../game/setup/roster';

interface RosterGridProps {
  readonly roster: Roster;
  /** Functional update, applied to the latest roster (safe under rapid clicks). */
  readonly onRosterChange: (change: (roster: Roster) => Roster) => void;
}

/** Attendance board: every stored fighter with an in/out toggle. Inactive fighters stay stored. */
export function RosterGrid({ roster, onRosterChange }: RosterGridProps) {
  const titleId = useId();
  const activeCount = roster.filter((p) => p.active).length;

  return (
    <section className="panel" aria-labelledby={titleId}>
      <div className="panel__header">
        <h2 id={titleId} className="panel__title">
          Roster
        </h2>
        <p className="roster-count" data-testid="roster-count">
          <strong>{activeCount}</strong> in · {roster.length} total
        </p>
      </div>

      {roster.length === 0 ? (
        <p className="empty">No fighters yet. Paste names above to fill the roster.</p>
      ) : (
        <>
          <div className="toolbar">
            <button
              type="button"
              className="button button--small"
              onClick={() => onRosterChange((r) => setAllActive(r, true))}
              disabled={activeCount === roster.length}
            >
              All in
            </button>
            <button
              type="button"
              className="button button--small"
              onClick={() => onRosterChange((r) => setAllActive(r, false))}
              disabled={activeCount === 0}
            >
              All out
            </button>
          </div>
          <ul className="roster-grid">
            {roster.map((p) => (
              <li key={p.id} className={p.active ? 'slot' : 'slot slot--out'}>
                <button
                  type="button"
                  className="slot__toggle"
                  aria-pressed={p.active}
                  title={
                    p.active ? 'Playing today. Click to sit out.' : 'Sitting out. Click to play.'
                  }
                  onClick={() => onRosterChange((r) => toggleParticipant(r, p.id))}
                >
                  <span className="slot__name">{p.name}</span>
                  <span className="slot__status" aria-hidden="true">
                    {p.active ? 'IN' : 'OUT'}
                  </span>
                </button>
                <button
                  type="button"
                  className="slot__remove"
                  aria-label={`Remove ${p.name}`}
                  title="Remove from roster"
                  onClick={() => onRosterChange((r) => removeParticipant(r, p.id))}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
