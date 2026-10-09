import {
  ACCENT_COLOURS,
  HAIR_COLOURS,
  lookFor,
  OUTFIT_COLOURS,
  SKIN_TONES,
  swatchHex,
  type FighterLook,
  type HairStyle,
  type Outfit,
} from '../../game/config/looks';
import type { PixelImage } from './PixelArt';

/**
 * Original pixel fighters (12×16 bust), built in layers: head, hair, headwear, face extras,
 * outfit. No external art is used. Palette keys:
 * s skin, e eyes, m mouth, h hair, o/O outfit/shade, b/B accent/shade, w white, K trousers,
 * J jeans, k songkok black, G frames.
 */
const W = 12;
const H = 16;

const HEAD: readonly string[] = [
  '............',
  '............',
  '....ssss....',
  '...ssssss...',
  '...ssssss...',
  '...sesses...',
  '...ssssss...',
  '...ssmmss...',
  '....ssss....',
  '.....ss.....',
];

const HAIR_TOP: Readonly<Record<HairStyle, readonly string[]>> = {
  spiky: ['..h.h..h.h..', '..hhhhhhhh..', '.hhhhhhhhhh.', '..hhhhhhhh..'],
  short: ['............', '............', '...hhhhhh...', '..hhhhhhhh..'],
  bob: ['............', '...hhhhhh...', '..hhhhhhhh..', '..hhhhhhhh..'],
  long: ['............', '...hhhhhh...', '..hhhhhhhh..', '.hhhhhhhhhh.'],
  ponytail: ['............', '............', '...hhhhhh...', '..hhhhhhhhh.'],
  topknot: ['.....hh.....', '....hhhh....', '...hhhhhh...', '..hhhhhhhh..'],
  buns: ['.hh......hh.', '.hhhhhhhhhh.', '..hhhhhhhh..', '..hhhhhhhh..'],
  afro: ['..hhhhhhhh..', '.hhhhhhhhhh.', 'hhhhhhhhhhhh', 'hhhhhhhhhhhh'],
  mohawk: ['.....hh.....', '.....hh.....', '....shhs....', '...sshhss...'],
  bald: ['............', '............', '....ssss....', '...ssssss...'],
};

const sides = (rows: number[], cols: number[]): [number, number][] =>
  rows.flatMap((r) => cols.map((c): [number, number] => [r, c]));

/** Extra hair pixels beside the face: [row, col]. */
const HAIR_SIDES: Readonly<Partial<Record<HairStyle, readonly [number, number][]>>> = {
  bob: sides([4, 5, 6, 7], [2, 9]),
  long: sides([4, 5, 6, 7, 8, 9, 10], [1, 2, 9, 10]),
  ponytail: [
    [2, 10],
    [4, 10],
    [4, 11],
    [5, 11],
    [6, 11],
  ],
  afro: sides([4, 5], [1, 2, 9, 10]),
};

const OUTFIT_ROWS: Readonly<Record<Outfit, readonly string[]>> = {
  gi: [
    '..ooossooo..',
    '.oooOssOooo.',
    '.ooooOOoooo.',
    '.oooooooooo.',
    'ss.oooooo.ss',
    '...bbbbbb...',
  ],
  'shirt-tie': [
    '..wwwoowww..',
    '.wwwwoowwww.',
    '.wwwwoowwww.',
    '.wwwwOOwwww.',
    'ss.wwwwww.ss',
    '...KKKKKK...',
  ],
  'baju-melayu': [
    '..oooOOooo..',
    '.oooooboooo.',
    '.oooooboooo.',
    '.bbbbbbbbbb.',
    'ss.bBbBbB.ss',
    '...oooooo...',
  ],
  tshirt: [
    '..oooooooo..',
    '.oooooooooo.',
    '.oooobboooo.',
    '.oooooooooo.',
    'ss.oooooo.ss',
    '...JJJJJJ...',
  ],
  jacket: [
    '..ooowwooo..',
    '.oooowwoooo.',
    '.ooOowwoOoo.',
    '.oooowwoooo.',
    'ss.oowwoo.ss',
    '...KKKKKK...',
  ],
  hoodie: [
    '..OOOOOOOO..',
    '.oooowwoooo.',
    '.oooowwoooo.',
    '.ooOOOOOOoo.',
    'ss.oOOOOo.ss',
    '...KKKKKK...',
  ],
};

