import { isWinnerCount, MAX_NAME_LENGTH } from '../game/config/limits';
import { cleanLook, isFighterLook } from '../game/config/looks';
import { isFatePresetId } from '../game/config/presets';
import { isStageChoice } from '../game/config/stages';
import { nameKey, nameLength, normalizeName, type Participant } from '../game/setup/roster';
import { DEFAULT_SETUP, type SetupConfig } from '../game/setup/setupConfig';

export const SETUP_STORAGE_KEY = 'kof.setup';
export const CORRUPT_BACKUP_KEY = `${SETUP_STORAGE_KEY}.corrupt`;
export const SETUP_SCHEMA_VERSION = 1;

interface StoredSetupV1 {
  readonly schemaVersion: 1;
  readonly roster: readonly Participant[];
  readonly winnerCount: number;
  readonly presetId: string;
  /** Added 2026-10-10 (optional, schema unchanged). */
  readonly stage?: string;
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

export function loadSetup(storage: Storage | null = getBrowserStorage()): SetupLoadResult {
  if (!storage) return { config: DEFAULT_SETUP, status: 'unavailable' };

  let raw: string | null;
  try {
    raw = storage.getItem(SETUP_STORAGE_KEY);
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
  if (!isRecord(parsed) || parsed.schemaVersion !== SETUP_SCHEMA_VERSION) {
    return corrupt(storage, raw);
  }

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

  return {
    config: { roster: roster.entries, winnerCount, presetId, stage },
    status: repaired ? 'repaired' : 'loaded',
  };
}

export function saveSetup(
  config: SetupConfig,
  storage: Storage | null = getBrowserStorage(),
): SetupSaveResult {
  if (!storage) return { ok: false, message: 'Browser storage is unavailable.' };
  const stored: StoredSetupV1 = {
    schemaVersion: SETUP_SCHEMA_VERSION,
    roster: config.roster.map(({ id, name, active, look }) =>
      look ? { id, name, active, look: cleanLook(look) } : { id, name, active },
    ),
    winnerCount: config.winnerCount,
    presetId: config.presetId,
    stage: config.stage,
  };
  try {
    storage.setItem(SETUP_STORAGE_KEY, JSON.stringify(stored));
    return { ok: true };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `Could not save settings (${detail}).` };
  }
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
