import { describe, expect, it } from 'vitest';
import { ANNOUNCE_AFTER_SFX_MS, announceDelayMs, createSoundEngine } from './soundEngine';

describe('announcer timing (Edge fix 2026-10-10)', () => {
  it('waits until the latest effect has landed before speaking', () => {
    expect(announceDelayMs(1000, 1000)).toBe(ANNOUNCE_AFTER_SFX_MS);
    expect(announceDelayMs(1000, 1200)).toBe(ANNOUNCE_AFTER_SFX_MS - 200);
    expect(announceDelayMs(1000, 1000 + ANNOUNCE_AFTER_SFX_MS)).toBe(0);
    expect(announceDelayMs(-Infinity, 5)).toBe(0);
  });

  it('is a safe no-op without Web Audio or speech (jsdom)', () => {
    const engine = createSoundEngine();
    expect(() => {
      engine.sfx('ko');
      engine.announce('K. O.!');
      engine.setPaused(true);
      engine.dispose();
    }).not.toThrow();
  });
});
