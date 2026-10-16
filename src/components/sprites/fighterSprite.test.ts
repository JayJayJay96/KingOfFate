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
  NATURAL_SKIN_TONES,
  RACES,
  ROLES,
  cleanLook,
  lookTitle,
  randomLook,
  roleFlavour,
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

  it('fun skins and any colour work; random looks keep natural skin (owner request 2026-10-16)', () => {
    expect(renderLook({ ...BASE, skin: 'goblin' }).palette.s).toBe('#6fbf4a');
    expect(isFighterLook({ ...BASE, skin: '#12ab34' })).toBe(true);
    expect(renderLook({ ...BASE, skin: '#12ab34' }).palette.s).toBe('#12ab34');
    expect(isFighterLook({ ...BASE, skin: 'rainbow' })).toBe(false);
    expect(isFighterLook({ ...BASE, skin: '#12ab3' })).toBe(false);
    const natural = new Set(NATURAL_SKIN_TONES.map((s) => s.id));
    for (const name of MANY) expect(natural.has(neutralLook(name).skin)).toBe(true);
  });

  it('every race renders well-formed with every hair and headwear, and looks different', () => {
    const seen = new Set<string>();
    for (const race of RACES) {
      for (const hair of HAIR_STYLES) {
        for (const headwear of HEADWEAR) expectWellFormed({ ...BASE, race, hair, headwear });
      }
      seen.add(JSON.stringify(renderLook({ ...BASE, race }).rows));
    }
    expect(seen.size).toBe(RACES.length);
    expect(isFighterLook({ ...BASE, race: 'goblin' })).toBe(true);
    expect(isFighterLook({ ...BASE, race: 'dragon' })).toBe(false);
    // Looks saved before races existed are human.
    expect(renderLook(BASE)).toEqual(renderLook({ ...BASE, race: 'human' }));
    expect(cleanLook({ ...BASE, race: 'human' })).toEqual(cleanLook(BASE));
    expect(cleanLook({ ...BASE, race: 'elf' }).race).toBe('elf');
  });

  it('every class renders well-formed on every race and hair, and looks different', () => {
    const seen = new Set<string>();
    for (const role of ROLES) {
      for (const race of RACES) {
        for (const hair of HAIR_STYLES) expectWellFormed({ ...BASE, role, race, hair });
      }
      seen.add(JSON.stringify(renderLook({ ...BASE, role }).rows));
    }
    expect(seen.size).toBe(ROLES.length);
    expect(isFighterLook({ ...BASE, role: 'mage' })).toBe(true);
    expect(isFighterLook({ ...BASE, role: 'bard' })).toBe(false);
    expect(cleanLook({ ...BASE, role: 'none' })).toEqual(cleanLook(BASE));
  });

  it('titles and flavour: looks only (owner decision 2026-10-16)', () => {
    expect(lookTitle({ ...BASE, race: 'goblin', role: 'mage' })).toBe('Goblin Mage');
    expect(lookTitle({ ...BASE, role: 'chef' })).toBe('Chef');
    expect(lookTitle({ ...BASE, race: 'elf' })).toBe('Elf');
    expect(lookTitle(BASE)).toBeNull();
    expect(lookTitle(null)).toBeNull();
    expect(roleFlavour({ ...BASE, role: 'mage' })).toMatchObject({ fx: '🔥', pose: 'spin' });
    expect(roleFlavour(BASE)).toMatchObject({ fx: null, pose: 'jump' });
  });

  it('Random in the editor covers every option except religious headwear (owner 2026-10-16)', () => {
    let seed = 1;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const looks = Array.from({ length: 3000 }, () => randomLook(random));
    const seen = (f: (l: FighterLook) => string | undefined) => new Set(looks.map(f));
    expect(looks.every(isFighterLook)).toBe(true);
    expect(seen((l) => l.race ?? 'human').size).toBe(RACES.length);
    expect(seen((l) => l.role ?? 'none').size).toBe(ROLES.length);
    const skins = seen((l) => l.skin);
    for (const t of SKIN_TONES) expect(skins.has(t.id)).toBe(true);
    expect(skins.has('#a8b0bc')).toBe(true); // Robot metal
    expect(seen((l) => l.hair).size).toBe(HAIR_STYLES.length);
    expect(seen((l) => l.outfit).size).toBe(OUTFITS.length);
    expect(seen((l) => l.face).size).toBe(FACE_EXTRAS.length);
    expect(seen((l) => l.headwear)).toEqual(new Set(['none', 'cap', 'headband', 'beanie']));
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
