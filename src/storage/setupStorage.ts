import { isWinnerCount, MAX_NAME_LENGTH, MAX_TITLE_LENGTH } from '../game/config/limits';
import { cleanLook, isFighterLook } from '../game/config/looks';
import { isFatePresetId, isValidCustomOdds } from '../game/config/presets';
import { isFairState } from '../game/setup/fairSitOut';
import { isStageChoice } from '../game/config/stages';
import { nameKey, nameLength, normalizeName, type Participant } from '../game/setup/roster';
import { DEFAULT_SETUP, type SetupConfig } from '../game/setup/setupConfig';

export const SETUP_STORAGE_KEY = 'kof.setup';
export const CORRUPT_BACKUP_KEY = `${SETUP_STORAGE_KEY}.corrupt`;
export const SETUP_SCHEMA_VERSION = 1;

export interface StoredSetupV1 {
  readonly schemaVersion: 1;
  readonly roster: readonly Participant[];
  readonly winnerCount: number;
  readonly presetId: string;
  /** Added 2026-10-10 (optional, schema unchanged). */
  readonly stage?: string;
  /** Added 2026-10-16 (optional, schema unchanged). */
  readonly turbo?: boolean;
  /** Added 2026-10-16 (optional, schema unchanged). */
  readonly title?: string;
  /** Added 2026-10-16 (optional, schema unchanged). */
  readonly customOdds?: unknown;
  /** Added 2026-10-29 (optional, schema unchanged). */
  readonly fair?: unknown;
}

/**
 * - `empty`: nothing stored yet (first run).
 * - `loaded`: stored config restored as-is.
 * - `repaired`: stored config readable but some fields/entries were invalid and dropped/defaulted.
 * - `corrupt`: unreadable or unknown schema; defaults used, raw value copied to CORRUPT_BACKUP_KEY.
 * - `unavailable`: browser storage cannot be accessed; defaults used, nothing will persist.
 */
export type SetupLoadStatus = 'empty' | 'loaded' | 'repaired' | 'corrupt' | 'unavailable';

export interface SetupLoadResult {
  readonly config: SetupConfig;
  readonly status: SetupLoadStatus;
}

export type SetupSaveResult =
  { readonly ok: true } | { readonly ok: false; readonly message: string };

export function getBrowserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadSetup(
  storage: Storage | null = getBrowserStorage(),
  /** Office mode keeps its own local copy of the office setup. */
  key = SETUP_STORAGE_KEY,
): SetupLoadResult {
  if (!storage) return { config: DEFAULT_SETUP, status: 'unavailable' };

  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return { config: DEFAULT_SETUP, status: 'unavailable' };
  }
  if (raw === null) return { config: DEFAULT_SETUP, status: 'empty' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return corrupt(storage, raw);
  }
  return parseStoredSetup(parsed) ?? corrupt(storage, raw);
}

/** Validates a stored (or office server) setup object; null when it is not a setup at all. */
export function parseStoredSetup(parsed: unknown): SetupLoadResult | null {
  if (!isRecord(parsed) || parsed.schemaVersion !== SETUP_SCHEMA_VERSION) return null;

  let repaired = false;
  const roster = sanitizeRoster(parsed.roster);
  if (roster.dropped) repaired = true;

  let winnerCount = DEFAULT_SETUP.winnerCount;
  if (isWinnerCount(parsed.winnerCount)) winnerCount = parsed.winnerCount;
  else repaired = true;

  let presetId = DEFAULT_SETUP.presetId;
  if (isFatePresetId(parsed.presetId)) presetId = parsed.presetId;
  else repaired = true;

  let stage = DEFAULT_SETUP.stage;
  if (isStageChoice(parsed.stage)) stage = parsed.stage;
  else if (parsed.stage !== undefined) repaired = true;

  let turbo = DEFAULT_SETUP.turbo;
  if (typeof parsed.turbo === 'boolean') turbo = parsed.turbo;
  else if (parsed.turbo !== undefined) repaired = true;

  let title = DEFAULT_SETUP.title;
  if (typeof parsed.title === 'string') title = cleanTitle(parsed.title);
  else if (parsed.title !== undefined) repaired = true;

  let customOdds = DEFAULT_SETUP.customOdds;
  if (isValidCustomOdds(parsed.customOdds)) customOdds = parsed.customOdds;
  else if (parsed.customOdds !== undefined) repaired = true;

  let fair = DEFAULT_SETUP.fair;
  if (isFairState(parsed.fair)) fair = parsed.fair;
  else if (parsed.fair !== undefined) repaired = true;

  return {
    config: {
      roster: roster.entries,
      winnerCount,
      presetId,
      customOdds,
      stage,
      turbo,
      title,
      fair,
    },
    status: repaired ? 'repaired' : 'loaded',
  };
}

export function saveSetup(
  config: SetupConfig,
  storage: Storage | null = getBrowserStorage(),
  key = SETUP_STORAGE_KEY,
): SetupSaveResult {
  if (!storage) return { ok: false, message: 'Browser storage is unavailable.' };
  try {
    storage.setItem(key, JSON.stringify(toStoredSetup(config)));
    return { ok: true };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `Could not save settings (${detail}).` };
  }
}

/** The stored form: what localStorage and the office server keep. */
export function toStoredSetup(config: SetupConfig): StoredSetupV1 {
  return {
    schemaVersion: SETUP_SCHEMA_VERSION,
    roster: config.roster.map(({ id, name, active, look }) =>
      look ? { id, name, active, look: cleanLook(look) } : { id, name, active },
    ),
    winnerCount: config.winnerCount,
    presetId: config.presetId,
    customOdds: config.customOdds,
    stage: config.stage,
    turbo: config.turbo,
    title: config.title,
    fair: config.fair,
  };
}

/** Single line, at most MAX_TITLE_LENGTH characters (edges kept so typing a space works). */
export function cleanTitle(raw: string): string {
  return [...raw.replace(/\s+/g, ' ')].slice(0, MAX_TITLE_LENGTH).join('');
}

function corrupt(storage: Storage, raw: string): SetupLoadResult {
  try {
    storage.setItem(CORRUPT_BACKUP_KEY, raw);
  } catch {
    // Best effort only: the backup is a courtesy, defaults are still safe to use.
  }
  return { config: DEFAULT_SETUP, status: 'corrupt' };
}

function sanitizeRoster(value: unknown): { entries: Participant[]; dropped: boolean } {
  if (!Array.isArray(value)) return { entries: [], dropped: true };
  const entries: Participant[] = [];
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const item of value) {
    if (
      !isRecord(item) ||
      typeof item.id !== 'string' ||
      item.id === '' ||
      typeof item.name !== 'string' ||
      typeof item.active !== 'boolean'
    ) {
      continue;
    }
    const name = normalizeName(item.name);
    const key = nameKey(name);
    if (name === '' || nameLength(name) > MAX_NAME_LENGTH) continue;
    if (ids.has(item.id) || names.has(key)) continue;
    ids.add(item.id);
    names.add(key);
    // A damaged look is dropped (the person falls back to their neutral look).
    entries.push(
      isFighterLook(item.look)
        ? { id: item.id, name, active: item.active, look: cleanLook(item.look) }
        : { id: item.id, name, active: item.active },
    );
  }
  return { entries, dropped: entries.length !== value.length };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
