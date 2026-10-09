import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createAssetStore, CUSTOM_MUSIC_KEY, type AssetStore } from '../storage/assetStorage';
import { loadAudioSettings, saveAudioSettings, type AudioSettings } from './audioSettings';
import { SoundContext, type CustomMusicInfo, type SoundControls } from './soundContext';
import { createSoundEngine, type SoundEngine } from './soundEngine';
import type { VoiceInfo } from './voice';

interface SoundProviderProps {
  readonly children: ReactNode;
  /** Injection for tests. */
  readonly engine?: SoundEngine;
  readonly assets?: AssetStore;
}

/** One sound engine for the whole app, plus persisted settings and the optional custom music. */
export function SoundProvider({
  children,
  engine: injected,
  assets: injectedAssets,
}: SoundProviderProps) {
  const [engine] = useState(() => injected ?? createSoundEngine());
  const [assets] = useState(() => injectedAssets ?? createAssetStore());
  const [settings, setSettings] = useState<AudioSettings>(loadAudioSettings);
  const [voices, setVoices] = useState<readonly VoiceInfo[]>(() => engine.listVoices());
  const [customMusic, setCustomMusicInfo] = useState<CustomMusicInfo | null>(null);
  const [customUrl, setCustomUrl] = useState<string | null>(null);

  // Browsers only allow audio after a user gesture: unlock on the first click or key press.
  useEffect(() => {
    const unlock = () => engine.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [engine]);

  // Voices load asynchronously and the "voiceschanged" event may fire before we subscribe,
  // so also re-read shortly after mount.
  useEffect(() => {
    const refresh = () => setVoices(engine.listVoices());
    const unsubscribe = engine.onVoicesChanged(refresh);
    const timers = [0, 500, 2000].map((ms) => setTimeout(refresh, ms));
    return () => {
      unsubscribe();
      timers.forEach(clearTimeout);
    };
  }, [engine]);
  useEffect(() => () => engine.dispose(), [engine]);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    assets
      .get(CUSTOM_MUSIC_KEY)
      .then((asset) => {
        if (cancelled || !asset) return;
        url = URL.createObjectURL(asset.blob);
        setCustomUrl(url);
        setCustomMusicInfo({ name: asset.name, size: asset.size });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [assets]);

  useEffect(() => {
    engine.apply(settings, customUrl);
  }, [engine, settings, customUrl]);

  const update = useCallback((change: Partial<AudioSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...change };
      saveAudioSettings(next);
      return next;
    });
  }, []);

  const toggleMute = useCallback(() => {
    engine.unlock();
    setSettings((prev) => {
      const next = { ...prev, muted: !prev.muted };
      saveAudioSettings(next);
      return next;
    });
  }, [engine]);

  const setCustomMusic = useCallback(
    async (file: File) => {
      try {
        const asset = await assets.put(CUSTOM_MUSIC_KEY, file, file.name, new Date().toISOString());
        setCustomUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(asset.blob);
        });
        setCustomMusicInfo({ name: asset.name, size: asset.size });
        update({ musicSource: 'custom' });
        return null;
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    },
    [assets, update],
  );

  const removeCustomMusic = useCallback(async () => {
    await assets.remove(CUSTOM_MUSIC_KEY).catch(() => undefined);
    setCustomUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    setCustomMusicInfo(null);
    update({ musicSource: 'builtin' });
  }, [assets, update]);

  const value = useMemo<SoundControls>(
    () => ({
      engine,
      settings,
      update,
      toggleMute,
      voices,
      customMusic,
      setCustomMusic,
      removeCustomMusic,
    }),
    [engine, settings, update, toggleMute, voices, customMusic, setCustomMusic, removeCustomMusic],
  );

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}
