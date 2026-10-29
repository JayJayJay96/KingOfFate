import { getBrowserStorage } from '../storage/setupStorage';

/** Per-PC choice (owner decision 2026-10-29): Personal = this PC only; Office = shared server. */
export type StorageMode = 'personal' | 'office';

export interface OfficeSettings {
  readonly mode: StorageMode;
  /** The office code this PC uses; checked by the server on every call. */
  readonly code: string;
}

export const OFFICE_SETTINGS_KEY = 'kof.office';
export const DEFAULT_OFFICE_CODE = '116059';
const PERSONAL: OfficeSettings = { mode: 'personal', code: '' };

export function loadOfficeSettings(storage = getBrowserStorage()): OfficeSettings {
  try {
    const v: unknown = JSON.parse(storage?.getItem(OFFICE_SETTINGS_KEY) ?? 'null');
    if (
      typeof v === 'object' &&
      v !== null &&
      (v as { mode?: unknown }).mode === 'office' &&
      typeof (v as { code?: unknown }).code === 'string'
    ) {
      return { mode: 'office', code: (v as { code: string }).code };
    }
  } catch {
    // Unreadable: Personal mode.
  }
  return PERSONAL;
}

export function saveOfficeSettings(settings: OfficeSettings, storage = getBrowserStorage()) {
  try {
    storage?.setItem(OFFICE_SETTINGS_KEY, JSON.stringify(settings));
    return !!storage;
  } catch {
    return false;
  }
}
