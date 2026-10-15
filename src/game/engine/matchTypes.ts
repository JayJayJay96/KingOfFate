import type { FighterLook } from '../config/looks';
import type { FateKind, FatePresetId } from '../config/presets';
import type { DuelThrow, Gesture } from './rps';

/**
 * v4: limited Shield supply + Sudden Death at one-third left (replaces the 3-turn streak).
 * v3 added the automated RPS finale and completion; v2 added Fates/Shields.
 */
export const MATCH_SCHEMA_VERSION = 4;

export interface MatchPlayer {
  readonly id: string;
  readonly name: string;
  readonly alive: boolean;
  /** At most one Shield per player. */
  readonly shield: boolean;
  /** Turn number on which the player was eliminated, or null while alive. */
  readonly eliminatedOnTurn: number | null;
  /** Cosmetic: the custom look at match start, if the host picked one. Never affects play. */
  readonly look?: FighterLook;
}

/**
 * READY: host may start the next ordinary turn.
 * SPINNING: a turn's full outcome is committed and persisted; reveal animations are running.
 * FINALE: alive count reached W + 1; the automated RPS finale runs (see FinaleState).
 * VICTORY: exactly W winners locked; the result is committed and the ceremony shows.
 */
export type MatchPhase = 'READY' | 'SPINNING' | 'FINALE' | 'VICTORY';

export interface FinaleThrow {
  readonly playerId: string;
  readonly gesture: Gesture;
}

/** One reveal's throws, sampled and saved before its chant starts. */
export interface FinaleRoundCommit {
  readonly roundId: string;
  readonly roundNumber: number;
  /** 1 = main race; 2+ = tiebreak races. */
  readonly stageNumber: number;
  readonly throws: readonly FinaleThrow[];
}

export interface FinaleRoundResult extends FinaleRoundCommit {
  /** Null = draw (everyone the same, or all three gestures). */
  readonly winningGesture: Gesture | null;
  readonly scorerIds: readonly string[];
  readonly qualifiedIds: readonly string[];
  /** Set when this reveal oversubscribed the slots and started a tiebreak. */
  readonly tiebreakIds: readonly string[] | null;
}

export interface FinaleState {
  /** Host has pressed Start (needed so audio can play). */
  readonly started: boolean;
  readonly stageNumber: number;
  /** All finalists in their stage layout order. */
  readonly finalistIds: readonly string[];
  /** Still competing in the current race. */
  readonly contenderIds: readonly string[];
  /** Current race points (reset for tiebreaks). */
  readonly scores: Readonly<Record<string, number>>;
  /** Locked winners in qualification order. */
  readonly winnerIds: readonly string[];
  /** Out of contention after an oversubscribed reveal (D3). */
  readonly excludedIds: readonly string[];
  readonly pendingRound: FinaleRoundCommit | null;
  /** Full audit trail of every reveal and score change. */
  readonly rounds: readonly FinaleRoundResult[];
}

export interface CommittedDuel {
  readonly opponentId: string;
  /** Draws first, decisive throw last. `challenger` is the turn's selected player. */
  readonly throws: readonly DuelThrow[];
}

/** Bomb Fate (owner decision 2026-10-16): the blast also hits one adjacent living fighter. */
export interface CommittedBomb {
  /** Nearest living fighter to the left or right in grid order (50/50, wrapping). */
  readonly neighbourId: string;
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
  /** Bomb only (absent on turns saved before Bombs existed). */
  readonly bomb?: CommittedBomb | null;
}

export type TurnOutcome =
  | { readonly fate: 'KO'; readonly result: 'ELIMINATED' | 'BLOCKED' }
  | { readonly fate: 'SHIELD'; readonly result: 'GAINED' | 'WASTED' }
  | {
      readonly fate: 'BOMB';
      readonly result: 'ELIMINATED' | 'BLOCKED';
      readonly neighbourId: string;
      /** SPARED: hitting both would have left fewer than W + 1 fighters. */
      readonly neighbourResult: 'ELIMINATED' | 'BLOCKED' | 'SPARED';
    }
  | {
      readonly fate: 'VS';
      readonly winnerId: string;
      readonly loserId: string;
      readonly loserResult: 'ELIMINATED' | 'BLOCKED';
      /** Winner's reward: gained a Shield, already had one, or none due to Sudden Death. */
      readonly winnerShield: 'GAINED' | 'ALREADY' | 'SUDDEN_DEATH' | 'NO_SUPPLY';
    };

export interface ResolvedTurn {
  readonly turn: CommittedTurn;
  readonly outcome: TurnOutcome;
  /** First fighter eliminated this turn (a Bomb can also eliminate its neighbour). */
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
  | (EventBase & {
      readonly type: 'SUDDEN_DEATH_STARTED';
      readonly fateSlots: readonly FateKind[];
      readonly aliveCount: number;
      /** Fighters whose Shields shattered. */
      readonly shatteredIds: readonly string[];
    })
  /** The last Shield has been earned: Shield slots became KO. */
  | (EventBase & {
      readonly type: 'SHIELD_SUPPLY_EXHAUSTED';
      readonly fateSlots: readonly FateKind[];
    })
  | (EventBase & { readonly type: 'SHIELDS_CLEARED'; readonly playerIds: readonly string[] })
  | (EventBase & { readonly type: 'FINALE_REACHED'; readonly finalistIds: readonly string[] })
  | (EventBase & { readonly type: 'FINALE_STARTED' })
  | (EventBase & { readonly type: 'FINALE_ROUND_COMMITTED'; readonly round: FinaleRoundCommit })
  | (EventBase & { readonly type: 'FINALE_ROUND_RESOLVED'; readonly round: FinaleRoundResult })
  | (EventBase & {
      readonly type: 'FINALISTS_QUALIFIED';
      readonly playerIds: readonly string[];
      /** True when filled automatically because contenders = open slots (D2). */
      readonly automatic: boolean;
    })
  | (EventBase & {
      readonly type: 'TIEBREAK_STARTED';
      readonly contenderIds: readonly string[];
      readonly slots: number;
    })
  | (EventBase & {
      readonly type: 'MATCH_COMPLETED';
      readonly winnerIds: readonly string[];
      readonly completedAt: string;
    })
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
  /** Prize / title line, e.g. "Who buys kopi today?" (optional, cosmetic). */
  readonly title?: string;
  /** Winners of the previous match: they wear a crown (optional, cosmetic). */
  readonly championIds?: readonly string[];
  /** Grid order = array order. */
  readonly players: readonly MatchPlayer[];
  /** The visible 20 equally likely Fate slots; always the real active odds. */
  readonly fateSlots: readonly FateKind[];
  readonly phase: MatchPhase;
  readonly completedTurns: number;
  readonly pendingTurn: CommittedTurn | null;
  readonly lastTurn: ResolvedTurn | null;
  /** Shields that can still be earned this match (Shield Fate or VS win). 0 = none left. */
  readonly shieldSupply: number;
  /** Sudden Death starts when the living count drops to this (one-third of the start). */
  readonly suddenDeathAt: number;
  /** Active for the rest of the ordinary stage: all Shields shattered, none can be earned. */
  readonly suddenDeath: boolean;
  /** Present from the W + 1 handoff onwards. */
  readonly finale: FinaleState | null;
  /** ISO-8601 UTC; set exactly once when the match is won. */
  readonly completedAt: string | null;
  readonly events: readonly MatchEvent[];
}
