import { useEffect } from 'react';
import { CHANT_LABEL, stagePositions, type ChantWord } from '../../animation/finaleTimeline';
import { describeFinaleRound, GESTURE_LABEL } from '../../game/engine/describeEvent';
import { FINALE_TARGET_SCORE } from '../../game/engine/finale';
import type { FinaleThrow, MatchState } from '../../game/engine/matchTypes';
import type { Gesture } from '../../game/engine/rps';
import { useFinaleShow } from '../../hooks/useFinaleShow';
import type { SoundControl } from '../../hooks/useSound';
import { EventLog } from './EventLog';

const GESTURE_ICON: Readonly<Record<Gesture, string>> = { ROCK: '✊', PAPER: '✋', SCISSORS: '✌️' };
const INTERACTIVE = 'button, input, textarea, select, a, [contenteditable="true"]';

interface FinaleStageProps {
  readonly match: MatchState;
  readonly timeScale: number;
  readonly sound: SoundControl;
  readonly saveError: string | null;
  readonly onBegin: () => void;
  readonly onNextRound: () => void;
  readonly onResolveRound: (roundId: string) => void;
}

/** Full-screen Một Hai Ba Yo finale. Plays back committed reveals only. */
export function FinaleStage({
  match,
  timeScale,
  sound,
  saveError,
  onBegin,
  onNextRound,
  onResolveRound,
}: FinaleStageProps) {
  const f = match.finale!;
  const nameOf = (id: string) => match.players.find((p) => p.id === id)?.name ?? '???';
  const show = useFinaleShow(match, timeScale, {
    onNextRound,
    onResolveRound,
    onBeat: (word: ChantWord) => sound.audio.chant(word),
  });

  const slotsLeft = match.winnerCount - f.winnerIds.length;
  const lastRound = f.rounds.at(-1) ?? null;
  const showingResult = !f.pendingRound && lastRound !== null;
  const positions = stagePositions(f.finalistIds.length);

  function begin() {
    sound.unlock();
    sound.audio.startMusic();
    onBegin();
  }

  // Background drone while the finale runs (once audio has been unlocked by a click).
  useEffect(() => {
    if (f.started && sound.unlocked) sound.audio.startMusic();
  }, [f.started, sound.unlocked, sound.audio]);

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
        <button
          type="button"
          className="button button--small finale-stage__sound"
          aria-pressed={sound.enabled}
          onClick={sound.toggle}
          title={sound.audio.available ? 'Placeholder sound effects' : 'Sound is not available'}
          disabled={!sound.audio.available}
        >
          {sound.audio.available ? (sound.enabled ? '🔊 Sound on' : '🔇 Sound off') : 'No sound'}
        </button>
      </header>

      {saveError && (
        <p className="banner banner--error" role="alert">
          {saveError}
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
    >
      <span
        key={bouncing ? word : 'still'}
        className={bouncing ? 'finalist__hand finalist__hand--bounce' : 'finalist__hand'}
        aria-hidden="true"
      >
        {status === 'winner' ? '👑' : revealed ? GESTURE_ICON[revealed.gesture] : '✊'}
      </span>
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
