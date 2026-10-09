import { GESTURE_LABEL } from '../../game/engine/describeEvent';
import type { CommittedDuel } from '../../game/engine/matchTypes';
import { beats, type Gesture } from '../../game/engine/rps';
import { FighterSprite, HandIcon } from '../sprites/icons';

interface DuelPanelProps {
  readonly challengerName: string;
  readonly opponentName: string;
  readonly duel: CommittedDuel;
  /** -1 = intro, otherwise index of the throw currently shown. */
  readonly throwIndex: number;
}

/** Plays back the already-committed VS throws. Never samples anything. */
export function DuelPanel({ challengerName, opponentName, duel, throwIndex }: DuelPanelProps) {
  const current = throwIndex >= 0 ? duel.throws[throwIndex] : undefined;
  let caption = 'Rock · Paper · Scissors!';
  if (current) {
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
    <section className="panel duel" aria-label="VS duel" data-testid="duel">
      <div className="duel__fighters">
        <Side name={challengerName} gesture={current?.challenger} />
        <span className="duel__vs">VS</span>
        <Side name={opponentName} gesture={current?.opponent} />
      </div>
      <p className="duel__caption" aria-live="polite">
        {caption}
      </p>
    </section>
  );
}

function Side({ name, gesture }: { readonly name: string; readonly gesture?: Gesture }) {
  return (
    <div className="duel__side">
      <span className="duel__figure">
        <FighterSprite seed={name} size={72} />
        <span className="duel__hand">
          <HandIcon gesture={gesture ?? 'ROCK'} size={40} />
        </span>
      </span>
      <span className="duel__name">{name}</span>
      <span className="duel__gesture">{gesture ? GESTURE_LABEL[gesture] : '…'}</span>
    </div>
  );
}
