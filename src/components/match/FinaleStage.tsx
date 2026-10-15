import {
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { ANNOUNCE } from '../../audio/announcer';
import { useSound } from '../../audio/soundContext';
import { FINALE_SPLASH_MS } from '../../animation/matchIntro';
import { StageArt } from '../stage/StageArt';
import { StageContext } from '../stage/stageContext';
import {
  CHANT_LABEL,
  finaleIntensity,
  stagePositions,
  type ChantWord,
} from '../../animation/finaleTimeline';
import { describeFinaleRound, GESTURE_LABEL } from '../../game/engine/describeEvent';
import { FINALE_TARGET_SCORE, winningGesture } from '../../game/engine/finale';
import type { FinaleThrow, MatchState } from '../../game/engine/matchTypes';
import { useFinaleShow } from '../../hooks/useFinaleShow';
import { finaleDrawStreak, isClash } from '../../animation/drawCounter';
import { Crowd } from '../stage/Crowd';
import { DrawBurst } from './DrawBurst';
import { CrownIcon, FighterSprite, HandIcon } from '../sprites/icons';
import { EventLog } from './EventLog';
import { aimAttacks, ATTACK_OF, type AttackAction } from './handAttack';
import { PauseMenu } from './PauseMenu';

const INTERACTIVE = 'button, input, textarea, select, a, [contenteditable="true"]';

interface FinaleStageProps {
  readonly match: MatchState;
  readonly timeScale: number;
  readonly saveError: string | null;
  /** D4: pause requested (takes effect after the current round). */
  readonly paused: boolean;
  readonly onTogglePause: () => void;
  readonly onBegin: () => void;
  readonly onNextRound: () => void;
  readonly onResolveRound: (roundId: string) => void;
  /** Slow-motion final blow after the deciding reveal (match already won and saved). */
  readonly finishing?: boolean;
}

/** Full-screen "1, 2, Juice!" finale. Plays back committed reveals only. */
export function FinaleStage({
  match,
  timeScale,
  saveError,
  paused,
  onTogglePause,
  onBegin,
  onNextRound,
  onResolveRound,
  finishing = false,
}: FinaleStageProps) {
  const f = match.finale!;
  const { engine, settings, toggleMute } = useSound();
  const stageId = useContext(StageContext);
  // "FINAL ROUND" splash while finalists walk in; decorative, Start works straight away.
  const [splash, setSplash] = useState(!f.started);
  useEffect(() => {
    if (!splash) return;
    engine.announce(ANNOUNCE.finalRound);
    const timer = setTimeout(() => setSplash(false), FINALE_SPLASH_MS * timeScale);
    return () => clearTimeout(timer);
    // Once per finale screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const nameOf = (id: string) => match.players.find((p) => p.id === id)?.name ?? '???';
  const show = useFinaleShow(
    match,
    timeScale,
    {
      onNextRound,
      onResolveRound,
      onBeat: (word: ChantWord) => engine.chant(word),
      onDark: (ms: number) => engine.musicDrop(ms),
    },
    paused,
  );

  const slotsLeft = match.winnerCount - f.winnerIds.length;
  const lastRound = f.rounds.at(-1) ?? null;
  const showingResult = !f.pendingRound && lastRound !== null;
  const positions = stagePositions(f.finalistIds.length);
  const holding = paused && !f.pendingRound;

  // Winning hands attack the nearest losing hand on "Juice!" (owner request; presentation only).
  const revealThrows = show.revealThrows;
  const winGesture = revealThrows ? winningGesture(revealThrows.map((t) => t.gesture)) : null;
  const action: AttackAction | null = winGesture ? ATTACK_OF[winGesture] : null;
  const revealKey = revealThrows ? (f.pendingRound?.roundId ?? lastRound?.roundId ?? '') : '';
  const arenaRef = useRef<HTMLElement>(null);
  const pending = f.pendingRound;
  // Draw counter: draws in a row in this race, counting a draw being revealed right now.
  const drawCount =
    revealThrows && !winGesture ? finaleDrawStreak(f.rounds, f.stageNumber) + (pending ? 1 : 0) : 0;
  const clash = revealThrows ? isClash(revealThrows.map((t) => t.gesture)) : false;
  // Camera: at match point it pushes in on whoever is one point from a slot.
  const leaders = f.contenderIds.filter(
    (id) => !f.winnerIds.includes(id) && (f.scores[id] ?? 0) >= FINALE_TARGET_SCORE - 1,
  );
  const focus =
    show.dark && leaders.length > 0
      ? centroid(leaders.map((id) => positions[f.finalistIds.indexOf(id)]!))
      : null;
  const impactNow = !!pending && show.word === 'JUICE' && !!winGesture;

  // Rising pace: the music speeds up with the chant (owner request); back to normal on exit.
  const paceScale = show.paceScale;
  useEffect(() => {
    engine.setMusicRate(1 / paceScale);
  }, [engine, paceScale]);
  useEffect(() => () => engine.setMusicRate(1), [engine]);
  // Music that builds: layers come in as the race tightens (owner request).
  const intensity = finaleIntensity(f);
  useEffect(() => {
    engine.setMusicIntensity(intensity);
  }, [engine, intensity]);
  useEffect(() => () => engine.setMusicIntensity(null), [engine]);
  useLayoutEffect(() => {
    if (action) aimAttacks(arenaRef.current);
  }, [action, revealKey]);

  function begin() {
    engine.unlock();
    onBegin();
  }

  // Result sounds for newly scored reveals (not for a finale restored from storage).
  const seenRounds = useRef(f.rounds.length);
  useEffect(() => {
    if (f.rounds.length > seenRounds.current && lastRound) {
      engine.sfx(
        !lastRound.winningGesture ? 'draw' : lastRound.qualifiedIds.length ? 'qualify' : 'score',
      );
    }
    seenRounds.current = f.rounds.length;
  }, [engine, f.rounds.length, lastRound]);

  useEffect(() => {
    if (f.started) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      if (event.repeat) return;
      if (event.target instanceof Element && event.target.closest(INTERACTIVE)) return;
      event.preventDefault();
      begin();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <main className="finale-stage" aria-label="Finale">
      <div className="finale-stage__main">
        <header className="finale-stage__bar">
          <h1 className="finale-stage__title">Finale</h1>
          <span>
            First to {FINALE_TARGET_SCORE} · {slotsLeft} winner slot{slotsLeft === 1 ? '' : 's'}{' '}
            left
          </span>
          {match.title && (
            <span className="prize-line" data-testid="finale-prize">
              {match.title}
            </span>
          )}
          {f.stageNumber > 1 && (
            <span className="finale-stage__tiebreak" data-testid="tiebreak">
              Tiebreak {f.stageNumber - 1}
            </span>
          )}
          <span className="finale-stage__actions">
            {f.started && (
              <button type="button" className="button button--small" onClick={onTogglePause}>
                {paused ? 'Resume' : 'Pause (Esc)'}
              </button>
            )}
            <button
              type="button"
              className="button button--small"
              aria-pressed={!settings.muted}
              onClick={toggleMute}
            >
              {settings.muted ? 'Sound off (M)' : 'Sound on (M)'}
            </button>
          </span>
        </header>

        {saveError && (
          <p className="banner banner--error" role="alert">
            {saveError}
          </p>
        )}
        {paused && f.pendingRound && (
          <p className="banner banner--warn" role="status" data-testid="pausing">
            Pausing after this round…
          </p>
        )}

        <section
          ref={arenaRef}
          className={[
            'finale-stage__arena',
            splash && !f.started ? 'finale-stage__arena--entering' : '',
            finishing ? 'finale-stage__arena--final-blow' : '',
            show.dark ? 'finale-stage__arena--last-point' : '',
            impactNow ? 'finale-stage__arena--impact' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-label="Finalists"
          data-testid="finale-arena"
          style={{ '--pace': paceScale } as CSSProperties}
        >
          <div
            className={
              focus ? 'finale-stage__camera finale-stage__camera--focus' : 'finale-stage__camera'
            }
            data-testid="finale-camera"
            style={focus ? { transformOrigin: `${focus.x}% ${focus.y}%` } : undefined}
          >
            {stageId && (
              <div className="finale-stage__backdrop" aria-hidden="true">
                <StageArt stage={stageId} />
              </div>
            )}
            <Crowd
              mood={finishing ? 'jump' : revealThrows && winGesture ? 'cheer' : 'idle'}
              cue={revealKey}
            />
            {f.finalistIds.map((id, i) => (
              <Finalist
                key={id}
                name={nameOf(id)}
                champion={!!match.championIds?.includes(id)}
                position={positions[i]!}
                score={f.scores[id] ?? 0}
                status={
                  f.winnerIds.includes(id) ? 'winner' : f.excludedIds.includes(id) ? 'out' : 'in'
                }
                word={show.word}
                revealed={show.revealThrows?.find((t: FinaleThrow) => t.playerId === id) ?? null}
                scored={showingResult && lastRound.scorerIds.includes(id)}
                action={action}
                winGesture={winGesture}
                revealKey={revealKey}
              />
            ))}
          </div>
          {show.word === 'JUICE' && (
            <span
              key={`flash:${pending?.roundId ?? 'intro'}`}
              className="finale-flash"
              aria-hidden="true"
            />
          )}
          {drawCount > 0 && <DrawBurst key={revealKey} count={drawCount} clash={clash} />}
          {splash && !f.started && (
            <p className="finale-splash" data-testid="finale-splash" aria-hidden="true">
              Final round
            </p>
          )}
          {show.dark && (
            <p className="finale-last-point" data-testid="last-point" aria-hidden="true">
              Match point
            </p>
          )}
          {finishing && (
            <p className="finale-finish" data-testid="final-blow" aria-hidden="true">
              Finish!
            </p>
          )}
          <div className="finale-stage__center">
            <p className="finale-stage__chant" data-testid="chant" aria-hidden="true">
              {show.word ? CHANT_LABEL[show.word] : f.started ? '' : '1, 2, Juice!'}
            </p>
          </div>
        </section>

        <p className="finale-stage__caption" data-testid="finale-caption" aria-live="polite">
          {showingResult ? describeFinaleRound(lastRound, nameOf) : ''}
        </p>

        {!f.started && (
          <section className="panel finale-stage__intro">
            <p>
              {f.finalistIds.length} finalists, {match.winnerCount} winner slot
              {match.winnerCount === 1 ? '' : 's'}. Everyone throws on “Juice!”. Everyone the same,
              or all three hands, is a draw. Otherwise every winning hand scores 1. First to{' '}
              {FINALE_TARGET_SCORE} takes a slot.
            </p>
            <button type="button" className="button button--start" onClick={begin}>
              Start the finale
            </button>
            <p className="hint">Rounds then run automatically. Space / Enter also starts.</p>
          </section>
        )}
      </div>

      <EventLog match={match} />

      {holding && (
        <PauseMenu
          title="Finale paused"
          message="The next round starts when you resume. Nothing already decided changes."
          onResume={onTogglePause}
        />
      )}
    </main>
  );
}

function centroid(points: readonly { x: number; y: number }[]): { x: number; y: number } {
  const n = points.length;
  return {
    x: Math.round(points.reduce((a, p) => a + p.x, 0) / n),
    y: Math.round(points.reduce((a, p) => a + p.y, 0) / n),
  };
}

interface FinalistProps {
  readonly name: string;
  /** Won the previous match (wears a small crown until someone wins this one). */
  readonly champion: boolean;
  readonly position: { x: number; y: number };
  readonly score: number;
  readonly status: 'in' | 'winner' | 'out';
  readonly word: ChantWord | null;
  readonly revealed: FinaleThrow | null;
  readonly scored: boolean;
  readonly action: AttackAction | null;
  readonly winGesture: FinaleThrow['gesture'] | null;
  readonly revealKey: string;
}

function Finalist({
  name,
  champion,
  position,
  score,
  status,
  word,
  revealed,
  scored,
  action,
  winGesture,
  revealKey,
}: FinalistProps) {
  const classes = ['finalist', `finalist--${status}`];
  if (scored) classes.push('finalist--scored');
  const bouncing = status === 'in' && !revealed && (word === 'ONE' || word === 'TWO');
  const role =
    action && revealed && status !== 'winner'
      ? revealed.gesture === winGesture
        ? 'winner'
        : 'loser'
      : null;
  const handClasses = ['finalist__hand'];
  if (bouncing) handClasses.push('finalist__hand--bounce');
  if (role === 'winner') handClasses.push('hand-attack', `hand-attack--${action}`);
  if (role === 'loser') handClasses.push('hand-hit', `hand-hit--${action}`);
  return (
    <div
      className={classes.join(' ')}
      style={{ left: `${position.x}%`, top: `${position.y}%` }}
      data-testid="finalist"
      data-status={status}
      data-score={score}
      data-gesture={revealed?.gesture}
    >
      <div className="finalist__figure">
        {status === 'winner' && <CrownIcon size={26} />}
        {champion && status !== 'winner' && (
          <span className="champion-crown" title="Last match's champion">
            <CrownIcon size={16} />
          </span>
        )}
        <FighterSprite seed={name} size={56} idle={status !== 'out'} />
        {/* Hand sits below the fighter (owner request), large enough to read on a screenshare. */}
        {status !== 'winner' && (
          <span
            key={bouncing ? word : `still:${revealKey}:${role ?? ''}`}
            className={handClasses.join(' ')}
            data-attack={role ?? undefined}
          >
            <HandIcon gesture={revealed?.gesture ?? 'ROCK'} size={52} />
          </span>
        )}
      </div>
      <span className="finalist__name">{name}</span>
      {status === 'winner' && <span className="finalist__badge">Winner</span>}
      {status === 'out' && <span className="finalist__badge">Out</span>}
      {status === 'in' && (
        <span
          className="finalist__pips"
          role="img"
          aria-label={`${score} of ${FINALE_TARGET_SCORE} points`}
        >
          {Array.from({ length: FINALE_TARGET_SCORE }, (_, i) => (
            <span key={i} className={i < score ? 'pip pip--gold' : 'pip'} />
          ))}
        </span>
      )}
      {revealed && status === 'in' && (
        <span className="finalist__gesture">{GESTURE_LABEL[revealed.gesture]}</span>
      )}
    </div>
  );
}
