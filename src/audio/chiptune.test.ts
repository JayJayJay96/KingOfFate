import { describe, expect, it } from 'vitest';
import { noteToFrequency, stepSeconds, STEPS_PER_LOOP, THEMES } from './chiptune';

describe('chiptune themes', () => {
  it.each(Object.entries(THEMES))('%s: every track is exactly one 4-bar loop', (_name, theme) => {
    expect(theme.lead).toHaveLength(STEPS_PER_LOOP);
    expect(theme.bass).toHaveLength(STEPS_PER_LOOP);
    expect(theme.drums).toHaveLength(STEPS_PER_LOOP);
  });

  it.each(Object.entries(THEMES))('%s: every note parses to an audible pitch', (_name, theme) => {
    for (const note of [...theme.lead, ...theme.bass]) {
      if (!note) continue;
      const f = noteToFrequency(note);
      expect(f).toBeGreaterThan(40);
      expect(f).toBeLessThan(2000);
    }
    expect(theme.drums.every((d) => d === null || ['K', 'S', 'H', 'T'].includes(d))).toBe(true);
  });

  it('converts notes with equal temperament', () => {
    expect(noteToFrequency('A4')).toBeCloseTo(440);
    expect(noteToFrequency('A5')).toBeCloseTo(880);
    expect(noteToFrequency('C4')).toBeCloseTo(261.63, 1);
    expect(noteToFrequency('G#5')).toBeCloseTo(830.61, 1);
    expect(() => noteToFrequency('H2')).toThrow();
  });

  it('the select theme is faster than the finale theme', () => {
    expect(stepSeconds(THEMES.select)).toBeLessThan(stepSeconds(THEMES.finale));
  });
});
