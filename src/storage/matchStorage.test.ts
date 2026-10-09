import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
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
    const spinning = beginTurn(newMatch(), createScriptedRng([2]), 't1');
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

  it('discards a corrupt checkpoint and reports it', async () => {
    const factory = new IDBFactory();
    const repo = createIndexedDbMatchRepository(factory);
    await repo.save({ ...newMatch(), phase: 'SPINNING', pendingTurn: null });
    expect(await repo.load()).toEqual({ status: 'corrupt' });
    expect(await repo.load()).toEqual({ status: 'none' });
  });

  it('rejects checkpoints with a pending turn on a dead player', async () => {
    const repo = createIndexedDbMatchRepository(new IDBFactory());
    const spinning = beginTurn(newMatch(), createScriptedRng([0]), 't1');
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
