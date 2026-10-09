import { describe, expect, it } from 'vitest';
import { CHI2_P001, chiSquareUniform } from '../../test/stats';
import { createScriptedRng, createSeededRng, type Rng } from '../rng/rng';
import { describeEvent } from './describeEvent';
import { IllegalTransitionError } from './errors';
import {
  beginFinale,
  FINALE_TARGET_SCORE,
  initialFinale,
  resolveFinaleRound,
  startFinaleRound,
  winningGesture,
} from './finale';
import { createMatch, type MatchLaunch } from './match';
import type { MatchState } from './matchTypes';

const R = 0;
const P = 1;
const S = 2;
const NAMES = ['Aisyah', 'Wei Jie', 'Kavitha', 'Hafiz', 'Mei Ling', 'Arjun'];
const T = '2026-10-09T08:00:00.000Z';
const ids = { matchId: 'm1', startedAt: '2026-10-09T07:00:00.000Z' };

function launch(n: number, w: number): MatchLaunch {
  return {
    players: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: NAMES[i] ?? `P${i}` })),
    winnerCount: w,
    presetId: 'normal',
  };
}

/** A started finale with W + 1 finalists (the match opens straight in the finale). */
function finale(w: number): MatchState {
  return beginFinale(createMatch(launch(w + 1, w), ids));
}

/** One reveal with scripted gestures, in contender order. */
function round(s: MatchState, gestures: number[]): MatchState {
  const id = `r${s.finale!.rounds.length + 1}`;
  return resolveFinaleRound(startFinaleRound(s, createScriptedRng(gestures), id), id, T);
}

function playOut(s: MatchState, rng: Rng): MatchState {
  let n = 0;
  while (s.phase === 'FINALE') {
    const id = `r${++n}`;
    s = resolveFinaleRound(startFinaleRound(s, rng, id), id, T);
    if (n > 10_000) throw new Error('Finale did not finish');
  }
  return s;
}

describe('winningGesture', () => {
  it('everyone the same is a draw', () => {
    expect(winningGesture(['ROCK', 'ROCK', 'ROCK'])).toBeNull();
  });
  it('all three gestures is a draw', () => {
    expect(winningGesture(['ROCK', 'PAPER', 'SCISSORS', 'ROCK'])).toBeNull();
  });
  it('exactly two gestures: the stronger one wins', () => {
    expect(winningGesture(['ROCK', 'SCISSORS', 'SCISSORS'])).toBe('ROCK');
    expect(winningGesture(['PAPER', 'ROCK'])).toBe('PAPER');
    expect(winningGesture(['SCISSORS', 'PAPER'])).toBe('SCISSORS');
  });
});

describe('finale setup', () => {
  it('W + 1 alive hands off to the finale with everyone at 0 and nobody started', () => {
    const m = createMatch(launch(3, 2), ids);
    expect(m.phase).toBe('FINALE');
    expect(m.finale).toEqual(initialFinale(['p0', 'p1', 'p2']));
  });

  it('rounds need the host to start the finale first; starting is idempotent', () => {
    const m = createMatch(launch(3, 2), ids);
    expect(() => startFinaleRound(m, createScriptedRng([R, R, R]), 'r1')).toThrow(
      IllegalTransitionError,
    );
    const started = beginFinale(m);
    expect(started.finale?.started).toBe(true);
    expect(beginFinale(started)).toBe(started);
    expect(describeEvent(started.events.at(-1)!, started)).toMatch(/^Một Hai Ba Yo!/);
  });

  it('commits every contender’s throw before the reveal, and only one round at a time', () => {
    const s = startFinaleRound(finale(2), createScriptedRng([R, P, S]), 'r1');
    expect(s.finale?.pendingRound).toEqual({
      roundId: 'r1',
      roundNumber: 1,
      stageNumber: 1,
      throws: [
        { playerId: 'p0', gesture: 'ROCK' },
        { playerId: 'p1', gesture: 'PAPER' },
        { playerId: 'p2', gesture: 'SCISSORS' },
      ],
    });
    expect(describeEvent(s.events.at(-1)!, s)).toBeNull(); // no spoiler
    expect(() => startFinaleRound(s, createScriptedRng([R, R, R]), 'r2')).toThrow(
      IllegalTransitionError,
    );
  });
});

