/**
 * Fate presets. Every pool is 20 equally likely slots; weights are slot counts.
 * Normal odds: approved baseline (PROJECT.md §4).
 * Sudden Death odds: D1, approved 2026-10-09.
 * Bomb: owner decision 2026-10-16, one slot in every pool, taken from KO.
 * Custom: owner decision 2026-10-16, the host sets both pools in 5 % (one-slot) steps.
 */
export const FATE_SLOT_COUNT = 20;

export type FateKind = 'KO' | 'VS' | 'SHIELD' | 'BOMB';
export const FATE_KINDS: readonly FateKind[] = ['KO', 'VS', 'SHIELD', 'BOMB'];

export type FateWeights = Readonly<Record<FateKind, number>>;

/** Built-in presets. */
export const FATE_PRESET_IDS = ['fast', 'normal', 'chaotic'] as const;
export type BuiltInPresetId = (typeof FATE_PRESET_IDS)[number];
export const CUSTOM_PRESET_ID = 'custom';
export type FatePresetId = BuiltInPresetId | typeof CUSTOM_PRESET_ID;

export interface FatePreset {
  readonly id: BuiltInPresetId;
  readonly label: string;
  readonly normal: FateWeights;
  readonly suddenDeath: FateWeights;
}

export const FATE_PRESETS: Readonly<Record<BuiltInPresetId, FatePreset>> = {
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
  return (
    value === CUSTOM_PRESET_ID ||
    (typeof value === 'string' && (FATE_PRESET_IDS as readonly string[]).includes(value))
  );
}

/** Both pools of a match: normal play and Sudden Death. */
export interface FateOdds {
  readonly normal: FateWeights;
  readonly suddenDeath: FateWeights;
}

/** Starting point of the Custom preset: the Normal preset. */
export const DEFAULT_CUSTOM_ODDS: FateOdds = {
  normal: FATE_PRESETS.normal.normal,
  suddenDeath: FATE_PRESETS.normal.suddenDeath,
};

export function presetName(id: FatePresetId): string {
  return id === CUSTOM_PRESET_ID ? 'Custom' : FATE_PRESETS[id].label;
}

export function oddsFor(id: FatePresetId, custom?: FateOdds | null): FateOdds {
  if (id === CUSTOM_PRESET_ID) return custom ?? DEFAULT_CUSTOM_ODDS;
  return FATE_PRESETS[id];
}

function isWeights(value: unknown): value is FateWeights {
  if (typeof value !== 'object' || value === null) return false;
  const w = value as Record<string, unknown>;
  return (
    FATE_KINDS.every((k) => Number.isInteger(w[k]) && (w[k] as number) >= 0) &&
    FATE_KINDS.reduce((sum, k) => sum + (w[k] as number), 0) === FATE_SLOT_COUNT
  );
}

/**
 * Custom odds rules: both pools fill the 20 slots; normal play keeps at least one non-Shield
 * slot; Sudden Death has no Shield and no more VS than normal play (slots only flip to KO).
 */
export function isValidCustomOdds(value: unknown): value is FateOdds {
  if (typeof value !== 'object' || value === null) return false;
  const { normal, suddenDeath } = value as Record<string, unknown>;
  return (
    isWeights(normal) &&
    isWeights(suddenDeath) &&
    normal.SHIELD < FATE_SLOT_COUNT &&
    suddenDeath.SHIELD === 0 &&
    suddenDeath.VS <= normal.VS
  );
}

export type AdjustableKind = Exclude<FateKind, 'KO'>;

/**
 * Moves `delta` slots between `kind` and KO in one pool (KO takes whatever is left), then keeps
 * Sudden Death within the rules. Always returns valid odds.
 */
export function adjustOdds(
  odds: FateOdds,
  pool: 'normal' | 'suddenDeath',
  kind: AdjustableKind,
  delta: number,
): FateOdds {
  const withKind = (w: FateWeights, k: AdjustableKind, value: number): FateWeights => {
    const next = { ...w, [k]: value };
    return { ...next, KO: FATE_SLOT_COUNT - next.VS - next.SHIELD - next.BOMB };
  };
  let { normal, suddenDeath } = odds;
  if (pool === 'normal') {
    // Shield may never fill all 20 slots (someone must be able to fall).
    const others = FATE_SLOT_COUNT - normal.KO - normal[kind];
    const max = kind === 'SHIELD' ? FATE_SLOT_COUNT - 1 - others : normal[kind] + normal.KO;
    normal = withKind(normal, kind, Math.min(Math.max(normal[kind] + delta, 0), Math.max(0, max)));
  } else {
    if (kind === 'SHIELD') return odds;
    const cap = kind === 'VS' ? normal.VS : FATE_SLOT_COUNT;
    const max = Math.min(suddenDeath[kind] + suddenDeath.KO, cap);
    suddenDeath = withKind(
      suddenDeath,
      kind,
      Math.min(Math.max(suddenDeath[kind] + delta, 0), max),
    );
  }
  if (suddenDeath.VS > normal.VS) suddenDeath = withKind(suddenDeath, 'VS', normal.VS);
  return { normal, suddenDeath };
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
