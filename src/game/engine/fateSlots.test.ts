import { describe, expect, it } from 'vitest';
import { FATE_PRESET_IDS, FATE_PRESETS } from '../config/presets';
import { countSlots, isFateKind, spreadSlots, toSuddenDeathSlots } from './fateSlots';

describe('spreadSlots', () => {
  it.each(FATE_PRESET_IDS)('%s: 20 slots with exactly the preset weights', (id) => {
    const slots = spreadSlots(FATE_PRESETS[id].normal);
    expect(slots).toHaveLength(20);
    expect(countSlots(slots)).toEqual(FATE_PRESETS[id].normal);
  });

  it('spreads minority Fates instead of clumping them', () => {
    const slots = spreadSlots(FATE_PRESETS.normal.normal); // 15 KO / 4 VS / 1 SHIELD
    const vsPositions = slots.flatMap((k, i) => (k === 'VS' ? [i] : []));
    const gaps = vsPositions.slice(1).map((p, i) => p - vsPositions[i]!);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(3);
  });

  it('rejects weights that do not fill 20 slots', () => {
    expect(() => spreadSlots({ KO: 10, VS: 5, SHIELD: 4 })).toThrow();
  });
});

describe('toSuddenDeathSlots', () => {
  it.each(FATE_PRESET_IDS)('%s: converts in place to the approved Sudden Death odds', (id) => {
    const before = spreadSlots(FATE_PRESETS[id].normal);
    const after = toSuddenDeathSlots(before, FATE_PRESETS[id].suddenDeath);
    expect(countSlots(after)).toEqual(FATE_PRESETS[id].suddenDeath);
    // Only Shield/VS slots flip, and only ever to KO.
    after.forEach((kind, i) => {
      if (kind !== before[i]) expect(kind).toBe('KO');
      if (before[i] === 'KO') expect(kind).toBe('KO');
    });
  });

  it('works on shuffled strips too', () => {
    const shuffled = [...spreadSlots(FATE_PRESETS.chaotic.normal)].reverse();
    expect(countSlots(toSuddenDeathSlots(shuffled, FATE_PRESETS.chaotic.suddenDeath))).toEqual(
      FATE_PRESETS.chaotic.suddenDeath,
    );
  });

  it('refuses compositions that would add Shields or VS', () => {
    const strip = spreadSlots(FATE_PRESETS.fast.normal); // 18 / 2 / 0
    expect(() => toSuddenDeathSlots(strip, { KO: 15, VS: 5, SHIELD: 0 })).toThrow();
    expect(() => toSuddenDeathSlots(strip, { KO: 18, VS: 1, SHIELD: 1 })).toThrow();
  });
});

describe('isFateKind', () => {
  it('accepts only the three MVP Fates', () => {
    expect(['KO', 'VS', 'SHIELD'].every(isFateKind)).toBe(true);
    expect(isFateKind('GHOST')).toBe(false);
  });
});
