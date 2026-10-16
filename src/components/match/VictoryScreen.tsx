import { useContext, useEffect, useState, type CSSProperties } from 'react';
import { FANFARES } from '../../audio/fanfares';
import { scatterFallen } from '../../animation/victoryLayout';
import { victoryLine } from '../../audio/announcer';
import { summarizeMatch } from '../../game/history/history';
import { toCompletedRecord } from '../../storage/matchStorage';
import { MatchAwards } from '../history/MatchAwards';
import { useSound } from '../../audio/soundContext';
import type { MatchState } from '../../game/engine/matchTypes';
import { renderShareCard, shareCardData, shareCardFileName } from '../../share/shareCard';
import { downloadBlob } from '../../utils/download';
import { fighterSprite } from '../sprites/fighterSprite';
import { LooksContext, lookKey } from '../sprites/looksContext';
import { lookTitle, roleFlavour } from '../../game/config/looks';
import { CROWN } from '../sprites/crown';
import { CrownIcon, FighterSprite } from '../sprites/icons';
import { Crowd } from '../stage/Crowd';
import { StageContext } from '../stage/stageContext';
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
  const stageId = useContext(StageContext);
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

  const winnerLine = victoryLine(f.winnerIds.map(nameOf));
  const looks = useContext(LooksContext);
  // Victory pose (owner request 2026-10-16): winners jump on the beat of the stage fanfare.
  const beatSeconds = 60 / (stageId ? FANFARES[stageId].bpm : 132);
  useEffect(() => {
    engine.fanfare(stageId);
    engine.announce(winnerLine);
    // Once when the ceremony appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);

  return (
    <main className="victory" aria-label="Victory">
      <div className="victory__fallen-field" role="group" aria-label="Knocked out during the match">
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
      {match.title && (
        <p className="prize-line victory__prize" data-testid="victory-prize">
          {match.title}
        </p>
      )}

      <div className="victory__podium">
        {losersLeft.map((id) => (
          <FinaleLoser key={id} name={nameOf(id)} />
        ))}
        <ol
          className="victory__winners"
          aria-label="Winners"
          data-testid="victory-winners"
          style={{ '--beat': `${beatSeconds.toFixed(3)}s` } as CSSProperties}
        >
          {f.winnerIds.map((id, i) => (
            <li key={id}>
              <span
                className={`victory__portrait victory__portrait--jump victory__portrait--${
                  roleFlavour(looks.get(lookKey(nameOf(id)))).pose
                }`}
                // Several winners take turns: every other one lands on the off-beat.
                style={{ animationDelay: i % 2 ? 'calc(var(--beat) * -1)' : '0s' }}
              >
                <CrownIcon size={28} />
                <FighterSprite seed={nameOf(id)} size={96} idle />
              </span>
              <span className="victory__name">{nameOf(id)}</span>
              {lookTitle(looks.get(lookKey(nameOf(id)))) && (
                <span className="victory__class">{lookTitle(looks.get(lookKey(nameOf(id))))}</span>
              )}
            </li>
          ))}
        </ol>
        {losersRight.map((id) => (
          <FinaleLoser key={id} name={nameOf(id)} />
        ))}
      </div>
      <div className="victory__crowd">
        <Crowd mood="jump" />
      </div>

      <p className="victory__summary">
        {f.rounds.length} finale round{f.rounds.length === 1 ? '' : 's'}
        {knockedOut.length > 0 && ` · ${knockedOut.length} knocked out along the way`}
      </p>
      <MatchAwards summary={summarizeMatch(toCompletedRecord(match))} />
      {saveError ? (
        <p className="banner banner--error" role="alert">
          The result could not be saved: {saveError}
        </p>
      ) : (
        <p className="victory__saved" data-testid="result-saved">
          Result saved to History.
        </p>
      )}
      <ShareCardButtons match={match} />
      <button type="button" className="button button--start victory__back" onClick={onLeave}>
        Return to setup
      </button>
      <EventLog match={match} />
    </main>
  );
}

/** "Save picture" / "Copy picture" for the office chat (owner request 2026-10-16). */
function ShareCardButtons({ match }: { readonly match: MatchState }) {
  const stageId = useContext(StageContext);
  const looks = useContext(LooksContext);
  const [status, setStatus] = useState('');
  const canCopy =
    typeof navigator !== 'undefined' &&
    typeof navigator.clipboard?.write === 'function' &&
    typeof ClipboardItem !== 'undefined';

  async function picture(): Promise<Blob | null> {
    return renderShareCard(shareCardData(match, stageId), {
      sprite: (name, look) => fighterSprite(name, look ?? looks.get(lookKey(name))),
      crown: CROWN,
    });
  }

  async function save() {
    const blob = await picture();
    if (!blob) {
      setStatus('This browser cannot make pictures.');
      return;
    }
    const name = shareCardFileName(match);
    downloadBlob(name, blob);
    setStatus(`Saved ${name}.`);
  }

  async function copy() {
    try {
      const blob = await picture();
      if (!blob) throw new Error('no canvas');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setStatus('Copied! Paste it into the chat.');
    } catch {
      setStatus('Could not copy the picture. Use Save picture instead.');
    }
  }

  return (
    <div className="share-card" data-testid="share-card">
      <button type="button" className="button" onClick={() => void save()}>
        Save picture
      </button>
      {canCopy && (
        <button type="button" className="button" onClick={() => void copy()}>
          Copy picture
        </button>
      )}
      <span className="hint" role="status">
        {status}
      </span>
    </div>
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
