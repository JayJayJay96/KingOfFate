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
import type { CompletedMatchRecord, MatchRepository } from '../storage/matchStorage';

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
  };
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