describe('scoring', () => {
  it('a draw scores nobody (same hands, or all three)', () => {
    let s = round(finale(2), [R, R, R]);
    s = round(s, [R, P, S]);
    expect(s.finale?.scores).toEqual({ p0: 0, p1: 0, p2: 0 });
    expect(describeEvent(s.events.at(-1)!, s)).toBe(
      'Round 2: draw, Rock, Paper and Scissors all thrown.',
    );
  });

  it('every player throwing the winning hand scores 1', () => {
    const s = round(finale(2), [R, R, S]);
    expect(s.finale?.scores).toEqual({ p0: 1, p1: 1, p2: 0 });
    expect(s.finale?.rounds[0]).toMatchObject({ winningGesture: 'ROCK', scorerIds: ['p0', 'p1'] });
    expect(describeEvent(s.events.at(-1)!, s)).toBe(
      'Round 1: Rock beats Scissors, +1 for Aisyah and Wei Jie.',
    );
  });

  it('two finalists throwing the same is a draw', () => {
    expect(round(finale(1), [P, P]).finale?.scores).toEqual({ p0: 0, p1: 0 });
  });

  it('is idempotent: a stale or repeated round id changes nothing', () => {
    const pending = startFinaleRound(finale(1), createScriptedRng([R, S]), 'r1');
    const resolved = resolveFinaleRound(pending, 'r1', T);
    expect(resolveFinaleRound(resolved, 'r1', T)).toBe(resolved);
    expect(resolveFinaleRound(pending, 'other', T)).toBe(pending);
  });
});

describe('qualification and victory', () => {
  it('W = 1: first to 3 wins; the result is committed once with a completion time', () => {
    let s = finale(1);
    s = round(s, [R, S]);
    s = round(s, [S, R]);
    s = round(s, [P, R]);
    expect(s.finale?.scores).toEqual({ p0: 2, p1: 1 });
    s = round(s, [S, P]);
    expect(s.phase).toBe('VICTORY');
    expect(s.finale?.winnerIds).toEqual(['p0']);
    expect(s.completedAt).toBe(T);
    expect(s.events.filter((e) => e.type === 'MATCH_COMPLETED')).toHaveLength(1);
    expect(describeEvent(s.events.at(-1)!, s)).toBe('Winner: Aisyah!');
    expect(() => startFinaleRound(s, createScriptedRng([R, R]), 'rx')).toThrow(
      IllegalTransitionError,
    );
  });

  it('a qualified winner is locked and leaves the competition', () => {
    let s = finale(2);
    for (let i = 0; i < 3; i++) s = round(s, [R, S, S]); // p0 alone scores 3
    expect(s.finale?.winnerIds).toEqual(['p0']);
    expect(s.finale?.contenderIds).toEqual(['p1', 'p2']);
    expect(s.phase).toBe('FINALE');
    s = round(s, [P, R]); // only p1 and p2 throw now
    expect(s.finale?.rounds.at(-1)?.throws.map((t) => t.playerId)).toEqual(['p1', 'p2']);
  });

  it('owner example: HAN=2, BEN=2, JAY=1, then HAN and BEN both win → both slots, no tiebreak', () => {
    let s = finale(2); // p0 = HAN, p1 = BEN, p2 = JAY
    s = round(s, [R, R, S]); // 1,1,0
    s = round(s, [R, R, S]); // 2,2,0
    s = round(s, [S, S, R]); // 2,2,1
    expect(s.finale?.scores).toEqual({ p0: 2, p1: 2, p2: 1 });
    s = round(s, [R, R, S]); // 3,3,1
    expect(s.phase).toBe('VICTORY');
    expect(s.finale?.winnerIds).toEqual(['p0', 'p1']);
    expect(s.finale?.stageNumber).toBe(1);
    expect(s.events.some((e) => e.type === 'TIEBREAK_STARTED')).toBe(false);
  });
});

