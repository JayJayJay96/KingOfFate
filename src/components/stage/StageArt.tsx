import { memo, type ReactElement } from 'react';
import type { StageId } from '../../game/config/stages';

/**
 * Original pixel stage backgrounds, drawn in code (no external art). 320×180 scenes made of
 * rects; a few layers drift or twinkle via CSS (off under reduced motion). Decorative only.
 */
const VW = 320;
const VH = 180;

type El = ReactElement;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Builds one scene's rects with unique keys. */
function scene(draw: (r: Rect) => El[]): El[] {
  let key = 0;
  const r: Rect = (x, y, w, h, fill, cls) => (
    <rect key={key++} x={x} y={y} width={w} height={h} fill={fill} className={cls} />
  );
  return draw(r);
}
type Rect = (x: number, y: number, w: number, h: number, fill: string, cls?: string) => El;

/** Horizontal colour bands (dithered-looking sky). */
function bands(r: Rect, top: number, bottom: number, colours: readonly string[]): El[] {
  const h = (bottom - top) / colours.length;
  return colours.map((c, i) => r(0, Math.round(top + i * h), VW, Math.ceil(h) + 1, c));
}

function stars(r: Rect, seed: number, count: number, maxY: number): El[] {
  const rand = rng(seed);
  return Array.from({ length: count }, (_, i) =>
    r(
      Math.floor(rand() * VW),
      Math.floor(rand() * maxY),
      1,
      1,
      i % 3 ? '#cfd8ff' : '#ffffff',
      i % 4 === 0 ? 'stage-twinkle' : undefined,
    ),
  );
}

function skyline(
  r: Rect,
  seed: number,
  baseY: number,
  minH: number,
  maxH: number,
  fill: string,
  windows?: string,
): El[] {
  const rand = rng(seed);
  const out: El[] = [];
  let x = -4;
  while (x < VW) {
    const w = 10 + Math.floor(rand() * 16);
    const h = minH + Math.floor(rand() * (maxH - minH));
    out.push(r(x, baseY - h, w, h, fill));
    if (windows) {
      for (let wy = baseY - h + 4; wy < baseY - 3; wy += 5) {
        for (let wx = x + 2; wx < x + w - 2; wx += 4) {
          if (rand() < 0.35) out.push(r(wx, wy, 2, 2, windows));
        }
      }
    }
    x += w + Math.floor(rand() * 4);
  }
  return out;
}

function pixelCircle(r: Rect, cx: number, cy: number, radius: number, fill: string, gaps = false) {
  const out: El[] = [];
  for (let y = -radius; y <= radius; y++) {
    if (gaps && y > 0 && y % 4 === 0) continue;
    const half = Math.floor(Math.sqrt(radius * radius - y * y));
    out.push(r(cx - half, cy + y, half * 2, 1, fill));
  }
  return out;
}

const klNight = (r: Rect): El[] => {
  const rand = rng(7);
  const tower = (x: number): El[] => {
    const out = [
      r(x, 72, 16, 78, '#3a3f6a'),
      r(x + 1, 56, 14, 16, '#444a78'),
      r(x + 3, 44, 10, 12, '#4c5384'),
      r(x + 5, 36, 6, 8, '#5a6296'),
      r(x + 7, 16, 2, 20, '#9aa3d8'),
    ];
    for (let y = 59; y < 148; y += 4) {
      for (let wx = x + 2; wx < x + 15; wx += 3) {
        if (rand() < 0.55) out.push(r(wx, y, 1, 2, '#ffe08a'));
      }
    }
    return out;
  };
  return [
    ...bands(r, 0, 150, ['#070720', '#0b0b2e', '#120f3a', '#1a1446', '#241852', '#2e1c5c']),
    ...stars(r, 3, 70, 90),
    ...pixelCircle(r, 270, 28, 10, '#f4f0d0'),
    ...pixelCircle(r, 274, 25, 8, '#0b0b2e'),
    ...skyline(r, 11, 150, 25, 60, '#18123a', '#3a3570'),
    ...tower(132),
    ...tower(172),
    r(148, 96, 24, 3, '#6a72a8'),
    ...skyline(r, 23, 150, 12, 35, '#0e0a22', '#ffcf5a'),
    r(0, 150, VW, 30, '#141024'),
    ...Array.from({ length: 16 }, (_, i) => r(i * 22, 164, 10, 2, '#f2d36b')),
    <g key="cars" className="stage-drift">
      {[20, 90, 170, 250].flatMap((x) => [
        r(x, 155, 12, 4, '#ff3b5c'),
        r(x + 10, 156, 2, 2, '#ffe9a0'),
      ])}
    </g>,
  ];
};

