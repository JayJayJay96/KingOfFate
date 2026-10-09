/**
 * Fate presets. Every pool is 20 equally likely slots; weights are slot counts.
 * Normal odds: approved baseline (PROJECT.md §4).
 * Sudden Death odds: D1, approved 2026-10-09.
 */
export const FATE_SLOT_COUNT = 20;

export type FateKind = 'KO' | 'VS' | 'SHIELD';
export const FATE_KINDS: readonly FateKind[] = ['KO', 'VS', 'SHIELD'];

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
    normal: { KO: 18, VS: 2, SHIELD: 0 },
    suddenDeath: { KO: 19, VS: 1, SHIELD: 0 },
  },
  normal: {
    id: 'normal',
    label: 'Normal',
    normal: { KO: 15, VS: 4, SHIELD: 1 },
    suddenDeath: { KO: 18, VS: 2, SHIELD: 0 },
  },
  chaotic: {
    id: 'chaotic',
    label: 'Chaotic',
    normal: { KO: 12, VS: 5, SHIELD: 3 },
    suddenDeath: { KO: 16, VS: 4, SHIELD: 0 },
  },
};

export const DEFAULT_PRESET_ID: FatePresetId = 'normal';

export function isFatePresetId(value: unknown): value is FatePresetId {
  return typeof value === 'string' && (FATE_PRESET_IDS as readonly string[]).includes(value);
}

export function slotsToPercent(slots: number): number {
  return (slots * 100) / FATE_SLOT_COUNT;
}

const FATE_LABELS: Readonly<Record<FateKind, string>> = { KO: 'KO', VS: 'VS', SHIELD: 'Shield' };

/** Human-readable odds, omitting kinds with zero slots, e.g. "KO 75% · VS 20% · Shield 5%". */
export function formatOdds(weights: FateWeights): string {
  return FATE_KINDS.filter((kind) => weights[kind] > 0)
    .map((kind) => `${FATE_LABELS[kind]} ${slotsToPercent(weights[kind])}%`)
    .join(' · ');
}
