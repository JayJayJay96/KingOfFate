import { describe, expect, it } from 'vitest';
import { createScriptedRng, createSeededRng } from '../rng/rng';
import { chiSquareUniform } from '../../test/stats';
import { describeEvent } from './describeEvent';
import {
  alivePlayers,
  beginTurn,
  createMatch,
  IllegalTransitionError,
  resolveTurn,
  type MatchLaunch,
} from './match';
import type { MatchState } from './matchTypes';

const NAMES = ['Aisyah', 'Wei Jie', 'Kavitha', 'Hafiz', 'Mei Ling', 'Arjun', 'Nurul', 'Jason'];

function launch(n: number, winnerCount = 1): MatchLaunch {
  return {
    players: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: NAMES[i] ?? `P${i}` })),
    winnerCount,
    presetId: 'normal',
  };
}

const ids = { matchId: 'm1', startedAt: '2026-10-09T07:00:00.000Z' };

/** Plays a full KO-only match and returns the final state. */
function playOut(state: MatchState, seed: number): MatchState {
  const rng = createSeededRng(seed);
  let turn = 0;
  while (state.phase === 'READY') {
    state = beginTurn(state, rng, `t${++turn}`);
    state = resolveTurn(state, `t${turn}`);
  }
  return state;
}

describe('createMatch', () => {
  it('starts READY with every player alive and a MATCH_STARTED event', () => {
    const m = createMatch(launch(5, 2), ids);
    expect(m.phase).toBe('READY');
    expect(alivePlayers(m)).toHaveLength(5);
    expect(m.events.map((e) => e.type)).toEqual(['MATCH_STARTED']);
    expect(m.events[0]!.id).toBe('m1#1');
  });

  it('goes straight to the finale gate when N = W + 1, with no ordinary turns', () => {
    const m = createMatch(launch(3, 2), ids);
    expect(m.phase).toBe('FINALE_GATE');
    expect(m.events.map((e) => e.type)).toEqual(['MATCH_STARTED', 'FINALE_REACHED']);
    expect(() => beginTurn(m, createScriptedRng([0]), 't1')).toThrow(IllegalTransitionError);
  });

  it.each([
    [launch(1), /outside/],
    [launch(33), /outside/],
    [launch(3, 3), /at least 4/],
    [{ ...launch(4), winnerCount: 6 }, /winner count/],
    [
      {
        ...launch(2),
        players: [
          { id: 'x', name: 'A' },
          { id: 'x', name: 'B' },
        ],
      },
      /unique/,
    ],
  ])('rejects invalid launches (%#)', (bad, message) => {
    expect(() => createMatch(bad, ids)).toThrow(message);
  });
});

describe('beginTurn', () => {
  it('commits a pending KO for the sampled living player without eliminating yet', () => {
    const m = beginTurn(createMatch(launch(4), ids), createScriptedRng([2]), 't1');
    expect(m.phase).toBe('SPINNING');
    expect(m.pendingTurn).toEqual({ turnId: 't1', turnNumber: 1, playerId: 'p2', fate: 'KO' });
    expect(alivePlayers(m)).toHaveLength(4);
    expect(m.events.at(-1)?.type).toBe('TURN_COMMITTED');
  });

  it('samples only among living players, by index into the living list', () => {
    let m = createMatch(launch(5), ids);
    m = resolveTurn(beginTurn(m, createScriptedRng([0]), 't1'), 't1'); // p0 out
    m = beginTurn(m, createScriptedRng([0]), 't2');
    expect(m.pendingTurn?.playerId).toBe('p1');
  });

  it('refuses a second turn while one is spinning (double click guard)', () => {
    const m = beginTurn(createMatch(launch(4), ids), createScriptedRng([0]), 't1');
    expect(() => beginTurn(m, createScriptedRng([1]), 't2')).toThrow(IllegalTransitionError);
  });
});

