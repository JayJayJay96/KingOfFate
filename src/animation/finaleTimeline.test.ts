import { describe, expect, it } from 'vitest';
import {
  CHANT_BEAT_MS,
  FINALE_MIN_BEAT_MS,
  FINALE_REVEAL_HOLD_MS,
  finalePace,
  introTimeline,
  NORMAL_PACE,
  roundsWithoutWinner,
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

  it.each([4, 5, 6])('%i finalists sit in two rows, leaving the middle for the chant', (n) => {
    const pts = stagePositions(n);
    expect(pts).toHaveLength(n);
    for (const p of pts) {
      expect(p.x).toBeGreaterThan(5);
      expect(p.x).toBeLessThan(95);
      expect([24, 76]).toContain(p.y);
    }
    // No two fighters share a spot.
    expect(new Set(pts.map((p) => `${p.x},${p.y}`)).size).toBe(n);
  });
});

describe('finale rising pace (owner request 2026-10-10)', () => {
  const draw = { qualifiedIds: [], tiebreakIds: null };
  const winner = { qualifiedIds: ['a'], tiebreakIds: null };
  const tiebreak = { qualifiedIds: [], tiebreakIds: ['a', 'b'] };

  it('counts the latest rounds in a row with no new winner; a winner or tiebreak resets', () => {
    expect(roundsWithoutWinner([])).toBe(0);
    expect(roundsWithoutWinner([draw, draw, draw])).toBe(3);
    expect(roundsWithoutWinner([draw, winner, draw, draw])).toBe(2);
    expect(roundsWithoutWinner([draw, draw, tiebreak])).toBe(0);
    expect(roundsWithoutWinner([draw, winner])).toBe(0);
  });

  it('each such round makes the beat 50 ms shorter, everything in proportion, floor 60 %', () => {
    expect(finalePace(0)).toEqual(NORMAL_PACE);
    const p1 = finalePace(1);
    expect(p1.beatMs).toBe(CHANT_BEAT_MS - 50);
    expect(p1.scale).toBeCloseTo((CHANT_BEAT_MS - 50) / CHANT_BEAT_MS);
    expect(p1.holdMs).toBe(Math.round(FINALE_REVEAL_HOLD_MS * p1.scale));
    expect(finalePace(4).beatMs).toBe(CHANT_BEAT_MS - 200);
    expect(finalePace(50).beatMs).toBe(FINALE_MIN_BEAT_MS);
    expect(finalePace(50).scale).toBeCloseTo(0.6);
    // Monotonic: never slower as the streak grows.
    for (let k = 0; k < 20; k++) {
      expect(finalePace(k + 1).beatMs).toBeLessThanOrEqual(finalePace(k).beatMs);
    }
  });

  it('the round timeline follows the pace, and the hand attack (2.4 s × pace) still fits', () => {
    for (let k = 0; k < 12; k++) {
      const pace = finalePace(k);
      const { cues, resolveMs } = roundTimeline(pace);
      expect(cues.map((c) => c.atMs)).toEqual([0, pace.beatMs, 2 * pace.beatMs]);
      expect(resolveMs).toBe(2 * pace.beatMs + pace.holdMs);
      // Visible after "Yo!": hold + pause ≥ attack delay + duration, both scaled.
      expect(pace.holdMs + pace.pauseMs).toBeGreaterThanOrEqual((0.15 + 2.4) * 1000 * pace.scale);
    }
  });
});
