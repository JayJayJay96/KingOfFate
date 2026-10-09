import type { CSSProperties } from 'react';

export interface PixelImage {
  /** Equal-length rows; each character is a palette key, anything else is transparent. */
  readonly rows: readonly string[];
  readonly palette: Readonly<Record<string, string>>;
}

interface PixelArtProps {
  readonly image: PixelImage;
  /** Rendered height in px (width keeps the pixel aspect ratio). */
  readonly size: number;
  readonly className?: string;
  readonly style?: CSSProperties;
}

/** Crisp SVG pixel art. Runs of equal colour are merged into one rect per row. Decorative only. */
export function PixelArt({ image, size, className, style }: PixelArtProps) {
  const height = image.rows.length;
  const width = image.rows[0]?.length ?? 0;
  const rects: { x: number; y: number; w: number; fill: string }[] = [];
  image.rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const key = row[x]!;
      let end = x + 1;
      while (end < row.length && row[end] === key) end++;
      const fill = image.palette[key];
      if (fill) rects.push({ x, y, w: end - x, fill });
      x = end;
    }
  });
  return (
    <svg
      className={className}
      style={style}
      width={(size * width) / Math.max(1, height)}
      height={size}
      viewBox={`0 0 ${width} ${height}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
      ))}
    </svg>
  );
}
