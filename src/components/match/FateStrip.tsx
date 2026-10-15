import type { FateKind } from '../../game/config/presets';
import { countSlots } from '../../game/engine/fateSlots';
import { FateIcon } from '../sprites/icons';

const FATE_INFO: Readonly<Record<FateKind, { label: string; help: string }>> = {
  KO: {
    label: 'KO',
    help: 'KO: the fighter loses their Shield, or is eliminated if they have none.',
  },
  VS: {
    label: 'VS',
    help: 'VS: rock-paper-scissors duel vs a random living fighter. Loser loses their Shield or is eliminated; winner earns a Shield (not in Sudden Death).',
  },
  SHIELD: {
    label: 'Shield',
    help: 'Shield: the fighter gains a Shield (max 1; a second one is wasted).',
  },
  BOMB: {
    label: 'Bomb',
    help: 'Bomb: the fighter takes a KO and the blast also hits the next living fighter to their left or right (50/50). A Shield absorbs it for either.',
  },
};

interface FateStripProps {
  readonly slots: readonly FateKind[];
  /** Fate cursor during a spin. */
  readonly cursorIndex: number | null;
  /** Slot that decided the previous turn (shown when idle). */
  readonly lastSlotIndex: number | null;
  readonly suddenDeath: boolean;
  /** Shields still available to earn, out of the match's total supply. */
  readonly shieldSupply: number;
  readonly shieldSupplyTotal: number;
  /** Living count at which Sudden Death starts. */
  readonly suddenDeathAt: number;
  /** Living count at which the finale starts (W + 1); it pre-empts Sudden Death. */
  readonly finaleAt: number;
}

/** The 20 equally likely Fate slots. The odds shown are computed from the live strip. */
export function FateStrip({
  slots,
  cursorIndex,
  lastSlotIndex,
  suddenDeath,
  shieldSupply,
  shieldSupplyTotal,
  suddenDeathAt,
  finaleAt,
}: FateStripProps) {
  const counts = countSlots(slots);
  const odds = (['KO', 'VS', 'SHIELD', 'BOMB'] as const)
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
            Sudden Death: Shields shattered
          </p>
        ) : (
          <>
            <p
              className="fate-strip__meter"
              data-testid="shield-supply"
              title="Each Shield earned (Shield Fate or VS win) uses one. When none are left, Shield slots turn into KO."
            >
              Shields left{' '}
              {Array.from({ length: shieldSupplyTotal }, (_, i) => (
                <span
                  key={i}
                  className={i < shieldSupply ? 'pip pip--shield' : 'pip'}
                  aria-hidden="true"
                />
              ))}
              <span className="sr-only">
                {shieldSupply} of {shieldSupplyTotal}
              </span>
            </p>
            <p
              className="fate-strip__meter"
              data-testid="sudden-death-at"
              title="At this many fighters left, all Shields shatter and KO odds rise."
            >
              {suddenDeathAt > finaleAt
                ? `Sudden Death at ${suddenDeathAt} left`
                : `No Sudden Death: finale at ${finaleAt} left`}
            </p>
          </>
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
              <FateIcon kind={kind} size={20} />
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
