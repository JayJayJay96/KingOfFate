import { useCallback, useEffect, useRef, useState } from 'react';
import type { SetupConfig } from '../game/setup/setupConfig';
import type { OfficeClient } from '../office/officeClient';
import type { OfficeStatusStore } from '../office/officeStatus';
import {
  createSetupSync,
  OFFICE_SETUP_KEY,
  type SetupSync,
  type SetupSyncState,
} from '../office/setupSync';
import {
  getBrowserStorage,
  loadSetup,
  saveSetup,
  SETUP_STORAGE_KEY,
  type SetupLoadStatus,
} from '../storage/setupStorage';

const UNAVAILABLE_MESSAGE = 'Browser storage is unavailable.';

export type SetupUpdater = (change: (config: SetupConfig) => SetupConfig) => void;

export interface OfficeSetupOptions {
  readonly client: OfficeClient;
  readonly code: string;
  readonly status: OfficeStatusStore;
}

export interface SetupStore {
  readonly config: SetupConfig;
  readonly loadStatus: SetupLoadStatus;
  /** Non-null when the latest change could not be persisted; never pretend it was saved. */
  readonly saveError: string | null;
  readonly update: SetupUpdater;
  /** Office mode only: shared-setup state and the host's choices. */
  readonly office?: {
    readonly state: SetupSyncState;
    /** Fetches the office setup (applied unless this PC has unsent changes). */
    readonly refresh: () => Promise<void>;
    readonly useOffice: () => void;
    readonly uploadMine: () => void;
  };
}

/**
 * Loads the one default configuration once and persists every change to localStorage. In Office
 * mode (`office` must keep one identity) the setup is also shared through the office server; its
 * own local copy keeps working offline and starts from this PC's Personal setup.
 */
export function useSetupConfig(office?: OfficeSetupOptions): SetupStore {
  const key = office ? OFFICE_SETUP_KEY : SETUP_STORAGE_KEY;
  const [initial] = useState(() => {
    const loaded = loadSetup(getBrowserStorage(), key);
    return office && loaded.status === 'empty' ? loadSetup() : loaded;
  });
  const [config, setConfig] = useState(initial.config);
  const [saveError, setSaveError] = useState<string | null>(
    initial.status === 'unavailable' ? UNAVAILABLE_MESSAGE : null,
  );
  const latest = useRef(initial.config);
  const [syncState, setSyncState] = useState<SetupSyncState>('synced');
  const sync = useRef<SetupSync | null>(null);

  const store = useCallback(
    (next: SetupConfig) => {
      latest.current = next;
      setConfig(next);
      const result = saveSetup(next, getBrowserStorage(), key);
      setSaveError(result.ok ? null : result.message);
    },
    [key],
  );

  useEffect(() => {
    if (!office) return;
    const current = createSetupSync({
      ...office,
      current: () => latest.current,
      apply: store,
      onState: setSyncState,
    });
    sync.current = current;
    void current.pull();
    return () => {
      sync.current = null;
    };
  }, [office, store]);

  const update = useCallback<SetupUpdater>(
    (change) => {
      const next = change(latest.current);
      if (next === latest.current) return;
      store(next);
      sync.current?.changed();
    },
    [store],
  );

  const refresh = useCallback(() => sync.current?.pull() ?? Promise.resolve(), []);

  return {
    config,
    loadStatus: initial.status,
    saveError,
    update,
    ...(office && {
      office: {
        state: syncState,
        refresh,
        useOffice: () => void sync.current?.useOffice(),
        uploadMine: () => void sync.current?.uploadMine(),
      },
    }),
  };
}
