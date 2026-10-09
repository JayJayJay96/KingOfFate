/**
 * Where knocked-out fighters lie on the victory screen. Deterministic per name (a refresh shows
 * the same picture) and kept out of the centre column where the winners stand.
 */
export interface FallenSpot {
  /** Percent of the viewport. */
  readonly x: number;
  readonly y: number;
  /** Lying on their left or right side. */
  readonly rotate: 90 | -90;
}

/** Centre column (percent) reserved for the title, winners and buttons. */
export const CLEAR_LEFT = 26;
export const CLEAR_RIGHT = 74;

function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function scatterFallen(names: readonly string[]): FallenSpot[] {
  const spots: FallenSpot[] = [];
  names.forEach((name, i) => {
    const h = hash(`${name}#${i}`);
    // Alternate sides so both edges fill evenly (hash low bits are not well mixed).
    const leftSide = i % 2 === 0;
    const band = CLEAR_LEFT - 6; // usable width of each side band
    const x = leftSide ? 3 + ((h >>> 1) % band) : CLEAR_RIGHT + 3 + ((h >>> 1) % band);
    let y = 6 + ((h >>> 9) % 86);
    // Nudge down (wrapping) until it does not sit on top of an earlier body.
    for (let tries = 0; tries < 12; tries++) {
      const clash = spots.some((s) => Math.abs(s.x - x) < 7 && Math.abs(s.y - y) < 8);
      if (!clash) break;
      y = 6 + ((y - 6 + 9) % 86);
    }
    spots.push({ x, y, rotate: (h >>> 20) & 1 ? 90 : -90 });
  });
  return spots;
}