describe('resolveTurn', () => {
  it('eliminates the committed player exactly once', () => {
    const spinning = beginTurn(createMatch(launch(4), ids), createScriptedRng([1]), 't1');
    const resolved = resolveTurn(spinning, 't1');
    expect(resolved.players.find((p) => p.id === 'p1')).toMatchObject({
      alive: false,
      eliminatedOnTurn: 1,
    });
    expect(resolved.phase).toBe('READY');
    expect(resolved.completedTurns).toBe(1);
    expect(resolved.lastTurn).toEqual({ turn: spinning.pendingTurn, eliminated: true });

    // Replays (e.g. animation callback after a reload) are no-ops.
    expect(resolveTurn(resolved, 't1')).toBe(resolved);
  });

  it('ignores a stale or unknown turn id', () => {
    const spinning = beginTurn(createMatch(launch(4), ids), createScriptedRng([1]), 't1');
    expect(resolveTurn(spinning, 'other')).toBe(spinning);
  });

  it('stops ordinary turns at exactly W + 1 alive', () => {
    let m = createMatch(launch(4, 2), ids);
    m = resolveTurn(beginTurn(m, createScriptedRng([3]), 't1'), 't1');
    expect(m.phase).toBe('FINALE_GATE');
    expect(alivePlayers(m).map((p) => p.id)).toEqual(['p0', 'p1', 'p2']);
    expect(m.events.at(-1)).toMatchObject({
      type: 'FINALE_REACHED',
      finalistIds: ['p0', 'p1', 'p2'],
    });
  });

  it('describes the log without spoiling committed-but-unrevealed turns', () => {
    const spinning = beginTurn(createMatch(launch(4), ids), createScriptedRng([0]), 't1');
    const visible = spinning.events.map((e) => describeEvent(e, spinning)).filter(Boolean);
    expect(visible).toEqual(['Match started: 4 fighters, 1 winner, Normal preset.']);
    const resolved = resolveTurn(spinning, 't1');
    expect(describeEvent(resolved.events.at(-1)!, resolved)).toBe(
      'Turn 1: Aisyah takes a KO. Eliminated!',
    );
  });
});

describe('full KO-only matches', () => {
  it.each([1, 2, 3, 4, 5])('W = %i: every N from W+1 to 32 ends with exactly W+1 alive', (w) => {
    for (let n = w + 1; n <= 32; n++) {
      const final = playOut(createMatch(launch(n, w), ids), n * 100 + w);
      expect(final.phase).toBe('FINALE_GATE');
      expect(alivePlayers(final)).toHaveLength(w + 1);
      expect(final.completedTurns).toBe(n - w - 1);
      expect(final.players.filter((p) => !p.alive)).toHaveLength(n - w - 1);
      const eventIds = final.events.map((e) => e.id);
      expect(new Set(eventIds).size).toBe(eventIds.length);
      expect(final.events.map((e) => e.seq)).toEqual(eventIds.map((_, i) => i + 1));
    }
  });
});

describe('fairness simulation', () => {
  it('selects each living player uniformly (seeded chi-square)', () => {
    const rng = createSeededRng(99);
    const base = createMatch(launch(8), ids);
    const counts = new Array<number>(8).fill(0);
    for (let i = 0; i < 80_000; i++) {
      const id = beginTurn(base, rng, 't').pendingTurn!.playerId;
      counts[Number(id.slice(1))]!++;
    }
    // Critical chi-square value for df = 7 at p = 0.001 is 24.32.
    expect(chiSquareUniform(counts)).toBeLessThan(24.32);
  });

  it('excludes eliminated players entirely', () => {
    const rng = createSeededRng(7);
    let m = createMatch(launch(6), ids);
    m = resolveTurn(beginTurn(m, createScriptedRng([0]), 't1'), 't1');
    for (let i = 0; i < 5000; i++) {
      expect(beginTurn(m, rng, 't').pendingTurn!.playerId).not.toBe('p0');
    }
  });
});
