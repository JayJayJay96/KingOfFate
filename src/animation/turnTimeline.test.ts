import { describe, expect, it } from 'vitest';
import { MAX_SPIN_MS } from '../game/config/timing';
import type { CommittedTurn } from '../game/engine/matchTypes';
import {
  buildTurnTimeline,
  DUEL_INTRO_MS,
  DUEL_RESULT_HOLD_MS,
  DUEL_THROW_MS,
  fateStartIndex,
  VS_ANNOUNCE_MS,
} from './turnTimeline';

const alive = ['a', 'b', 'c', 'd', 'e'];
const koTurn: CommittedTurn = {
  turnId: 'turn-1',
  turnNumber: 1,
  playerId: 'c',
  fateSlotIndex: 13,
  fate: 'KO',
  suddenDeath: false,
  duel: null,
};
const vsTurn: CommittedTurn = {
  ...koTurn,
  fate: 'VS',
  duel: {
    opponentId: 'a',
    throws: [
      { challenger: 'ROCK', opponent: 'ROCK' },
      { challenger: 'PAPER', opponent: 'ROCK' },
    ],
  },
};

describe('buildTurnTimeline (one step at a time)', () => {
  it('the Fate cursor only starts after the fighter has landed and been revealed', () => {
    for (let i = 0; i < 100; i++) {
      const turn = { ...koTurn, turnId: `turn-${i}`, fateSlotIndex: i % 20 };
      const t = buildTurnTimeline(turn, alive, 'a', 0);
      expect(t.playerSteps.at(-1)!.id).toBe('c');
      expect(t.fateStartMs).toBeGreaterThan(t.playerSteps.at(-1)!.atMs);
      expect(t.fateSteps[0]!.atMs).toBe(t.fateStartMs);
      expect(t.fateSteps.at(-1)!.id).toBe(String(i % 20));
      // Each cursor stays within its own cap.
      expect(t.fateStartMs).toBeLessThanOrEqual(MAX_SPIN_MS);
      expect(t.fateDoneMs - t.fateStartMs).toBeLessThanOrEqual(MAX_SPIN_MS);
      expect(t.completeMs).toBe(t.fateDoneMs);
      expect(t.vsAnnounceMs).toBeNull();
      expect(t.opponentSteps).toEqual([]);
    }
  });

  it('the Fate cursor walks the strip in order, wrapping', () => {
    const t = buildTurnTimeline(koTurn, alive, 'a', 18);
    expect(t.fateSteps.slice(0, 4).map((s) => s.id)).toEqual(['18', '19', '0', '1']);
  });

  it('VS: "VS!" announce, then an opponent spin over the OTHER fighters, then the throws', () => {
    for (let i = 0; i < 50; i++) {
      const t = buildTurnTimeline({ ...vsTurn, turnId: `vs-${i}` }, alive, 'a', 0);
      expect(t.vsAnnounceMs).toBe(t.fateDoneMs);
      expect(t.opponentStartMs).toBe(t.fateDoneMs + VS_ANNOUNCE_MS);
      expect(t.opponentSteps[0]).toEqual({ id: 'd', atMs: t.opponentStartMs }); // after 'c'
      expect(t.opponentSteps.every((s) => s.id !== 'c')).toBe(true);
      expect(t.opponentSteps.at(-1)!.id).toBe('a');
      expect(t.duelStartMs! - t.opponentStartMs!).toBeLessThanOrEqual(MAX_SPIN_MS);
      expect(t.duelThrowsAtMs).toEqual([
        t.duelStartMs! + DUEL_INTRO_MS,
        t.duelStartMs! + DUEL_INTRO_MS + DUEL_THROW_MS,
      ]);
      expect(t.completeMs).toBe(t.duelThrowsAtMs.at(-1)! + DUEL_RESULT_HOLD_MS);
    }
  });

  it('the opponent cursor wraps from the last fighter to the first', () => {
    const turn = { ...vsTurn, playerId: 'e', duel: { ...vsTurn.duel!, opponentId: 'b' } };
    expect(buildTurnTimeline(turn, alive, 'a', 0).opponentSteps[0]!.id).toBe('a');
  });

  it('is deterministic (refresh replays the identical show)', () => {
    expect(buildTurnTimeline(vsTurn, alive, 'a', 0)).toEqual(
      buildTurnTimeline(vsTurn, alive, 'a', 0),
    );
  });
});

describe('fateStartIndex', () => {
  it('starts at slot 0, then after the previous slot, wrapping', () => {
    expect(fateStartIndex(null)).toBe(0);
    expect(fateStartIndex(4)).toBe(5);
    expect(fateStartIndex(19)).toBe(0);
  });
});
