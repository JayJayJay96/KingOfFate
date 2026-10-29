import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETUP, type SetupConfig } from '../game/setup/setupConfig';
import { createMemoryMatchRepository, type MatchRepository } from '../storage/matchStorage';
import { toStoredSetup } from '../storage/setupStorage';
import { createFakeOffice } from '../test/fakeOfficeClient';
import { playCompletedMatch, playToVictory } from '../test/historyFixtures';
import { createOfficeClient, officeServerFromEnv } from './officeClient';
import { createOfficeMatchRepository, OUTBOX_KEY } from './officeRepository';
import { loadOfficeSettings, saveOfficeSettings } from './officeSettings';
import { createOfficeStatusStore } from './officeStatus';
import { createSetupSync, type SetupSyncState } from './setupSync';

const PLAYERS = [
  ['a', 'Aisyah'],
  ['b', 'Wei Jie'],
] as const;

describe('office client', () => {
  it('reads the server settings from the build environment', () => {
    expect(officeServerFromEnv({})).toBeNull();
    expect(
      officeServerFromEnv({
        VITE_SUPABASE_URL: 'https://x.supabase.co/',
        VITE_SUPABASE_ANON_KEY: 'k',
      }),
    ).toEqual({ url: 'https://x.supabase.co', key: 'k' });
  });

  it('calls the Postgres function with the public key on the apikey header only', async () => {
    const fetchImpl = vi.fn(async () => new Response('{"ok":true,"matches":[]}'));
    const client = createOfficeClient({ url: 'https://x.supabase.co', key: 'pub' }, fetchImpl, []);
    expect(await client.listMatches('116059')).toEqual({ ok: true, matches: [] });
    expect(fetchImpl).toHaveBeenCalledWith('https://x.supabase.co/rest/v1/rpc/kof_list_matches', {
      method: 'POST',
      headers: { apikey: 'pub', 'Content-Type': 'application/json' },
      body: '{"p_code":"116059"}',
    });
  });

  it('retries network and server errors, then reports offline; a refused code is not retried', async () => {
    const down = vi.fn(async (): Promise<Response> => {
      throw new TypeError('Failed to fetch');
    });
    expect(await createOfficeClient({ url: 'u', key: 'k' }, down, [0, 0]).getSetup('x')).toEqual({
      ok: false,
      error: 'offline',
    });
    expect(down).toHaveBeenCalledTimes(3);

    const flaky = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response('{"ok":true,"setup":null,"version":0}'));
    expect(
      await createOfficeClient({ url: 'u', key: 'k' }, flaky, [0]).getSetup('x'),
    ).toMatchObject({ ok: true });

    const refused = vi.fn(async () => new Response('{"ok":false,"error":"code"}'));
    expect(await createOfficeClient({ url: 'u', key: 'k' }, refused, [0]).getSetup('x')).toEqual({
      ok: false,
      error: 'code',
    });
    expect(refused).toHaveBeenCalledTimes(1);

    const missing = vi.fn(async () => new Response('', { status: 404 }));
    expect(await createOfficeClient({ url: 'u', key: 'k' }, missing, [0]).getSetup('x')).toEqual({
      ok: false,
      error: 'invalid',
    });
    expect(missing).toHaveBeenCalledTimes(1);
  });

  it('remembers the mode and code per PC', () => {
    expect(loadOfficeSettings(localStorage)).toEqual({ mode: 'personal', code: '' });
    saveOfficeSettings({ mode: 'office', code: '116059' }, localStorage);
    expect(loadOfficeSettings(localStorage)).toEqual({ mode: 'office', code: '116059' });
  });
});

