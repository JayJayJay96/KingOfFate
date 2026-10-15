import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { beginFinale, resolveFinaleRound, startFinaleRound } from '../game/engine/finale';
import { beginTurn, createMatch, resolveTurn } from '../game/engine/match';
import type { MatchState } from '../game/engine/matchTypes';
import { createScriptedRng } from '../game/rng/rng';
import { createIndexedDbMatchRepository, createMemoryMatchRepository } from './matchStorage';

function newMatch(): MatchState {
  return createMatch(
    {
      players: ['Aisyah', 'Wei Jie', 'Kavitha', 'Hafiz'].map((name, i) => ({ id: `p${i}`, name })),
      winnerCount: 1,
      presetId: 'normal',
    },
    { matchId: 'm1', startedAt: '2026-10-09T07:00:00.000Z' },
  );
}

describe('IndexedDB match repository', () => {
  it('reports "none" when nothing is saved', async () => {
    const repo = createIndexedDbMatchRepository(new IDBFactory());
    expect(await repo.load()).toEqual({ status: 'none' });
  });

  it('round-trips a match and clears it', async () => {
    const repo = createIndexedDbMatchRepository(new IDBFactory());
    const match = newMatch();
    expect(await repo.save(match)).toEqual({ ok: true });
    expect(await repo.load()).toEqual({ status: 'loaded', match });
    expect(await repo.clear()).toEqual({ ok: true });
    expect(await repo.load()).toEqual({ status: 'none' });
  });

  it('recovers a mid-spin checkpoint after "reload" without resampling or double-applying', async () => {
    const factory = new IDBFactory();
    // Draws: living index 2, Fate slot 0 (KO in the Normal strip).
    const spinning = beginTurn(newMatch(), createScriptedRng([2, 0]), 't1');
    await createIndexedDbMatchRepository(factory).save(spinning);

    // New repository instance on the same database = page reload.
    const afterReload = createIndexedDbMatchRepository(factory);
    const loaded = await afterReload.load();
    expect(loaded.status).toBe('loaded');
    const restored = (loaded as { match: MatchState }).match;
    expect(restored.pendingTurn).toEqual(spinning.pendingTurn);

    const resolved = resolveTurn(restored, 't1');
    await afterReload.save(resolved);
    // A late duplicate completion (e.g. from the pre-reload tab) changes nothing.
    expect(resolveTurn(resolved, 't1')).toBe(resolved);

    const final = await createIndexedDbMatchRepository(factory).load();
    const players = (final as { match: MatchState }).match.players;
    expect(players.filter((p) => !p.alive).map((p) => p.id)).toEqual(['p2']);
  });

  it('recovers a mid-spin Bomb with its committed neighbour; rejects a damaged one', async () => {
    const factory = new IDBFactory();
    const m0 = newMatch();
    const bombSlot = m0.fateSlots.indexOf('BOMB');
    const spinning = beginTurn(m0, createScriptedRng([1, bombSlot, 1]), 't1');
    expect(spinning.pendingTurn!.bomb).toEqual({ neighbourId: 'p2' });
    await createIndexedDbMatchRepository(factory).save(spinning);
    const loaded = await createIndexedDbMatchRepository(factory).load();
    expect(loaded).toEqual({ status: 'loaded', match: spinning });

    const damaged = {
      ...spinning,
      pendingTurn: { ...spinning.pendingTurn!, bomb: { neighbourId: 'p1' } }, // the picked one
    };
    const repo = createIndexedDbMatchRepository(new IDBFactory());
    await repo.save(damaged);
    expect((await repo.load()).status).toBe('corrupt');
  });

  it('discards a corrupt checkpoint and reports it', async () => {
    const factory = new IDBFactory();
    const repo = createIndexedDbMatchRepository(factory);
    await repo.save({ ...newMatch(), phase: 'SPINNING', pendingTurn: null });
    expect(await repo.load()).toEqual({ status: 'corrupt' });
    expect(await repo.load()).toEqual({ status: 'none' });
  });

  it('rejects checkpoints with a pending turn on a dead player', async () => {
    const repo = createIndexedDbMatchRepository(new IDBFactory());
    const spinning = beginTurn(newMatch(), createScriptedRng([0, 0]), 't1');
    const tampered = {
      ...spinning,
      players: spinning.players.map((p) => (p.id === 'p0' ? { ...p, alive: false } : p)),
    };
    await repo.save(tampered);
    expect((await repo.load()).status).toBe('corrupt');
  });

  it('reports unavailable storage instead of pretending to save', async () => {
    const repo = createIndexedDbMatchRepository(null);
    expect((await repo.load()).status).toBe('unavailable');
    expect((await repo.save(newMatch())).ok).toBe(false);
  });
});

describe('memory match repository', () => {
  it('stores copies, not live references', async () => {
    const repo = createMemoryMatchRepository();
    const match = newMatch();
    await repo.save(match);
    const loaded = await repo.load();
    expect(loaded).toEqual({ status: 'loaded', match });
    expect((loaded as { match: MatchState }).match).not.toBe(match);
  });
});

