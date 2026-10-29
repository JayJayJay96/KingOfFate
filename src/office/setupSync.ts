import type { SetupConfig } from '../game/setup/setupConfig';
import { getBrowserStorage, parseStoredSetup, toStoredSetup } from '../storage/setupStorage';
import type { OfficeClient } from './officeClient';
import type { OfficeStatusStore } from './officeStatus';

export const OFFICE_SETUP_KEY = 'kof.office.setup';
export const OFFICE_SETUP_META_KEY = 'kof.office.setupMeta';

/**
 * - `synced`: this PC has the office setup.
 * - `offline`: the server is unreachable; changes are kept on this PC only.
 * - `diverged`: this PC changed the setup while offline; the host chooses whose to keep.
 * - `conflict`: another host saved first; the host chooses whose to keep.
 * - `code`: the office code was refused.
 */
export type SetupSyncState = 'synced' | 'offline' | 'diverged' | 'conflict' | 'code';

interface Meta {
  /** Office setup version this PC's copy is based on. */
  readonly version: number;
  /** Local changes not yet on the server. */
  readonly dirty: boolean;
  /** A save failed because the server was unreachable (owner: these stay local until chosen). */
  readonly stranded: boolean;
}

export interface SetupSync {
  /** Call after every local change. */
  readonly changed: () => void;
  /** Fetches the office setup; applies it unless this PC has unsent changes. */
  readonly pull: () => Promise<void>;
  /** Keep the office copy, dropping this PC's unsent changes. */
  readonly useOffice: () => Promise<void>;
  /** Upload this PC's copy over the office copy. */
  readonly uploadMine: () => Promise<void>;
}

/** Owner decisions 2026-10-29: shared setup, "who saved first wins", then an explicit choice. */
export function createSetupSync(options: {
  readonly client: OfficeClient;
  readonly code: string;
  readonly status: OfficeStatusStore;
  /** This PC's current setup. */
  readonly current: () => SetupConfig;
  /** Applies a setup that came from the office. */
  readonly apply: (config: SetupConfig) => void;
  readonly onState: (state: SetupSyncState) => void;
  readonly storage?: Storage | null;
  /** Wait after the last change before saving (e.g. typing in the title box). */
  readonly debounceMs?: number;
}): SetupSync {
  const { client, code, status, current, apply, onState, debounceMs = 700 } = options;
  const storage = options.storage === undefined ? getBrowserStorage() : options.storage;
  let state: SetupSyncState = 'synced';
  let remote: { config: SetupConfig | null; version: number } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const readMeta = (): Meta => {
    try {
      const v = JSON.parse(storage?.getItem(OFFICE_SETUP_META_KEY) ?? 'null') as Meta | null;
      if (v && Number.isInteger(v.version)) return v;
    } catch {
      // Fresh below.
    }
    return { version: 0, dirty: false, stranded: false };
  };
  const writeMeta = (change: Partial<Meta>) => {
    try {
      storage?.setItem(OFFICE_SETUP_META_KEY, JSON.stringify({ ...readMeta(), ...change }));
    } catch {
      // Worst case the next pull asks again.
    }
  };
  const setState = (next: SetupSyncState) => {
    state = next;
    status.set({ link: next === 'offline' ? 'offline' : next === 'code' ? 'code' : 'online' });
    onState(next);
  };
  const remember = (setup: unknown, version: number) => {
    remote = { config: setup ? (parseStoredSetup(setup)?.config ?? null) : null, version };
  };

  async function push(baseVersion: number) {
    const config = current();
    const result = await client.saveSetup(code, toStoredSetup(config), baseVersion);
    if (result.ok) {
      writeMeta({ version: result.version, dirty: false, stranded: false });
      remote = { config, version: result.version };
      setState('synced');
    } else if (result.error === 'conflict') {
      remember(result.setup, result.version ?? 0);
      setState('conflict');
    } else if (result.error === 'offline') {
      writeMeta({ stranded: true });
      setState('offline');
    } else {
      setState(result.error === 'code' ? 'code' : 'offline');
    }
  }

  async function pull() {
    if (timer) return; // A save is about to go out.
    const result = await client.getSetup(code);
    if (!result.ok) {
      setState(result.error === 'code' ? 'code' : 'offline');
      return;
    }
    remember(result.setup, result.version);
    const meta = readMeta();
    if (!remote?.config) {
      // Empty office: the first host's setup becomes the office setup.
      await push(result.version);
    } else if (meta.stranded) {
      setState('diverged');
    } else if (meta.dirty && meta.version !== result.version) {
      setState('conflict');
    } else if (meta.dirty) {
      await push(result.version);
    } else {
      writeMeta({ version: result.version });
      apply(remote.config);
      setState('synced');
    }
  }

  return {
    changed() {
      writeMeta({ dirty: true });
      if (state === 'conflict' || state === 'diverged' || state === 'code') return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void push(readMeta().version);
      }, debounceMs);
    },
    pull,
    async useOffice() {
      const fresh = await client.getSetup(code);
      if (!fresh.ok) {
        setState(fresh.error === 'code' ? 'code' : 'offline');
        return;
      }
      remember(fresh.setup, fresh.version);
      if (!remote?.config) return;
      writeMeta({ version: remote.version, dirty: false, stranded: false });
      apply(remote.config);
      setState('synced');
    },
    async uploadMine() {
      const fresh = await client.getSetup(code);
      if (!fresh.ok) {
        setState(fresh.error === 'code' ? 'code' : 'offline');
        return;
      }
      await push(fresh.version);
    },
  };
}
