/**
 * Fighter looks (owner decision 2026-10-10): a random *neutral* look derived from the name by
 * default, plus an optional per-person look the host picks. Religious headwear (tudung, songkok)
 * is never assigned at random; it is only ever chosen by the host. Purely cosmetic.
 */
export const HAIR_STYLES = [
  'spiky',
  'short',
  'bob',
  'long',
  'ponytail',
  'topknot',
  'buns',
  'afro',
  'mohawk',
  'bald',
] as const;
export const HEADWEAR = ['none', 'cap', 'headband', 'beanie', 'tudung', 'songkok'] as const;
export const FACE_EXTRAS = ['none', 'glasses', 'shades', 'moustache', 'beard'] as const;
export const OUTFITS = ['gi', 'shirt-tie', 'baju-melayu', 'tshirt', 'jacket', 'hoodie'] as const;

export type HairStyle = (typeof HAIR_STYLES)[number];
export type Headwear = (typeof HEADWEAR)[number];
export type FaceExtra = (typeof FACE_EXTRAS)[number];
export type Outfit = (typeof OUTFITS)[number];

export interface Swatch {
  readonly id: string;
  readonly label: string;
  readonly hex: string;
}

/** Natural skin tones: the only ones a random default look uses. */
export const NATURAL_SKIN_TONES: readonly Swatch[] = [
  { id: 'light', label: 'Light', hex: '#ffdbac' },
  { id: 'fair', label: 'Fair', hex: '#f1c27d' },
  { id: 'tan', label: 'Tan', hex: '#e0ac69' },
  { id: 'brown', label: 'Brown', hex: '#c68642' },
  { id: 'dark', label: 'Dark', hex: '#8d5524' },
  { id: 'deep', label: 'Deep', hex: '#5c3a1e' },
];

/** Fun skins for cosplay (owner request 2026-10-16), only when the host picks them. */
export const FANTASY_SKIN_TONES: readonly Swatch[] = [
  { id: 'goblin', label: 'Goblin green', hex: '#6fbf4a' },
  { id: 'orc', label: 'Orc olive', hex: '#7a8f3a' },
  { id: 'smurf', label: 'Smurf blue', hex: '#4a86d9' },
  { id: 'alien', label: 'Alien purple', hex: '#9b6bd6' },
  { id: 'zombie', label: 'Zombie grey-green', hex: '#9fb8a0' },
  { id: 'demon', label: 'Demon red', hex: '#c93c3c' },
  { id: 'vampire', label: 'Vampire pale', hex: '#f2efe9' },
  { id: 'golden', label: 'Golden', hex: '#e8c547' },
];

export const SKIN_TONES: readonly Swatch[] = [...NATURAL_SKIN_TONES, ...FANTASY_SKIN_TONES];

/** A skin is a swatch id or, with the "any colour" picker, a #rrggbb colour. */
export const CUSTOM_COLOUR = /^#[0-9a-f]{6}$/;

export function skinHex(skin: string): string {
  return CUSTOM_COLOUR.test(skin) ? skin : swatchHex(SKIN_TONES, skin);
}

export const HAIR_COLOURS: readonly Swatch[] = [
  { id: 'black', label: 'Black', hex: '#1b1b1b' },
  { id: 'dark-brown', label: 'Dark brown', hex: '#3b2314' },
  { id: 'brown', label: 'Brown', hex: '#6a3d1e' },
  { id: 'blonde', label: 'Blonde', hex: '#c9a227' },
  { id: 'red', label: 'Red', hex: '#b03a2e' },
  { id: 'blue', label: 'Blue', hex: '#2c3e91' },
  { id: 'grey', label: 'Grey', hex: '#9a9a9a' },
  { id: 'pink', label: 'Pink', hex: '#e05a9c' },
];

export const OUTFIT_COLOURS: readonly Swatch[] = [
  { id: 'red', label: 'Red', hex: '#d7263d' },
  { id: 'teal', label: 'Teal', hex: '#1b998b' },
  { id: 'blue', label: 'Blue', hex: '#2e86de' },
  { id: 'orange', label: 'Orange', hex: '#f46036' },
  { id: 'purple', label: 'Purple', hex: '#7d5ba6' },
  { id: 'navy', label: 'Navy', hex: '#2f4858' },
  { id: 'gold', label: 'Gold', hex: '#e2b007' },
  { id: 'green', label: 'Green', hex: '#3a9d4a' },
  { id: 'black', label: 'Black', hex: '#2a2a2a' },
  { id: 'white', label: 'White', hex: '#e8e8e8' },
  { id: 'pink', label: 'Pink', hex: '#e86fa6' },
  { id: 'maroon', label: 'Maroon', hex: '#7a1f2b' },
];

