import { useEffect } from 'react';
import type { MatchState } from '../../game/engine/matchTypes';
import type { SoundControl } from '../../hooks/useSound';
import { EventLog } from './EventLog';

interface VictoryScreenProps {
  readonly match: MatchState;
  readonly sound: SoundControl;
  readonly saveError: string | null;
  readonly onLeave: () => void;
}

/** Winner ceremony. The result was committed (with its record) before this rendered. */
export function VictoryScreen({ match, sound, saveError, onLeave }: VictoryScreenProps) {
  const f = match.finale!;
  const nameOf = (id: string) => match.players.find((p) => p.id === id)?.name ?? '???';
  const others = f.finalistIds.filter((id) => !f.winnerIds.includes(id));
  const { audio } = sound;

  useEffect(() => {
    audio.stopMusic();
    audio.victory();
  }, [audio]);

  return (
    <main className="victory" aria-label="Victory">
      <div className="victory__confetti" aria-hidden="true">
        {Array.from({ length: 24 }, (_, i) => (
          <span
            key={i}
            style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 8) * 0.25}s` }}
          />
        ))}
      </div>
      <h1 className="victory__title">{f.winnerIds.length === 1 ? 'Winner!' : 'Winners!'}</h1>
      <ol className="victory__winners" aria-label="Winners">
        {f.winnerIds.map((id) => (
          <li key={id}>
            <span aria-hidden="true">👑 </span>
            {nameOf(id)}
          </li>
        ))}
      </ol>
      <p className="victory__summary">
        {f.rounds.length} finale round{f.rounds.length === 1 ? '' : 's'}
        {others.length > 0 && ` · Also in the finale: ${others.map(nameOf).join(', ')}`}
      </p>
      {saveError ? (
        <p className="banner banner--error" role="alert">
          The result could not be saved: {saveError}
        </p>
      ) : (
        <p className="victory__saved" data-testid="result-saved">
          Result saved.
        </p>
      )}
      <button type="button" className="button button--start victory__back" onClick={onLeave}>
        Return to setup
      </button>
      <EventLog match={match} />
    </main>
  );
}
