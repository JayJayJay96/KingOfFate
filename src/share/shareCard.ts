import type { StageId } from '../game/config/stages';
import { lookTitle, type FighterLook } from '../game/config/looks';
import type { MatchState } from '../game/engine/matchTypes';
import { fileStamp } from '../game/history/exportData';
import type { PixelImage } from '../components/sprites/PixelArt';

/**
 * Victory share card (owner request 2026-10-16): one picture with the winner(s), the prize line,
 * the date and the fallen fighters, to post in the office chat. Drawn locally on a canvas; the
 * picture is only saved or copied when the host asks, never uploaded.
 */
export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

export interface ShareCardData {
  readonly title: string | null;
  readonly winners: readonly { readonly name: string; readonly look?: FighterLook }[];
  /** Knocked out during ordinary turns, in the order they fell, then the finale losers. */
  readonly fallen: readonly string[];
  readonly dateText: string;
  readonly fighterCount: number;
  readonly finaleRounds: number;
  readonly stage: StageId | null;
}

export function shareCardData(match: MatchState, stage: StageId | null): ShareCardData {
  const f = match.finale!;
  const byId = new Map(match.players.map((p) => [p.id, p]));
  const knockedOut = match.players
    .filter((p) => !p.alive)
    .sort((a, b) => (a.eliminatedOnTurn ?? 0) - (b.eliminatedOnTurn ?? 0))
    .map((p) => p.name);
  const finaleLosers = f.finalistIds.filter((id) => !f.winnerIds.includes(id));
  const when = new Date(match.completedAt ?? match.startedAt);
  return {
    title: match.title?.trim() || null,
    winners: f.winnerIds.map((id) => {
      const p = byId.get(id);
      return p?.look ? { name: p.name, look: p.look } : { name: p?.name ?? '???' };
    }),
    fallen: [...knockedOut, ...finaleLosers.map((id) => byId.get(id)?.name ?? '???')],
    dateText: when.toLocaleString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    fighterCount: match.players.length,
    finaleRounds: f.rounds.length,
    stage,
  };
}

export function shareCardFileName(match: MatchState): string {
  return `kof-winner_${fileStamp(new Date(match.completedAt ?? match.startedAt))}.png`;
}

/** "Fallen: A, B, C +4 more" in at most `maxChars` characters. */
export function fallenLine(names: readonly string[], maxChars: number): string {
  if (names.length === 0) return 'Nobody fell. Pure luck!';
  const prefix = 'Fallen: ';
  for (let shown = names.length; shown > 0; shown--) {
    const rest = names.length - shown;
    const line = `${prefix}${names.slice(0, shown).join(', ')}${rest > 0 ? ` +${rest} more` : ''}`;
    if (line.length <= maxChars) return line;
  }
  return `${prefix}${names.length} fighters`;
}

const SKY: Readonly<Record<StageId, readonly [string, string]>> = {
  'kl-night': ['#0b1030', '#3a1450'],
  mamak: ['#2a1405', '#5a2a0a'],
  pantry: ['#0e2a2a', '#1f4a3a'],
  'pasar-malam': ['#1a0a2a', '#5a1a3a'],
  rooftop: ['#0a1a3a', '#c0503a'],
};

const FONT = '"Press Start 2P", monospace';

export interface ShareCardArt {
  readonly sprite: (name: string, look?: FighterLook) => PixelImage;
  readonly crown: PixelImage;
}

