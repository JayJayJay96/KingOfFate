import { isWinnerCount } from '../game/config/limits';
import { FATE_SLOT_COUNT, isFatePresetId } from '../game/config/presets';
import { isFateKind } from '../game/engine/fateSlots';
import { MATCH_SCHEMA_VERSION, type MatchState } from '../game/engine/matchTypes';
import { isGesture } from '../game/engine/rps';

export type MatchLoadResult =
  | { readonly status: 'none' }
  | { readonly status: 'loaded'; readonly match: MatchState }
  | { readonly status: 'corrupt' }
  /** Saved by an older app version with different rules; discarded, never migrated. */
  | { readonly status: 'outdated' }
  | { readonly status: 'unavailable'; readonly message: string };

export type MatchSaveResult =
  { readonly ok: true } | { readonly ok: false; readonly message: string };

/** The once-only result of a won match (full final state kept for audit/history). */
export interface CompletedMatchRecord {
  readonly recordVersion: 1;
  readonly matchId: string;
  /** ISO-8601 UTC. */
  readonly completedAt: string;
  readonly winnerIds: readonly string[];
  readonly match: MatchState;
}

/**
 * Checkpoint store for the single in-progress match. Each save is one atomic write; saving a
 * VICTORY state also writes its completion record in the SAME transaction (keyed by matchId, so
 * repeated saves can never create a second record).
 */
export interface MatchRepository {
  load(): Promise<MatchLoadResult>;
  save(match: MatchState): Promise<MatchSaveResult>;
  clear(): Promise<MatchSaveResult>;
  /** Raw stored records; history re-validates each one (older rule versions included). */
  listCompleted(): Promise<CompletedMatchRecord[]>;
  deleteCompleted(matchId: string): Promise<MatchSaveResult>;
  clearCompleted(): Promise<MatchSaveResult>;
}

export function toCompletedRecord(match: MatchState): CompletedMatchRecord {
  if (match.phase !== 'VICTORY' || !match.completedAt || !match.finale) {
    throw new Error('Only a won match has a completion record');
  }
  return {
    recordVersion: 1,
    matchId: match.matchId,
    completedAt: match.completedAt,
    winnerIds: match.finale.winnerIds,
    match,
  };
}

const DB_NAME = 'kof';
/** v2 adds the completed-matches store (Phase 4). */
const DB_VERSION = 2;
const STORE = 'current-match';
const COMPLETED_STORE = 'completed-matches';
const CURRENT_KEY = 'current';
const CORRUPT_KEY = 'corrupt-backup';

