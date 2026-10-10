/** Per-browser sound preferences (owner convenience, never part of match state). */
export interface AudioSettings {
  readonly muted: boolean;
  /** 0–1 volumes per layer (PROJECT.md §5: configurable music / voice / SFX). */
  readonly music: number;
  readonly voice: number;
  readonly sfx: number;
  /** Chosen chant voice, or null for automatic (an English voice). */
  readonly voiceURI: string | null;
  /** Match-screen music: the original built-in chiptune, or the host's own local file. */
  readonly musicSource: 'builtin' | 'custom';
  /** English arcade announcer callouts ("K.O.!", "Round 1… Fight!"), on the voice volume. */
  readonly announcer: boolean;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  muted: false,
  music: 0.5,
  voice: 1,
  sfx: 0.7,
  voiceURI: null,
  musicSource: 'builtin',
  announcer: true,
};

export const AUDIO_SETTINGS_KEY = 'kof.audio';
/** Phase 4 key ("on" | "off"); migrated into `muted`. */
const LEGACY_SOUND_KEY = 'kof.sound';

export function loadAudioSettings(storage: Storage | null = safeStorage()): AudioSettings {
  if (!storage) return DEFAULT_AUDIO_SETTINGS;
  let parsed: unknown = null;
  try {
    const raw = storage.getItem(AUDIO_SETTINGS_KEY);
    parsed = raw === null ? null : JSON.parse(raw);
  } catch {
    parsed = null;
  }
  if (!isRecord(parsed)) {
    let legacyMuted = false;
    try {
      legacyMuted = storage.getItem(LEGACY_SOUND_KEY) === 'off';
    } catch {
      // ignore
    }
    return { ...DEFAULT_AUDIO_SETTINGS, muted: legacyMuted };
  }
  return {
    muted: typeof parsed.muted === 'boolean' ? parsed.muted : DEFAULT_AUDIO_SETTINGS.muted,
    music: volumeOr(parsed.music, DEFAULT_AUDIO_SETTINGS.music),
    voice: volumeOr(parsed.voice, DEFAULT_AUDIO_SETTINGS.voice),
    sfx: volumeOr(parsed.sfx, DEFAULT_AUDIO_SETTINGS.sfx),
    voiceURI: typeof parsed.voiceURI === 'string' ? parsed.voiceURI : null,
    musicSource: parsed.musicSource === 'custom' ? 'custom' : 'builtin',
    announcer:
      typeof parsed.announcer === 'boolean' ? parsed.announcer : DEFAULT_AUDIO_SETTINGS.announcer,
  };
}

export function saveAudioSettings(
  settings: AudioSettings,
  storage: Storage | null = safeStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

function volumeOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
