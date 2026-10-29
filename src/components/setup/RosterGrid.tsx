import { useId, useState } from 'react';
import { formatDateTime } from '../../game/history/format';
import type { FairWin } from '../../game/setup/fairSitOut';
import {
  removeParticipant,
  setAllActive,
  setParticipantLook,
  toggleParticipant,
  type Roster,
} from '../../game/setup/roster';
import { CrownIcon, FighterSprite } from '../sprites/icons';
import { LookEditor } from './LookEditor';

interface RosterGridProps {
  readonly roster: Roster;
  /** Functional update, applied to the latest roster (safe under rapid clicks). */
  readonly onRosterChange: (change: (roster: Roster) => Roster) => void;
  /** Fair sit-outs: who has won more than the lowest count this cycle, with their wins. */
  readonly sitOut?: ReadonlyMap<string, readonly FairWin[]>;
}

/** Hover text for a sat-out person's crown. */
function sitOutTip(wins: readonly FairWin[]): string {
  const list = wins
    .map((w) => formatDateTime(w.completedAt) + (w.title ? ` (${w.title})` : ''))
    .join('; ');
  return `Sitting out so everyone gets a chance. Won: ${list}`;
}

/** Attendance board: every stored fighter with an in/out toggle. Inactive fighters stay stored. */
export function RosterGrid({ roster, onRosterChange, sitOut }: RosterGridProps) {
  const titleId = useId();
  const activeCount = roster.filter((p) => p.active).length;
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = roster.find((p) => p.id === editingId) ?? null;

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
                {sitOut?.has(p.id) && (
                  <span
                    className="slot__crown"
                    role="img"
                    aria-label={sitOutTip(sitOut.get(p.id)!)}
                    title={sitOutTip(sitOut.get(p.id)!)}
                    data-testid="sit-out-crown"
                  >
                    <CrownIcon size={18} />
                  </span>
                )}
                <button
                  type="button"
                  className="slot__toggle"
                  aria-pressed={p.active}
                  title={
                    p.active ? 'Playing today. Click to sit out.' : 'Sitting out. Click to play.'
                  }
                  onClick={() => onRosterChange((r) => toggleParticipant(r, p.id))}
                >
                  <FighterSprite seed={p.name} look={p.look} size={36} />
                  <span className="slot__name">{p.name}</span>
                  <span className="slot__status" aria-hidden="true">
                    {p.active ? 'IN' : 'OUT'}
                  </span>
                </button>
                <button
                  type="button"
                  className="slot__look"
                  aria-label={`Change look for ${p.name}`}
                  title="Change look"
                  onClick={() => setEditingId(p.id)}
                >
                  🎨
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
      {editing && (
        <LookEditor
          person={editing}
          onSave={(look) => onRosterChange((r) => setParticipantLook(r, editing.id, look))}
          onClose={() => setEditingId(null)}
        />
      )}
    </section>
  );
}
