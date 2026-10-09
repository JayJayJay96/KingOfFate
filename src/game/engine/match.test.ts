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
  shufflePositions,
  SUDDEN_DEATH_STREAK,
  type MatchLaunch,
} from './match';
import type { MatchState } from './matchTypes';

const NAMES = ['Aisyah', 'Wei Jie', 'Kavitha', 'Hafiz', 'Mei Ling', 'Arjun', 'Nurul', 'Jason'];
const ROCK = 0;
const PAPER = 1;
const SCISSORS = 2;
const KINDS = ['KO', 'VS', 'SHIELD'] as const;

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

/**
 * Traced sequence on 8 fighters: three VS turns where the loser is protected by a Shield earned
 * in the previous VS → streak 3 → Sudden Death. Ends with p0 unshielded, p2 shielded.
 */
function reachSuddenDeath(presetId: FatePresetId): MatchState {
  let m = createMatch(launch(8, 1, presetId), ids);
  m = vs(m, 0, 0, [ROCK, SCISSORS]); // p0 beats p1 → p1 out, p0 Shield. streak 0
  m = vs(m, 1, 0, [ROCK, SCISSORS]); // p2 beats p0 → p0 blocked, p2 Shield. streak 1
  m = vs(m, 0, 0, [ROCK, SCISSORS]); // p0 beats p2 → p2 blocked, p0 Shield. streak 2
  return vs(m, 1, 0, [ROCK, SCISSORS]); // p2 beats p0 → p0 blocked, p2 Shield. streak 3
}

describe('createMatch', () => {
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
    expect(m.phase).toBe('FINALE_GATE');
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

  it('is absorbed by a Shield: Shield consumed, nobody eliminated, streak grows', () => {
    let m = shieldUp(createMatch(launch(5), ids), 1);
    m = ko(m, 1);
    expect(player(m, 'p1')).toMatchObject({ alive: true, shield: false });
    expect(m.lastTurn?.outcome).toEqual({ fate: 'KO', result: 'BLOCKED' });
    expect(m.noEliminationStreak).toBe(2);
  });
});

describe('SHIELD', () => {
  it('grants one Shield; a second is wasted (cap 1)', () => {
    let m = shieldUp(createMatch(launch(5), ids), 3);
    expect(player(m, 'p3').shield).toBe(true);
    expect(m.lastTurn?.outcome).toEqual({ fate: 'SHIELD', result: 'GAINED' });
    m = shieldUp(m, 3);
    expect(player(m, 'p3').shield).toBe(true);
    expect(m.lastTurn?.outcome).toEqual({ fate: 'SHIELD', result: 'WASTED' });
    expect(describeEvent(m.events.at(-1)!, m)).toBe('Turn 2: Hafiz already has a Shield. Wasted!');
  });
});

describe('VS', () => {
  it('winner earns a Shield, unshielded loser is eliminated', () => {
    const m = vs(createMatch(launch(5), ids), 0, 0, [ROCK, SCISSORS]); // p0 vs p1
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
    const m = vs(createMatch(launch(5), ids), 0, 0, [ROCK, ROCK, ROCK, PAPER]);
    expect(m.lastTurn?.outcome).toMatchObject({ winnerId: 'p1', loserId: 'p0' });
    expect(player(m, 'p0').alive).toBe(false);
    expect(describeEvent(m.events.at(-1)!, m)).toContain('Paper beats Rock after 1 draw');
  });

  it('a shielded loser survives and loses the Shield; a winner who has one keeps exactly one', () => {
    let m = shieldUp(createMatch(launch(5), ids), 1); // p1 Shield
    m = shieldUp(m, 0); // p0 Shield
    m = vs(m, 0, 0, [ROCK, SCISSORS]); // p0 beats p1
    expect(m.lastTurn?.outcome).toMatchObject({ loserResult: 'BLOCKED', winnerShield: 'ALREADY' });
    expect(player(m, 'p1')).toMatchObject({ alive: true, shield: false });
    expect(player(m, 'p0').shield).toBe(true);
  });

  it('owner example: 4 alive / 2 winners — a VS kill triggers the finale, a Shield block does not', () => {
    // p2 (living 2) vs others [p0, p1, p3] index 2 = p3; Paper beats Rock.
    const kill = vs(createMatch(launch(4, 2), ids), 2, 2, [PAPER, ROCK]);
    expect(alivePlayers(kill)).toHaveLength(3);
    expect(kill.phase).toBe('FINALE_GATE');

    let block = shieldUp(createMatch(launch(4, 2), ids), 3);
    block = vs(block, 2, 2, [PAPER, ROCK]);
    expect(alivePlayers(block)).toHaveLength(4);
    expect(block.phase).toBe('READY');
  });
});

