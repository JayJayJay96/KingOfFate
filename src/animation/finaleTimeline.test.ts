import { describe, expect, it } from 'vitest';
import {
  CHANT_BEAT_MS,
  FINALE_REVEAL_HOLD_MS,
  introTimeline,
  roundTimeline,
  stagePositions,
} from './finaleTimeline';

describe('finale chant timelines', () => {
  it('intro is "Một Hai Ba Yo!" with no reveal, then clears', () => {
    const { cues, doneMs } = introTimeline();
    expect(cues.map((c) => c.word)).toEqual(['MOT', 'HAI', 'BA', 'YO', null]);
    expect(cues.every((c) => !c.reveal)).toBe(true);
    expect(doneMs).toBeGreaterThan(cues.at(-1)!.atMs);
  });

  it('each round is "Hai · Ba · Yo!" and hands are revealed only on "Yo!"', () => {
    const { cues, resolveMs } = roundTimeline();
    expect(cues.map((c) => [c.word, c.reveal])).toEqual([
      ['HAI', false],
      ['BA', false],
      ['YO', true],
    ]);
    expect(cues.map((c) => c.atMs)).toEqual([0, CHANT_BEAT_MS, 2 * CHANT_BEAT_MS]);
    expect(resolveMs).toBe(2 * CHANT_BEAT_MS + FINALE_REVEAL_HOLD_MS);
  });
});

describe('stagePositions', () => {
  it('2 finalists face each other left/right', () => {
    const [a, b] = stagePositions(2);
    expect(a!.y).toBe(b!.y);
    expect(a!.x).toBeLessThan(50);
    expect(b!.x).toBeGreaterThan(50);
  });

  it('3 finalists form a triangle with one on top', () => {
    const pts = stagePositions(3);
    expect(pts[0]!.x).toBeCloseTo(50);
    expect(pts[0]!.y).toBeLessThan(pts[1]!.y);
    expect(pts[1]!.y).toBeCloseTo(pts[2]!.y);
  });

  it.each([4, 5, 6])('%i finalists sit on a ring inside the arena', (n) => {
    const pts = stagePositions(n);
    expect(pts).toHaveLength(n);
    for (const p of pts) {
      expect(p.x).toBeGreaterThan(5);
      expect(p.x).toBeLessThan(95);
      expect(p.y).toBeGreaterThan(5);
      expect(p.y).toBeLessThan(95);
    }
  });
});
