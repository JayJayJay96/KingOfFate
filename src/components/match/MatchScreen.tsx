import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ANNOUNCE,
  IMPACT_LINE,
  IMPACT_STAMP,
  turnImpact,
  type ImpactKind,
} from '../../audio/announcer';
import { useSound } from '../../audio/soundContext';
import { FINAL_BLOW_MS } from '../../animation/matchIntro';
import { spinStartId } from '../../animation/spinPlan';
import { fateStartIndex } from '../../animation/turnTimeline';
import { FATE_PRESETS } from '../../game/config/presets';
import { alivePlayers, eliminatedThisTurn, shieldSupplyFor } from '../../game/engine/match';
import type { MatchState } from '../../game/engine/matchTypes';
import { useTurnAnimation, type TurnCue } from '../../hooks/useTurnAnimation';
import { DuelPanel } from './DuelPanel';
import { EventLog } from './EventLog';
import { FateStrip } from './FateStrip';
import { FighterGrid } from './FighterGrid';
import { FinaleStage } from './FinaleStage';
import { MatchIntro } from './MatchIntro';
import { PauseMenu } from './PauseMenu';
import { PreviewPanel } from './PreviewPanel';
import { VictoryScreen } from './VictoryScreen';
import { Crowd } from '../stage/Crowd';

