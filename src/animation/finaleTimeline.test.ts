import { describe, expect, it } from 'vitest';
import {
  CHANT_BEAT_MS,
  FINALE_MIN_BEAT_MS,
  FINALE_REVEAL_HOLD_MS,
  finaleIntensity,
  finalePace,
  introTimeline,
  isLastPoint,
  LAST_POINT_PAUSE_MS,
  NORMAL_PACE,
  roundsWithoutWinner,
  roundTimeline,
  stagePositions,
} from './finaleTimeline';

describe('finale chant timelines', () => {
  it('intro is "1, 2, Juice!" with no reveal, then clears', () => {
    const { cues, doneMs } = introTimeline();
    expect(cues.map((c) => c.word)).toEqual(['ONE', 'TWO', 'JUICE', null]);
    expect(cues.every((c) => !c.reveal)).toBe(true);
    expect(doneMs).toBeGreaterThan(cues.at(-1)!.atMs);
  });

  it('each round is "1 · 2 · Juice!" and hands are revealed only on "Juice!"', () => {
    const { cues, resolveMs } = roundTimeline();
    expect(cues.map((c) => [c.word, c.reveal])).toEqual([
      ['ONE', false],
      ['TWO', false],
      ['JUICE', true],
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

  it('speeds up steeply, then levels off toward the 60 % floor (curve 2026-10-16)', () => {
    expect(finalePace(0)).toEqual(NORMAL_PACE);
    const p1 = finalePace(1);
    expect(p1.beatMs).toBe(528);
    expect(p1.scale).toBeCloseTo(528 / CHANT_BEAT_MS);
    expect(p1.holdMs).toBe(Math.round(FINALE_REVEAL_HOLD_MS * p1.scale));
    expect([2, 3, 4].map((k) => finalePace(k).beatMs)).toEqual([478, 442, 418]);
    expect(finalePace(50).beatMs).toBe(FINALE_MIN_BEAT_MS);
    expect(finalePace(50).scale).toBeCloseTo(0.6);
    // Never slower as the streak grows, and each step is smaller than the one before.
    for (let k = 0; k < 20; k++) {
      const [a, b, c] = [finalePace(k), finalePace(k + 1), finalePace(k + 2)].map((p) => p.beatMs);
      expect(b).toBeLessThanOrEqual(a!);
      expect(b! - c!).toBeLessThanOrEqual(a! - b! + 1); // ±1 ms rounding
    }
  });

  it('the round timeline follows the pace, and the hand attack (2.4 s × pace) still fits', () => {
    for (let k = 0; k < 12; k++) {
      const pace = finalePace(k);
      const { cues, resolveMs } = roundTimeline(pace);
      expect(cues.map((c) => c.atMs)).toEqual([0, pace.beatMs, 2 * pace.beatMs]);
      expect(resolveMs).toBe(2 * pace.beatMs + pace.holdMs);
      // Visible after "Juice!": hold + pause ≥ attack delay + duration, both scaled.
      expect(pace.holdMs + pace.pauseMs).toBeGreaterThanOrEqual((0.15 + 2.4) * 1000 * pace.scale);
    }
  });
});

describe('"last point" drama (owner request 2026-10-16)', () => {
  const race = (scores: Record<string, number>, winnerIds: string[] = []) => ({
    started: true,
    stageNumber: 1,
    finalistIds: ['a', 'b', 'c'],
    contenderIds: ['a', 'b', 'c'],
    scores,
    winnerIds,
    excludedIds: [],
    pendingRound: null,
    rounds: [],
  });

  it('is on when someone still racing is one point from a slot', () => {
    expect(isLastPoint(race({ a: 1, b: 1, c: 0 }))).toBe(false);
    expect(isLastPoint(race({ a: 2, b: 0, c: 0 }))).toBe(true);
    expect(isLastPoint(race({ a: 3, b: 1, c: 0 }, ['a']))).toBe(false);
  });

  it('"2" darkens, and "Juice!" waits for the held breath; the hold after is unchanged', () => {
    const pace = finalePace(2);
    const plain = roundTimeline(pace);
    const drama = roundTimeline(pace, true);
    expect(drama.cues[1]).toMatchObject({ word: 'TWO', dark: true });
    expect(plain.cues.some((c) => c.dark)).toBe(false);
    expect(drama.cues[2]!.atMs).toBe(2 * pace.beatMs + LAST_POINT_PAUSE_MS);
    expect(drama.resolveMs - drama.cues[2]!.atMs).toBe(plain.resolveMs - plain.cues[2]!.atMs);
  });
});

describe('finale music that builds (owner request 2026-10-10)', () => {
  const base = {
    started: true,
    stageNumber: 1,
    finalistIds: ['a', 'b', 'c'],
    contenderIds: ['a', 'b', 'c'],
    winnerIds: [] as string[],
    excludedIds: [] as string[],
    pendingRound: null,
    rounds: [],
  };
  const at = (scores: Record<string, number>, extra = {}) =>
    finaleIntensity({ ...base, scores, ...extra });

  it('drums and bass, then lead, then arpeggio at match point, then a key change', () => {
    expect(at({ a: 0, b: 0, c: 0 })).toBe(0);
    expect(at({ a: 1, b: 0, c: 0 })).toBe(1);
    expect(at({ a: 2, b: 1, c: 0 })).toBe(2);
    expect(at({ a: 2, b: 2, c: 0 })).toBe(3);
    expect(at({ a: 0, b: 0 }, { stageNumber: 2, contenderIds: ['a', 'b'] })).toBe(3);
  });

  it('a qualified winner no longer counts toward match point', () => {
    expect(at({ a: 3, b: 2, c: 0 }, { winnerIds: ['a'] })).toBe(2);
  });
});
