import type { FatePresetId } from '../config/presets';

export const MATCH_SCHEMA_VERSION = 1;

export interface MatchPlayer {
  readonly id: string;
  readonly name: string;
  readonly alive: boolean;
  /** Turn number on which the player was eliminated, or null while alive. */
  readonly eliminatedOnTurn: number | null;
}

/**
 * READY: host may start the next ordinary turn.
 * SPINNING: a turn's outcome is committed and persisted; the reveal animation is running.
 * FINALE_GATE: alive count reached W + 1. Phase 2 placeholder until the Phase 4 finale exists.
 */
export type MatchPhase = 'READY' | 'SPINNING' | 'FINALE_GATE';

/** Phase 2 is KO-only. Phase 3 widens this to every Fate kind. */
export type TurnFate = 'KO';

export interface CommittedTurn {
  readonly turnId: string;
  readonly turnNumber: number;
  readonly playerId: string;
  readonly fate: TurnFate;
}

export interface ResolvedTurn {
  readonly turn: CommittedTurn;
  readonly eliminated: boolean;
}

interface EventBase {
  /** Unique, deterministic: `${matchId}#${seq}`. */
  readonly id: string;
  readonly seq: number;
}

export type MatchEvent =
  | (EventBase & {
      readonly type: 'MATCH_STARTED';
      readonly playerIds: readonly string[];
      readonly winnerCount: number;
      readonly presetId: FatePresetId;
    })
  | (EventBase & { readonly type: 'TURN_COMMITTED'; readonly turn: CommittedTurn })
  | (EventBase & {
      readonly type: 'PLAYER_ELIMINATED';
      readonly turnId: string;
      readonly turnNumber: number;
      readonly playerId: string;
    })
  | (EventBase & { readonly type: 'FINALE_REACHED'; readonly finalistIds: readonly string[] })
  /** Visual grid order changed. Never affects odds: selection is uniform over living players. */
  | (EventBase & { readonly type: 'PLAYERS_SHUFFLED'; readonly order: readonly string[] });

/** Distributive Omit so each union member keeps its own fields. */
export type NewMatchEvent = MatchEvent extends infer E
  ? E extends MatchEvent
    ? Omit<E, 'id' | 'seq'>
    : never
  : never;

export interface MatchState {
  readonly schemaVersion: typeof MATCH_SCHEMA_VERSION;
  readonly matchId: string;
  /** ISO-8601 UTC timestamp. */
  readonly startedAt: string;
  readonly presetId: FatePresetId;
  readonly winnerCount: number;
  readonly players: readonly MatchPlayer[];
  readonly phase: MatchPhase;
  readonly completedTurns: number;
  readonly pendingTurn: CommittedTurn | null;
  readonly lastTurn: ResolvedTurn | null;
  /** Consecutive completed turns without elimination (feeds Sudden Death in Phase 3). */
  readonly noEliminationStreak: number;
  readonly events: readonly MatchEvent[];
}
