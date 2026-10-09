import { useEffect, useRef } from 'react';
import { describeEvent } from '../../game/engine/describeEvent';
import type { MatchState } from '../../game/engine/matchTypes';

/** Chronological, screenshare-readable log. Auto-scrolls to the newest entry. */
export function EventLog({ match }: { readonly match: MatchState }) {
  const listRef = useRef<HTMLOListElement>(null);
  const lines = match.events.flatMap((event) => {
    const text = describeEvent(event, match);
    return text ? [{ id: event.id, text, type: event.type }] : [];
  });

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [lines.length]);

  return (
    <section className="panel event-log" aria-labelledby="event-log-title">
      <h2 id="event-log-title" className="panel__title">
        Event log
      </h2>
      <ol ref={listRef} className="event-log__list" data-testid="event-log">
        {lines.map((line) => (
          <li key={line.id} className={`event-log__item event-log__item--${line.type}`}>
            {line.text}
          </li>
        ))}
      </ol>
    </section>
  );
}
