import { useEffect, useState } from 'react';
import { spinStartId } from '../../animation/spinPlan';
import { fateStartIndex } from '../../animation/turnTimeline';
import { FATE_PRESETS } from '../../game/config/presets';
import { alivePlayers } from '../../game/engine/match';
import type { MatchState } from '../../game/engine/matchTypes';
import { useTurnAnimation } from '../../hooks/useTurnAnimation';
import { DuelPanel } from './DuelPanel';
import { FateStrip } from './FateStrip';
import { EventLog } from './EventLog';
import { FighterGrid } from './FighterGrid';
import { useSound } from '../../hooks/useSound';
import { FinaleStage } from './FinaleStage';
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
  // Lives across finale → victory so one unlocked audio context is reused.
  const sound = useSound();
  const alive = alivePlayers(match);
  const animation = useTurnAnimation(
    match.pendingTurn,
    alive.map((p) => p.id),
    spinStartId(match.players, match.lastTurn?.turn.playerId ?? null),
    fateStartIndex(match.lastTurn?.turn.fateSlotIndex ?? null),
    timeScale,
    onSpinComplete,
  );
  const highlightId = animation.playerCursorId;
  const duel = match.pendingTurn?.duel ?? null;
  const nameOf = (id: string) => match.players.find((p) => p.id === id)?.name ?? '???';
  const canSpin = match.phase === 'READY' && !confirmingAbandon;

  // Space/Enter start the next turn, except when a control has focus (it handles its own keys).
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      if (event.repeat || !canSpin) return;
      if (event.target instanceof Element && event.target.closest(INTERACTIVE)) return;
      event.preventDefault();
      onSpin();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canSpin, onSpin]);

  if (match.phase === 'FINALE') {
    return (
      <FinaleStage
        match={match}
        timeScale={timeScale}
        sound={sound}
        saveError={saveError}
        onBegin={onBeginFinale}
        onNextRound={onNextFinaleRound}
        onResolveRound={onResolveFinaleRound}
      />
    );
  }
  if (match.phase === 'VICTORY') {
    return <VictoryScreen match={match} sound={sound} saveError={saveError} onLeave={onLeave} />;
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
          {confirmingAbandon ? (
            <>
              <span>Abandon? Not recorded.</span>
              <button
                type="button"
                className="button button--small button--danger"
                onClick={onLeave}
              >
                Yes, abandon
              </button>
              <button
                type="button"
                className="button button--small"
                onClick={() => setConfirmingAbandon(false)}
              >
                Keep playing
              </button>
            </>
          ) : (
            <button
              type="button"
              className="button button--small"
              disabled={match.phase !== 'READY'}
              onClick={() => setConfirmingAbandon(true)}
            >
              Abandon match
            </button>
          )}
        </span>
      </header>

      {saveError && (
        <p className="banner banner--error" role="alert">
          {saveError}
        </p>
      )}

      {duel && animation.duelThrowIndex !== null ? (
        <DuelPanel
          challengerName={nameOf(match.pendingTurn!.playerId)}
          opponentName={nameOf(duel.opponentId)}
          duel={duel}
          throwIndex={animation.duelThrowIndex}
        />
      ) : (
        <PreviewPanel match={match} highlightId={highlightId} />
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
          opponentId={animation.duelThrowIndex !== null ? (duel?.opponentId ?? null) : null}
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
            Click ? or press Space / Enter. Shuffle moves fighters and Fate slots; odds stay equal.
          </p>
        </div>
      </section>

      <EventLog match={match} />
    </main>
  );
}
