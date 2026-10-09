import { useEffect, useRef, useState } from 'react';
import { ANNOUNCE } from '../../audio/announcer';
import { useSound } from '../../audio/soundContext';
import { matchIntroTimeline, type IntroBanner } from '../../animation/matchIntro';
import type { MatchPlayer } from '../../game/engine/matchTypes';
import { FighterSprite } from '../sprites/icons';

interface MatchIntroProps {
  readonly players: readonly MatchPlayer[];
  readonly timeScale: number;
  /** Finished or skipped (click, Space/Enter handled by the match screen). */
  readonly onDone: () => void;
}

/**
 * Character-select style intro (~4 s): the select cursor flashes across every portrait, then
 * "ROUND 1… FIGHT!". Decorative only; skipping it changes nothing.
 */
export function MatchIntro({ players, timeScale, onDone }: MatchIntroProps) {
  const { engine } = useSound();
  const [cursor, setCursor] = useState<number | null>(0);
  const [banner, setBanner] = useState<IntroBanner>(null);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    const { cues, doneMs } = matchIntroTimeline(players.length);
    const timers = cues.map((cue) =>
      setTimeout(() => {
        setCursor(cue.cursor);
        setBanner(cue.banner);
        if (cue.banner === 'ROUND 1') engine.announce(ANNOUNCE.roundOne);
        else if (cue.banner === 'FIGHT!') {
          engine.sfx('fight');
          engine.announce(ANNOUNCE.fight);
        } else engine.sfx('tick');
      }, cue.atMs * timeScale),
    );
    timers.push(setTimeout(() => onDoneRef.current(), doneMs * timeScale));
    return () => timers.forEach(clearTimeout);
    // Runs once per intro; the fighter list is fixed for the match.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={banner ? 'match-intro match-intro--banner' : 'match-intro'}
      data-testid="match-intro"
      role="presentation"
      onClick={() => onDoneRef.current()}
    >
      <p className="match-intro__title">Select your fate</p>
      <ul className="match-intro__grid" aria-hidden="true">
        {players.map((p, i) => (
          <li
            key={p.id}
            className={
              i === cursor ? 'match-intro__slot match-intro__slot--cursor' : 'match-intro__slot'
            }
          >
            <FighterSprite seed={p.name} size={44} idle />
            <span className="match-intro__name">{p.name}</span>
          </li>
        ))}
      </ul>
      {banner && (
        <p
          key={banner}
          className={`match-intro__banner${banner === 'FIGHT!' ? ' match-intro__banner--fight' : ''}`}
        >
          {banner}
        </p>
      )}
      <p className="match-intro__skip">Space / click to skip</p>
    </div>
  );
}
