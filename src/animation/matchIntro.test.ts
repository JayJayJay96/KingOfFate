import { describe, expect, it } from 'vitest';
import { ANNOUNCE, IMPACT_LINE, turnImpact, victoryLine } from '../audio/announcer';
import { beginTurn, createMatch, resolveTurn } from '../game/engine/match';
import { createScriptedRng } from '../game/rng/rng';
import {
  INTRO_DONE_MS,
  INTRO_FIGHT_AT_MS,
  INTRO_ROUND_AT_MS,
  INTRO_STEP_MS,
  matchIntroTimeline,
} from './matchIntro';

describe('match intro timeline (owner decision: ~4 s, skippable)', () => {
  it('flashes the select cursor across every fighter, then ROUND 1, then FIGHT!', () => {
    const { cues, doneMs } = matchIntroTimeline(5);
    const cursorCues = cues.filter((c) => c.cursor !== null);
    expect(cursorCues.length).toBe(Math.ceil(INTRO_ROUND_AT_MS / INTRO_STEP_MS));
    expect(new Set(cursorCues.map((c) => c.cursor))).toEqual(new Set([0, 1, 2, 3, 4]));
    expect(cursorCues.every((c, i) => c.cursor === i % 5 && c.atMs === i * INTRO_STEP_MS)).toBe(
      true,
    );
    expect(cues.filter((c) => c.banner)).toEqual([
      { atMs: INTRO_ROUND_AT_MS, cursor: null, banner: 'ROUND 1' },
      { atMs: INTRO_FIGHT_AT_MS, cursor: null, banner: 'FIGHT!' },
    ]);
    expect(doneMs).toBe(INTRO_DONE_MS);
    expect(doneMs).toBeGreaterThanOrEqual(3500);
    expect(doneMs).toBeLessThanOrEqual(4500);
    // Ordered in time.
    expect(cues.map((c) => c.atMs)).toEqual([...cues.map((c) => c.atMs)].sort((a, b) => a - b));
  });

  it('works for the smallest and largest rosters', () => {
    expect(matchIntroTimeline(2).cues.filter((c) => c.cursor === 1).length).toBeGreaterThan(5);
    const big = matchIntroTimeline(32).cues.filter((c) => c.cursor !== null);
    expect(Math.max(...big.map((c) => c.cursor!))).toBeLessThan(32);
  });
});

describe('announcer lines', () => {
  const players = ['Aisyah', 'Wei Jie', 'Kavitha', 'Hafiz'].map((name, i) => ({
    id: `p${i}`,
    name,
  }));
  const start = createMatch(
    { players, winnerCount: 1, presetId: 'chaotic' },
    { matchId: 'm', startedAt: '2026-10-10T00:00:00.000Z' },
  );
  const slot = (kind: string) => start.fateSlots.indexOf(kind as never);
  const play = (draws: number[]) =>
    resolveTurn(beginTurn(start, createScriptedRng(draws), 't'), 't');

  it('maps each outcome to its stamp/sound kind', () => {
    expect(turnImpact(play([0, slot('KO')]).lastTurn!)).toBe('ko');
    expect(turnImpact(play([0, slot('SHIELD')]).lastTurn!)).toBe('shield');
    // VS: challenger 0 vs opponent 0 among the others, Rock beats Scissors → opponent eliminated.
    expect(turnImpact(play([0, slot('VS'), 0, 0, 2]).lastTurn!)).toBe('ko');
    expect(IMPACT_LINE.ko).toBe('K. O.!');
  });

  it('names the winners', () => {
    expect(victoryLine(['Aisyah'])).toBe('Aisyah wins!');
    expect(victoryLine(['Aisyah', 'Wei Jie', 'Hafiz'])).toBe('Aisyah, Wei Jie and Hafiz win!');
    expect(ANNOUNCE.fight).toBe('Fight!');
  });
});
