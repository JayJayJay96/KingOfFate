import { describe, expect, it } from 'vitest';
import { fighterSprite } from './fighterSprite';

const NAMES = ['Aisyah', 'Wei Jie', 'Kavitha', 'Hafiz', 'Mei Ling', 'Arjun', 'Nurul', 'Jason'];

describe('fighterSprite', () => {
  it('is stable per person (case and spacing insensitive)', () => {
    expect(fighterSprite('Aisyah')).toEqual(fighterSprite('  aisyah '));
  });

  it('every sprite is a 12×16 grid whose characters are all in the palette', () => {
    for (const name of NAMES) {
      const s = fighterSprite(name);
      expect(s.rows).toHaveLength(16);
      for (const row of s.rows) {
        expect(row).toHaveLength(12);
        for (const ch of row) if (ch !== '.') expect(s.palette[ch]).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it('gives different people different looks', () => {
    const looks = new Set(NAMES.map((n) => JSON.stringify(fighterSprite(n))));
    expect(looks.size).toBeGreaterThanOrEqual(6);
  });
});
