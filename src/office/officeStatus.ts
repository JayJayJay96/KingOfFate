import { useSyncExternalStore } from 'react';

/** How this PC is talking to the office server right now. */
export interface OfficeStatus {
  /** 'offline' = server unreachable after retries, local data in use; 'code' = code refused. */
  readonly link: 'online' | 'offline' | 'code' | 'unknown';
  /** Completed matches saved on this PC and not yet uploaded. */
  readonly pending: number;
}

export interface OfficeStatusStore {
  get(): OfficeStatus;
  set(change: Partial<OfficeStatus>): void;
  subscribe(listener: () => void): () => void;
}

export function createOfficeStatusStore(): OfficeStatusStore {
  let status: OfficeStatus = { link: 'unknown', pending: 0 };
  const listeners = new Set<() => void>();
  return {
    get: () => status,
    set(change) {
      const next = { ...status, ...change };
      if (next.link === status.link && next.pending === status.pending) return;
      status = next;
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function useOfficeStatus(store: OfficeStatusStore | null): OfficeStatus | null {
  return useSyncExternalStore(
    (l) => store?.subscribe(l) ?? (() => {}),
    () => store?.get() ?? null,
  );
}