type Grid = string[][];

const set = (g: Grid, r: number, c: number, ch: string) => {
  if (r >= 0 && r < H && c >= 0 && c < W) g[r]![c] = ch;
};
const overlay = (g: Grid, top: number, rows: readonly string[]) =>
  rows.forEach((row, i) =>
    [...row].forEach((ch, c) => {
      if (ch !== '.') set(g, top + i, c, ch);
    }),
  );

export function renderLook(look: FighterLook): PixelImage {
  const g: Grid = Array.from({ length: H }, () => Array.from({ length: W }, () => '.'));
  overlay(g, 0, HEAD);
  overlay(g, 10, OUTFIT_ROWS[look.outfit]);

  // Hair (the head template already holds the bald shape).
  overlay(g, 0, HAIR_TOP[look.hair]);
  for (const [r, c] of HAIR_SIDES[look.hair] ?? []) set(g, r, c, 'h');

  switch (look.headwear) {
    case 'cap':
      overlay(g, 1, ['...bbbbbb...', '..bbbbbbbb..', '..bbbbbbbbbb']);
      break;
    case 'headband':
      for (let c = 2; c <= 9; c++) if (g[3]![c] !== '.' || (c >= 3 && c <= 8)) set(g, 3, c, 'b');
      break;
    case 'beanie':
      overlay(g, 0, ['....bbbb....', '..bbbbbbbb..', '..bbbbbbbb..', '..BBBBBBBB..']);
      break;
    case 'songkok':
      overlay(g, 0, ['............', '...kkkkkk...', '...kkkkkk...', '...kkkkkk...']);
      break;
    case 'tudung': {
      // Covers all hair, frames the face and drapes over the shoulders.
      for (const row of g) for (let c = 0; c < W; c++) if (row[c] === 'h') row[c] = '.';
      overlay(g, 1, ['...bbbbbb...', '..bbbbbbbb..', '..bbbbbbbb..']);
      for (let r = 4; r <= 8; r++) {
        set(g, r, 2, 'b');
        set(g, r, 9, 'b');
      }
      set(g, 8, 3, 'b');
      set(g, 8, 8, 'b');
      overlay(g, 9, ['..bbbbbbbb..', '.bBbbbbbbBb.']);
      break;
    }
    case 'none':
      break;
  }

  switch (look.face) {
    case 'glasses':
      overlay(g, 5, ['...GeGGeG...']);
      break;
    case 'shades':
      overlay(g, 5, ['...GGGGGG...']);
      break;
    case 'moustache':
      for (let c = 4; c <= 7; c++) set(g, 6, c, 'h');
      break;
    case 'beard':
      if (look.headwear !== 'tudung') {
        for (const c of [3, 4, 7, 8]) set(g, 7, c, 'h');
        overlay(g, 8, ['....hhhh....']);
      }
      break;
    case 'none':
      break;
  }

  const outfit = swatchHex(OUTFIT_COLOURS, look.outfitColour);
  const accent = swatchHex(ACCENT_COLOURS, look.accent);
  return {
    rows: g.map((r) => r.join('')),
    palette: {
      s: swatchHex(SKIN_TONES, look.skin),
      e: '#1b1b2a',
      m: '#7a2a2a',
      h: swatchHex(HAIR_COLOURS, look.hairColour),
      o: outfit,
      O: shade(outfit),
      b: accent,
      B: shade(accent),
      w: '#f2f2f2',
      K: '#2a2a3a',
      J: '#2c4a7a',
      k: '#151515',
      G: '#111111',
    },
  };
}

/** Sprite for a person: their custom look, or the stable neutral look from their name. */
export function fighterSprite(seed: string, look?: FighterLook | null): PixelImage {
  return renderLook(lookFor(seed, look));
}

/** Idle-animation offset so a crowd of fighters never breathes in sync (0–1190 ms). */
export function idleDelayMs(seed: string): number {
  let h = 0x811c9dc5;
  const text = seed.trim().toLowerCase();
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ((h >>> 0) % 120) * 10;
}

function shade(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * 0.7);
  const g = Math.round(((n >> 8) & 255) * 0.7);
  const b = Math.round((n & 255) * 0.7);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
