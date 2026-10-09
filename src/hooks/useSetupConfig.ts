import { useCallback, useRef, useState } from 'react';
import type { SetupConfig } from '../game/setup/setupConfig';
import { loadSetup, saveSetup, type SetupLoadStatus } from '../storage/setupStorage';

const UNAVAILABLE_MESSAGE = 'Browser storage is unavailable.';

export type SetupUpdater = (change: (config: SetupConfig) => SetupConfig) => void;

export interface SetupStore {
  readonly config: SetupConfig;
  readonly loadStatus: SetupLoadStatus;
  /** Non-null when the latest change could not be persisted; never pretend it was saved. */
  readonly saveError: string | null;
  readonly update: SetupUpdater;
}

/** Loads the one default configuration once and persists every change to localStorage. */
export function useSetupConfig(): SetupStore {
  const [initial] = useState(() => loadSetup());
  const [config, setConfig] = useState(initial.config);
  const [saveError, setSaveError] = useState<string | null>(
    initial.status === 'unavailable' ? UNAVAILABLE_MESSAGE : null,
  );
  const latest = useRef(initial.config);

  const update = useCallback<SetupUpdater>((change) => {
    const next = change(latest.current);
    if (next === latest.current) return;
    latest.current = next;
    setConfig(next);
    const result = saveSetup(next);
    setSaveError(result.ok ? null : result.message);
  }, []);

  return { config, loadStatus: initial.status, saveError, update };
}
