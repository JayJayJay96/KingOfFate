import { useEffect, useRef, useState } from 'react';
import { useSound } from '../../audio/soundContext';
import type { SfxName } from '../../audio/soundEngine';
import { spinStartId } from '../../animation/spinPlan';
import { fateStartIndex } from '../../animation/turnTimeline';
import { FATE_PRESETS } from '../../game/config/presets';
import { alivePlayers } from '../../game/engine/match';
import type { MatchState, ResolvedTurn } from '../../game/engine/matchTypes';
import { useTurnAnimation, type TurnCue } from '../../hooks/useTurnAnimation';
import { DuelPanel } from './DuelPanel';
import { EventLog } from './EventLog';
import { FateStrip } from './FateStrip';
import { FighterGrid } from './FighterGrid';
import { FinaleStage } from './FinaleStage';
import { PauseMenu } from './PauseMenu';
import { PreviewPanel } from './PreviewPanel';
import { VictoryScreen } from './VictoryScreen';

interface MatchScreenProps {
  readonly match: MatchState;
  readonly timeScale: number;
  readonly saveError: string | null;
  readonly onSpin: () => void;
  readonly onShuffle: () => void;
  readonly onSpinComplete: (turnId: string) => void;
  readonly onBeginFinale: () => void;
  readonly onNextFinaleRound: () => void;
  readonly onResolveFinaleRound: (roundId: string) => void;
  readonly onLeave: () => void;
}

const INTERACTIVE = 'button, input, textarea, select, a, [contenteditable="true"]';

function outcomeSfx(last: ResolvedTurn): SfxName {
  const o = last.outcome;
  if (o.fate === 'KO') return o.result === 'ELIMINATED' ? 'ko' : 'blocked';
  if (o.fate === 'SHIELD') return o.result === 'GAINED' ? 'shield' : 'wasted';
  return o.loserResult === 'ELIMINATED' ? 'ko' : 'blocked';
}

