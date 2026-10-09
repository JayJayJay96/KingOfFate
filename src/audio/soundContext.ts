import { createContext, useContext } from 'react';
import type { AudioSettings } from './audioSettings';
import type { SoundEngine } from './soundEngine';
import type { VoiceInfo } from './voice';

export interface CustomMusicInfo {
  readonly name: string;
  readonly size: number;
}

export interface SoundControls {
  readonly engine: SoundEngine;
  readonly settings: AudioSettings;
  readonly update: (change: Partial<AudioSettings>) => void;
  readonly toggleMute: () => void;
  readonly voices: readonly VoiceInfo[];
  readonly customMusic: CustomMusicInfo | null;
  /** Returns an error message, or null on success. */
  readonly setCustomMusic: (file: File) => Promise<string | null>;
  readonly removeCustomMusic: () => Promise<void>;
}

export const SoundContext = createContext<SoundControls | null>(null);

export function useSound(): SoundControls {
  const value = useContext(SoundContext);
  if (!value) throw new Error('useSound must be used inside <SoundProvider>');
  return value;
}
