import type { FateKind } from '../../game/config/presets';
import { SUDDEN_DEATH_STREAK } from '../../game/engine/match';
import { countSlots } from '../../game/engine/fateSlots';

const FATE_INFO: Readonly<Record<FateKind, { label: string; icon: string; help: string }>> =
  {
    KO: {
      label: 'KO',
      icon: '💥',
      help: 'KO: the fighter loses their Shield, or is eliminated if they have none.',
    },
    VS: {
      label: 'VS',
      icon: '⚔️',
      help: 'VS: rock-paper-scissors duel vs a random living fighter. Loser loses their Shield or is eliminated; winner earns a Shield (not in Sudden Death).',
    },
    SHIELD: {
      label: 'Shield',
      icon: '🛡️',
      help: 'Shield: the fighter gains a Shield (max 1; a second one is wasted).',
    },
  };

interface FateStripProps {
  readonly slots: readonly FateKind[];
  /** Fate cursor during a spin. */
  readonly cursorIndex: number | null;
  /** Slot that decided the previous turn (shown when idle). */
  readonly lastSlotIndex: number | null;
  readonly suddenDeath: boolean;
  readonly noEliminationStreak: number;
}

/** The 20 equally likely Fate slots. The odds shown are computed from the live strip. */
export function FateStrip({
  slots,
  cursorIndex,
  lastSlotIndex,
  suddenDeath,
  noEliminationStreak,
}: FateStripProps) {
  const counts = countSlots(slots);
  const odds = (['KO', 'VS', 'SHIELD'] as const)
    .filter((k) => counts[k] > 0)
    .map((k) => `${FATE_INFO[k].label} ${counts[k] * 5}%`)
    .join(' · ');

  return (
    <section
      className={`panel fate-strip${suddenDeath ? ' fate-strip--sudden-death' : ''}`}
      aria-labelledby="fate-strip-title"
    >
      <div className="fate-strip__header">
        <h2 id="fate-strip-title" className="panel__title">
          Fate
        </h2>
        <p className="fate-strip__odds" data-testid="fate-odds">
          {odds}
        </p>
        {suddenDeath ? (
          <p className="fate-strip__sudden-death" data-testid="sudden-death">
            Sudden Death: no new Shields
          </p>
        ) : (
          <p
            className="fate-strip__streak"
            data-testid="streak"
            title={`Sudden Death starts after ${SUDDEN_DEATH_STREAK} turns in a row without an elimination.`}
          >
            No-KO streak{' '}
            {Array.from({ length: SUDDEN_DEATH_STREAK }, (_, i) => (
              <span
                key={i}
                className={i < noEliminationStreak ? 'pip pip--on' : 'pip'}
                aria-hidden="true"
              />
            ))}
            <span className="sr-only">
              {noEliminationStreak} of {SUDDEN_DEATH_STREAK}
            </span>
          </p>
        )}
      </div>
      <ol className="fate-strip__slots" aria-label="Fate slots">
        {slots.map((kind, i) => {
          const classes = ['fate-slot', `fate-slot--${kind}`];
          if (i === cursorIndex) classes.push('fate-slot--cursor');
          if (cursorIndex === null && i === lastSlotIndex) classes.push('fate-slot--last');
          return (
            <li
              key={i}
              className={classes.join(' ')}
              title={FATE_INFO[kind].help}
              data-kind={kind}
              data-cursor={i === cursorIndex ? 'true' : undefined}
            >
              <span aria-hidden="true">{FATE_INFO[kind].icon}</span>
              <span className="fate-slot__label">{FATE_INFO[kind].label}</span>
            </li>
          );
        })}
      </ol>
      <p className="hint fate-strip__help">
        Each of the 20 slots is equally likely. Hover a slot for its rule.
      </p>
    </section>
  );
}