const mamak = (r: Rect): El[] => {
  const stool = (x: number, colour: string) => [
    r(x, 162, 10, 3, colour),
    r(x + 1, 165, 2, 7, colour),
    r(x + 7, 165, 2, 7, colour),
  ];
  const table = (x: number) => [
    r(x, 150, 34, 4, '#e8e8e8'),
    r(x + 15, 154, 4, 18, '#9a9a9a'),
    r(x + 6, 145, 4, 5, '#c98a3a'),
    r(x + 22, 145, 4, 5, '#c98a3a'),
  ];
  return [
    ...bands(r, 0, 50, ['#2b1840', '#4a2050', '#7a3050', '#b04a40', '#e07a3a']),
    r(0, 40, VW, 112, '#c9b48a'),
    r(0, 40, VW, 4, '#a8946a'),
    ...Array.from({ length: 7 }, (_, i) => {
      const x = 14 + i * 44;
      return [
        r(x, 50, 24, 22, '#5a3a2a'),
        r(x + 2, 52, 9, 18, '#7a5236'),
        r(x + 13, 52, 9, 18, '#7a5236'),
        r(x - 1, 72, 26, 2, '#8a7a5a'),
      ];
    }).flat(),
    r(30, 82, 260, 20, '#1b5e20'),
    r(30, 82, 260, 2, '#2e7d32'),
    <text
      key="sign"
      x={160}
      y={96}
      textAnchor="middle"
      fontFamily="'Press Start 2P', monospace"
      fontSize={9}
      fill="#ffe066"
    >
      RESTORAN MAMAK 24 JAM
    </text>,
    ...Array.from({ length: 32 }, (_, i) => r(i * 10, 104, 10, 9, i % 2 ? '#f4f4f4' : '#d7263d')),
    r(0, 113, VW, 37, '#3a2a20'),
    r(244, 118, 34, 20, '#111'),
    r(246, 120, 30, 16, '#2e8b3a', 'stage-twinkle'),
    r(260, 120, 1, 16, '#e8e8e8'),
    ...[50, 120, 200, 270].flatMap((x) => [
      r(x, 113, 1, 8, '#222'),
      r(x - 3, 121, 7, 3, '#ffd76a'),
      r(x - 8, 124, 17, 6, 'rgba(255, 215, 106, 0.18)', 'stage-twinkle'),
    ]),
    ...Array.from({ length: 10 }, (_, i) => r(i * 32, 150, 32, 30, i % 2 ? '#7a7a7a' : '#6a6a6a')),
    ...table(30),
    ...table(140),
    ...table(240),
    ...stool(18, '#2e86de'),
    ...stool(70, '#d7263d'),
    ...stool(128, '#d7263d'),
    ...stool(180, '#2e86de'),
    ...stool(228, '#2e86de'),
    ...stool(280, '#d7263d'),
  ];
};

const pantry = (r: Rect): El[] => {
  const out: El[] = [r(0, 0, VW, 150, '#d9e3e8')];
  for (let y = 0; y < 150; y += 16) out.push(r(0, y, VW, 1, '#c3cfd6'));
  for (let x = 0; x < VW; x += 16) out.push(r(x, 0, 1, 150, '#c3cfd6'));
  out.push(
    r(16, 18, 92, 64, '#5a6a7a'),
    r(20, 22, 84, 56, '#8fc7ff'),
    ...[
      [22, 58, 10, 20],
      [34, 48, 8, 30],
      [44, 62, 12, 16],
      [58, 40, 10, 38],
      [70, 54, 9, 24],
      [81, 60, 12, 18],
      [94, 50, 8, 28],
    ].map(([x, y, w, h]) => r(x!, y!, w!, h!, '#5f7fa8')),
    r(61, 22, 2, 56, '#5a6a7a'),
    r(126, 2, 66, 5, '#ffffff'),
    r(118, 7, 82, 6, 'rgba(255,255,255,0.35)', 'stage-twinkle'),
    r(176, 18, 136, 38, '#8a6a4a'),
    ...[176, 210, 244, 278].map((x) => r(x + 32, 18, 2, 38, '#6a4e34')),
    r(112, 58, 38, 92, '#eef1f3'),
    r(112, 96, 38, 2, '#c9ced3'),
    r(144, 70, 2, 18, '#8a9097'),
    r(144, 104, 2, 30, '#8a9097'),
    r(150, 100, 170, 8, '#3a3a40'),
    r(150, 108, 170, 42, '#9a7a5a'),
    ...[150, 192, 234].map((x) => r(x + 40, 108, 2, 42, '#7a5c40')),
    r(196, 78, 22, 22, '#222'),
    r(199, 81, 4, 3, '#ff3b5c', 'stage-twinkle'),
    r(203, 90, 8, 8, '#f4f4f4'),
    <g key="steam" className="stage-steam">
      {r(205, 72, 2, 4, 'rgba(255,255,255,0.7)')}
      {r(208, 66, 2, 4, 'rgba(255,255,255,0.5)')}
    </g>,
    r(236, 82, 38, 18, '#bfc4c9'),
    r(239, 85, 24, 12, '#2a2f36'),
    r(266, 86, 5, 2, '#4dff88'),
    r(288, 60, 18, 40, '#e8eef2'),
    r(290, 44, 14, 18, '#7ec8ff'),
  );
  for (let y = 150; y < VH; y += 10) {
    for (let x = 0; x < VW; x += 10) {
      out.push(r(x, y, 10, 10, (x + y) % 20 === 0 ? '#8a8f99' : '#a7acb5'));
    }
  }
  return out;
};

