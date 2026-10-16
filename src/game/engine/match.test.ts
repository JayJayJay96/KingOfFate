import { describe, expect, it } from 'vitest';
import { CHI2_P001, chiSquare, chiSquareUniform } from '../../test/stats';
import { FATE_PRESET_IDS, FATE_PRESETS, type FateKind, type FatePresetId } from '../config/presets';
import { createScriptedRng, createSeededRng, type Rng } from '../rng/rng';
import { describeEvent } from './describeEvent';
import { countSlots } from './fateSlots';
import {
  alivePlayers,
  beginTurn,
  createMatch,
  IllegalTransitionError,
  resolveTurn,
  shieldSupplyFor,
  shufflePositions,
  eliminatedThisTurn,
  livingNeighbours,
  suddenDeathAtFor,
  type MatchLaunch,
} from './match';
import type { MatchState } from './matchTypes';

const NAMES = ['Aisyah', 'Wei Jie', 'Kavitha', 'Hafiz', 'Mei Ling', 'Arjun', 'Nurul', 'Jason'];
const ROCK = 0;
const PAPER = 1;
const SCISSORS = 2;
const KINDS = ['KO', 'VS', 'SHIELD', 'BOMB'] as const;

function launch(n: number, winnerCount = 1, presetId: FatePresetId = 'normal'): MatchLaunch {
  return {
    players: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: NAMES[i] ?? `P${i}` })),
    winnerCount,
    presetId,
  };
}

const ids = { matchId: 'm1', startedAt: '2026-10-09T07:00:00.000Z' };
const slotOf = (state: MatchState, kind: FateKind) => {
  const i = state.fateSlots.indexOf(kind);
  if (i < 0) throw new Error(`No ${kind} slot`);
  return i;
};
const player = (state: MatchState, id: string) => state.players.find((p) => p.id === id)!;

/** One full turn with scripted draws: [livingIndex, slotIndex, (opponentIndex, throws...)]. */
function play(state: MatchState, draws: number[]) {
  const turnId = `t${state.completedTurns + 1}`;
  return resolveTurn(beginTurn(state, createScriptedRng(draws), turnId), turnId);
}
const ko = (s: MatchState, livingIndex: number) => play(s, [livingIndex, slotOf(s, 'KO')]);
const shieldUp = (s: MatchState, livingIndex: number) =>
  play(s, [livingIndex, slotOf(s, 'SHIELD')]);
/** VS: living fighter `livingIndex` challenges `opponentIndex` among the OTHER living fighters. */
const vs = (s: MatchState, livingIndex: number, opponentIndex: number, throws: number[]) =>
  play(s, [livingIndex, slotOf(s, 'VS'), opponentIndex, ...throws]);

function playOut(state: MatchState, rng: Rng): MatchState {
  let n = 0;
  while (state.phase === 'READY') {
    const id = `t${++n}`;
    state = resolveTurn(beginTurn(state, rng, id), id);
    if (n > 5000) throw new Error('Match did not finish');
  }
  return state;
}

/** A strip with the given weights (arrangement is irrelevant to odds). */
function stripOf(weights: Record<FateKind, number>): FateKind[] {
  return KINDS.flatMap((k) => Array<FateKind>(weights[k]).fill(k));
}

/** KO the first living fighter `times` times. */
function koFirst(state: MatchState, times: number): MatchState {
  for (let i = 0; i < times; i++) state = ko(state, 0);
  return state;
}

