/**
 * Fate presets. Every pool is 20 equally likely slots; weights are slot counts.
 * Normal odds: approved baseline (PROJECT.md §4).
 * Sudden Death odds: D1, approved 2026-10-09.
 * Bomb: owner decision 2026-10-16, one slot in every pool, taken from KO.
 */
export const FATE_SLOT_COUNT = 20;

export type FateKind = 'KO' | 'VS' | 'SHIELD' | 'BOMB';
export const FATE_KINDS: readonly FateKind[] = ['KO', 'VS', 'SHIELD', 'BOMB'];

export type FateWeights = Readonly<Record<FateKind, number>>;

export const FATE_PRESET_IDS = ['fast', 'normal', 'chaotic'] as const;
export type FatePresetId = (typeof FATE_PRESET_IDS)[number];

export interface FatePreset {
  readonly id: FatePresetId;
  readonly label: string;
  readonly normal: FateWeights;
  readonly suddenDeath: FateWeights;
}

export const FATE_PRESETS: Readonly<Record<FatePresetId, FatePreset>> = {
  fast: {
    id: 'fast',
    label: 'Fast',
    normal: { KO: 17, VS: 2, SHIELD: 0, BOMB: 1 },
    suddenDeath: { KO: 18, VS: 1, SHIELD: 0, BOMB: 1 },
  },
  normal: {
    id: 'normal',
    label: 'Normal',
    normal: { KO: 14, VS: 4, SHIELD: 1, BOMB: 1 },
    suddenDeath: { KO: 17, VS: 2, SHIELD: 0, BOMB: 1 },
  },
  chaotic: {
    id: 'chaotic',
    label: 'Chaotic',
    normal: { KO: 11, VS: 5, SHIELD: 3, BOMB: 1 },
    suddenDeath: { KO: 15, VS: 4, SHIELD: 0, BOMB: 1 },
  },
};

export const DEFAULT_PRESET_ID: FatePresetId = 'normal';

export function isFatePresetId(value: unknown): value is FatePresetId {
  return typeof value === 'string' && (FATE_PRESET_IDS as readonly string[]).includes(value);
}

export function slotsToPercent(slots: number): number {
  return (slots * 100) / FATE_SLOT_COUNT;
}

const FATE_LABELS: Readonly<Record<FateKind, string>> = {
  KO: 'KO',
  VS: 'VS',
  SHIELD: 'Shield',
  BOMB: 'Bomb',
};

/** Human-readable odds, omitting kinds with zero slots, e.g. "KO 70% · VS 20% · Shield 5% · Bomb 5%". */
export function formatOdds(weights: FateWeights): string {
  return FATE_KINDS.filter((kind) => weights[kind] > 0)
    .map((kind) => `${FATE_LABELS[kind]} ${slotsToPercent(weights[kind])}%`)
    .join(' · ');
}
