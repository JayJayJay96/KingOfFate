import { describe, expect, it } from 'vitest';
import { chantText, createChanter, pickAnnouncerVoice, pickVoice, type VoiceInfo } from './voice';

const v = (name: string, lang: string): VoiceInfo => ({ voiceURI: name, name, lang });
const DAVID = v('Microsoft David - English (United States)', 'en-US');
const ARIA = v('Microsoft Aria Online (Natural) - English (United States)', 'en-US');
const AN = v('Microsoft An - Vietnamese (Vietnam)', 'vi-VN');
const HOAIMY = v('Microsoft HoaiMy Online (Natural) - Vietnamese (Vietnam)', 'vi-VN');
const FR = v('Thomas', 'fr-FR');

describe('pickVoice (chant "1, 2, Juice!" is English)', () => {
  it('prefers a natural English voice, then any English, then anything, then nothing', () => {
    expect(pickVoice([HOAIMY, DAVID, ARIA], null)).toBe(ARIA);
    expect(pickVoice([AN, DAVID], null)).toBe(DAVID);
    expect(pickVoice([FR], null)).toBe(FR);
    expect(pickVoice([], null)).toBeNull();
  });

  it('honours the host’s choice while it exists', () => {
    expect(pickVoice([DAVID, HOAIMY], HOAIMY.voiceURI)).toBe(HOAIMY);
    expect(pickVoice([DAVID, ARIA], 'gone')).toBe(ARIA);
  });
});

describe('chantText', () => {
  it('says "One", "Two", "Juice!"', () => {
    expect(chantText('ONE')).toBe('One');
    expect(chantText('TWO')).toBe('Two');
    expect(chantText('JUICE')).toBe('Juice!');
  });
});

describe('createChanter', () => {
  it('is a safe no-op without browser speech', () => {
    const c = createChanter(undefined);
    expect(c.available).toBe(false);
    expect(c.listVoices()).toEqual([]);
    expect(() => c.speak('JUICE', null, 1)).not.toThrow();
  });
});

describe('pickAnnouncerVoice', () => {
  it('always picks English (natural first)', () => {
    expect(pickAnnouncerVoice([HOAIMY, DAVID, ARIA])).toBe(ARIA);
    expect(pickAnnouncerVoice([AN, DAVID])).toBe(DAVID);
    expect(pickAnnouncerVoice([AN, FR])).toBeNull();
  });
});
