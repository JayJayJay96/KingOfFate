import { describe, expect, it } from 'vitest';
import { CROWN } from '../components/sprites/crown';
import { fighterSprite } from '../components/sprites/fighterSprite';
import { playToVictory } from '../test/historyFixtures';
import {
  drawShareCard,
  fallenLine,
  shareCardData,
  shareCardFileName,
  type ShareCardData,
} from './shareCard';

const ROSTER = (['Aisyah', 'Wei Jie', 'Kavitha', 'Hafiz', 'Mei Ling'] as const).map(
  (name, i) => [`p${i}`, name] as const,
);

describe('victory share card (owner request 2026-10-16)', () => {
  const won = { ...playToVictory({ matchId: 'm1', players: ROSTER, seed: 3 }), title: 'Kopi!' };

  it('lists the winners, the prize line and everyone who fell', () => {
    const data = shareCardData(won, 'mamak');
    const f = won.finale!;
    expect(data.title).toBe('Kopi!');
    expect(data.winners.map((w) => w.name)).toEqual(
      f.winnerIds.map((id) => won.players.find((p) => p.id === id)!.name),
    );
    expect(data.fallen).toHaveLength(ROSTER.length - f.winnerIds.length);
    expect(data.fallen).not.toContain(data.winners[0]!.name);
    expect(data.fighterCount).toBe(ROSTER.length);
    expect(data.stage).toBe('mamak');
  });

  it('names the file after the finish time', () => {
    expect(shareCardFileName(won)).toMatch(/^kof-winner_\d{4}-\d{2}-\d{2}_\d{4}\.png$/);
  });

  it('shortens a long list of the fallen', () => {
    expect(fallenLine([], 40)).toBe('Nobody fell. Pure luck!');
    expect(fallenLine(['An', 'Bo'], 40)).toBe('Fallen: An, Bo');
    const many = Array.from({ length: 30 }, (_, i) => `Fighter${i}`);
    const line = fallenLine(many, 70);
    expect(line.length).toBeLessThanOrEqual(70);
    expect(line).toMatch(/\+\d+ more$/);
  });

  it('draws the title, the winner and the fallen line', () => {
    const texts: string[] = [];
    const noop = () => undefined;
    const ctx = {
      createLinearGradient: () => ({ addColorStop: noop }),
      fillRect: noop,
      strokeRect: noop,
      fillText: (t: string) => texts.push(t),
    } as unknown as CanvasRenderingContext2D;
    const data: ShareCardData = {
      title: 'Who buys kopi today?',
      winners: [{ name: 'Aisyah' }],
      fallen: ['Wei Jie'],
      dateText: '16 Oct 2026',
      fighterCount: 2,
      finaleRounds: 4,
      stage: null,
    };
    drawShareCard(ctx, data, { sprite: (n) => fighterSprite(n), crown: CROWN });
    expect(texts).toContain('WHO BUYS KOPI TODAY?');
    expect(texts).toContain('WINNER!');
    expect(texts).toContain('AISYAH');
    expect(texts).toContain('Fallen: Wei Jie');
  });
});
