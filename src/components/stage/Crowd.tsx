import { memo, type CSSProperties } from 'react';

/**
 * Pixel spectators along the bottom of the stage (owner request 2026-10-16). They idle, cheer
 * on a K.O. or a scored point, and jump for the winner. Drawn in code; decorative only.
 */
export type CrowdMood = 'idle' | 'cheer' | 'jump';

const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
const SHIRT = ['#e63946', '#2a9d8f', '#f4a261', '#457b9d', '#9b5de5', '#ffd166', '#06d6a0'];
const HAIR = ['#1b1b1b', '#3b2a1a', '#6b4423', '#111827'];

function rand(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Spectator {
  readonly skin: string;
  readonly shirt: string;
  readonly hair: string;
  readonly delay: number;
  readonly scale: number;
}

function spectators(count: number): Spectator[] {
  const r = rand(0xc0ffee);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(r() * list.length)]!;
  return Array.from({ length: count }, () => ({
    skin: pick(SKIN),
    shirt: pick(SHIRT),
    hair: pick(HAIR),
    delay: Math.round(r() * 250),
    scale: 0.85 + r() * 0.3,
  }));
}

const PEOPLE = spectators(18);

/** `cue` changes on every new reaction so the animation restarts. */
export const Crowd = memo(function Crowd({
  mood,
  cue = '',
}: {
  readonly mood: CrowdMood;
  readonly cue?: string;
}) {
  return (
    <div
      key={`${mood}:${cue}`}
      className={`crowd crowd--${mood}`}
      data-testid="crowd"
      data-mood={mood}
      aria-hidden="true"
    >
      {PEOPLE.map((p, i) => (
        <svg
          key={i}
          className="crowd__fan"
          viewBox="0 0 12 18"
          width={18 * p.scale}
          height={27 * p.scale}
          style={{ '--delay': `${p.delay}ms` } as CSSProperties}
          shapeRendering="crispEdges"
          focusable="false"
        >
          <rect
            className="crowd__arm crowd__arm--up"
            x="0"
            y="2"
            width="2"
            height="7"
            fill={p.skin}
          />
          <rect
            className="crowd__arm crowd__arm--up"
            x="10"
            y="2"
            width="2"
            height="7"
            fill={p.skin}
          />
          <rect x="3" y="0" width="6" height="2" fill={p.hair} />
          <rect x="3" y="2" width="6" height="5" fill={p.skin} />
          <rect x="2" y="8" width="8" height="10" fill={p.shirt} />
          <rect
            className="crowd__arm crowd__arm--down"
            x="0"
            y="9"
            width="2"
            height="6"
            fill={p.shirt}
          />
          <rect
            className="crowd__arm crowd__arm--down"
            x="10"
            y="9"
            width="2"
            height="6"
            fill={p.shirt}
          />
        </svg>
      ))}
    </div>
  );
});
