import type { CompletedMatchRecord, MatchRepository } from '../storage/matchStorage';
import { getBrowserStorage } from '../storage/setupStorage';
import { describeOfficeError, type OfficeClient } from './officeClient';
import type { OfficeStatusStore } from './officeStatus';

export const OUTBOX_KEY = 'kof.office.outbox';

/**
 * Office mode history (owner decisions 2026-10-29). The in-progress match stays on this PC. A won
 * match is saved locally first (same atomic checkpoint as Personal mode) and its ID is put in an
 * outbox BEFORE that save, then uploaded with mode 'add' (keyed by matchId: a retry can never
 * duplicate it). Unsent results upload automatically on the next server call. The local copy of
 * office history is a mirror for when the server cannot be reached.
 */
export function createOfficeMatchRepository(
  local: MatchRepository,
  client: OfficeClient,
  code: string,
  status: OfficeStatusStore,
  storage: Storage | null = getBrowserStorage(),
): MatchRepository {
  const outbox = {
    read(): string[] {
      try {
        const v: unknown = JSON.parse(storage?.getItem(OUTBOX_KEY) ?? '[]');
        return Array.isArray(v) ? v.filter((id): id is string => typeof id === 'string') : [];
      } catch {
        return [];
      }
    },
    write(ids: readonly string[]) {
      try {
        storage?.setItem(OUTBOX_KEY, JSON.stringify([...new Set(ids)]));
      } catch {
        // The record itself is still saved locally; only the upload reminder is lost.
      }
      status.set({ pending: ids.length });
    },
  };
  status.set({ pending: outbox.read().length });

  /** Uploads unsent results; true when the outbox is empty afterwards. */
  async function flush(): Promise<boolean> {
    const ids = outbox.read();
    if (ids.length === 0) return true;
    const saved = await local.listCompleted().catch(() => [] as CompletedMatchRecord[]);
    const records = saved.filter((r) => ids.includes(r.matchId));
    if (records.length > 0) {
      const result = await client.putMatches(code, records, 'add');
      if (!result.ok) {
        status.set({ link: result.error === 'code' ? 'code' : 'offline' });
        return false;
      }
    }
    const sent = new Set(records.map((r) => r.matchId));
    outbox.write(outbox.read().filter((id) => !sent.has(id)));
    return outbox.read().length === 0;
  }

  async function serverWrite(
    run: () => Promise<{ ok: boolean; error?: Parameters<typeof describeOfficeError>[0] }>,
    after: () => Promise<unknown>,
  ) {
    const result = await run();
    if (!result.ok) {
      const error = result.error ?? 'invalid';
      status.set({ link: error === 'code' ? 'code' : error === 'offline' ? 'offline' : 'online' });
      return { ok: false as const, message: `Nothing changed. ${describeOfficeError(error)}` };
    }
    status.set({ link: 'online' });
    await after();
    return { ok: true as const };
  }

  return {
    load: () => local.load(),
    clear: () => local.clear(),
    async save(match) {
      if (match.phase === 'VICTORY') outbox.write([...outbox.read(), match.matchId]);
      const result = await local.save(match);
      if (match.phase === 'VICTORY') {
        // Nothing was saved, so there is nothing to upload.
        if (!result.ok) outbox.write(outbox.read().filter((id) => id !== match.matchId));
        else void flush();
      }
      return result;
    },
    async listCompleted() {
      await flush();
      const result = await client.listMatches(code);
      if (!result.ok) {
        status.set({ link: result.error === 'code' ? 'code' : 'offline' });
        if (result.error === 'code') throw new Error(describeOfficeError('code'));
        // Offline: last copy of office history plus this PC's unsent results.
        return local.listCompleted();
      }
      status.set({ link: 'online' });
      const ids = outbox.read();
      const unsent = (await local.listCompleted()).filter((r) => ids.includes(r.matchId));
      const server = result.matches as CompletedMatchRecord[];
      const all = [
        ...server.filter((r) => !unsent.some((u) => u.matchId === r?.matchId)),
        ...unsent,
      ];
      await local.importCompleted(all, true);
      return all;
    },
    deleteCompleted: (matchId) =>
      serverWrite(
        () => client.deleteMatch(code, matchId),
        async () => {
          outbox.write(outbox.read().filter((id) => id !== matchId));
          await local.deleteCompleted(matchId);
        },
      ),
    clearCompleted: () =>
      serverWrite(
        () => client.putMatches(code, [], 'replace'),
        async () => {
          outbox.write([]);
          await local.clearCompleted();
        },
      ),
    importCompleted: (records, replace) =>
      serverWrite(
        () => client.putMatches(code, records, replace ? 'replace' : 'upsert'),
        async () => {
          if (replace) outbox.write([]);
          await local.importCompleted(records, replace);
        },
      ),
  };
}
