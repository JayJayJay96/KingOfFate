import { useEffect, useRef } from 'react';
import { useSound } from '../../audio/soundContext';
import { CHANT_LABEL, stagePositions, type ChantWord } from '../../animation/finaleTimeline';
import { describeFinaleRound, GESTURE_LABEL } from '../../game/engine/describeEvent';
import { FINALE_TARGET_SCORE } from '../../game/engine/finale';
import type { FinaleThrow, MatchState } from '../../game/engine/matchTypes';
import { useFinaleShow } from '../../hooks/useFinaleShow';
import { CrownIcon, FighterSprite, HandIcon } from '../sprites/icons';
import { EventLog } from './EventLog';
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
}

/** Full-screen Một Hai Ba Yo finale. Plays back committed reveals only. */
export function FinaleStage({
  match,
  timeScale,
  saveError,
  paused,
  onTogglePause,
  onBegin,
  onNextRound,
  onResolveRound,
}: FinaleStageProps) {
  const f = match.finale!;
  const { engine, settings, toggleMute } = useSound();
  const nameOf = (id: string) => match.players.find((p) => p.id === id)?.name ?? '???';
  const show = useFinaleShow(
    match,
    timeScale,
    { onNextRound, onResolveRound, onBeat: (word: ChantWord) => engine.chant(word) },
    paused,
  );

  const slotsLeft = match.winnerCount - f.winnerIds.length;
  const lastRound = f.rounds.at(-1) ?? null;
  const showingResult = !f.pendingRound && lastRound !== null;
  const positions = stagePositions(f.finalistIds.length);
  const holding = paused && !f.pendingRound;

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
      <header className="finale-stage__bar">
        <h1 className="finale-stage__title">Finale</h1>
        <span>
          First to {FINALE_TARGET_SCORE} · {slotsLeft} winner slot{slotsLeft === 1 ? '' : 's'} left
        </span>
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

      <section className="finale-stage__arena" aria-label="Finalists">
        {f.finalistIds.map((id, i) => (
          <Finalist
            key={id}
            name={nameOf(id)}
            position={positions[i]!}
            score={f.scores[id] ?? 0}
            status={f.winnerIds.includes(id) ? 'winner' : f.excludedIds.includes(id) ? 'out' : 'in'}
            word={show.word}
            revealed={show.revealThrows?.find((t: FinaleThrow) => t.playerId === id) ?? null}
            scored={showingResult && lastRound.scorerIds.includes(id)}
          />
        ))}
        <div className="finale-stage__center">
          <p className="finale-stage__chant" data-testid="chant" aria-hidden="true">
            {show.word ? CHANT_LABEL[show.word] : f.started ? '' : 'Một Hai Ba Yo!'}
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
            {match.winnerCount === 1 ? '' : 's'}. Everyone throws on “Yo!”. Everyone the same, or
            all three hands, is a draw. Otherwise every winning hand scores 1. First to{' '}
            {FINALE_TARGET_SCORE} takes a slot.
          </p>
          <button type="button" className="button button--start" onClick={begin}>
            Start the finale
          </button>
          <p className="hint">Rounds then run automatically. Space / Enter also starts.</p>
        </section>
      )}

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

interface FinalistProps {
  readonly name: string;
  readonly position: { x: number; y: number };
  readonly score: number;
  readonly status: 'in' | 'winner' | 'out';
  readonly word: ChantWord | null;
  readonly revealed: FinaleThrow | null;
  readonly scored: boolean;
}

function Finalist({ name, position, score, status, word, revealed, scored }: FinalistProps) {
  const classes = ['finalist', `finalist--${status}`];
  if (scored) classes.push('finalist--scored');
  const bouncing = status === 'in' && !revealed && (word === 'HAI' || word === 'BA');
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
        <FighterSprite seed={name} size={56} />
        {/* Hand sits below the fighter (owner request), large enough to read on a screenshare. */}
        {status !== 'winner' && (
          <span
            key={bouncing ? word : 'still'}
            className={bouncing ? 'finalist__hand finalist__hand--bounce' : 'finalist__hand'}
          >
            <HandIcon gesture={revealed?.gesture ?? 'ROCK'} size={52} />
          </span>
        )}
      </div>
      <span className="finalist__name">{name}</span>
      {status === 'winner' && <span className="finalist__badge">Winner</span>}
      {status === 'out' && <span className="finalist__badge">Out</span>}
      {status === 'in' && (
        <span className="finalist__pips" aria-label={`${score} of ${FINALE_TARGET_SCORE} points`}>
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