export function createIndexedDbMatchRepository(
  /** `null` = IndexedDB unavailable (e.g. blocked/private mode); every call then reports it. */
  factory: IDBFactory | null = globalThis.indexedDB ?? null,
): MatchRepository {
  let dbPromise: Promise<IDBDatabase> | null = null;

  function open(): Promise<IDBDatabase> {
    if (!factory) return Promise.reject(new Error('IndexedDB is not available in this browser.'));
    dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
        if (!db.objectStoreNames.contains(COMPLETED_STORE)) {
          db.createObjectStore(COMPLETED_STORE, { keyPath: 'matchId' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Could not open IndexedDB.'));
      request.onblocked = () => reject(new Error('IndexedDB upgrade is blocked by another tab.'));
    }).catch((error: unknown) => {
      dbPromise = null;
      throw error;
    });
    return dbPromise;
  }

  /** Runs one transaction over the given stores; resolves only after it has fully committed. */
  async function transact<T>(
    mode: IDBTransactionMode,
    work: (store: IDBObjectStore, tx: IDBTransaction) => IDBRequest<T> | void,
    stores: string[] = [STORE],
  ): Promise<T | undefined> {
    const db = await open();
    return new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(stores, mode);
      const request = work(tx.objectStore(STORE), tx);
      tx.oncomplete = () => resolve(request ? request.result : undefined);
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed.'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted.'));
    });
  }

  return {
    async load() {
      let raw: unknown;
      try {
        raw = await transact<unknown>('readonly', (store) => store.get(CURRENT_KEY));
      } catch (error) {
        return { status: 'unavailable', message: messageOf(error) };
      }
      if (raw === undefined) return { status: 'none' };
      if (
        isRecord(raw) &&
        typeof raw.schemaVersion === 'number' &&
        raw.schemaVersion < MATCH_SCHEMA_VERSION
      ) {
        try {
          await transact('readwrite', (store) => store.delete(CURRENT_KEY));
        } catch {
          // Best effort.
        }
        return { status: 'outdated' };
      }
      if (!isMatchState(raw)) {
        try {
          await transact('readwrite', (store) => {
            store.put(raw, CORRUPT_KEY);
            store.delete(CURRENT_KEY);
          });
        } catch {
          // Best effort: reporting "corrupt" is what matters.
        }
        return { status: 'corrupt' };
      }
      return { status: 'loaded', match: raw };
    },
    async save(match) {
      try {
        const completed = match.phase === 'VICTORY' ? toCompletedRecord(match) : null;
        await transact(
          'readwrite',
          (store, tx) => {
            if (completed) tx.objectStore(COMPLETED_STORE).put(completed);
            return store.put(match, CURRENT_KEY);
          },
          [STORE, COMPLETED_STORE],
        );
        return { ok: true };
      } catch (error) {
        return { ok: false, message: messageOf(error) };
      }
    },
    async clear() {
      try {
        await transact('readwrite', (store) => store.delete(CURRENT_KEY));
        return { ok: true };
      } catch (error) {
        return { ok: false, message: messageOf(error) };
      }
    },
    async listCompleted() {
      const all = await transact<CompletedMatchRecord[]>(
        'readonly',
        (_store, tx) => tx.objectStore(COMPLETED_STORE).getAll(),
        [STORE, COMPLETED_STORE],
      );
      return all ?? [];
    },
    async deleteCompleted(matchId) {
      try {
        await transact(
          'readwrite',
          (_store, tx) => tx.objectStore(COMPLETED_STORE).delete(matchId),
          [STORE, COMPLETED_STORE],
        );
        return { ok: true };
      } catch (error) {
        return { ok: false, message: messageOf(error) };
      }
    },
    async clearCompleted() {
      try {
        await transact('readwrite', (_store, tx) => tx.objectStore(COMPLETED_STORE).clear(), [
          STORE,
          COMPLETED_STORE,
        ]);
        return { ok: true };
      } catch (error) {
        return { ok: false, message: messageOf(error) };
      }
    },
  };
}

/** In-memory repository for tests; structuredClone mimics IndexedDB's copy semantics. */
export function createMemoryMatchRepository(
  initial: MatchState | null = null,
  /** Pre-existing history (raw, may include invalid records for tests). */
  completedRecords: readonly CompletedMatchRecord[] = [],
): MatchRepository {
  let stored: MatchState | null = initial ? structuredClone(initial) : null;
  const completed = new Map<string, CompletedMatchRecord>(
    completedRecords.map((r) => [r.matchId, structuredClone(r)]),
  );
  return {
    async load() {
      return stored ? { status: 'loaded', match: structuredClone(stored) } : { status: 'none' };
    },
    async save(match) {
      stored = structuredClone(match);
      if (match.phase === 'VICTORY') {
        completed.set(match.matchId, structuredClone(toCompletedRecord(match)));
      }
      return { ok: true };
    },
    async clear() {
      stored = null;
      return { ok: true };
    },
    async listCompleted() {
      return [...completed.values()].map((r) => structuredClone(r));
    },
    async deleteCompleted(matchId) {
      completed.delete(matchId);
      return { ok: true };
    },
    async clearCompleted() {
      completed.clear();
      return { ok: true };
    },
  };
}

const PHASES = new Set(['READY', 'SPINNING', 'FINALE', 'VICTORY']);

