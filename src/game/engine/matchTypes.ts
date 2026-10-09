import type { FateKind, FatePresetId } from '../config/presets';
import type { DuelThrow } from './rps';

/** v2 (Phase 3): Shields, Fate strip, VS duels, Sudden Death. */
export const MATCH_SCHEMA_VERSION = 2;

export interface MatchPlayer {
  readonly id: string;
  readonly name: string;
  readonly alive: boolean;
  /** At most one Shield per player. */
  readonly shield: boolean;
  /** Turn number on which the player was eliminated, or null while alive. */
  readonly eliminatedOnTurn: number | null;
}

/**
 * READY: host may start the next ordinary turn.
 * SPINNING: a turn's full outcome is committed and persisted; reveal animations are running.
 * FINALE_GATE: alive count reached W + 1. Placeholder until the Phase 4 finale exists.
 */
export type MatchPhase = 'READY' | 'SPINNING' | 'FINALE_GATE';

export interface CommittedDuel {
  readonly opponentId: string;
  /** Draws first, decisive throw last. `challenger` is the turn's selected player. */
  readonly throws: readonly DuelThrow[];
}

/** Everything random about a turn, sampled and saved before any animation starts. */
export interface CommittedTurn {
  readonly turnId: string;
  readonly turnNumber: number;
  readonly playerId: string;
  readonly fateSlotIndex: number;
  readonly fate: FateKind;
  readonly suddenDeath: boolean;
  readonly duel: CommittedDuel | null;
}

export type TurnOutcome =
  | { readonly fate: 'KO'; readonly result: 'ELIMINATED' | 'BLOCKED' }
  | { readonly fate: 'SHIELD'; readonly result: 'GAINED' | 'WASTED' }
  | {
      readonly fate: 'VS';
      readonly winnerId: string;
      readonly loserId: string;
      readonly loserResult: 'ELIMINATED' | 'BLOCKED';
      /** Winner's reward: gained a Shield, already had one, or none due to Sudden Death. */
      readonly winnerShield: 'GAINED' | 'ALREADY' | 'SUDDEN_DEATH';
    };

export interface ResolvedTurn {
  readonly turn: CommittedTurn;
  readonly outcome: TurnOutcome;
  readonly eliminatedId: string | null;
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
      readonly type: 'TURN_RESOLVED';
      readonly turnId: string;
      readonly turnNumber: number;
      readonly playerId: string;
      readonly outcome: TurnOutcome;
      readonly duel: CommittedDuel | null;
    })
  | (EventBase & { readonly type: 'SUDDEN_DEATH_STARTED'; readonly fateSlots: readonly FateKind[] })
  | (EventBase & { readonly type: 'SHIELDS_CLEARED'; readonly playerIds: readonly string[] })
  | (EventBase & { readonly type: 'FINALE_REACHED'; readonly finalistIds: readonly string[] })
  /** Visual positions changed. Never affects odds. Hidden from the visible log. */
  | (EventBase & {
      readonly type: 'POSITIONS_SHUFFLED';
      readonly playerOrder: readonly string[];
      readonly fateSlots: readonly FateKind[];
    });

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
  /** Grid order = array order. */
  readonly players: readonly MatchPlayer[];
  /** The visible 20 equally likely Fate slots; always the real active odds. */
  readonly fateSlots: readonly FateKind[];
  readonly phase: MatchPhase;
  readonly completedTurns: number;
  readonly pendingTurn: CommittedTurn | null;
  readonly lastTurn: ResolvedTurn | null;
  /** Consecutive completed ordinary turns without an elimination. */
  readonly noEliminationStreak: number;
  /** Active for the rest of the ordinary stage once the streak reaches 3. */
  readonly suddenDeath: boolean;
  readonly events: readonly MatchEvent[];
}
