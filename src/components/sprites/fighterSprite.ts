import type { PixelImage } from './PixelArt';

/**
 * Original generic pixel fighters (12×16 bust). Each person gets a stable look derived from
 * their name: hairstyle, skin tone, hair and outfit colours. No external art is used.
 */
const HAIR_STYLES: readonly (readonly string[])[] = [
  // spiky
  ['..h.h..h.h..', '..hhhhhhhh..', '.hhhhhhhhhh.', '..hhhhhhhh..'],
  // bob (side hair added below)
  ['............', '...hhhhhh...', '..hhhhhhhh..', '..hhhhhhhh..'],
  // headband
  ['............', '....hhhh....', '...hhhhhh...', '..bbbbbbbb..'],
  // top knot
  ['.....hh.....', '....hhhh....', '...hhhhhh...', '..hhhhhhhh..'],
];

const BODY: readonly string[] = [
  '...ssssss...',
  '...sesses...',
  '...ssssss...',
  '...ssmmss...',
  '....ssss....',
  '.....ss.....',
  '..oooooooo..',
  '.ooooOOoooo.',
  '.oooOooOooo.',
  '.oooooooooo.',
  'ss.oooooo.ss',
  '...bbbbbb...',
];

const SKIN = ['#ffdbac', '#f1c27d', '#e0ac69', '#c68642', '#8d5524'];
const HAIR = ['#1b1b1b', '#3b2314', '#6a3d1e', '#c9a227', '#b03a2e', '#2c3e91'];
const OUTFIT = ['#d7263d', '#1b998b', '#2e86de', '#f46036', '#7d5ba6', '#2f4858', '#e2b007'];
const ACCENT = ['#ffcc33', '#ffffff', '#111111', '#3be8ff'];

function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Idle-animation offset so a crowd of fighters never breathes in sync (0–1190 ms). */
export function idleDelayMs(seed: string): number {
  return (hash(seed.trim().toLowerCase()) % 120) * 10;
}

/** Pick from a list using a different slice of the hash for each feature. */
const pick = <T>(list: readonly T[], h: number, shift: number): T =>
  list[(h >>> shift) % list.length]!;

/** Stable sprite for a person: the same name always looks the same. */
export function fighterSprite(seed: string): PixelImage {
  const h = hash(seed.trim().toLowerCase());
  const styleIndex = h % HAIR_STYLES.length;
  const rows = [...HAIR_STYLES[styleIndex]!, ...BODY].map((r) => r.split(''));
  if (styleIndex === 1) {
    // Bob: hair down both sides of the face.
    for (const y of [4, 5, 6, 7]) {
      rows[y]![2] = 'h';
      rows[y]![9] = 'h';
    }
  }
  const outfit = pick(OUTFIT, h, 8);
  return {
    rows: rows.map((r) => r.join('')),
    palette: {
      h: pick(HAIR, h, 4),
      s: pick(SKIN, h, 12),
      e: '#1b1b2a',
      m: '#7a2a2a',
      o: outfit,
      O: shade(outfit),
      b: pick(ACCENT, h, 16),
    },
  };
}

function shade(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * 0.7);
  const g = Math.round(((n >> 8) & 255) * 0.7);
  const b = Math.round((n & 255) * 0.7);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
