import { useEffect, useMemo, useState } from 'react';
import { applyFairSitOut, type FairWin } from '../game/setup/fairSitOut';
import type { MatchRepository } from '../storage/matchStorage';
import type { SetupStore } from './useSetupConfig';

/**
 * Applies the fair sit-out rule each time the setup menu is shown (owner decision 2026-10-29) and
 * returns who sits out with their wins, for the roster crowns. History problems never block setup.
 */
export function useFairSitOut(
  repository: MatchRepository,
  store: SetupStore,
  visible: boolean,
): ReadonlyMap<string, readonly FairWin[]> {
  const [records, setRecords] = useState<readonly unknown[]>([]);
  const { update } = store;
  // Office mode: get the latest office setup first, so the rule runs on the shared roster.
  const refresh = store.office?.refresh;

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    Promise.resolve(refresh?.())
      .then(() => repository.listCompleted())
      .catch(() => [])
      .then((all) => {
        if (cancelled) return;
        setRecords(all);
        update((c) => {
          const result = applyFairSitOut(c.roster, all, c.fair);
          return result.roster === c.roster && result.fair === c.fair
            ? c
            : { ...c, roster: result.roster, fair: result.fair };
        });
      });
    return () => {
      cancelled = true;
    };
  }, [repository, update, visible, refresh]);

  const { roster, fair } = store.config;
  return useMemo(() => applyFairSitOut(roster, records, fair).sitOut, [roster, records, fair]);
}
