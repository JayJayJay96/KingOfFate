import type { CompletedMatchRecord } from '../../storage/matchStorage';
import { EXPORT_VERSION } from './exportData';
import { isHistoryRecord } from './history';

export type ImportMode = 'replace' | 'merge';

export interface ImportPlan {
  /** Records to write (for 'replace': the whole new history). */
  readonly records: readonly CompletedMatchRecord[];
  /** New matchIds added. */
  readonly imported: number;
  /** Same matchId already saved with different content; the file's version wins (merge only). */
  readonly replaced: number;
  /** Identical copies (already saved, or repeated in the file). */
  readonly duplicates: number;
  /** Records in the file that failed validation. */
  readonly invalid: number;
}

export type ImportParse =
  | { readonly ok: true; readonly matches: readonly unknown[] }
  | { readonly ok: false; readonly message: string };

/** Accepts only this app's own JSON export (owner decision 2026-10-29). */
export function parseHistoryFile(text: string): ImportParse {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, message: 'This file is not valid JSON.' };
  }
  if (
    typeof data !== 'object' ||
    data === null ||
    (data as { app?: unknown }).app !== 'kof-king-of-fate' ||
    !Array.isArray((data as { matches?: unknown }).matches)
  ) {
    return { ok: false, message: 'This is not a King of Fate history export.' };
  }
  if ((data as { exportVersion?: unknown }).exportVersion !== EXPORT_VERSION) {
    return { ok: false, message: 'This export was made by a different version of the game.' };
  }
  return { ok: true, matches: (data as { matches: unknown[] }).matches };
}

/**
 * Decides what an import writes. Merge (owner decision 2026-10-29): identical copies are skipped,
 * the same matchId with different content takes the file's version.
 */
export function planImport(
  existing: readonly CompletedMatchRecord[],
  matches: readonly unknown[],
  mode: ImportMode,
): ImportPlan {
  const saved = new Map(mode === 'merge' ? existing.map((r) => [r.matchId, r] as const) : []);
  const fromFile = new Map<string, CompletedMatchRecord>();
  let invalid = 0;
  let duplicates = 0;
  for (const m of matches) {
    if (!isHistoryRecord(m)) invalid++;
    else if (fromFile.has(m.matchId)) duplicates++;
    else fromFile.set(m.matchId, m);
  }
  if (mode === 'replace') {
    const records = [...fromFile.values()];
    return { records, imported: records.length, replaced: 0, duplicates, invalid };
  }
  const records: CompletedMatchRecord[] = [];
  let imported = 0;
  let replaced = 0;
  for (const record of fromFile.values()) {
    const old = saved.get(record.matchId);
    if (!old) imported++;
    else if (stableJson(old) === stableJson(record)) {
      duplicates++;
      continue;
    } else replaced++;
    records.push(record);
  }
  return { records, imported, replaced, duplicates, invalid };
}

export function importSummary(plan: ImportPlan): string {
  const parts = [`imported ${plan.imported}`];
  if (plan.replaced) parts.push(`replaced ${plan.replaced}`);
  if (plan.duplicates) {
    parts.push(`skipped ${plan.duplicates} duplicate${plan.duplicates === 1 ? '' : 's'}`);
  }
  if (plan.invalid) parts.push(`${plan.invalid} invalid`);
  return parts.join(', ');
}

/** JSON with sorted keys, so content equality ignores key order. */
export function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}
