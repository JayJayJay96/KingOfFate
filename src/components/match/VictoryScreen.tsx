import { useEffect } from 'react';
import { scatterFallen } from '../../animation/victoryLayout';
import { useSound } from '../../audio/soundContext';
import type { MatchState } from '../../game/engine/matchTypes';
import { CrownIcon, FighterSprite } from '../sprites/icons';
import { EventLog } from './EventLog';

interface VictoryScreenProps {
  readonly match: MatchState;
  readonly saveError: string | null;
  readonly onLeave: () => void;
}

/**
 * Winner ceremony. The result was committed (with its record) before this rendered.
 * Owner request: everyone knocked out during the match lies scattered around the screen, and
 * finalists who lost lie knocked out beside the standing winners.
 */
export function VictoryScreen({ match, saveError, onLeave }: VictoryScreenProps) {
  const f = match.finale!;
  const { engine } = useSound();
  const nameOf = (id: string) => match.players.find((p) => p.id === id)?.name ?? '???';
  const finaleLosers = f.finalistIds.filter((id) => !f.winnerIds.includes(id));
  // Knocked out during ordinary turns, in the order they fell.
  const knockedOut = match.players
    .filter((p) => !p.alive)
    .sort((a, b) => (a.eliminatedOnTurn ?? 0) - (b.eliminatedOnTurn ?? 0));
  const spots = scatterFallen(knockedOut.map((p) => p.name));
  // Finale losers alternate left / right of the winners.
  const losersLeft = finaleLosers.filter((_, i) => i % 2 === 0);
  const losersRight = finaleLosers.filter((_, i) => i % 2 === 1);

  useEffect(() => {
    engine.sfx('victory');
  }, [engine]);

  return (
    <main className="victory" aria-label="Victory">
      <div className="victory__fallen-field" aria-label="Knocked out during the match">
        {knockedOut.map((p, i) => (
          <div
            key={p.id}
            className="fallen"
            data-testid="fallen"
            style={{ left: `${spots[i]!.x}%`, top: `${spots[i]!.y}%` }}
          >
            <span className="fallen__body" style={{ transform: `rotate(${spots[i]!.rotate}deg)` }}>
              <FighterSprite seed={p.name} size={40} />
            </span>
            <span className="fallen__name">{p.name}</span>
          </div>
        ))}
      </div>
      <div className="victory__confetti" aria-hidden="true">
        {Array.from({ length: 24 }, (_, i) => (
          <span
            key={i}
            style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 8) * 0.25}s` }}
          />
        ))}
      </div>

      <h1 className="victory__title">{f.winnerIds.length === 1 ? 'Winner!' : 'Winners!'}</h1>

      <div className="victory__podium">
        {losersLeft.map((id) => (
          <FinaleLoser key={id} name={nameOf(id)} />
        ))}
        <ol className="victory__winners" aria-label="Winners">
          {f.winnerIds.map((id) => (
            <li key={id}>
              <span className="victory__portrait">
                <CrownIcon size={28} />
                <FighterSprite seed={nameOf(id)} size={96} />
              </span>
              <span className="victory__name">{nameOf(id)}</span>
            </li>
          ))}
        </ol>
        {losersRight.map((id) => (
          <FinaleLoser key={id} name={nameOf(id)} />
        ))}
      </div>

      <p className="victory__summary">
        {f.rounds.length} finale round{f.rounds.length === 1 ? '' : 's'}
        {knockedOut.length > 0 && ` · ${knockedOut.length} knocked out along the way`}
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

function FinaleLoser({ name }: { readonly name: string }) {
  return (
    <div className="finale-loser" data-testid="finale-loser">
      <span className="finale-loser__body">
        <FighterSprite seed={name} size={72} />
      </span>
      <span className="finale-loser__name">{name}</span>
      <span className="finale-loser__tag">Lost the finale</span>
    </div>
  );
}