describe('schema v2 checks', () => {
  it('discards a match saved by an older schema with an "outdated" status', async () => {
    const repo = createIndexedDbMatchRepository(new IDBFactory());
    await repo.save({ ...newMatch(), schemaVersion: 1 } as unknown as MatchState);
    expect(await repo.load()).toEqual({ status: 'outdated' });
    expect(await repo.load()).toEqual({ status: 'none' });
  });

  it('rejects a damaged Fate strip or a Shield slot during Sudden Death', async () => {
    const repo = createIndexedDbMatchRepository(new IDBFactory());
    await repo.save({ ...newMatch(), fateSlots: newMatch().fateSlots.slice(1) });
    expect((await repo.load()).status).toBe('corrupt');
    await repo.save({ ...newMatch(), suddenDeath: true });
    expect((await repo.load()).status).toBe('corrupt'); // normal strip still has a Shield slot
  });

  it('rejects a VS turn without a decisive throw', async () => {
    const repo = createIndexedDbMatchRepository(new IDBFactory());
    const m = newMatch();
    const vsSlot = m.fateSlots.indexOf('VS');
    const spinning = beginTurn(m, createScriptedRng([0, vsSlot, 0, 0, 2]), 't1');
    expect(spinning.pendingTurn?.duel?.throws).toHaveLength(1);
    await repo.save(spinning);
    expect((await repo.load()).status).toBe('loaded');
    await repo.save({
      ...spinning,
      pendingTurn: {
        ...spinning.pendingTurn!,
        duel: { opponentId: 'p1', throws: [{ challenger: 'ROCK', opponent: 'ROCK' }] },
      },
    });
    expect((await repo.load()).status).toBe('corrupt');
  });
});

describe('finale and completion records', () => {
  async function wonMatch(): Promise<MatchState> {
    let m = beginFinale(
      createMatch(
        {
          players: [
            { id: 'a', name: 'Aisyah' },
            { id: 'b', name: 'Wei Jie' },
          ],
          winnerCount: 1,
          presetId: 'normal',
        },
        { matchId: 'won-1', startedAt: '2026-10-09T07:00:00.000Z' },
      ),
    );
    for (let i = 1; i <= 3; i++) {
      // Rock (0) beats Scissors (2): Aisyah scores each round.
      m = startFinaleRound(m, createScriptedRng([0, 2]), `r${i}`);
      m = resolveFinaleRound(m, `r${i}`, '2026-10-09T08:00:00.000Z');
    }
    expect(m.phase).toBe('VICTORY');
    return m;
  }

  it('saves a mid-finale checkpoint and restores it', async () => {
    const repo = createIndexedDbMatchRepository(new IDBFactory());
    const m = startFinaleRound(
      beginFinale(
        createMatch(
          {
            players: [
              { id: 'a', name: 'A' },
              { id: 'b', name: 'B' },
            ],
            winnerCount: 1,
            presetId: 'fast',
          },
          { matchId: 'f1', startedAt: '2026-10-09T07:00:00.000Z' },
        ),
      ),
      createScriptedRng([1, 1]),
      'r1',
    );
    await repo.save(m);
    expect(await repo.load()).toEqual({ status: 'loaded', match: m });
  });

  it('writes exactly one completion record with the victory, even when saved again', async () => {
    const factory = new IDBFactory();
    const repo = createIndexedDbMatchRepository(factory);
    const won = await wonMatch();
    await repo.save(won);
    await repo.save(won); // e.g. a retry or a second tab
    const records = await createIndexedDbMatchRepository(factory).listCompleted();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      recordVersion: 1,
      matchId: 'won-1',
      completedAt: '2026-10-09T08:00:00.000Z',
      winnerIds: ['a'],
    });
    expect(records[0]!.match.finale?.rounds).toHaveLength(3);
  });

  it('keeps the completion record after the current match is cleared', async () => {
    const repo = createIndexedDbMatchRepository(new IDBFactory());
    await repo.save(await wonMatch());
    await repo.clear();
    expect(await repo.load()).toEqual({ status: 'none' });
    expect(await repo.listCompleted()).toHaveLength(1);
  });

  it('rejects a victory without exactly W winners', async () => {
    const repo = createIndexedDbMatchRepository(new IDBFactory());
    const won = await wonMatch();
    await repo.save({ ...won, finale: { ...won.finale!, winnerIds: [] } } as MatchState);
    // Saving still succeeds (the record writer copies what it is given) but loading refuses it.
    expect((await repo.load()).status).toBe('corrupt');
  });

  it('deletes one completed match or clears them all, and the change survives a reopen', async () => {
    const factory = new IDBFactory();
    const repo = createIndexedDbMatchRepository(factory);
    const won = await wonMatch();
    await repo.save(won);
    await repo.save({ ...won, matchId: 'won-2' });
    await repo.save({ ...won, matchId: 'won-3' });
    expect(await repo.deleteCompleted('won-2')).toEqual({ ok: true });
    const reopened = createIndexedDbMatchRepository(factory);
    expect((await reopened.listCompleted()).map((r) => r.matchId).sort()).toEqual([
      'won-1',
      'won-3',
    ]);
    // The in-progress checkpoint is untouched by history deletes.
    expect((await reopened.load()).status).toBe('loaded');
    expect(await reopened.clearCompleted()).toEqual({ ok: true });
    expect(await createIndexedDbMatchRepository(factory).listCompleted()).toEqual([]);
    expect((await reopened.load()).status).toBe('loaded');
  });

  it('reports delete/clear failures when IndexedDB is unavailable', async () => {
    const repo = createIndexedDbMatchRepository(null);
    expect((await repo.deleteCompleted('x')).ok).toBe(false);
    expect((await repo.clearCompleted()).ok).toBe(false);
  });

  it('the memory repository mirrors the once-only record behaviour', async () => {
    const repo = createMemoryMatchRepository();
    const won = await wonMatch();
    await repo.save(won);
    await repo.save(won);
    expect(await repo.listCompleted()).toHaveLength(1);
  });
});
