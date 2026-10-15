import { useContext } from 'react';
import type { FighterLook } from '../../game/config/looks';
import type { FateKind } from '../../game/config/presets';
import type { Gesture } from '../../game/engine/rps';
import { fighterSprite, idleDelayMs } from './fighterSprite';
import { LooksContext, lookKey } from './looksContext';
import { PixelArt, type PixelImage } from './PixelArt';

/** Original pixel icons drawn for this project. */
const FATE_IMAGES: Readonly<Record<FateKind, PixelImage>> = {
  KO: {
    rows: [
      'y...y...y',
      '.y..y..y.',
      '..rrrrr..',
      '..rRRRr..',
      'yyrRRRryy',
      '..rRRRr..',
      '..rrrrr..',
      '.y..y..y.',
      'y...y...y',
    ],
    palette: { y: '#ffcc33', r: '#ff3b5c', R: '#ffffff' },
  },
  VS: {
    rows: [
      'w.......w',
      '.w.....w.',
      '..w...w..',
      '...w.w...',
      '....w....',
      '...w.w...',
      '..g...g..',
      '.gg...gg.',
      'g.......g',
    ],
    palette: { w: '#e8e8ff', g: '#ffcc33' },
  },
  SHIELD: {
    rows: [
      'ccccccccc',
      'cwwwwwwwc',
      'cwcccccwc',
      'cwcccccwc',
      'cwcccccwc',
      '.cwcccwc.',
      '..cwcwc..',
      '...cwc...',
      '....c....',
    ],
    palette: { c: '#3be8ff', w: '#ffffff' },
  },
  BOMB: {
    rows: [
      '......y.y',
      '.....o.y.',
      '....o..y.',
      '..kkok...',
      '.kkkkkk..',
      'kkwkkkkk.',
      'kwkkkkkk.',
      '.kkkkkk..',
      '..kkkk...',
    ],
    palette: { k: '#2a2a3a', w: '#9aa0c8', o: '#c8a060', y: '#ffcc33' },
  },
};

const HAND_PALETTE = { k: '#1b1b2a', s: '#f1c27d' };
const HAND_IMAGES: Readonly<Record<Gesture, PixelImage>> = {
  ROCK: {
    rows: [
      '..kkkk..',
      '.kssssk.',
      'kssssssk',
      'kskskssk',
      'kssssssk',
      'kssssssk',
      '.kssssk.',
      '..kkkk..',
    ],
    palette: HAND_PALETTE,
  },
  PAPER: {
    rows: [
      '.kkkkkk.',
      '.ksksks.',
      '.ksksks.',
      'kssssssk',
      'kssssssk',
      'kssssssk',
      '.kssssk.',
      '..kkkk..',
    ],
    palette: HAND_PALETTE,
  },
  SCISSORS: {
    rows: [
      'ks....sk',
      '.ks..sk.',
      '..kssk..',
      '.kssssk.',
      'kssssssk',
      'kssssssk',
      '.kssssk.',
      '..kkkk..',
    ],
    palette: HAND_PALETTE,
  },
};

const CROWN: PixelImage = {
  rows: ['g...g...g', 'gg.ggg.gg', 'ggggggggg', 'ggrgggrgg', 'ggggggggg', '.ggggggg.'],
  palette: { g: '#ffcc33', r: '#ff3b5c' },
};

export function FateIcon({ kind, size = 18 }: { readonly kind: FateKind; readonly size?: number }) {
  return <PixelArt image={FATE_IMAGES[kind]} size={size} className="pixel-icon" />;
}

export function HandIcon({
  gesture,
  size = 40,
}: {
  readonly gesture: Gesture;
  readonly size?: number;
}) {
  return <PixelArt image={HAND_IMAGES[gesture]} size={size} className="pixel-icon" />;
}

export function CrownIcon({ size = 24 }: { readonly size?: number }) {
  return <PixelArt image={CROWN} size={size} className="pixel-icon" />;
}

export function FighterSprite({
  seed,
  size,
  idle = false,
  look,
}: {
  readonly seed: string;
  readonly size: number;
  /** Retro two-step breathing bob, offset per fighter. */
  readonly idle?: boolean;
  /** Explicit look (e.g. the editor preview); otherwise the custom look on screen, if any. */
  readonly look?: FighterLook | null;
}) {
  const looks = useContext(LooksContext);
  return (
    <PixelArt
      image={fighterSprite(seed, look ?? looks.get(lookKey(seed)))}
      size={size}
      className={idle ? 'fighter-sprite fighter-sprite--idle' : 'fighter-sprite'}
      style={idle ? { animationDelay: `-${idleDelayMs(seed)}ms` } : undefined}
    />
  );
}
