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

/** Checkpoint store for the single in-progress match. Each save is one atomic write. */
export interface MatchRepository {
  load(): Promise<MatchLoadResult>;
  save(match: MatchState): Promise<MatchSaveResult>;
  clear(): Promise<MatchSaveResult>;
}

const DB_NAME = 'kof';
const DB_VERSION = 1;
const STORE = 'current-match';
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
        if (!request.result.objectStoreNames.contains(STORE)) {
          request.result.createObjectStore(STORE);
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

  /** Runs one transaction; resolves only after it has fully committed. */
  async function transact<T>(
    mode: IDBTransactionMode,
    work: (store: IDBObjectStore) => IDBRequest<T> | void,
  ): Promise<T | undefined> {
    const db = await open();
    return new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = work(tx.objectStore(STORE));
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
        await transact('readwrite', (store) => store.put(match, CURRENT_KEY));
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
  };
}

/** In-memory repository for tests; structuredClone mimics IndexedDB's copy semantics. */
export function createMemoryMatchRepository(initial: MatchState | null = null): MatchRepository {
  let stored: MatchState | null = initial ? structuredClone(initial) : null;
  return {
    async load() {
      return stored ? { status: 'loaded', match: structuredClone(stored) } : { status: 'none' };
    },
    async save(match) {
      stored = structuredClone(match);
      return { ok: true };
    },
    async clear() {
      stored = null;
      return { ok: true };
    },
  };
}

const PHASES = new Set(['READY', 'SPINNING', 'FINALE_GATE']);

/** Structural + consistency check so a damaged checkpoint can never be resumed. */
export function isMatchState(value: unknown): value is MatchState {
  if (!isRecord(value)) return false;
  if (value.schemaVersion !== MATCH_SCHEMA_VERSION) return false;
  if (typeof value.matchId !== 'string' || typeof value.startedAt !== 'string') return false;
  if (!isFatePresetId(value.presetId) || !isWinnerCount(value.winnerCount)) return false;
  if (typeof value.phase !== 'string' || !PHASES.has(value.phase)) return false;
  if (!isNonNegativeInt(value.completedTurns) || !isNonNegativeInt(value.noEliminationStreak)) {
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
  return true;
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