describe('Sudden Death', () => {
  it.each(FATE_PRESET_IDS)(
    '%s: starts after exactly 3 no-elimination turns and swaps the strip to the D1 odds',
    (presetId) => {
      const m = reachSuddenDeath(presetId);
      expect(m.noEliminationStreak).toBe(SUDDEN_DEATH_STREAK);
      expect(m.suddenDeath).toBe(true);
      expect(countSlots(m.fateSlots)).toEqual(FATE_PRESETS[presetId].suddenDeath);
      expect(m.fateSlots).not.toContain('SHIELD');
      expect(m.events.at(-1)?.type).toBe('SUDDEN_DEATH_STARTED');
      expect(describeEvent(m.events.at(-1)!, m)).toMatch(/^SUDDEN DEATH!/);
    },
  );

  it('an elimination before the 3rd turn resets the streak (no Sudden Death)', () => {
    let m = createMatch(launch(8), ids);
    m = vs(m, 0, 0, [ROCK, SCISSORS]);
    m = vs(m, 1, 0, [ROCK, SCISSORS]);
    m = vs(m, 0, 0, [ROCK, SCISSORS]); // streak 2
    m = ko(m, 2); // living [p0, p2, p3, …] → p3 unshielded → eliminated
    expect(m.noEliminationStreak).toBe(0);
    expect(m.suddenDeath).toBe(false);
  });

  it('existing Shields still block; VS winners get no Shield; it persists after eliminations', () => {
    let m = reachSuddenDeath('chaotic');
    expect(player(m, 'p2').shield).toBe(true);
    m = ko(m, 1); // living [p0, p2, …] → p2's existing Shield blocks
    expect(m.lastTurn?.outcome).toEqual({ fate: 'KO', result: 'BLOCKED' });
    m = vs(m, 2, 2, [ROCK, SCISSORS]); // p3 vs others [p0, p2, p4, …] index 2 = p4
    expect(m.lastTurn?.outcome).toMatchObject({
      winnerId: 'p3',
      loserResult: 'ELIMINATED',
      winnerShield: 'SUDDEN_DEATH',
    });
    expect(player(m, 'p3').shield).toBe(false);
    expect(m.noEliminationStreak).toBe(0);
    expect(m.suddenDeath).toBe(true);
    expect(m.fateSlots).not.toContain('SHIELD');
  });
});

describe('finale gate', () => {
  it('clears every Shield when W + 1 remain', () => {
    let m = shieldUp(createMatch(launch(4, 2), ids), 0); // p0 Shield
    m = ko(m, 3); // p3 out → 3 alive = W + 1
    expect(m.phase).toBe('FINALE_GATE');
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
          expect(final.phase).toBe('FINALE_GATE');
          expect(alivePlayers(final)).toHaveLength(w + 1);
          expect(final.players.some((p) => p.shield)).toBe(false);
          const eventIds = final.events.map((e) => e.id);
          expect(new Set(eventIds).size).toBe(eventIds.length);
          const resolved = final.events.filter((e) => e.type === 'TURN_RESOLVED').length;
          expect(final.players.filter((p) => !p.alive).length).toBeLessThanOrEqual(resolved);
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
        const counts: Record<FateKind, number> = { KO: 0, VS: 0, SHIELD: 0 };
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
      fateSlots: stripOf({ KO: 0, VS: 20, SHIELD: 0 }),
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
      fateSlots: stripOf({ KO: 0, VS: 20, SHIELD: 0 }),
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