export function drawShareCard(
  ctx: CanvasRenderingContext2D,
  data: ShareCardData,
  art: ShareCardArt,
): void {
  const [top, bottom] = data.stage ? SKY[data.stage] : (['#0d0716', '#3a1030'] as const);
  const sky = ctx.createLinearGradient(0, 0, 0, CARD_HEIGHT);
  sky.addColorStop(0, top);
  sky.addColorStop(1, bottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // Pixel stars, the same every time.
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (let i = 0; i < 70; i++) {
    ctx.fillRect(Math.floor(rand() * CARD_WIDTH), Math.floor(rand() * 260), 3, 3);
  }

  // Frame.
  ctx.strokeStyle = '#ffcc33';
  ctx.lineWidth = 8;
  ctx.strokeRect(12, 12, CARD_WIDTH - 24, CARD_HEIGHT - 24);

  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  shadowText(ctx, 'KING OF FATE', 40, 40, 28, '#ffcc33');
  ctx.textAlign = 'right';
  shadowText(ctx, data.dateText, CARD_WIDTH - 40, 46, 16, '#e8e8ff');

  ctx.textAlign = 'center';
  let y = 100;
  if (data.title) {
    shadowText(ctx, fit(data.title.toUpperCase(), 40), CARD_WIDTH / 2, y, 22, '#ffcc33');
    y += 44;
  }
  shadowText(
    ctx,
    data.winners.length === 1 ? 'WINNER!' : 'WINNERS!',
    CARD_WIDTH / 2,
    y,
    52,
    '#ff3b5c',
  );
  y += 84;

  // Winners side by side: crown, sprite, name.
  const count = Math.max(1, data.winners.length);
  const scale = count <= 2 ? 11 : count <= 3 ? 9 : 7;
  const slot = CARD_WIDTH / (count + 1);
  data.winners.forEach((w, i) => {
    const cx = slot * (i + 1);
    const img = art.sprite(w.name, w.look);
    const width = img.rows[0]!.length * scale;
    const height = img.rows.length * scale;
    const crownScale = Math.max(4, Math.round(scale * 0.6));
    drawPixels(ctx, art.crown, cx - (art.crown.rows[0]!.length * crownScale) / 2, y, crownScale);
    const spriteY = y + art.crown.rows.length * crownScale + 6;
    drawPixels(ctx, img, cx - width / 2, spriteY, scale);
    shadowText(ctx, fit(w.name.toUpperCase(), 18), cx, spriteY + height + 12, 22, '#ffffff');
    const title = lookTitle(w.look);
    if (title)
      shadowText(ctx, fit(title.toUpperCase(), 22), cx, spriteY + height + 42, 12, '#ffcc33');
  });

  ctx.textAlign = 'center';
  const rounds = `${data.finaleRounds} FINALE ROUND${data.finaleRounds === 1 ? '' : 'S'}`;
  shadowText(
    ctx,
    `${data.fighterCount} FIGHTERS · ${rounds}`,
    CARD_WIDTH / 2,
    CARD_HEIGHT - 112,
    14,
    '#c9a7ff',
  );
  shadowText(ctx, fallenLine(data.fallen, 70), CARD_WIDTH / 2, CARD_HEIGHT - 80, 13, '#e8e8ff');
  shadowText(ctx, 'king-of-fate.vercel.app', CARD_WIDTH / 2, CARD_HEIGHT - 48, 11, '#8888aa');
}

/** Renders the card to a PNG. Null when the browser has no 2D canvas. */
export async function renderShareCard(
  data: ShareCardData,
  art: ShareCardArt,
): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    ctx = null;
  }
  if (!ctx) return null;
  try {
    await document.fonts?.load(`22px ${FONT}`);
  } catch {
    // The fallback monospace font still makes a fine card.
  }
  ctx.imageSmoothingEnabled = false;
  drawShareCard(ctx, data, art);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
}

function shadowText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  colour: string,
) {
  ctx.font = `${size}px ${FONT}`;
  const offset = Math.max(2, Math.round(size / 8));
  ctx.fillStyle = '#000000';
  ctx.fillText(text, x + offset, y + offset);
  ctx.fillStyle = colour;
  ctx.fillText(text, x, y);
}

function drawPixels(
  ctx: CanvasRenderingContext2D,
  image: PixelImage,
  x: number,
  y: number,
  scale: number,
) {
  image.rows.forEach((row, ry) => {
    [...row].forEach((key, rx) => {
      const colour = image.palette[key];
      if (!colour) return;
      ctx.fillStyle = colour;
      ctx.fillRect(Math.round(x + rx * scale), Math.round(y + ry * scale), scale, scale);
    });
  });
}

function fit(text: string, maxChars: number): string {
  const chars = [...text];
  return chars.length <= maxChars ? text : `${chars.slice(0, maxChars - 1).join('')}…`;
}
