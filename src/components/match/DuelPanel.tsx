import { useContext, useLayoutEffect, useRef, type CSSProperties } from 'react';
import { roleFlavour } from '../../game/config/looks';
import { LooksContext, lookKey } from '../sprites/looksContext';
import type { DuelWord } from '../../animation/turnTimeline';
import { GESTURE_LABEL } from '../../game/engine/describeEvent';
import type { CommittedDuel } from '../../game/engine/matchTypes';
import { beats, type Gesture } from '../../game/engine/rps';
import { FighterSprite, HandIcon } from '../sprites/icons';
import { aimAttacks, ATTACK_OF, type AttackAction } from './handAttack';
import { DrawBurst } from './DrawBurst';

interface DuelPanelProps {
  /**
   * announce: "VS!" with a mystery opponent; pick: the opponent cursor is choosing;
   * fight: the committed throws play back.
   */
  readonly mode: 'announce' | 'pick' | 'fight';
  readonly challengerName: string;
  /** Opponent shown so far (the cursor's current fighter while picking), or null. */
  readonly opponentName: string | null;
  readonly duel: CommittedDuel;
  /** fight mode: -1 = fists up (intro or counting), otherwise index of the throw revealed. */
  readonly throwIndex: number;
  /** ROCK / PAPER / SCISSORS count word on screen (owner request: count before every reveal). */
  readonly word?: DuelWord | null;
}

const WORD_LABEL: Readonly<Record<DuelWord, string>> = {
  ROCK: 'Rock…',
  PAPER: 'Paper…',
  SCISSORS: 'Scissors!',
};

/** Plays back the already-committed VS. Never samples anything. */
export function DuelPanel({
  mode,
  challengerName,
  opponentName,
  duel,
  throwIndex,
  word = null,
}: DuelPanelProps) {
  const current = mode === 'fight' && throwIndex >= 0 ? duel.throws[throwIndex] : undefined;
  const decisive = current && current.challenger !== current.opponent ? current : undefined;
  const challengerWon = decisive ? beats(decisive.challenger, decisive.opponent) : false;
  const action: AttackAction | null = decisive
    ? ATTACK_OF[challengerWon ? decisive.challenger : decisive.opponent]
    : null;
  const counting = mode === 'fight' && !current && word !== null;

  let caption = 'Rock · Paper · Scissors!';
  if (mode === 'announce') caption = `${challengerName} must fight… who?`;
  else if (mode === 'pick') caption = 'Choosing an opponent…';
  else if (counting) caption = WORD_LABEL[word];
  else if (current && !decisive) caption = 'Draw! Throw again…';
  else if (decisive) {
    const [w, l] = challengerWon
      ? [decisive.challenger, decisive.opponent]
      : [decisive.opponent, decisive.challenger];
    caption = `${GESTURE_LABEL[w]} beats ${GESTURE_LABEL[l]}! ${
      challengerWon ? challengerName : opponentName
    } wins!`;
  }

  // Aim the winning hand at the losing one once both are on screen.
  const panelRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (decisive) aimAttacks(panelRef.current);
  }, [decisive, throwIndex]);

  const role = (isChallenger: boolean): 'winner' | 'loser' | null =>
    decisive ? (isChallenger === challengerWon ? 'winner' : 'loser') : null;

  return (
    <section
      ref={panelRef}
      className={`panel duel duel--${mode}`}
      aria-label="VS duel"
      data-testid="duel"
    >
      <div className="duel__fighters">
        <Side
          name={challengerName}
          gesture={current?.challenger}
          showHand={mode === 'fight'}
          bounce={counting ? word : null}
          role={role(true)}
          action={action}
          revealKey={throwIndex}
        />
        <span className="duel__vs">
          {mode === 'announce' ? (
            'VS!'
          ) : counting || (current && word) ? (
            <span key={word ?? ''} className="duel__count" data-testid="duel-count">
              {word === 'SCISSORS' ? 'SCISSORS!' : word}
            </span>
          ) : (
            'VS'
          )}
        </span>
        {opponentName && mode !== 'announce' ? (
          <Side
            name={opponentName}
            gesture={current?.opponent}
            showHand={mode === 'fight'}
            bounce={counting ? word : null}
            role={role(false)}
            action={action}
            revealKey={throwIndex}
          />
        ) : (
          <div className="duel__side duel__side--mystery" aria-hidden="true">
            <span className="duel__mystery">?</span>
            <span className="duel__name">???</span>
          </div>
        )}
      </div>
      {/* Draws come first, so this throw's number is the draw count; a duel draw is always a clash. */}
      {current && !decisive && <DrawBurst key={throwIndex} count={throwIndex + 1} clash />}
      <p className="duel__caption" aria-live="polite">
        {caption}
      </p>
    </section>
  );
}

function Side({
  name,
  gesture,
  showHand,
  bounce,
  role,
  action,
  revealKey,
}: {
  readonly name: string;
  readonly gesture?: Gesture;
  readonly showHand: boolean;
  /** Count word while fists bounce, or null. */
  readonly bounce: DuelWord | null;
  readonly role: 'winner' | 'loser' | null;
  readonly action: AttackAction | null;
  readonly revealKey: number;
}) {
  const flavour = roleFlavour(useContext(LooksContext).get(lookKey(name)));
  const classes = ['duel__hand'];
  if (bounce) classes.push('duel__hand--bounce');
  if (role === 'winner' && action) classes.push('hand-attack', `hand-attack--${action}`);
  if (role === 'loser' && action) classes.push('hand-hit', `hand-hit--${action}`);
  return (
    <div className="duel__side">
      <span className="duel__figure">
        <FighterSprite seed={name} size={72} idle />
        {showHand && (
          <span
            key={`${revealKey}:${bounce ?? ''}`}
            className={classes.join(' ')}
            data-attack={role ?? undefined}
            data-fx={role === 'winner' && action && flavour.fx ? flavour.fx : undefined}
            style={{ '--fx-glow': flavour.glow } as CSSProperties}
          >
            <HandIcon gesture={gesture ?? 'ROCK'} size={60} />
          </span>
        )}
      </span>
      <span className="duel__name">{name}</span>
      <span className="duel__gesture">{gesture ? GESTURE_LABEL[gesture] : '…'}</span>
    </div>
  );
}
