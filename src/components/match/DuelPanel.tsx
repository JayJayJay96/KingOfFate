import { GESTURE_LABEL } from '../../game/engine/describeEvent';
import type { CommittedDuel } from '../../game/engine/matchTypes';
import { beats, type Gesture } from '../../game/engine/rps';
import { FighterSprite, HandIcon } from '../sprites/icons';

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
  /** fight mode: -1 = intro, otherwise index of the throw currently shown. */
  readonly throwIndex: number;
}

/** Plays back the already-committed VS. Never samples anything. */
export function DuelPanel({
  mode,
  challengerName,
  opponentName,
  duel,
  throwIndex,
}: DuelPanelProps) {
  const current = mode === 'fight' && throwIndex >= 0 ? duel.throws[throwIndex] : undefined;
  let caption = 'Rock · Paper · Scissors!';
  if (mode === 'announce') caption = `${challengerName} must fight… who?`;
  else if (mode === 'pick') caption = 'Choosing an opponent…';
  else if (current) {
    if (current.challenger === current.opponent) caption = 'Draw! Throw again…';
    else {
      const challengerWon = beats(current.challenger, current.opponent);
      const [w, l] = challengerWon
        ? [current.challenger, current.opponent]
        : [current.opponent, current.challenger];
      caption = `${GESTURE_LABEL[w]} beats ${GESTURE_LABEL[l]}! ${
        challengerWon ? challengerName : opponentName
      } wins!`;
    }
  }

  return (
    <section className={`panel duel duel--${mode}`} aria-label="VS duel" data-testid="duel">
      <div className="duel__fighters">
        <Side name={challengerName} gesture={current?.challenger} showHand={mode === 'fight'} />
        <span className="duel__vs">{mode === 'announce' ? 'VS!' : 'VS'}</span>
        {opponentName && mode !== 'announce' ? (
          <Side name={opponentName} gesture={current?.opponent} showHand={mode === 'fight'} />
        ) : (
          <div className="duel__side duel__side--mystery" aria-hidden="true">
            <span className="duel__mystery">?</span>
            <span className="duel__name">???</span>
          </div>
        )}
      </div>
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
}: {
  readonly name: string;
  readonly gesture?: Gesture;
  readonly showHand: boolean;
}) {
  return (
    <div className="duel__side">
      <span className="duel__figure">
        <FighterSprite seed={name} size={72} />
        {showHand && (
          <span className="duel__hand">
            <HandIcon gesture={gesture ?? 'ROCK'} size={60} />
          </span>
        )}
      </span>
      <span className="duel__name">{name}</span>
      <span className="duel__gesture">{gesture ? GESTURE_LABEL[gesture] : '…'}</span>
    </div>
  );
}
