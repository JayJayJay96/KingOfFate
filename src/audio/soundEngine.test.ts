import { describe, expect, it } from 'vitest';
import { createSoundEngine } from './soundEngine';

describe('sound engine', () => {
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
