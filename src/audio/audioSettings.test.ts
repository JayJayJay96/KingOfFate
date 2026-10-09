import { describe, expect, it } from 'vitest';
import {
  AUDIO_SETTINGS_KEY,
  DEFAULT_AUDIO_SETTINGS,
  loadAudioSettings,
  saveAudioSettings,
} from './audioSettings';

describe('audio settings', () => {
  it('defaults on first run', () => {
    expect(loadAudioSettings(localStorage)).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('round-trips', () => {
    const s = {
      ...DEFAULT_AUDIO_SETTINGS,
      music: 0.2,
      voiceURI: 'vi-voice',
      musicSource: 'custom' as const,
    };
    expect(saveAudioSettings(s, localStorage)).toBe(true);
    expect(loadAudioSettings(localStorage)).toEqual(s);
  });

  it('migrates the Phase 4 "kof.sound = off" preference to muted', () => {
    localStorage.setItem('kof.sound', 'off');
    expect(loadAudioSettings(localStorage).muted).toBe(true);
  });

  it('clamps volumes and repairs bad values', () => {
    localStorage.setItem(
      AUDIO_SETTINGS_KEY,
      JSON.stringify({ muted: 'yes', music: 7, voice: -1, sfx: 'loud', musicSource: 'cassette' }),
    );
    expect(loadAudioSettings(localStorage)).toEqual({
      ...DEFAULT_AUDIO_SETTINGS,
      music: 1,
      voice: 0,
    });
  });

  it('survives unreadable JSON and missing storage', () => {
    localStorage.setItem(AUDIO_SETTINGS_KEY, '{nope');
    expect(loadAudioSettings(localStorage)).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(loadAudioSettings(null)).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(saveAudioSettings(DEFAULT_AUDIO_SETTINGS, null)).toBe(false);
  });
});

describe('announcer setting', () => {
  it('is on by default and keeps an explicit off', () => {
    expect(DEFAULT_AUDIO_SETTINGS.announcer).toBe(true);
    localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify({ announcer: false }));
    expect(loadAudioSettings(localStorage).announcer).toBe(false);
    localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify({ announcer: 'yes' }));
    expect(loadAudioSettings(localStorage).announcer).toBe(true);
    localStorage.clear();
  });
});