/** Structural + consistency check so a damaged checkpoint can never be resumed. */
export function isMatchState(value: unknown): value is MatchState {
  if (!isRecord(value)) return false;
  if (value.schemaVersion !== MATCH_SCHEMA_VERSION) return false;
  if (typeof value.matchId !== 'string' || typeof value.startedAt !== 'string') return false;
  if (!isFatePresetId(value.presetId) || !isWinnerCount(value.winnerCount)) return false;
  if (typeof value.phase !== 'string' || !PHASES.has(value.phase)) return false;
  if (
    !isNonNegativeInt(value.completedTurns) ||
    !isNonNegativeInt(value.shieldSupply) ||
    !isNonNegativeInt(value.suddenDeathAt)
  ) {
    return false;
  }
  if (!Array.isArray(value.players) || !Array.isArray(value.events)) return false;

  const ids = new Set<string>();
  for (const p of value.players) {
    if (
      !isRecord(p) ||
      typeof p.id !== 'string' ||
      typeof p.name !== 'string' ||
      typeof p.alive !== 'boolean' ||
      typeof p.shield !== 'boolean' ||
      (!p.alive && p.shield) ||
      ids.has(p.id)
    ) {
      return false;
    }
    ids.add(p.id);
  }
  const alive = value.players.filter((p) => (p as { alive: boolean }).alive) as { id: string }[];
  if (alive.length < value.winnerCount + 1) return false;
  if (typeof value.suddenDeath !== 'boolean') return false;
  if (
    !Array.isArray(value.fateSlots) ||
    value.fateSlots.length !== FATE_SLOT_COUNT ||
    !value.fateSlots.every(isFateKind)
  ) {
    return false;
  }
  if (value.suddenDeath && value.fateSlots.includes('SHIELD')) return false;

  const pending = value.pendingTurn;
  if (value.phase === 'SPINNING') {
    if (!isRecord(pending) || typeof pending.turnId !== 'string') return false;
    if (!alive.some((p) => p.id === pending.playerId)) return false;
    const slot = pending.fateSlotIndex;
    if (
      typeof slot !== 'number' ||
      !Number.isInteger(slot) ||
      slot < 0 ||
      slot >= FATE_SLOT_COUNT
    ) {
      return false;
    }
    if (!isFateKind(pending.fate)) return false;
    if (
      pending.fate === 'VS'
        ? !isValidDuel(pending.duel, pending.playerId, alive)
        : pending.duel !== null
    ) {
      return false;
    }
  } else if (pending !== null) {
    return false;
  }

  const inFinale = value.phase === 'FINALE' || value.phase === 'VICTORY';
  if (!inFinale) return value.finale === null && value.completedAt === null;
  return isValidFinale(value.finale, alive, value.winnerCount, value.phase, value.completedAt);
}

function isValidFinale(
  finale: unknown,
  alive: readonly { id: string }[],
  winnerCount: number,
  phase: string,
  completedAt: unknown,
): boolean {
  if (!isRecord(finale) || typeof finale.started !== 'boolean') return false;
  if (!isNonNegativeInt(finale.stageNumber) || (finale.stageNumber as number) < 1) return false;
  const lists = ['finalistIds', 'contenderIds', 'winnerIds', 'excludedIds'] as const;
  if (!lists.every((k) => isStringArray(finale[k]))) return false;
  const finalists = finale.finalistIds as string[];
  const contenders = finale.contenderIds as string[];
  const winners = finale.winnerIds as string[];
  const excluded = finale.excludedIds as string[];
  const aliveIds = new Set(alive.map((p) => p.id));
  if (finalists.length !== aliveIds.size || !finalists.every((id) => aliveIds.has(id))) {
    return false;
  }
  const seen = new Set<string>();
  for (const id of [...contenders, ...winners, ...excluded]) {
    if (!aliveIds.has(id) || seen.has(id)) return false;
    seen.add(id);
  }
  if (!isRecord(finale.scores) || !Object.values(finale.scores).every(isNonNegativeInt)) {
    return false;
  }
  if (!Array.isArray(finale.rounds)) return false;

  const pending = finale.pendingRound;
  if (pending !== null) {
    if (!isRecord(pending) || typeof pending.roundId !== 'string') return false;
    if (!Array.isArray(pending.throws) || pending.throws.length !== contenders.length) return false;
    const ok = pending.throws.every(
      (t, i) => isRecord(t) && t.playerId === contenders[i] && isGesture(t.gesture),
    );
    if (!ok) return false;
  }

  if (phase === 'VICTORY') {
    return winners.length === winnerCount && pending === null && typeof completedAt === 'string';
  }
  return winners.length < winnerCount && contenders.length > 0 && completedAt === null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function isValidDuel(duel: unknown, playerId: unknown, alive: readonly { id: string }[]): boolean {
  if (!isRecord(duel) || duel.opponentId === playerId) return false;
  if (!alive.some((p) => p.id === duel.opponentId)) return false;
  if (!Array.isArray(duel.throws) || duel.throws.length === 0) return false;
  const ok = duel.throws.every(
    (t) => isRecord(t) && isGesture(t.challenger) && isGesture(t.opponent),
  );
  const last = duel.throws.at(-1) as { challenger: string; opponent: string };
  return ok && last.challenger !== last.opponent;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeInt(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
