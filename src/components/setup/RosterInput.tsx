import { useId, useState, type KeyboardEvent } from 'react';
import { MAX_NAME_LENGTH } from '../../game/config/limits';
import {
  addNamesToRoster,
  type NameRejection,
  type Roster,
  type RosterAddResult,
} from '../../game/setup/roster';
import { createId } from '../../utils/ids';

interface RosterInputProps {
  /** Functional update, applied to the latest roster. */
  readonly onRosterChange: (change: (roster: Roster) => Roster) => void;
}

interface AddFeedback {
  readonly addedCount: number;
  readonly rejected: readonly NameRejection[];
}

export function RosterInput({ onRosterChange }: RosterInputProps) {
  const inputId = useId();
  const hintId = useId();
  const [text, setText] = useState('');
  const [feedback, setFeedback] = useState<AddFeedback | null>(null);

  function handleAdd() {
    let outcome: RosterAddResult | null = null;
    onRosterChange((current) => {
      outcome = addNamesToRoster(current, text, createId);
      return outcome.roster;
    });
    const result = outcome as RosterAddResult | null;
    if (!result) return;
    // Keep only the rejected names in the box so the host can fix them.
    setText(result.rejected.map((r) => r.name).join('\n'));
    setFeedback({ addedCount: result.added.length, rejected: result.rejected });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      if (text.trim() !== '') handleAdd();
    }
  }

  return (
    <section className="panel" aria-labelledby={`${inputId}-title`}>
      <h2 id={`${inputId}-title`} className="panel__title">
        Add fighters
      </h2>
      <label htmlFor={inputId} className="field-label">
        Paste names, one per line
      </label>
      <textarea
        id={inputId}
        className="roster-input__text"
        rows={6}
        value={text}
        placeholder={'An\nBình\nChi'}
        aria-describedby={hintId}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <p id={hintId} className="hint">
        Max {MAX_NAME_LENGTH} characters per name. Duplicates (any letter case) are skipped.
        Ctrl+Enter adds.
      </p>
      <button type="button" className="button" onClick={handleAdd} disabled={text.trim() === ''}>
        Add to roster
      </button>
      <div className="roster-input__feedback" aria-live="polite">
        {feedback && (
          <>
            <p>
              Added {feedback.addedCount} fighter{feedback.addedCount === 1 ? '' : 's'}.
              {feedback.rejected.length > 0 && ' Skipped names were kept in the box to fix:'}
            </p>
            {feedback.rejected.length > 0 && (
              <ul className="warning-list">
                {feedback.rejected.map((r, i) => (
                  <li key={`${r.name}-${i}`}>{describeRejection(r)}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function describeRejection({ name, reason }: NameRejection): string {
  switch (reason) {
    case 'too-long':
      return `“${name}” is longer than ${MAX_NAME_LENGTH} characters.`;
    case 'duplicate':
      return `“${name}” is already on the roster.`;
  }
}
