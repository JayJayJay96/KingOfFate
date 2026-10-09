import { describe, expect, it } from 'vitest';
import {
  chantText,
  createChanter,
  isVietnamese,
  pickAnnouncerVoice,
  pickVoice,
  type VoiceInfo,
} from './voice';

const v = (name: string, lang: string): VoiceInfo => ({ voiceURI: name, name, lang });
const DAVID = v('Microsoft David - English (United States)', 'en-US');
const ARIA = v('Microsoft Aria Online (Natural) - English (United States)', 'en-US');
const AN = v('Microsoft An - Vietnamese (Vietnam)', 'vi-VN');
const HOAIMY = v('Microsoft HoaiMy Online (Natural) - Vietnamese (Vietnam)', 'vi-VN');
const FR = v('Thomas', 'fr-FR');

describe('pickVoice', () => {
  it('prefers a natural Vietnamese voice', () => {
    expect(pickVoice([DAVID, AN, HOAIMY, ARIA], null)).toBe(HOAIMY);
    expect(pickVoice([DAVID, AN], null)).toBe(AN);
  });

  it('falls back to English (natural first), then anything, then nothing', () => {
    expect(pickVoice([FR, DAVID, ARIA], null)).toBe(ARIA);
    expect(pickVoice([FR], null)).toBe(FR);
    expect(pickVoice([], null)).toBeNull();
  });

  it('honours the host’s choice while it exists', () => {
    expect(pickVoice([DAVID, HOAIMY], DAVID.voiceURI)).toBe(DAVID);
    expect(pickVoice([DAVID, HOAIMY], 'gone')).toBe(HOAIMY);
  });
});

describe('chantText', () => {
  it('speaks Vietnamese with a Vietnamese voice, phonetic otherwise', () => {
    expect(isVietnamese(HOAIMY)).toBe(true);
    expect(chantText('MOT', HOAIMY)).toBe('Một');
    expect(chantText('YO', HOAIMY)).toBe('Yo!');
    expect(chantText('MOT', DAVID)).toBe('Mote');
    expect(chantText('HAI', null)).toBe('Hi');
  });
});

describe('createChanter', () => {
  it('is a safe no-op without browser speech', () => {
    const c = createChanter(undefined);
    expect(c.available).toBe(false);
    expect(c.listVoices()).toEqual([]);
    expect(() => c.speak('YO', null, 1)).not.toThrow();
  });
});

describe('pickAnnouncerVoice', () => {
  it('always picks English (natural first), never the Vietnamese chant voice', () => {
    expect(pickAnnouncerVoice([HOAIMY, DAVID, ARIA])).toBe(ARIA);
    expect(pickAnnouncerVoice([AN, DAVID])).toBe(DAVID);
    expect(pickAnnouncerVoice([AN, FR])).toBeNull();
  });
});