describe('createMatch', () => {
  it('keeps the prize line and last champions (cosmetic only)', () => {
    const m = createMatch(
      { ...launch(4), title: '  Who buys kopi?  ', championIds: ['p2', 'ghost', 'p2'] },
      ids,
    );
    expect(m.title).toBe('Who buys kopi?');
    expect(m.championIds).toEqual(['p2']);
    const plain = createMatch({ ...launch(4), title: '   ' }, ids);
    expect(plain.title).toBeUndefined();
    expect(plain.championIds).toBeUndefined();
  });

  it('starts READY, everyone alive without Shields, strip = preset normal odds', () => {
    for (const id of FATE_PRESET_IDS) {
      const m = createMatch(launch(5, 2, id), ids);
      expect(m.phase).toBe('READY');
      expect(m.players.every((p) => p.alive && !p.shield)).toBe(true);
      expect(countSlots(m.fateSlots)).toEqual(FATE_PRESETS[id].normal);
      expect(m.suddenDeath).toBe(false);
    }
  });

  it('goes straight to the finale gate when N = W + 1, with no ordinary turns', () => {
    const m = createMatch(launch(3, 2), ids);
    expect(m.phase).toBe('FINALE');
    expect(() => beginTurn(m, createScriptedRng([0, 0]), 't1')).toThrow(IllegalTransitionError);
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
  it('commits player, slot and Fate without applying anything or spoiling the log', () => {
    const m0 = createMatch(launch(4), ids);
    const m = beginTurn(m0, createScriptedRng([2, slotOf(m0, 'KO')]), 't1');
    expect(m.phase).toBe('SPINNING');
    expect(m.pendingTurn).toMatchObject({ playerId: 'p2', fate: 'KO', duel: null });
    expect(alivePlayers(m)).toHaveLength(4);
    expect(describeEvent(m.events.at(-1)!, m)).toBeNull();
  });

  it('commits the VS opponent and every throw up front (draws rethrown)', () => {
    const m0 = createMatch(launch(4), ids);
    const draws = [0, slotOf(m0, 'VS'), 1, ROCK, ROCK, PAPER, PAPER, SCISSORS, PAPER];
    const m = beginTurn(m0, createScriptedRng(draws), 't1');
    expect(m.pendingTurn?.duel).toEqual({
      opponentId: 'p2', // others = [p1, p2, p3], index 1
      throws: [
        { challenger: 'ROCK', opponent: 'ROCK' },
        { challenger: 'PAPER', opponent: 'PAPER' },
        { challenger: 'SCISSORS', opponent: 'PAPER' },
      ],
    });
  });

  it('samples only living players', () => {
    let m = ko(createMatch(launch(5), ids), 0); // p0 out
    m = beginTurn(m, createScriptedRng([0, slotOf(m, 'KO')]), 't2');
    expect(m.pendingTurn?.playerId).toBe('p1');
  });

  it('refuses a second turn while one is spinning (double click guard)', () => {
    const m = beginTurn(createMatch(launch(4), ids), createScriptedRng([0, 0]), 't1');
    expect(() => beginTurn(m, createScriptedRng([1, 0]), 't2')).toThrow(IllegalTransitionError);
  });
});

describe('KO', () => {
  it('eliminates an unshielded fighter exactly once (idempotent resolve)', () => {
    const m0 = createMatch(launch(4), ids);
    const spinning = beginTurn(m0, createScriptedRng([1, slotOf(m0, 'KO')]), 't1');
    const resolved = resolveTurn(spinning, 't1');
    expect(player(resolved, 'p1')).toMatchObject({ alive: false, eliminatedOnTurn: 1 });
    expect(resolved.lastTurn).toMatchObject({
      outcome: { fate: 'KO', result: 'ELIMINATED' },
      eliminatedId: 'p1',
    });
    expect(resolveTurn(resolved, 't1')).toBe(resolved);
    expect(resolveTurn(spinning, 'other')).toBe(spinning);
    expect(describeEvent(resolved.events.at(-1)!, resolved)).toBe(
      'Turn 1: Wei Jie takes a KO. Eliminated!',
    );
  });

  it('is absorbed by a Shield: Shield consumed, nobody eliminated', () => {
    let m = shieldUp(createMatch(launch(10), ids), 1);
    m = ko(m, 1);
    expect(player(m, 'p1')).toMatchObject({ alive: true, shield: false });
    expect(m.lastTurn?.outcome).toEqual({ fate: 'KO', result: 'BLOCKED' });
  });
});

describe('Shield supply (owner decision: 1 per 5 fighters)', () => {
  it('starts with ceil(N / 5) Shields; Sudden Death at round(N / 3) left', () => {
    expect([2, 5, 6, 10, 20, 21, 32].map(shieldSupplyFor)).toEqual([1, 1, 2, 2, 4, 5, 7]);
    expect([9, 10, 20, 21, 32].map(suddenDeathAtFor)).toEqual([3, 3, 7, 7, 11]);
    const m = createMatch(launch(20), ids);
    expect(m.shieldSupply).toBe(4);
    expect(m.suddenDeathAt).toBe(7);
  });

  it('grants one Shield; a second is wasted (cap 1) and does not use supply', () => {
    let m = shieldUp(createMatch(launch(10), ids), 3);
    expect(player(m, 'p3').shield).toBe(true);
    expect(m.lastTurn?.outcome).toEqual({ fate: 'SHIELD', result: 'GAINED' });
    expect(m.shieldSupply).toBe(1);
    m = shieldUp(m, 3);
    expect(player(m, 'p3').shield).toBe(true);
    expect(m.lastTurn?.outcome).toEqual({ fate: 'SHIELD', result: 'WASTED' });
    expect(m.shieldSupply).toBe(1);
    expect(describeEvent(m.events.at(-1)!, m)).toBe('Turn 2: Hafiz already has a Shield. Wasted!');
  });

  it('the last Shield turns every Shield slot into KO, visibly', () => {
    let m = shieldUp(createMatch(launch(10), ids), 0); // supply 2 → 1
    expect(m.fateSlots).toContain('SHIELD');
    m = shieldUp(m, 1); // supply 1 → 0
    expect(m.shieldSupply).toBe(0);
    expect(m.fateSlots).not.toContain('SHIELD');
    expect(countSlots(m.fateSlots)).toEqual({ KO: 15, VS: 4, SHIELD: 0, BOMB: 1 });
    expect(m.events.at(-1)?.type).toBe('SHIELD_SUPPLY_EXHAUSTED');
    expect(describeEvent(m.events.at(-1)!, m)).toBe(
      'The last Shield has been taken! Shield slots turn into KO.',
    );
  });

  it('VS winners draw from the same supply; once it is empty they get nothing', () => {
    let m = shieldUp(createMatch(launch(10), ids), 0);
    m = shieldUp(m, 1); // supply now 0
    m = vs(m, 2, 2, [ROCK, SCISSORS]); // p2 vs others [p0, p1, p3, …] index 2 = p3
    expect(m.lastTurn?.outcome).toMatchObject({
      winnerId: 'p2',
      loserResult: 'ELIMINATED',
      winnerShield: 'NO_SUPPLY',
    });
    expect(player(m, 'p2').shield).toBe(false);
    expect(describeEvent(m.events.at(-1)!, m)).toContain('No Shields left to earn.');
  });
});

describe('VS', () => {
  it('winner earns a Shield, unshielded loser is eliminated', () => {
    const m = vs(createMatch(launch(10), ids), 0, 0, [ROCK, SCISSORS]); // p0 vs p1
    expect(m.lastTurn?.outcome).toEqual({
      fate: 'VS',
      winnerId: 'p0',
      loserId: 'p1',
      loserResult: 'ELIMINATED',
      winnerShield: 'GAINED',
    });
    expect(player(m, 'p0').shield).toBe(true);
    expect(player(m, 'p1').alive).toBe(false);
    expect(describeEvent(m.events.at(-1)!, m)).toBe(
      'Turn 1: Aisyah VS Wei Jie: Rock beats Scissors. Aisyah wins; Wei Jie is eliminated! Aisyah earns a Shield.',
    );
  });

  it('the selected fighter can lose; draws are counted in the log', () => {
    const m = vs(createMatch(launch(10), ids), 0, 0, [ROCK, ROCK, ROCK, PAPER]);
    expect(m.lastTurn?.outcome).toMatchObject({ winnerId: 'p1', loserId: 'p0' });
    expect(player(m, 'p0').alive).toBe(false);
    expect(describeEvent(m.events.at(-1)!, m)).toContain('Paper beats Rock after 1 draw');
  });

  it('a shielded loser survives and loses the Shield; a winner who has one keeps exactly one', () => {
    let m = shieldUp(createMatch(launch(10), ids), 1); // p1 Shield
    m = shieldUp(m, 0); // p0 Shield (supply now 0, the VS slots remain)
    m = vs(m, 0, 0, [ROCK, SCISSORS]); // p0 beats p1
    expect(m.lastTurn?.outcome).toMatchObject({ loserResult: 'BLOCKED', winnerShield: 'ALREADY' });
    expect(player(m, 'p1')).toMatchObject({ alive: true, shield: false });
    expect(player(m, 'p0').shield).toBe(true);
  });

  it('owner example: 4 alive / 2 winners — a VS kill triggers the finale, a Shield block does not', () => {
    // p2 (living 2) vs others [p0, p1, p3] index 2 = p3; Paper beats Rock.
    const kill = vs(createMatch(launch(4, 2), ids), 2, 2, [PAPER, ROCK]);
    expect(alivePlayers(kill)).toHaveLength(3);
    expect(kill.phase).toBe('FINALE');

    let block = shieldUp(createMatch(launch(4, 2), ids), 3);
    block = vs(block, 2, 2, [PAPER, ROCK]);
    expect(alivePlayers(block)).toHaveLength(4);
    expect(block.phase).toBe('READY');
  });
});

describe('Sudden Death (owner decision: one-third of the starting fighters left)', () => {
  it.each(FATE_PRESET_IDS)(
    '%s: starts exactly when one-third remain and swaps the strip to the D1 odds',
    (presetId) => {
      // 9 fighters, 1 winner: Sudden Death at 3 left (finale at 2).
      let m = koFirst(createMatch(launch(9, 1, presetId), ids), 5);
      expect(alivePlayers(m)).toHaveLength(4);
      expect(m.suddenDeath).toBe(false);
      m = ko(m, 0);
      expect(alivePlayers(m)).toHaveLength(3);
      expect(m.suddenDeath).toBe(true);
      expect(m.shieldSupply).toBe(0);
      expect(countSlots(m.fateSlots)).toEqual(FATE_PRESETS[presetId].suddenDeath);
      expect(m.events.at(-1)).toMatchObject({ type: 'SUDDEN_DEATH_STARTED', aliveCount: 3 });
      expect(describeEvent(m.events.at(-1)!, m)).toMatch(/^SUDDEN DEATH! Only 3 fighters left\./);
    },
  );

  it('every held Shield shatters when Sudden Death starts', () => {
    let m = shieldUp(createMatch(launch(9), ids), 8); // p8 (P8) holds a Shield
    m = koFirst(m, 6); // p0–p5 out → 3 left
    expect(m.suddenDeath).toBe(true);
    expect(player(m, 'p8').shield).toBe(false);
    expect(m.events.at(-1)).toMatchObject({ shatteredIds: ['p8'] });
    expect(describeEvent(m.events.at(-1)!, m)).toContain('Shields shatter (P8).');
  });

  it('in Sudden Death VS winners get no Shield, and it lasts until the finale', () => {
    let m = koFirst(createMatch(launch(12), ids), 8); // Sudden Death at 4 left
    expect(m.suddenDeath).toBe(true);
    m = vs(m, 0, 0, [ROCK, SCISSORS]); // p8 beats p9 → 3 left
    expect(m.lastTurn?.outcome).toMatchObject({
      loserResult: 'ELIMINATED',
      winnerShield: 'SUDDEN_DEATH',
    });
    expect(m.suddenDeath).toBe(true);
    expect(m.phase).toBe('READY');
    m = ko(m, 0); // 2 left = W + 1
    expect(m.phase).toBe('FINALE');
  });

  it('never starts when one-third is already the finale size (finale comes first)', () => {
    const m = koFirst(createMatch(launch(5), ids), 3); // one-third of 5 → 2 = W + 1
    expect(m.phase).toBe('FINALE');
    expect(m.events.some((e) => e.type === 'SUDDEN_DEATH_STARTED')).toBe(false);
  });
});

describe('finale gate', () => {
  it('clears every Shield when W + 1 remain', () => {
    let m = shieldUp(createMatch(launch(4, 2), ids), 0); // p0 Shield
    m = ko(m, 3); // p3 out → 3 alive = W + 1
    expect(m.phase).toBe('FINALE');
    expect(m.players.some((p) => p.shield)).toBe(false);
    expect(m.events.slice(-2).map((e) => e.type)).toEqual(['SHIELDS_CLEARED', 'FINALE_REACHED']);
  });
});

describe('shufflePositions', () => {
  it('permutes fighters and Fate slots without changing anyone or the odds; hidden from the log', () => {
    const m = createMatch(launch(6, 1, 'chaotic'), ids);
    const s = shufflePositions(m, createSeededRng(5));
    expect(s.players.map((p) => p.id)).not.toEqual(m.players.map((p) => p.id));
    expect([...s.players].sort((a, b) => a.id.localeCompare(b.id))).toEqual(m.players);
    expect(countSlots(s.fateSlots)).toEqual(countSlots(m.fateSlots));
    expect(s.events.at(-1)?.type).toBe('POSITIONS_SHUFFLED');
    expect(describeEvent(s.events.at(-1)!, s)).toBeNull();
  });

  it('always visibly changes the fighter order, even when the draw is the identity', () => {
    // 4 fighters: nextInt(4), nextInt(3), nextInt(2). [3, 2, 1] = identity → redraw [0, 0, 0].
    // Then 19 draws for the 20 Fate slots.
    const draws = [3, 2, 1, 0, 0, 0, ...Array.from({ length: 19 }, () => 0)];
    const s = shufflePositions(createMatch(launch(4), ids), createScriptedRng(draws));
    expect(s.players.map((p) => p.id)).toEqual(['p1', 'p2', 'p3', 'p0']);
  });

  it('is only allowed between turns', () => {
    const spinning = beginTurn(createMatch(launch(4), ids), createScriptedRng([0, 0]), 't1');
    expect(() => shufflePositions(spinning, createSeededRng(1))).toThrow(IllegalTransitionError);
  });
});

describe('full matches (seeded)', () => {
  it.each(FATE_PRESET_IDS)(
    '%s: W = 1..5 across roster sizes ends with exactly W + 1 alive and no Shields',
    (presetId) => {
      const rng = createSeededRng(presetId.length * 1000 + 7);
      for (let w = 1; w <= 5; w++) {
        for (const n of [w + 1, w + 2, w + 5, 20, 32]) {
          const final = playOut(createMatch(launch(n, w, presetId), ids), rng);
          expect(final.phase).toBe('FINALE');
          expect(alivePlayers(final)).toHaveLength(w + 1);
          expect(final.players.some((p) => p.shield)).toBe(false);
          const eventIds = final.events.map((e) => e.id);
          expect(new Set(eventIds).size).toBe(eventIds.length);
          // Each turn eliminates at most one fighter, or two with a Bomb.
          const maxFalls = final.events.reduce(
            (sum, e) =>
              e.type === 'TURN_RESOLVED' ? sum + (e.outcome.fate === 'BOMB' ? 2 : 1) : sum,
            0,
          );
          expect(final.players.filter((p) => !p.alive).length).toBeLessThanOrEqual(maxFalls);
        }
      }
    },
  );
});

describe('fairness simulations (seeded, fixed tolerances)', () => {
  it('selects each living player uniformly', () => {
    const rng = createSeededRng(99);
    const base = createMatch(launch(8), ids);
    const counts = new Array<number>(8).fill(0);
    for (let i = 0; i < 80_000; i++) {
      counts[Number(beginTurn(base, rng, 't').pendingTurn!.playerId.slice(1))]!++;
    }
    expect(chiSquareUniform(counts)).toBeLessThan(CHI2_P001[7]!);
  });

  it.each(FATE_PRESET_IDS)(
    '%s: Fate frequencies match the 20-slot weights (normal and Sudden Death)',
    (presetId) => {
      for (const mode of ['normal', 'suddenDeath'] as const) {
        const weights = FATE_PRESETS[presetId][mode];
        const base = { ...createMatch(launch(8, 1, presetId), ids), fateSlots: stripOf(weights) };
        const rng = createSeededRng(presetId.length * 31 + (mode === 'normal' ? 1 : 2));
        const counts: Record<FateKind, number> = { KO: 0, VS: 0, SHIELD: 0, BOMB: 0 };
        for (let i = 0; i < 60_000; i++) counts[beginTurn(base, rng, 't').pendingTurn!.fate]++;
        for (const k of KINDS) if (weights[k] === 0) expect(counts[k]).toBe(0);
        const kinds = KINDS.filter((k) => weights[k] > 0);
        const stat = chiSquare(
          kinds.map((k) => counts[k]),
          kinds.map((k) => weights[k] / 20),
        );
        expect(stat).toBeLessThan(CHI2_P001[kinds.length - 1]!);
      }
    },
  );

  it('VS opponents are uniform over the other living fighters', () => {
    const rng = createSeededRng(4242);
    const base = {
      ...createMatch(launch(6), ids),
      fateSlots: stripOf({ KO: 0, VS: 20, SHIELD: 0, BOMB: 0 }),
    };
    const counts = new Map<string, number>();
    for (let i = 0; i < 60_000; i++) {
      const t = beginTurn(base, rng, 't').pendingTurn!;
      if (t.playerId !== 'p0') continue;
      counts.set(t.duel!.opponentId, (counts.get(t.duel!.opponentId) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual(['p1', 'p2', 'p3', 'p4', 'p5']);
    expect(chiSquareUniform([...counts.values()])).toBeLessThan(CHI2_P001[4]!);
  });

  it('RPS is fair: gestures 1/3 each, challenger wins half, draws ~1/3 of throws', () => {
    const rng = createSeededRng(777);
    const base = {
      ...createMatch(launch(6), ids),
      fateSlots: stripOf({ KO: 0, VS: 20, SHIELD: 0, BOMB: 0 }),
    };
    const gestures = { ROCK: 0, PAPER: 0, SCISSORS: 0 };
    let challengerWins = 0;
    let throws = 0;
    let draws = 0;
    const duels = 60_000;
    for (let i = 0; i < duels; i++) {
      const s = resolveTurn(beginTurn(base, rng, 't'), 't');
      const last = s.lastTurn!;
      for (const t of last.turn.duel!.throws) {
        gestures[t.challenger]++;
        gestures[t.opponent]++;
        throws++;
        if (t.challenger === t.opponent) draws++;
      }
      if (last.outcome.fate === 'VS' && last.outcome.winnerId === last.turn.playerId) {
        challengerWins++;
      }
    }
    expect(chiSquareUniform(Object.values(gestures))).toBeLessThan(CHI2_P001[2]!);
    expect(Math.abs(challengerWins / duels - 0.5)).toBeLessThan(0.01); // ≈ 5 standard deviations
    expect(Math.abs(draws / throws - 1 / 3)).toBeLessThan(0.01);
  });
});

describe('Bomb (owner decision 2026-10-16)', () => {
  /** Bomb on living fighter `livingIndex`; side 0 = left neighbour, 1 = right. */
  const bomb = (s: MatchState, livingIndex: number, side: number) =>
    play(s, [livingIndex, slotOf(s, 'BOMB'), side]);

  it('commits the neighbour before any animation: nearest living left or right, wrapping', () => {
    const m = ko(createMatch(launch(6), ids), 1); // p1 out: p0 p2 p3 p4 p5 alive
    const pick = (draws: number[]) => beginTurn(m, createScriptedRng(draws), 'x').pendingTurn!;
    expect(pick([1, slotOf(m, 'BOMB'), 0])).toMatchObject({
      playerId: 'p2',
      fate: 'BOMB',
      bomb: { neighbourId: 'p0' }, // skips the fallen p1
    });
    expect(pick([1, slotOf(m, 'BOMB'), 1]).bomb).toEqual({ neighbourId: 'p3' });
    expect(pick([0, slotOf(m, 'BOMB'), 0]).bomb).toEqual({ neighbourId: 'p5' }); // wraps
    expect(livingNeighbours(m.players, 'p5')).toEqual(['p4', 'p0']);
    expect(pick([0, slotOf(m, 'KO')]).bomb).toBeUndefined();
  });

  it('eliminates the picked fighter and the neighbour', () => {
    const m = bomb(createMatch(launch(6), ids), 2, 1);
    expect(m.lastTurn!.outcome).toEqual({
      fate: 'BOMB',
      result: 'ELIMINATED',
      neighbourId: 'p3',
      neighbourResult: 'ELIMINATED',
    });
    expect(alivePlayers(m)).toHaveLength(4);
    expect(player(m, 'p2').eliminatedOnTurn).toBe(1);
    expect(player(m, 'p3').eliminatedOnTurn).toBe(1);
    expect(eliminatedThisTurn(m.lastTurn!)).toEqual(['p2', 'p3']);
    expect(describeEvent(m.events.at(-1)!, m)).toBe(
      'Turn 1: Kavitha picks a Bomb. Kavitha is blown out! The blast also eliminates Hafiz!',
    );
  });

  it('a Shield absorbs the blast for either fighter', () => {
    let m = shieldUp(createMatch(launch(6), ids), 3); // Hafiz (p3) shielded
    m = bomb(m, 2, 1);
    expect(m.lastTurn!.outcome).toMatchObject({ result: 'ELIMINATED', neighbourResult: 'BLOCKED' });
    expect(player(m, 'p3')).toMatchObject({ alive: true, shield: false });

    let n = shieldUp(createMatch(launch(6), ids), 2); // Kavitha (p2) shielded
    n = bomb(n, 2, 0);
    expect(n.lastTurn!.outcome).toMatchObject({ result: 'BLOCKED', neighbourResult: 'ELIMINATED' });
    expect(player(n, 'p2')).toMatchObject({ alive: true, shield: false });
    expect(n.lastTurn!.eliminatedId).toBe('p1');
    expect(eliminatedThisTurn(n.lastTurn!)).toEqual(['p1']);
  });

  it('spares the neighbour when two falls would leave fewer than W + 1 fighters', () => {
    const m = bomb(createMatch(launch(4, 2), ids), 0, 1); // W + 2 alive
    expect(m.lastTurn!.outcome).toMatchObject({ result: 'ELIMINATED', neighbourResult: 'SPARED' });
    expect(alivePlayers(m)).toHaveLength(3);
    expect(m.phase).toBe('FINALE');
  });

  it('can drop straight to exactly W + 1 and start the finale', () => {
    const m = bomb(createMatch(launch(5, 2), ids), 0, 1);
    expect(alivePlayers(m)).toHaveLength(3);
    expect(m.phase).toBe('FINALE');
    expect(m.finale!.finalistIds).toEqual(['p2', 'p3', 'p4']);
  });

  it('is applied once: resolving the same turn again changes nothing', () => {
    const m0 = createMatch(launch(6), ids);
    const spinning = beginTurn(m0, createScriptedRng([2, slotOf(m0, 'BOMB'), 1]), 't1');
    const once = resolveTurn(spinning, 't1');
    expect(resolveTurn(once, 't1')).toBe(once);
  });

  it('the blast side is a fair coin', () => {
    const rng = createSeededRng(2026);
    const base = {
      ...createMatch(launch(6), ids),
      fateSlots: stripOf({ KO: 0, VS: 0, SHIELD: 0, BOMB: 20 }),
    };
    let right = 0;
    const n = 40_000;
    for (let i = 0; i < n; i++) {
      const t = beginTurn(base, rng, 't').pendingTurn!;
      const [, r] = livingNeighbours(base.players, t.playerId);
      if (t.bomb!.neighbourId === r) right++;
    }
    expect(Math.abs(right / n - 0.5)).toBeLessThan(0.0125); // about 5 standard deviations
  });
});

describe('Custom preset (owner decision 2026-10-16)', () => {
  const customOdds = {
    normal: { KO: 8, VS: 6, SHIELD: 3, BOMB: 3 },
    suddenDeath: { KO: 14, VS: 2, SHIELD: 0, BOMB: 4 },
  };

  it('uses the host odds for the strip and for Sudden Death', () => {
    let m = createMatch({ ...launch(9, 1, 'custom'), customOdds }, ids);
    expect(m.customOdds).toEqual(customOdds);
    expect(countSlots(m.fateSlots)).toEqual(customOdds.normal);
    expect(describeEvent(m.events[0]!, m)).toMatch(/Custom preset\.$/);
    while (!m.suddenDeath && m.phase === 'READY') m = ko(m, 0);
    expect(countSlots(m.fateSlots)).toEqual(customOdds.suddenDeath);
  });

  it('refuses a Custom match without valid odds', () => {
    expect(() => createMatch(launch(4, 1, 'custom'), ids)).toThrow(IllegalTransitionError);
    expect(() =>
      createMatch(
        {
          ...launch(4, 1, 'custom'),
          customOdds: { ...customOdds, suddenDeath: customOdds.normal },
        },
        ids,
      ),
    ).toThrow(IllegalTransitionError);
  });

  it('Fate frequencies follow the custom weights', () => {
    const base = createMatch({ ...launch(8, 1, 'custom'), customOdds }, ids);
    const rng = createSeededRng(616);
    const counts: Record<FateKind, number> = { KO: 0, VS: 0, SHIELD: 0, BOMB: 0 };
    for (let i = 0; i < 40_000; i++) counts[beginTurn(base, rng, 't').pendingTurn!.fate]++;
    const stat = chiSquare(
      KINDS.map((k) => counts[k]),
      KINDS.map((k) => customOdds.normal[k] / 20),
    );
    expect(stat).toBeLessThan(CHI2_P001[3]!);
  });

  it('plays out to exactly W + 1', () => {
    const rng = createSeededRng(99);
    for (const n of [5, 12, 32]) {
      const final = playOut(createMatch({ ...launch(n, 2, 'custom'), customOdds }, ids), rng);
      expect(alivePlayers(final)).toHaveLength(3);
    }
  });
});