export function MatchScreen({
  match,
  timeScale,
  saveError,
  onSpin,
  onShuffle,
  onSpinComplete,
  onBeginFinale,
  onNextFinaleRound,
  onResolveFinaleRound,
  onLeave,
}: MatchScreenProps) {
  const [confirmingAbandon, setConfirmingAbandon] = useState(false);
  /** Normal play: Esc menu open. Finale: pause requested (D4). */
  const [paused, setPaused] = useState(false);
  const { engine, toggleMute } = useSound();
  const alive = alivePlayers(match);
  const duel = match.pendingTurn?.duel ?? null;

  const onCue = (cue: TurnCue) => {
    if (cue.kind === 'player' || cue.kind === 'opponent') engine.sfx('tick');
    else if (cue.kind === 'fate') engine.sfx('fateTick');
    else if (cue.kind === 'vsAnnounce') engine.sfx('vs');
    else if (cue.kind === 'duelIntro') engine.sfx('clash');
    else {
      const t = duel?.throws[cue.index];
      engine.sfx(t && t.challenger === t.opponent ? 'draw' : 'clash');
    }
  };

  const animation = useTurnAnimation(
    match.pendingTurn,
    alive.map((p) => p.id),
    spinStartId(match.players, match.lastTurn?.turn.playerId ?? null),
    fateStartIndex(match.lastTurn?.turn.fateSlotIndex ?? null),
    timeScale,
    onSpinComplete,
    onCue,
  );
  const highlightId = animation.playerCursorId;
  const stage = animation.stage;
  const nameOf = (id: string) => match.players.find((p) => p.id === id)?.name ?? '???';
  const inOrdinaryPlay = match.phase === 'READY' || match.phase === 'SPINNING';
  const canSpin = match.phase === 'READY' && !confirmingAbandon && !paused;

  // Background music follows the phase; it holds while paused.
  const finaleStarted = !!match.finale?.started;
  useEffect(() => {
    engine.setMusic(
      inOrdinaryPlay ? 'select' : match.phase === 'FINALE' && finaleStarted ? 'finale' : null,
    );
  }, [engine, inOrdinaryPlay, match.phase, finaleStarted]);
  useEffect(() => () => engine.setMusic(null), [engine]);
  useEffect(() => {
    engine.setPaused(paused);
  }, [engine, paused]);

  // Outcome sounds for newly resolved turns (not for a match restored from storage).
  const lastTurnId = match.lastTurn?.turn.turnId ?? null;
  const seenTurn = useRef(lastTurnId);
  useEffect(() => {
    if (lastTurnId && lastTurnId !== seenTurn.current && match.lastTurn) {
      engine.sfx(outcomeSfx(match.lastTurn));
    }
    seenTurn.current = lastTurnId;
  }, [engine, lastTurnId, match.lastTurn]);
  const seenSuddenDeath = useRef(match.suddenDeath);
  useEffect(() => {
    if (match.suddenDeath && !seenSuddenDeath.current) engine.sfx('suddenDeath');
    seenSuddenDeath.current = match.suddenDeath;
  }, [engine, match.suddenDeath]);

  // Keyboard: Space/Enter spin, S shuffle, M mute, Esc menu / finale pause.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat) return;
      const inControl = event.target instanceof Element && !!event.target.closest(INTERACTIVE);
      const key = event.key.toLowerCase();
      if (key === 'escape') {
        if (inOrdinaryPlay || (match.phase === 'FINALE' && finaleStarted)) {
          event.preventDefault();
          setPaused((p) => !p);
        }
        return;
      }
      if (inControl) return;
      if (key === 'm') toggleMute();
      else if (key === 's' && canSpin) onShuffle();
      else if ((key === ' ' || key === 'enter') && canSpin) {
        event.preventDefault();
        onSpin();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canSpin, onSpin, onShuffle, toggleMute, inOrdinaryPlay, match.phase, finaleStarted]);

  if (match.phase === 'FINALE') {
    return (
      <FinaleStage
        match={match}
        timeScale={timeScale}
        saveError={saveError}
        paused={paused}
        onTogglePause={() => setPaused((p) => !p)}
        onBegin={onBeginFinale}
        onNextRound={onNextFinaleRound}
        onResolveRound={onResolveFinaleRound}
      />
    );
  }
  if (match.phase === 'VICTORY') {
    return <VictoryScreen match={match} saveError={saveError} onLeave={onLeave} />;
  }

  return (
    <main className="match">
      <header className="match__bar">
        <span className="match__logo">King of Fate</span>
        <span>Turn {match.completedTurns + 1}</span>
        <span data-testid="alive-count">
          {alive.length} / {match.players.length} alive
        </span>
        <span>
          {match.winnerCount} winner{match.winnerCount === 1 ? '' : 's'}
        </span>
        <span>{FATE_PRESETS[match.presetId].label}</span>
        {match.suddenDeath && <span className="match__sudden-death">Sudden Death</span>}
        <span className="match__bar-actions">
          <button type="button" className="button button--small" onClick={() => setPaused(true)}>
            Menu (Esc)
          </button>
        </span>
      </header>

      {saveError && (
        <p className="banner banner--error" role="alert">
          {saveError}
        </p>
      )}

      {duel && (stage === 'vs' || stage === 'opponent' || stage === 'duel') ? (
        <DuelPanel
          mode={stage === 'vs' ? 'announce' : stage === 'opponent' ? 'pick' : 'fight'}
          challengerName={nameOf(match.pendingTurn!.playerId)}
          opponentName={animation.opponentCursorId ? nameOf(animation.opponentCursorId) : null}
          duel={duel}
          throwIndex={animation.duelThrowIndex ?? -1}
        />
      ) : (
        <PreviewPanel match={match} highlightId={highlightId} stage={stage} />
      )}

      <FateStrip
        slots={match.fateSlots}
        cursorIndex={animation.fateCursorIndex}
        lastSlotIndex={match.lastTurn?.turn.fateSlotIndex ?? null}
        suddenDeath={match.suddenDeath}
        noEliminationStreak={match.noEliminationStreak}
      />

      <section className="panel arena">
        <FighterGrid
          players={match.players}
          highlightId={highlightId}
          opponentId={animation.opponentCursorId}
          lastTargetId={match.lastTurn?.turn.playerId ?? null}
        />
        <div className="arena__controls">
          <div className="arena__buttons">
            <button
              type="button"
              className="random-button"
              aria-label="Random: start the next turn"
              disabled={!canSpin}
              onClick={onSpin}
            >
              ?
            </button>
            <button
              type="button"
              className="button shuffle-button"
              title="Shuffle fighter and Fate positions (does not change anyone's odds)"
              disabled={!canSpin}
              onClick={onShuffle}
            >
              Shuffle
            </button>
          </div>
          <p className="hint">
            Space / Enter: spin · S: shuffle · M: mute · Esc: menu. Shuffle never changes odds.
          </p>
        </div>
      </section>

      <EventLog match={match} />

      {paused && (
        <PauseMenu
          title="Paused"
          message={
            match.phase === 'SPINNING'
              ? 'The current spin keeps going; its result is already decided.'
              : undefined
          }
          onResume={() => {
            setPaused(false);
            setConfirmingAbandon(false);
          }}
        >
          {confirmingAbandon ? (
            <>
              <button type="button" className="button button--danger" onClick={onLeave}>
                Yes, abandon (not recorded)
              </button>
              <button type="button" className="button" onClick={() => setConfirmingAbandon(false)}>
                Keep playing
              </button>
            </>
          ) : (
            <button
              type="button"
              className="button"
              disabled={match.phase !== 'READY'}
              onClick={() => setConfirmingAbandon(true)}
            >
              Abandon match
            </button>
          )}
        </PauseMenu>
      )}
    </main>
  );
}