/** Belt, emblem, cap, headband, beanie and tudung colour. */
export const ACCENT_COLOURS: readonly Swatch[] = [
  { id: 'gold', label: 'Gold', hex: '#ffcc33' },
  { id: 'white', label: 'White', hex: '#ffffff' },
  { id: 'black', label: 'Black', hex: '#111111' },
  { id: 'cyan', label: 'Cyan', hex: '#3be8ff' },
  { id: 'red', label: 'Red', hex: '#ff3b5c' },
  { id: 'green', label: 'Green', hex: '#4dff88' },
  { id: 'purple', label: 'Purple', hex: '#9b6bff' },
  { id: 'beige', label: 'Beige', hex: '#e8d3b0' },
];

export interface FighterLook {
  readonly hair: HairStyle;
  readonly hairColour: string;
  readonly headwear: Headwear;
  readonly face: FaceExtra;
  readonly outfit: Outfit;
  readonly outfitColour: string;
  readonly skin: string;
  readonly accent: string;
}

export const LOOK_LABELS = {
  hair: {
    spiky: 'Spiky',
    short: 'Short',
    bob: 'Bob',
    long: 'Long',
    ponytail: 'Ponytail',
    topknot: 'Top knot',
    buns: 'Twin buns',
    afro: 'Afro',
    mohawk: 'Mohawk',
    bald: 'Bald',
  },
  headwear: {
    none: 'None',
    cap: 'Cap',
    headband: 'Headband',
    beanie: 'Beanie',
    tudung: 'Tudung',
    songkok: 'Songkok',
  },
  face: {
    none: 'None',
    glasses: 'Glasses',
    shades: 'Shades',
    moustache: 'Moustache',
    beard: 'Beard',
  },
  outfit: {
    gi: 'Karate gi',
    'shirt-tie': 'Shirt & tie',
    'baju-melayu': 'Baju Melayu',
    tshirt: 'T-shirt',
    jacket: 'Jacket',
    hoodie: 'Hoodie',
  },
} as const satisfies {
  hair: Record<HairStyle, string>;
  headwear: Record<Headwear, string>;
  face: Record<FaceExtra, string>;
  outfit: Record<Outfit, string>;
};

const has = (list: readonly string[], v: unknown): boolean =>
  typeof v === 'string' && list.includes(v);
const ids = (list: readonly Swatch[]) => list.map((s) => s.id);

export function isFighterLook(value: unknown): value is FighterLook {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    has(HAIR_STYLES, v.hair) &&
    has(ids(HAIR_COLOURS), v.hairColour) &&
    has(HEADWEAR, v.headwear) &&
    has(FACE_EXTRAS, v.face) &&
    has(OUTFITS, v.outfit) &&
    has(ids(OUTFIT_COLOURS), v.outfitColour) &&
    (has(ids(SKIN_TONES), v.skin) || (typeof v.skin === 'string' && CUSTOM_COLOUR.test(v.skin))) &&
    has(ids(ACCENT_COLOURS), v.accent)
  );
}

/** Only the fields we know, so a stored look never carries anything else. */
export function cleanLook(look: FighterLook): FighterLook {
  const { hair, hairColour, headwear, face, outfit, outfitColour, skin, accent } = look;
  return { hair, hairColour, headwear, face, outfit, outfitColour, skin, accent };
}

/** Headwear the random default may use (no religious headwear). */
const NEUTRAL_HEADWEAR: readonly Headwear[] = [
  'none',
  'none',
  'none',
  'none',
  'none',
  'cap',
  'headband',
  'beanie',
];
const RANDOM_FACE: readonly FaceExtra[] = [
  'none',
  'none',
  'none',
  'none',
  'glasses',
  'shades',
  'moustache',
  'beard',
];
/** Natural colours more often than fun ones. */
const RANDOM_HAIR_COLOUR = [
  'black',
  'black',
  'black',
  'dark-brown',
  'dark-brown',
  'brown',
  'blonde',
  'red',
  'blue',
  'grey',
  'pink',
];

function hash(text: string, salt: number): number {
  let h = 0x811c9dc5 ^ salt;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return h >>> 0;
}

const pick = <T>(list: readonly T[], key: string, salt: number): T =>
  list[hash(key, salt) % list.length]!;

/** The default look for a name: stable, neutral, varied. */
export function neutralLook(seed: string): FighterLook {
  const key = seed.trim().toLowerCase();
  return {
    hair: pick(HAIR_STYLES, key, 1),
    hairColour: pick(RANDOM_HAIR_COLOUR, key, 2),
    headwear: pick(NEUTRAL_HEADWEAR, key, 3),
    face: pick(RANDOM_FACE, key, 4),
    outfit: pick(OUTFITS, key, 5),
    outfitColour: pick(ids(OUTFIT_COLOURS), key, 6),
    skin: pick(ids(NATURAL_SKIN_TONES), key, 7),
    accent: pick(ids(ACCENT_COLOURS), key, 8),
  };
}

/** Custom look if valid, otherwise the neutral default for the name. */
export function lookFor(name: string, look: FighterLook | null | undefined): FighterLook {
  return look && isFighterLook(look) ? look : neutralLook(name);
}

export function swatchHex(list: readonly Swatch[], id: string): string {
  return (list.find((s) => s.id === id) ?? list[0]!).hex;
}