const pasarMalam = (r: Rect): El[] => {
  const goods = ['#ff3b5c', '#ffcc33', '#4dff88', '#f46036'];
  const tent = (x: number, a: string, b: string): El[] => {
    const rand = rng(x + 1);
    const out: El[] = [];
    for (let i = 0; i < 7; i++) out.push(r(x + i * 10, 64, 10, 14, i % 2 ? a : b));
    out.push(
      r(x - 2, 60, 74, 4, a),
      r(x, 78, 2, 52, '#bbb'),
      r(x + 68, 78, 2, 52, '#bbb'),
      r(x + 26, 80, 18, 3, '#ffe9a0', 'stage-twinkle'),
      r(x + 4, 112, 62, 18, '#7a4a2a'),
    );
    for (let i = 0; i < 12; i++) {
      out.push(
        r(x + 6 + Math.floor(rand() * 56), 106 + Math.floor(rand() * 6), 4, 4, goods[i % 4]!),
      );
    }
    return out;
  };
  const lights: El[] = [];
  const bulbs = ['#ffcc33', '#ff3b5c', '#4dff88', '#3be8ff'];
  for (let x = 0; x < VW; x += 8) {
    const y = 40 + Math.round(Math.abs(Math.sin(x / 26)) * 10);
    lights.push(r(x, y, 2, 2, bulbs[(x / 8) % 4]!, x % 16 ? 'stage-twinkle' : undefined));
  }
  const crowd: El[] = [];
  const rand = rng(31);
  for (let x = -6; x < VW; x += 12 + Math.floor(rand() * 8)) {
    const h = 18 + Math.floor(rand() * 8);
    crowd.push(r(x, 180 - h, 10, h, '#120c1e'), r(x + 2, 180 - h - 6, 6, 6, '#120c1e'));
  }
  return [
    ...bands(r, 0, 140, ['#060818', '#0a0d26', '#101436', '#181a44']),
    ...stars(r, 9, 30, 50),
    ...skyline(r, 17, 100, 20, 45, '#0d0f24'),
    ...lights,
    ...tent(8, '#d7263d', '#f4f4f4'),
    ...tent(86, '#2e86de', '#f4f4f4'),
    ...tent(164, '#e2b007', '#d7263d'),
    ...tent(242, '#1b998b', '#f4f4f4'),
    r(0, 130, VW, 50, '#24202e'),
    ...crowd,
  ];
};

const rooftop = (r: Rect): El[] => [
  ...bands(r, 0, 140, [
    '#3a1a5a',
    '#5a2070',
    '#8a2a78',
    '#c03a70',
    '#e85a5a',
    '#f78a4a',
    '#ffb347',
  ]),
  ...pixelCircle(r, 160, 100, 30, '#ffe066', true),
  <g key="clouds" className="stage-drift-slow">
    {[20, 120, 230].flatMap((x, i) => [
      r(x, 30 + i * 12, 34, 5, '#ffb3a0'),
      r(x + 6, 26 + i * 12, 20, 4, '#ffc8b4'),
    ])}
  </g>,
  ...skyline(r, 41, 132, 15, 50, '#3a1838', '#ff9a6a'),
  r(0, 132, VW, 48, '#4a4458'),
  r(0, 132, VW, 3, '#6a6478'),
  ...Array.from({ length: 33 }, (_, i) => r(i * 10, 118, 2, 14, '#2a2434')),
  r(0, 118, VW, 2, '#2a2434'),
  r(30, 140, 26, 22, '#7a7488'),
  r(32, 136, 22, 4, '#8a8498'),
  r(250, 120, 4, 40, '#2a2434'),
  r(244, 120, 16, 2, '#2a2434'),
  r(251, 112, 2, 8, '#ff3b5c', 'stage-twinkle'),
  r(190, 146, 30, 18, '#9a94a8'),
  r(195, 150, 20, 10, '#5a5468'),
];

const SCENES: Readonly<Record<StageId, (r: Rect) => El[]>> = {
  'kl-night': klNight,
  mamak,
  pantry,
  'pasar-malam': pasarMalam,
  rooftop,
};

/** The scene itself, scaled to cover its box. */
export const StageArt = memo(function StageArt({
  stage,
  crop = 'bottom',
}: {
  readonly stage: StageId;
  /** Which part survives in a very wide box: the ground line, or the middle of the scene. */
  readonly crop?: 'bottom' | 'middle';
}) {
  return (
    <svg
      className="stage-art"
      viewBox={`0 0 ${VW} ${VH}`}
      preserveAspectRatio={crop === 'middle' ? 'xMidYMid slice' : 'xMidYMax slice'}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      data-stage={stage}
    >
      {scene(SCENES[stage])}
    </svg>
  );
});

/** Full-screen, dimmed stage behind the whole match. */
export function StageBackdrop({ stage }: { readonly stage: StageId }) {
  return (
    <div className="stage-backdrop" data-testid="stage-backdrop" data-stage={stage}>
      <StageArt stage={stage} />
    </div>
  );
}
