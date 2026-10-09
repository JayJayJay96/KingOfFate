import type { Rng } from '../rng/rng';
import { IllegalTransitionError } from './errors';
import { appendEvent } from './matchEvents';
import type { FinaleRoundCommit, FinaleRoundResult, FinaleState, MatchState } from './matchTypes';
import { beats, GESTURES, type Gesture } from './rps';

/** First to this many points takes a winner slot (PROJECT.md §5). */
export const FINALE_TARGET_SCORE = 3;

export function initialFinale(finalistIds: readonly string[]): FinaleState {
  return {
    started: false,
    stageNumber: 1,
    finalistIds,
    contenderIds: finalistIds,
    scores: Object.fromEntries(finalistIds.map((id) => [id, 0])),
    winnerIds: [],
    excludedIds: [],
    pendingRound: null,
    rounds: [],
  };
}

/**
 * Winning gesture of one reveal, or null for a draw: everyone threw the same, or all three
 * gestures appear. With exactly two gestures, the one that beats the other wins.
 */
export function winningGesture(gestures: readonly Gesture[]): Gesture | null {
  const kinds = [...new Set(gestures)];
  if (kinds.length !== 2) return null;
  const [a, b] = kinds as [Gesture, Gesture];
  return beats(a, b) ? a : b;
}

/** Host pressed Start. Idempotent. */
export function beginFinale(state: MatchState): MatchState {
  const f = requireFinale(state);
  if (f.started) return state;
  return appendEvent({ ...state, finale: { ...f, started: true } }, { type: 'FINALE_STARTED' });
}

/**
 * Samples one reveal: every current contender throws independently and uniformly, with no bias
 * toward anyone. Committed before the chant animation plays.
 */
export function startFinaleRound(state: MatchState, rng: Rng, roundId: string): MatchState {
  const f = requireFinale(state);
  if (!f.started) throw new IllegalTransitionError('Finale has not been started');
  if (f.pendingRound) throw new IllegalTransitionError('A finale round is already in progress');
  const round: FinaleRoundCommit = {
    roundId,
    roundNumber: f.rounds.length + 1,
    stageNumber: f.stageNumber,
    throws: f.contenderIds.map((playerId) => ({ playerId, gesture: GESTURES[rng.nextInt(3)]! })),
  };
  return appendEvent(
    { ...state, finale: { ...f, pendingRound: round } },
    { type: 'FINALE_ROUND_COMMITTED', round },
  );
}

/**
 * Scores the committed reveal exactly once (stale/duplicate ids are no-ops):
 * - winners of the reveal each get +1;
 * - anyone reaching 3 takes a slot if there are enough slots for all of them;
 * - if MORE reach 3 than slots remain, only they replay a fresh first-to-3 race for those slots
 *   and every other contender is out of contention (D3, applied recursively);
 * - if contenders ever equal open slots they qualify automatically (D2 guard);
 * - with exactly W winners the match completes (VICTORY) and `completedAt` is set once.
 */
export function resolveFinaleRound(
  state: MatchState,
  roundId: string,
  completedAt: string,
): MatchState {
  const f = state.finale;
  const round = f?.pendingRound;
  if (state.phase !== 'FINALE' || !f || !round || round.roundId !== roundId) return state;

  const winning = winningGesture(round.throws.map((t) => t.gesture));
  const scorerIds = winning
    ? round.throws.filter((t) => t.gesture === winning).map((t) => t.playerId)
    : [];
  const scores: Record<string, number> = { ...f.scores };
  for (const id of scorerIds) scores[id] = (scores[id] ?? 0) + 1;

  const slotsLeft = state.winnerCount - f.winnerIds.length;
  const reached = f.contenderIds.filter((id) => (scores[id] ?? 0) >= FINALE_TARGET_SCORE);

  let next: FinaleState = { ...f, scores, pendingRound: null };
  let qualifiedIds: string[] = [];
  let tiebreakIds: string[] | null = null;

  if (reached.length > slotsLeft) {
    tiebreakIds = reached;
    next = {
      ...next,
      stageNumber: f.stageNumber + 1,
      contenderIds: reached,
      excludedIds: [...f.excludedIds, ...f.contenderIds.filter((id) => !reached.includes(id))],
      scores: { ...scores, ...Object.fromEntries(reached.map((id) => [id, 0])) },
    };
  } else if (reached.length > 0) {
    qualifiedIds = reached;
    next = {
      ...next,
      winnerIds: [...f.winnerIds, ...reached],
      contenderIds: f.contenderIds.filter((id) => !reached.includes(id)),
    };
  }

  // D2 guard: never keep rolling when the remaining contenders exactly fill the open slots.
  let automaticIds: string[] = [];
  const openSlots = state.winnerCount - next.winnerIds.length;
  if (openSlots > 0 && next.contenderIds.length === openSlots) {
    automaticIds = [...next.contenderIds];
    next = { ...next, winnerIds: [...next.winnerIds, ...automaticIds], contenderIds: [] };
  }

  const result: FinaleRoundResult = {
    ...round,
    winningGesture: winning,
    scorerIds,
    qualifiedIds,
    tiebreakIds,
  };
  next = { ...next, rounds: [...f.rounds, result] };

  let s = appendEvent({ ...state, finale: next }, { type: 'FINALE_ROUND_RESOLVED', round: result });
  if (qualifiedIds.length > 0) {
    s = appendEvent(s, { type: 'FINALISTS_QUALIFIED', playerIds: qualifiedIds, automatic: false });
  }
  if (tiebreakIds) {
    s = appendEvent(s, { type: 'TIEBREAK_STARTED', contenderIds: tiebreakIds, slots: slotsLeft });
  }
  if (automaticIds.length > 0) {
    s = appendEvent(s, { type: 'FINALISTS_QUALIFIED', playerIds: automaticIds, automatic: true });
  }

  if (next.winnerIds.length === state.winnerCount) {
    s = appendEvent(
      { ...s, phase: 'VICTORY', completedAt },
      { type: 'MATCH_COMPLETED', winnerIds: next.winnerIds, completedAt },
    );
  }
  return s;
}

function requireFinale(state: MatchState): FinaleState {
  if (state.phase !== 'FINALE' || !state.finale) {
    throw new IllegalTransitionError(`Not in the finale (phase ${state.phase})`);
  }
  return state.finale;
}
