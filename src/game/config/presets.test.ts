import { describe, expect, it } from 'vitest';
import {
  FATE_PRESET_IDS,
  FATE_PRESETS,
  FATE_SLOT_COUNT,
  formatOdds,
  slotsToPercent,
  type FateWeights,
} from './presets';

const total = (w: FateWeights) => w.KO + w.VS + w.SHIELD;

describe('Fate presets', () => {
  it('match the approved normal odds exactly (PROJECT.md §4)', () => {
    expect(FATE_PRESETS.fast.normal).toEqual({ KO: 18, VS: 2, SHIELD: 0 });
    expect(FATE_PRESETS.normal.normal).toEqual({ KO: 15, VS: 4, SHIELD: 1 });
    expect(FATE_PRESETS.chaotic.normal).toEqual({ KO: 12, VS: 5, SHIELD: 3 });
  });

  it('match the approved D1 Sudden Death odds exactly', () => {
    expect(FATE_PRESETS.fast.suddenDeath).toEqual({ KO: 19, VS: 1, SHIELD: 0 });
    expect(FATE_PRESETS.normal.suddenDeath).toEqual({ KO: 18, VS: 2, SHIELD: 0 });
    expect(FATE_PRESETS.chaotic.suddenDeath).toEqual({ KO: 16, VS: 4, SHIELD: 0 });
  });

  it.each(FATE_PRESET_IDS)('%s pools fill exactly 20 non-negative integer slots', (id) => {
    for (const w of [FATE_PRESETS[id].normal, FATE_PRESETS[id].suddenDeath]) {
      expect(total(w)).toBe(FATE_SLOT_COUNT);
      for (const n of Object.values(w)) expect(Number.isInteger(n) && n >= 0).toBe(true);
    }
  });

  it.each(FATE_PRESET_IDS)('%s Sudden Death raises KO, keeps VS, has no Shield', (id) => {
    const { normal, suddenDeath } = FATE_PRESETS[id];
    expect(suddenDeath.KO).toBeGreaterThan(normal.KO);
    expect(suddenDeath.VS).toBeGreaterThan(0);
    expect(suddenDeath.SHIELD).toBe(0);
  });

  it('Sudden Death weights are distinct per preset', () => {
    const kos = FATE_PRESET_IDS.map((id) => FATE_PRESETS[id].suddenDeath.KO);
    expect(new Set(kos).size).toBe(FATE_PRESET_IDS.length);
  });

  it('formats visible odds, omitting zero-slot kinds', () => {
    expect(formatOdds(FATE_PRESETS.normal.normal)).toBe('KO 75% · VS 20% · Shield 5%');
    expect(formatOdds(FATE_PRESETS.fast.normal)).toBe('KO 90% · VS 10%');
    expect(formatOdds(FATE_PRESETS.chaotic.suddenDeath)).toBe('KO 80% · VS 20%');
  });

  it('converts slots to 5% steps', () => {
    expect(slotsToPercent(1)).toBe(5);
    expect(slotsToPercent(15)).toBe(75);
  });
});
