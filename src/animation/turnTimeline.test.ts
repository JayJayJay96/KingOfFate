import { describe, expect, it } from 'vitest';
import { MAX_SPIN_MS } from '../game/config/timing';
import type { CommittedTurn } from '../game/engine/matchTypes';
import {
  buildTurnTimeline,
  DUEL_INTRO_MS,
  DUEL_RESULT_HOLD_MS,
  DUEL_THROW_MS,
  fateStartIndex,
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

describe('buildTurnTimeline', () => {
  it('both cursors land on the committed player and slot, within 10 s', () => {
    for (let i = 0; i < 100; i++) {
      const turn = { ...koTurn, turnId: `turn-${i}`, fateSlotIndex: i % 20 };
      const t = buildTurnTimeline(turn, alive, 'a', 0);
      expect(t.playerSteps.at(-1)!.id).toBe('c');
      expect(t.fateSteps.at(-1)!.id).toBe(String(i % 20));
      expect(t.cursorsDoneMs).toBeLessThanOrEqual(MAX_SPIN_MS);
      expect(t.completeMs).toBe(t.cursorsDoneMs);
      expect(t.duelThrowsAtMs).toEqual([]);
    }
  });

  it('player and Fate cursors get different rhythms', () => {
    const t = buildTurnTimeline(koTurn, alive, 'a', 0);
    expect(t.playerSteps.at(-1)!.atMs).not.toBe(t.fateSteps.at(-1)!.atMs);
  });

  it('the Fate cursor walks the strip in order, wrapping', () => {
    const t = buildTurnTimeline(koTurn, alive, 'a', 18);
    expect(t.fateSteps.slice(0, 4).map((s) => s.id)).toEqual(['18', '19', '0', '1']);
  });

  it('VS adds a duel after both cursors: intro, one beat per throw, result hold', () => {
    const turn: CommittedTurn = {
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
    const t = buildTurnTimeline(turn, alive, 'a', 0);
    expect(t.duelThrowsAtMs).toEqual([
      t.cursorsDoneMs + DUEL_INTRO_MS,
      t.cursorsDoneMs + DUEL_INTRO_MS + DUEL_THROW_MS,
    ]);
    expect(t.completeMs).toBe(t.duelThrowsAtMs.at(-1)! + DUEL_RESULT_HOLD_MS);
    // A decisive first throw keeps the duel within ~2–4 s.
    expect(DUEL_INTRO_MS + DUEL_RESULT_HOLD_MS).toBeGreaterThanOrEqual(2000);
  });

  it('is deterministic (refresh replays the identical show)', () => {
    expect(buildTurnTimeline(koTurn, alive, 'a', 0)).toEqual(
      buildTurnTimeline(koTurn, alive, 'a', 0),
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
