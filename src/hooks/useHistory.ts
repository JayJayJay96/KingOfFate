import { useCallback, useEffect, useMemo, useState } from 'react';
import { careerBadges, rivalries, type CareerBadge, type Rivalry } from '../game/history/awards';
import {
  aggregateStats,
  isHistoryRecord,
  sortSummaries,
  summarizeMatch,
  type FighterStats,
  type MatchSummary,
} from '../game/history/history';
import {
  importSummary,
  parseHistoryFile,
  planImport,
  type ImportMode,
  type ImportPlan,
} from '../game/history/importData';
import type { CompletedMatchRecord, MatchRepository } from '../storage/matchStorage';

export type PreparedImport =
  | { readonly ok: true; readonly mode: ImportMode; readonly plan: ImportPlan }
  | { readonly ok: false; readonly message: string };

export interface HistoryController {
  readonly loading: boolean;
  /** Load/delete failure; never pretends data was removed. */
  readonly error: string | null;
  /** Valid stored records. */
  readonly records: readonly CompletedMatchRecord[];
  /** Stored records that could not be read (kept in storage, left out of stats). */
  readonly skipped: number;
  /** Newest first. */
  readonly summaries: readonly MatchSummary[];
  /** Ranked by luck vs expected. */
  readonly stats: readonly FighterStats[];
  /** VS head-to-head pairs, most duels first. */
  readonly rivalries: readonly Rivalry[];
  /** Badges per person (roster entry ID). */
  readonly badges: ReadonlyMap<string, readonly CareerBadge[]>;
  readonly deleteMatch: (matchId: string) => Promise<boolean>;
  readonly clearAll: () => Promise<boolean>;
  /** Reads an export file and works out what importing it would do; writes nothing. */
  readonly prepareImport: (text: string, mode: ImportMode) => PreparedImport;
  /** Writes a prepared import; resolves to the report line, or null on failure (error set). */
  readonly applyImport: (prepared: PreparedImport & { ok: true }) => Promise<string | null>;
}

export function useHistory(repository: MatchRepository): HistoryController {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [raw, setRaw] = useState<readonly unknown[]>([]);

  const reload = useCallback(async () => {
    try {
      setRaw(await repository.listCompleted());
      return true;
    } catch (e) {
      setError(`History could not be loaded: ${messageOf(e)}`);
      return false;
    }
  }, [repository]);

  useEffect(() => {
    let cancelled = false;
    repository
      .listCompleted()
      .then(
        (all) => {
          if (!cancelled) setRaw(all);
        },
        (e: unknown) => {
          if (!cancelled) setError(`History could not be loaded: ${messageOf(e)}`);
        },
      )
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [repository]);

  const records = useMemo(() => raw.filter(isHistoryRecord), [raw]);
  const summaries = useMemo(() => sortSummaries(records.map(summarizeMatch)), [records]);
  const stats = useMemo(() => aggregateStats(summaries), [summaries]);
  const pairs = useMemo(() => rivalries(summaries), [summaries]);
  const badges = useMemo(() => careerBadges(summaries, stats), [summaries, stats]);

  const deleteMatch = useCallback(
    async (matchId: string) => {
      const result = await repository.deleteCompleted(matchId);
      if (!result.ok) {
        setError(`The match was not deleted: ${result.message}`);
        return false;
      }
      setError(null);
      return reload();
    },
    [repository, reload],
  );

  const clearAll = useCallback(async () => {
    const result = await repository.clearCompleted();
    if (!result.ok) {
      setError(`History was not cleared: ${result.message}`);
      return false;
    }
    setError(null);
    return reload();
  }, [repository, reload]);

  const prepareImport = useCallback(
    (text: string, mode: ImportMode): PreparedImport => {
      const parsed = parseHistoryFile(text);
      if (!parsed.ok) return parsed;
      return { ok: true, mode, plan: planImport(records, parsed.matches, mode) };
    },
    [records],
  );

  const applyImport = useCallback(
    async ({ mode, plan }: PreparedImport & { ok: true }) => {
      const result = await repository.importCompleted(plan.records, mode === 'replace');
      if (!result.ok) {
        setError(`Nothing was imported: ${result.message}`);
        return null;
      }
      setError(null);
      await reload();
      return importSummary(plan);
    },
    [repository, reload],
  );

  return {
    loading,
    error,
    records,
    skipped: raw.length - records.length,
    summaries,
    stats,
    rivalries: pairs,
    badges,
    deleteMatch,
    clearAll,
    prepareImport,
    applyImport,
  };
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
