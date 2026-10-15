import type { ChantWord } from '../animation/finaleTimeline';
import { ANNOUNCE, IMPACT_LINE } from './announcer';

/**
 * Recorded voice clips (owner request 2026-10-10): TTS starts late and cuts out at the finale's
 * faster pace, so short audio files play instead whenever they exist. Files live in
 * `public/voice/<id>.mp3`; `public/voice/manifest.json` lists the ones present, so a missing
 * clip never causes a failed request (it simply falls back to the browser voice).
 */
export const VOICE_CLIPS = ['one', 'two', 'juice', 'ko', 'versus', 'fight'] as const;
export type VoiceClipId = (typeof VOICE_CLIPS)[number];

export const VOICE_CLIP_LABELS: Readonly<Record<VoiceClipId, string>> = {
  one: '“1”',
  two: '“2”',
  juice: '“Juice!”',
  ko: '“K.O.!”',
  versus: '“Versus!”',
  fight: '“Fight!”',
};

export const CHANT_CLIP: Readonly<Record<ChantWord, VoiceClipId>> = {
  ONE: 'one',
  TWO: 'two',
  JUICE: 'juice',
};

/** Announcer lines that have a recorded clip. */
export const ANNOUNCE_CLIP: Readonly<Record<string, VoiceClipId>> = {
  [IMPACT_LINE.ko]: 'ko',
  [ANNOUNCE.versus]: 'versus',
  [ANNOUNCE.fight]: 'fight',
};

export const VOICE_BASE = 'voice/';

export function isVoiceClipId(value: unknown): value is VoiceClipId {
  return typeof value === 'string' && (VOICE_CLIPS as readonly string[]).includes(value);
}

/** Clip ids listed in the manifest (unknown or malformed entries are ignored). */
export function parseManifest(json: unknown): VoiceClipId[] {
  const list =
    typeof json === 'object' && json !== null && Array.isArray((json as { clips?: unknown }).clips)
      ? (json as { clips: unknown[] }).clips
      : [];
  return [...new Set(list.filter(isVoiceClipId))];
}
