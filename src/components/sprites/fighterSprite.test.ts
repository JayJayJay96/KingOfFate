import { describe, expect, it } from 'vitest';
import {
  ACCENT_COLOURS,
  FACE_EXTRAS,
  HAIR_COLOURS,
  HAIR_STYLES,
  HEADWEAR,
  isFighterLook,
  lookFor,
  neutralLook,
  OUTFIT_COLOURS,
  OUTFITS,
  SKIN_TONES,
  type FighterLook,
} from '../../game/config/looks';
import { fighterSprite, renderLook } from './fighterSprite';

const NAMES = ['Aisyah', 'Wei Jie', 'Kavitha', 'Hafiz', 'Mei Ling', 'Arjun', 'Nurul', 'Jason'];
const MANY = Array.from({ length: 300 }, (_, i) => `Fighter ${i}`);

const BASE: FighterLook = {
  hair: 'short',
  hairColour: 'black',
  headwear: 'none',
  face: 'none',
  outfit: 'gi',
  outfitColour: 'red',
  skin: 'tan',
  accent: 'gold',
};

function expectWellFormed(look: FighterLook) {
  const s = renderLook(look);
  expect(s.rows).toHaveLength(16);
  for (const row of s.rows) {
    expect(row).toHaveLength(12);
    for (const ch of row) if (ch !== '.') expect(s.palette[ch]).toMatch(/^#[0-9a-f]{6}$/);
  }
}

describe('fighter looks (Pack B)', () => {
  it('the default look is stable per person (case and spacing insensitive)', () => {
    expect(fighterSprite('Aisyah')).toEqual(fighterSprite('  aisyah '));
    expect(neutralLook('Aisyah')).toEqual(neutralLook('AISYAH'));
  });

  it('every option of every part renders a well-formed 12×16 sprite', () => {
    for (const hair of HAIR_STYLES) expectWellFormed({ ...BASE, hair });
    for (const headwear of HEADWEAR) {
      for (const hair of HAIR_STYLES) expectWellFormed({ ...BASE, headwear, hair });
    }
    for (const face of FACE_EXTRAS) expectWellFormed({ ...BASE, face });
    for (const outfit of OUTFITS) expectWellFormed({ ...BASE, outfit });
    for (const s of [SKIN_TONES, HAIR_COLOURS, OUTFIT_COLOURS, ACCENT_COLOURS]) {
      expect(new Set(s.map((x) => x.id)).size).toBe(s.length);
    }
  });

  it('random default looks never use religious headwear (owner decision)', () => {
    for (const name of MANY) {
      const look = neutralLook(name);
      expect(isFighterLook(look)).toBe(true);
      expect(['tudung', 'songkok']).not.toContain(look.headwear);
    }
  });

  it('gives a crowd plenty of variety', () => {
    const sprites = new Set(MANY.map((n) => JSON.stringify(fighterSprite(n))));
    expect(sprites.size).toBeGreaterThanOrEqual(295);
    const hairs = new Set(MANY.map((n) => neutralLook(n).hair));
    const outfits = new Set(MANY.map((n) => neutralLook(n).outfit));
    expect(hairs.size).toBe(HAIR_STYLES.length);
    expect(outfits.size).toBe(OUTFITS.length);
    expect(new Set(NAMES.map((n) => JSON.stringify(fighterSprite(n)))).size).toBe(NAMES.length);
  });

  it('a tudung hides all hair and frames the face', () => {
    const s = renderLook({ ...BASE, hair: 'long', headwear: 'tudung', face: 'beard' });
    expect(s.rows.join('')).not.toContain('h');
    expect(s.rows[5]![2]).toBe('b');
    expect(s.rows[5]![9]).toBe('b');
    expect(s.rows[5]).toContain('e');
  });

  it('uses a custom look when given, and falls back for a damaged one', () => {
    const custom: FighterLook = { ...BASE, headwear: 'songkok', outfit: 'baju-melayu' };
    expect(fighterSprite('Hafiz', custom)).toEqual(renderLook(custom));
    expect(lookFor('Hafiz', { ...custom, outfit: 'tuxedo' } as unknown as FighterLook)).toEqual(
      neutralLook('Hafiz'),
    );
  });
});