interface MatchScreenProps {
  readonly match: MatchState;
  readonly timeScale: number;
  /** Turbo spins (setup toggle). */
  readonly turbo?: boolean;
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

/** How long the K.O. stamp / sparks / shake stay on screen after a turn resolves. */
const IMPACT_MS = 1100;

export function MatchScreen({
  match,
  timeScale,
  turbo = false,
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
  /** Intro shown (or skipped) for this match; it plays once per match screen at turn 0. */
  const [introDoneFor, setIntroDoneFor] = useState<string | null>(null);
  // Effects are derived during render (no one-frame flash of the next screen). A turn or victory
  // that was already on screen when the match was restored from storage plays no effect.
  const lastTurnId = match.lastTurn?.turn.turnId ?? null;
  const [impactDoneFor, setImpactDoneFor] = useState(lastTurnId);
  const impact =
    match.lastTurn && lastTurnId !== impactDoneFor
      ? {
          turnId: lastTurnId!,
          kind: turnImpact(match.lastTurn),
          fallenIds: eliminatedThisTurn(match.lastTurn),
        }
      : null;
  /** Slow-motion final blow between the last finale reveal and the ceremony. */
  const [finishedFor, setFinishedFor] = useState(match.phase === 'VICTORY' ? match.matchId : null);
  const finishing = match.phase === 'VICTORY' && finishedFor !== match.matchId;
  const alive = alivePlayers(match);
  const showIntro =
    match.phase === 'READY' && match.completedTurns === 0 && introDoneFor !== match.matchId;
  const duel = match.pendingTurn?.duel ?? null;

  const onCue = (cue: TurnCue) => {
    if (cue.kind === 'player' || cue.kind === 'opponent') engine.sfx('tick');
    else if (cue.kind === 'fate') engine.sfx('fateTick');
    else if (cue.kind === 'bomb') engine.sfx('fuse');
    else if (cue.kind === 'vsAnnounce') {
      engine.sfx('vs');
      engine.announce(ANNOUNCE.versus);
    } else if (cue.kind === 'duelIntro') engine.sfx('clash');
    // Owner request: the count is a beat only (no spoken words).
    else if (cue.kind === 'duelCount') engine.sfx('count');
    else {
      // SCISSORS beat: the hands are revealed.
      const t = duel?.throws[cue.index];
      engine.sfx('count');
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
    turbo,
  );
  const highlightId = animation.playerCursorId;
  const stage = animation.stage;
  const nameOf = (id: string) => match.players.find((p) => p.id === id)?.name ?? '???';
  const inOrdinaryPlay = match.phase === 'READY' || match.phase === 'SPINNING';
  const canSpin = match.phase === 'READY' && !confirmingAbandon && !paused && !showIntro;

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

  // Outcome sound, announcer and K.O. effects for a newly resolved turn.
  const impactKind = impact?.kind ?? null;
  const impactTurnId = impact?.turnId ?? null;
  useEffect(() => {
    if (!impactTurnId || !impactKind) return;
    engine.sfx(impactKind);
    engine.announce(IMPACT_LINE[impactKind]);
    const timer = setTimeout(() => setImpactDoneFor(impactTurnId), IMPACT_MS * timeScale);
    return () => clearTimeout(timer);
  }, [engine, impactTurnId, impactKind, timeScale]);
  const seenSuddenDeath = useRef(match.suddenDeath);
  useEffect(() => {
    if (match.suddenDeath && !seenSuddenDeath.current) {
      engine.sfx('suddenDeath');
      engine.announce(ANNOUNCE.suddenDeath);
    }
    seenSuddenDeath.current = match.suddenDeath;
  }, [engine, match.suddenDeath]);

  // The finale's last reveal gets a slow-motion final blow before the ceremony. The result is
  // already committed and saved; this only delays the victory screen.
  const matchId = match.matchId;
  useEffect(() => {
    if (!finishing) return;
    engine.announce(ANNOUNCE.finish);
    engine.sfx('ko');
    const timer = setTimeout(() => setFinishedFor(matchId), FINAL_BLOW_MS * timeScale);
    return () => clearTimeout(timer);
  }, [engine, finishing, matchId, timeScale]);

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
      if (showIntro && (key === ' ' || key === 'enter')) {
        // Space/Enter skips the intro (owner decision); it does not also start a turn.
        event.preventDefault();
        setIntroDoneFor(match.matchId);
        return;
      }
      if (key === 'm') toggleMute();
      else if (key === 's' && canSpin) onShuffle();
      else if ((key === ' ' || key === 'enter') && canSpin) {
        event.preventDefault();
        onSpin();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    canSpin,
    onSpin,
    onShuffle,
    toggleMute,
    inOrdinaryPlay,
    match.phase,
    match.matchId,
    finaleStarted,
    showIntro,
  ]);

  // The K.O. that reaches W + 1 is shown before the screen hands over to the finale.
  const holdForImpact = match.phase === 'FINALE' && impact !== null;

  if ((match.phase === 'FINALE' && !holdForImpact) || (match.phase === 'VICTORY' && finishing)) {
    return (
      <FinaleStage
        finishing={finishing}
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
    <main
      className={impact?.kind === 'ko' || impact?.kind === 'boom' ? 'match match--shake' : 'match'}
    >
      <div className="match__main">
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
            word={animation.duelWord}
          />
        ) : (
          <div className="preview-wrap">
            <PreviewPanel match={match} highlightId={highlightId} stage={stage} />
            {animation.fast && stage === 'player' && (
              <span className="speed-lines" data-testid="speed-lines" aria-hidden="true" />
            )}
            <Crowd
              mood={impact?.kind === 'ko' || impact?.kind === 'boom' ? 'cheer' : 'idle'}
              cue={impact?.turnId ?? ''}
            />
            {impact && <ImpactBurst key={impact.turnId} kind={impact.kind} />}
          </div>
        )}

        <FateStrip
          slots={match.fateSlots}
          cursorIndex={animation.fateCursorIndex}
          lastSlotIndex={match.lastTurn?.turn.fateSlotIndex ?? null}
          suddenDeath={match.suddenDeath}
          shieldSupply={match.shieldSupply}
          shieldSupplyTotal={shieldSupplyFor(match.players.length)}
          suddenDeathAt={match.suddenDeathAt}
          finaleAt={match.winnerCount + 1}
        />

        <section className="panel arena">
          <FighterGrid
            players={match.players}
            championIds={match.championIds}
            highlightId={highlightId}
            opponentId={animation.opponentCursorId}
            lastTargetId={match.lastTurn?.turn.playerId ?? null}
            fallingIds={impact?.fallenIds ?? []}
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
      </div>

      <EventLog match={match} />

      {showIntro && (
        <MatchIntro
          players={match.players}
          timeScale={timeScale}
          title={match.title}
          championIds={match.championIds}
          onDone={() => setIntroDoneFor(match.matchId)}
        />
      )}

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

/** Big stamp, hit sparks and a flash over the preview. Decorative only. */
function ImpactBurst({ kind }: { readonly kind: ImpactKind }) {
  const sparks = kind === 'boom' ? 18 : 10;
  return (
    <div
      className={`impact impact--${kind}`}
      data-testid="impact"
      data-kind={kind}
      aria-hidden="true"
    >
      {(kind === 'ko' || kind === 'boom') && <span className="impact__flash" />}
      {(kind === 'ko' || kind === 'boom' || kind === 'blocked') &&
        Array.from({ length: sparks }, (_, i) => {
          const angle = (i / sparks) * Math.PI * 2;
          const style = {
            '--dx': `${Math.round(Math.cos(angle) * 120)}px`,
            '--dy': `${Math.round(Math.sin(angle) * 80)}px`,
          } as CSSProperties;
          return <span key={i} className="impact__spark" style={style} />;
        })}
      <span className="impact__stamp">{IMPACT_STAMP[kind]}</span>
    </div>
  );
}
