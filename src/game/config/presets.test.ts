import { describe, expect, it } from 'vitest';
import {
  adjustOdds,
  DEFAULT_CUSTOM_ODDS,
  isFatePresetId,
  isValidCustomOdds,
  presetName,
  FATE_PRESET_IDS,
  FATE_PRESETS,
  FATE_SLOT_COUNT,
  formatOdds,
  slotsToPercent,
  type FateWeights,
} from './presets';

const total = (w: FateWeights) => w.KO + w.VS + w.SHIELD + w.BOMB;

describe('Fate presets', () => {
  it('match the approved normal odds exactly (PROJECT.md §4)', () => {
    expect(FATE_PRESETS.fast.normal).toEqual({ KO: 17, VS: 2, SHIELD: 0, BOMB: 1 });
    expect(FATE_PRESETS.normal.normal).toEqual({ KO: 14, VS: 4, SHIELD: 1, BOMB: 1 });
    expect(FATE_PRESETS.chaotic.normal).toEqual({ KO: 11, VS: 5, SHIELD: 3, BOMB: 1 });
  });

  it('match the approved D1 Sudden Death odds exactly', () => {
    expect(FATE_PRESETS.fast.suddenDeath).toEqual({ KO: 18, VS: 1, SHIELD: 0, BOMB: 1 });
    expect(FATE_PRESETS.normal.suddenDeath).toEqual({ KO: 17, VS: 2, SHIELD: 0, BOMB: 1 });
    expect(FATE_PRESETS.chaotic.suddenDeath).toEqual({ KO: 15, VS: 4, SHIELD: 0, BOMB: 1 });
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
    expect(formatOdds(FATE_PRESETS.normal.normal)).toBe('KO 70% · VS 20% · Shield 5% · Bomb 5%');
    expect(formatOdds(FATE_PRESETS.fast.normal)).toBe('KO 85% · VS 10% · Bomb 5%');
    expect(formatOdds(FATE_PRESETS.chaotic.suddenDeath)).toBe('KO 75% · VS 20% · Bomb 5%');
  });

  it('converts slots to 5% steps', () => {
    expect(slotsToPercent(1)).toBe(5);
    expect(slotsToPercent(15)).toBe(75);
  });
});

describe('Custom odds (owner decision 2026-10-16)', () => {
  const sum = (w: FateWeights) => w.KO + w.VS + w.SHIELD + w.BOMB;

  it('is a preset id with its own name, starting from Normal', () => {
    expect(isFatePresetId('custom')).toBe(true);
    expect(presetName('custom')).toBe('Custom');
    expect(DEFAULT_CUSTOM_ODDS.normal).toEqual(FATE_PRESETS.normal.normal);
    expect(isValidCustomOdds(DEFAULT_CUSTOM_ODDS)).toBe(true);
  });

  it('+/- moves one slot between a Fate and KO; the pool always totals 20', () => {
    let o = adjustOdds(DEFAULT_CUSTOM_ODDS, 'normal', 'VS', 1);
    expect(o.normal).toEqual({ KO: 13, VS: 5, SHIELD: 1, BOMB: 1 });
    o = adjustOdds(o, 'normal', 'BOMB', -5);
    expect(o.normal.BOMB).toBe(0);
    expect(o.normal.KO).toBe(14);
    for (const kind of ['VS', 'SHIELD', 'BOMB'] as const) {
      const maxed = adjustOdds(DEFAULT_CUSTOM_ODDS, 'normal', kind, 40);
      expect(sum(maxed.normal)).toBe(20);
      expect(maxed.normal.KO).toBeGreaterThanOrEqual(0);
      expect(isValidCustomOdds(maxed)).toBe(true);
    }
  });

  it('never lets Shields fill every slot', () => {
    let o = DEFAULT_CUSTOM_ODDS;
    for (const kind of ['VS', 'BOMB'] as const) o = adjustOdds(o, 'normal', kind, -20);
    o = adjustOdds(o, 'normal', 'SHIELD', 40);
    expect(o.normal.SHIELD).toBe(19);
    expect(o.normal.KO).toBe(1);
  });

  it('Sudden Death: no Shields, and never more VS than normal play', () => {
    const o = adjustOdds(DEFAULT_CUSTOM_ODDS, 'suddenDeath', 'VS', 10);
    expect(o.suddenDeath.VS).toBe(DEFAULT_CUSTOM_ODDS.normal.VS);
    expect(adjustOdds(o, 'suddenDeath', 'SHIELD', 1)).toBe(o);
    // Lowering normal VS pulls Sudden Death VS down with it.
    const lower = adjustOdds(o, 'normal', 'VS', -3);
    expect(lower.suddenDeath.VS).toBe(1);
    expect(sum(lower.suddenDeath)).toBe(20);
    expect(isValidCustomOdds(lower)).toBe(true);
  });

  it('rejects odds that break the rules', () => {
    const bad = (normal: object, suddenDeath: object) => isValidCustomOdds({ normal, suddenDeath });
    const sd = { KO: 18, VS: 1, SHIELD: 0, BOMB: 1 };
    expect(bad({ KO: 15, VS: 4, SHIELD: 1, BOMB: 1 }, sd)).toBe(false); // 21 slots
    expect(bad({ KO: 0, VS: 0, SHIELD: 20, BOMB: 0 }, { KO: 20, VS: 0, SHIELD: 0, BOMB: 0 })).toBe(
      false,
    );
    expect(bad({ KO: 14, VS: 4, SHIELD: 1, BOMB: 1 }, { KO: 17, VS: 2, SHIELD: 1, BOMB: 0 })).toBe(
      false,
    );
    expect(bad({ KO: 18, VS: 1, SHIELD: 0, BOMB: 1 }, { KO: 16, VS: 3, SHIELD: 0, BOMB: 1 })).toBe(
      false,
    );
    expect(isValidCustomOdds(null)).toBe(false);
  });
});
