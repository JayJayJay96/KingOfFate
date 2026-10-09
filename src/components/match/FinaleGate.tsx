import { alivePlayers } from '../../game/engine/match';
import type { MatchState } from '../../game/engine/matchTypes';
import { EventLog } from './EventLog';

interface FinaleGateProps {
  readonly match: MatchState;
  readonly onLeave: () => void;
}

/** PHASE 2 PLACEHOLDER for the W + 1 handoff. The RPS finale and winners arrive in Phase 4. */
export function FinaleGate({ match, onLeave }: FinaleGateProps) {
  const finalists = alivePlayers(match);
  return (
    <main className="match finale-gate">
      <section className="panel finale-gate__panel">
        <h1 className="finale-gate__title">Finale!</h1>
        <p>
          {finalists.length} fighters remain for {match.winnerCount} winner slot
          {match.winnerCount === 1 ? '' : 's'}:
        </p>
        <ul className="finale-gate__list" aria-label="Finalists">
          {finalists.map((p) => (
            <li key={p.id}>{p.name}</li>
          ))}
        </ul>
        <p className="banner banner--warn" role="status">
          Phase 2 build: the Một Hai Ba Yo RPS finale arrives in Phase 4. No winners are declared
          yet.
        </p>
        <button type="button" className="button" onClick={onLeave}>
          Return to setup
        </button>
      </section>
      <EventLog match={match} />
    </main>
  );
}
