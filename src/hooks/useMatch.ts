import { useCallback, useEffect, useRef, useState } from 'react';
import {
  beginTurn,
  createMatch,
  resolveTurn,
  shufflePositions,
  type MatchLaunch,
} from '../game/engine/match';
import { beginFinale, resolveFinaleRound, startFinaleRound } from '../game/engine/finale';
import type { MatchState } from '../game/engine/matchTypes';
import type { Rng } from '../game/rng/rng';
import type { MatchRepository } from '../storage/matchStorage';
import { createId } from '../utils/ids';

export interface MatchController {
  readonly loading: boolean;
  readonly match: MatchState | null;
  /** One-off notice from restoring (e.g. corrupt checkpoint discarded). */
  readonly notice: string | null;
  /** Non-null while the latest checkpoint could not be written. */
  readonly saveError: string | null;
  readonly start: (launch: MatchLaunch) => Promise<void>;
  readonly spin: () => Promise<void>;
  /** Visual-only reshuffle of fighter and Fate slot positions, allowed between turns. */
  readonly shuffle: () => Promise<void>;
  readonly completeSpin: (turnId: string) => Promise<void>;
  /** Host pressed Start on the finale stage. */
  readonly beginFinale: () => Promise<void>;
  readonly nextFinaleRound: () => Promise<void>;
  readonly completeFinaleRound: (roundId: string) => Promise<void>;
  readonly leave: () => Promise<void>;
}

/**
 * Owns the in-progress match. Every transition is persisted BEFORE it is rendered, so the
 * spin animation only ever starts for an outcome that is already checkpointed.
 */
export function useMatch(repository: MatchRepository, rng: Rng): MatchController {
  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState<MatchState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const current = useRef<MatchState | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void repository.load().then((result) => {
      if (cancelled) return;
      if (result.status === 'loaded') {
        current.current = result.match;
        setMatch(result.match);
      } else if (result.status === 'outdated') {
        setNotice(
          'A match saved by an older version of the game was discarded. Start a new match.',
        );
      } else if (result.status === 'corrupt') {
        setNotice('A saved match could not be read and was discarded. Start a new match.');
      } else if (result.status === 'unavailable') {
        setSaveError(`Match progress cannot be saved: ${result.message}`);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [repository]);

  const commit = useCallback(
    async (next: MatchState) => {
      current.current = next;
      const result = await repository.save(next);
      setSaveError(result.ok ? null : `Match progress is not being saved: ${result.message}`);
      setMatch(next);
    },
    [repository],
  );

  /** Serialises transitions so double clicks/keys cannot start two turns. */
  const exclusive = useCallback(async (work: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    try {
      await work();
    } finally {
      busy.current = false;
    }
  }, []);

  const start = useCallback(
    (launch: MatchLaunch) =>
      exclusive(async () => {
        setNotice(null);
        await commit(
          createMatch(launch, { matchId: createId(), startedAt: new Date().toISOString() }),
        );
      }),
    [commit, exclusive],
  );

  const spin = useCallback(
    () =>
      exclusive(async () => {
        const state = current.current;
        if (!state || state.phase !== 'READY') return;
        await commit(beginTurn(state, rng, createId()));
      }),
    [commit, exclusive, rng],
  );

  const shuffle = useCallback(
    () =>
      exclusive(async () => {
        const state = current.current;
        if (!state || state.phase !== 'READY') return;
        await commit(shufflePositions(state, rng));
      }),
    [commit, exclusive, rng],
  );

  const completeSpin = useCallback(
    (turnId: string) =>
      exclusive(async () => {
        const state = current.current;
        if (!state) return;
        const next = resolveTurn(state, turnId);
        if (next !== state) await commit(next);
      }),
    [commit, exclusive],
  );

  const beginFinaleNow = useCallback(
    () =>
      exclusive(async () => {
        const state = current.current;
        if (!state || state.phase !== 'FINALE' || state.finale?.started) return;
        await commit(beginFinale(state));
      }),
    [commit, exclusive],
  );

  /** Samples and checkpoints the next reveal before its chant plays. */
  const nextFinaleRound = useCallback(
    () =>
      exclusive(async () => {
        const state = current.current;
        const f = state?.finale;
        if (!state || state.phase !== 'FINALE' || !f?.started || f.pendingRound) return;
        await commit(startFinaleRound(state, rng, createId()));
      }),
    [commit, exclusive, rng],
  );

  /** Scores the reveal once; a winning result is committed (with its record) before it shows. */
  const completeFinaleRound = useCallback(
    (roundId: string) =>
      exclusive(async () => {
        const state = current.current;
        if (!state) return;
        const next = resolveFinaleRound(state, roundId, new Date().toISOString());
        if (next !== state) await commit(next);
      }),
    [commit, exclusive],
  );

  const leave = useCallback(
    () =>
      exclusive(async () => {
        const result = await repository.clear();
        setSaveError(result.ok ? null : `Could not clear the saved match: ${result.message}`);
        current.current = null;
        setMatch(null);
      }),
    [exclusive, repository],
  );

  return {
    loading,
    match,
    notice,
    saveError,
    start,
    spin,
    shuffle,
    completeSpin,
    beginFinale: beginFinaleNow,
    nextFinaleRound,
    completeFinaleRound,
    leave,
  };
}