describe('oversubscription tiebreak (D3) — rule check on constructed states', () => {
  /**
   * With W + 1 finalists this cannot happen in play (some contender always fails to score), so
   * the rule is exercised on a constructed race: 4 contenders, 2 open slots.
   */
  /** 4 contenders p0–p3 with the given scores; callers set winnerCount to choose the slots. */
  function constructed(scores: Record<string, number>): MatchState {
    const base = finale(3);
    return { ...base, finale: { ...base.finale!, scores } };
  }

  it('if more reach 3 than slots remain, only they race again from 0; the rest are out', () => {
    // 4 contenders for 2 slots; p0–p2 reach 3 on the same reveal.
    const s0 = { ...constructed({ p0: 2, p1: 2, p2: 2, p3: 0 }), winnerCount: 2 };
    const s = round(s0, [R, R, R, S]); // p0, p1, p2 reach 3 together; 2 slots
    expect(s.phase).toBe('FINALE');
    expect(s.finale).toMatchObject({
      stageNumber: 2,
      contenderIds: ['p0', 'p1', 'p2'],
      excludedIds: ['p3'],
      winnerIds: [],
    });
    expect(s.finale?.scores).toMatchObject({ p0: 0, p1: 0, p2: 0 });
    expect(describeEvent(s.events.at(-1)!, s)).toMatch(/^TIEBREAK! Aisyah, Wei Jie and Kavitha/);

    // The tiebreak uses the same rules; two qualify together and fill both slots.
    let t = s;
    for (let i = 0; i < 3; i++) t = round(t, [P, P, R]);
    expect(t.phase).toBe('VICTORY');
    expect(t.finale?.winnerIds).toEqual(['p0', 'p1']);
    expect(t.finale?.rounds.at(-1)?.stageNumber).toBe(2);
  });

  it('D2 guard: contenders exactly equal to open slots qualify automatically', () => {
    // Normal case first: p0 already won, 3 contenders for 2 slots; p2 reaches 3 → 1 slot, 2 left.
    const s0 = constructed({ p0: 0, p1: 0, p2: 2, p3: 0 });
    const s1: MatchState = {
      ...s0,
      finale: { ...s0.finale!, contenderIds: ['p1', 'p2', 'p3'], winnerIds: ['p0'] },
    };
    const s = round(s1, [S, R, S]);
    expect(s.finale?.winnerIds).toEqual(['p0', 'p2']);
    expect(s.phase).toBe('FINALE');

    // Guard case: 3 contenders for 3 open slots fill them automatically after the reveal.
    const guard: MatchState = {
      ...s1,
      finale: { ...s1.finale!, contenderIds: ['p1', 'p2', 'p3'], winnerIds: [] },
    };
    const g = round(guard, [R, R, R]);
    expect(g.phase).toBe('VICTORY');
    expect(g.events.some((e) => e.type === 'FINALISTS_QUALIFIED' && e.automatic)).toBe(true);
  });
});

describe('real finales (seeded)', () => {
  it.each([1, 2, 3, 4, 5])('W = %i: always exactly W distinct winners, never a tiebreak', (w) => {
    const rng = createSeededRng(500 + w);
    for (let i = 0; i < 300; i++) {
      const s = playOut(finale(w), rng);
      expect(s.phase).toBe('VICTORY');
      const winners = s.finale!.winnerIds;
      expect(winners).toHaveLength(w);
      expect(new Set(winners).size).toBe(w);
      expect(s.finale!.stageNumber).toBe(1);
      expect(s.finale!.excludedIds).toEqual([]);
      expect(s.events.filter((e) => e.type === 'MATCH_COMPLETED')).toHaveLength(1);
    }
  });

  it.each([1, 2, 3, 4, 5])('W = %i: every finalist is equally likely to miss out', (w) => {
    const rng = createSeededRng(9000 + w);
    const missedOut = new Array<number>(w + 1).fill(0);
    const matches = 3000;
    for (let i = 0; i < matches; i++) {
      const s = playOut(finale(w), rng);
      const loser = s.finale!.finalistIds.find((id) => !s.finale!.winnerIds.includes(id))!;
      missedOut[Number(loser.slice(1))]!++;
    }
    expect(chiSquareUniform(missedOut)).toBeLessThan(CHI2_P001[w]!);
  });

  it('scores never exceed the target and every reveal is recorded', () => {
    const s = playOut(finale(4), createSeededRng(77));
    const resolved = s.events.filter((e) => e.type === 'FINALE_ROUND_RESOLVED').length;
    expect(s.finale!.rounds).toHaveLength(resolved);
    expect(Math.max(...Object.values(s.finale!.scores))).toBeLessThanOrEqual(FINALE_TARGET_SCORE);
  });
});