describe('office history (owner decisions 2026-10-29)', () => {
  function setup(local: MatchRepository = createMemoryMatchRepository()) {
    const server = createFakeOffice();
    const status = createOfficeStatusStore();
    const repo = createOfficeMatchRepository(local, server.client, '116059', status, localStorage);
    return { server, status, repo, local };
  }

  it('a won match is uploaded once, keyed by matchId', async () => {
    const { server, repo, status } = setup();
    const won = playToVictory({ matchId: 'm1', players: PLAYERS });
    await repo.save(won);
    await repo.save(won); // a repeated checkpoint
    expect((await repo.listCompleted()).map((r) => r.matchId)).toEqual(['m1']);
    expect([...server.state.matches.keys()]).toEqual(['m1']);
    expect(status.get()).toEqual({ link: 'online', pending: 0 });
  });

  it('offline: the result is kept on this PC, shown, and uploaded when the server is back', async () => {
    const { server, repo, status, local } = setup();
    server.state.online = false;
    await repo.save(playToVictory({ matchId: 'm1', players: PLAYERS }));
    expect((await repo.listCompleted()).map((r) => r.matchId)).toEqual(['m1']);
    expect(status.get()).toEqual({ link: 'offline', pending: 1 });
    expect(JSON.parse(localStorage.getItem(OUTBOX_KEY)!)).toEqual(['m1']);
    expect(server.state.matches.size).toBe(0);

    server.state.online = true;
    expect((await repo.listCompleted()).map((r) => r.matchId)).toEqual(['m1']);
    expect([...server.state.matches.keys()]).toEqual(['m1']);
    expect(status.get()).toEqual({ link: 'online', pending: 0 });
    // The local copy now mirrors the office history.
    expect((await local.listCompleted()).map((r) => r.matchId)).toEqual(['m1']);
  });

  it('shows matches other hosts saved; deletes and imports go to the server', async () => {
    const { server, repo } = setup();
    server.state.matches.set('other', playCompletedMatch({ matchId: 'other', players: PLAYERS }));
    expect((await repo.listCompleted()).map((r) => r.matchId)).toEqual(['other']);
    const extra = playCompletedMatch({ matchId: 'extra', players: PLAYERS, seed: 4 });
    expect(await repo.importCompleted([extra], false)).toEqual({ ok: true });
    expect([...server.state.matches.keys()].sort()).toEqual(['extra', 'other']);
    expect(await repo.deleteCompleted('other')).toEqual({ ok: true });
    expect([...server.state.matches.keys()]).toEqual(['extra']);
    expect(await repo.clearCompleted()).toEqual({ ok: true });
    expect(server.state.matches.size).toBe(0);
  });

  it('never pretends a delete worked while offline; a refused code is an error', async () => {
    const { server, repo } = setup();
    server.state.matches.set('m', playCompletedMatch({ matchId: 'm', players: PLAYERS }));
    server.state.online = false;
    expect(await repo.deleteCompleted('m')).toEqual({
      ok: false,
      message: 'Nothing changed. The office server could not be reached.',
    });
    expect(server.state.matches.size).toBe(1);
    server.state.online = true;
    server.state.code = 'changed';
    await expect(repo.listCompleted()).rejects.toThrow(/office code was refused/);
  });
});

describe('office setup sync (two hosts, offline)', () => {
  const withRoster = (names: string[]): SetupConfig => ({
    ...DEFAULT_SETUP,
    roster: names.map((name, i) => ({ id: `id${i}`, name, active: true })),
  });

  function host(server: ReturnType<typeof createFakeOffice>, initial: SetupConfig) {
    const saved = new Map<string, string>();
    const storage = {
      getItem: (k: string) => saved.get(k) ?? null,
      setItem: (k: string, v: string) => void saved.set(k, v),
    } as unknown as Storage;
    let config = initial;
    const states: SetupSyncState[] = [];
    const sync = createSetupSync({
      client: server.client,
      code: '116059',
      status: createOfficeStatusStore(),
      current: () => config,
      apply: (c) => (config = c),
      onState: (s) => states.push(s),
      storage,
      debounceMs: 0,
    });
    const edit = async (next: SetupConfig) => {
      config = next;
      sync.changed();
      await vi.runAllTimersAsync();
    };
    return { sync, edit, config: () => config, states };
  }

  it('the first host fills an empty office; a new PC gets it without setting anything up', async () => {
    const server = createFakeOffice();
    const first = host(server, withRoster(['Aisyah', 'Wei Jie']));
    await first.sync.pull();
    expect(server.state.setup).toEqual(toStoredSetup(withRoster(['Aisyah', 'Wei Jie'])));
    const newPc = host(server, DEFAULT_SETUP);
    await newPc.sync.pull();
    expect(newPc.config().roster.map((p) => p.name)).toEqual(['Aisyah', 'Wei Jie']);
    expect(newPc.states.at(-1)).toBe('synced');
  });

  it('two hosts: the first save wins, the second host chooses', async () => {
    vi.useFakeTimers();
    try {
      const server = createFakeOffice();
      const a = host(server, withRoster(['Aisyah']));
      await a.sync.pull();
      const b = host(server, DEFAULT_SETUP);
      await b.sync.pull();
      await a.edit(withRoster(['Aisyah', 'Kavitha']));
      await b.edit(withRoster(['Aisyah', 'Hafiz']));
      expect(b.states.at(-1)).toBe('conflict');
      expect(server.state.setup).toEqual(toStoredSetup(withRoster(['Aisyah', 'Kavitha'])));
      await b.sync.useOffice();
      expect(b.config().roster.map((p) => p.name)).toEqual(['Aisyah', 'Kavitha']);
      await b.edit(withRoster(['Aisyah', 'Kavitha', 'Hafiz']));
      expect(b.states.at(-1)).toBe('synced');
      await a.sync.pull();
      expect(a.config().roster).toHaveLength(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('offline edits stay on this PC; when the server is back the host picks', async () => {
    vi.useFakeTimers();
    try {
      const server = createFakeOffice();
      const a = host(server, withRoster(['Aisyah']));
      await a.sync.pull();
      server.state.online = false;
      await a.edit(withRoster(['Aisyah', 'Hafiz']));
      expect(a.states.at(-1)).toBe('offline');
      server.state.online = true;
      await a.sync.pull();
      expect(a.states.at(-1)).toBe('diverged');
      expect(a.config().roster).toHaveLength(2); // nothing silently replaced
      await a.sync.uploadMine();
      expect(a.states.at(-1)).toBe('synced');
      expect(server.state.setup).toEqual(toStoredSetup(withRoster(['Aisyah', 'Hafiz'])));
    } finally {
      vi.useRealTimers();
    }
  });
});
