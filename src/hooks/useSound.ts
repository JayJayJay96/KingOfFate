import { useCallback, useEffect, useState } from 'react';
import { createFinaleAudio, type FinaleAudio } from '../audio/finaleAudio';

const SOUND_KEY = 'kof.sound';

export interface SoundControl {
  readonly audio: FinaleAudio;
  readonly enabled: boolean;
  /** True once a host click has allowed the browser to play audio. */
  readonly unlocked: boolean;
  readonly unlock: () => void;
  readonly toggle: () => void;
}

function readPreference(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}

/** Sound on/off (persisted per browser) and the shared finale audio engine. */
export function useSound(): SoundControl {
  const [audio] = useState(createFinaleAudio);
  const [enabled, setEnabled] = useState(readPreference);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    audio.setEnabled(enabled);
  }, [audio, enabled]);

  useEffect(() => () => audio.stopMusic(), [audio]);

  const unlock = useCallback(() => {
    audio.unlock();
    setUnlocked(true);
  }, [audio]);

  const toggle = useCallback(() => {
    setEnabled((was) => {
      const next = !was;
      try {
        localStorage.setItem(SOUND_KEY, next ? 'on' : 'off');
      } catch {
        // Preference is a convenience; ignore storage failures.
      }
      return next;
    });
    unlock();
  }, [unlock]);

  return { audio, enabled, unlocked, unlock, toggle };
}
