import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { createAssetStore, CUSTOM_MUSIC_KEY, MAX_ASSET_BYTES } from './assetStorage';

const T = '2026-10-09T09:00:00.000Z';

describe('asset store (custom music, local only)', () => {
  it('stores, reads back and removes a file', async () => {
    const store = createAssetStore(new IDBFactory());
    expect(await store.get(CUSTOM_MUSIC_KEY)).toBeNull();
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/mpeg' });
    await store.put(CUSTOM_MUSIC_KEY, blob, 'theme.mp3', T);
    const got = await store.get(CUSTOM_MUSIC_KEY);
    expect(got).toMatchObject({ name: 'theme.mp3', type: 'audio/mpeg', size: 3, savedAt: T });
    await store.remove(CUSTOM_MUSIC_KEY);
    expect(await store.get(CUSTOM_MUSIC_KEY)).toBeNull();
  });

  it('refuses files over the size limit', async () => {
    const store = createAssetStore(new IDBFactory());
    const big = { size: MAX_ASSET_BYTES + 1, type: 'audio/mpeg' } as Blob;
    await expect(store.put(CUSTOM_MUSIC_KEY, big, 'huge.mp3', T)).rejects.toThrow(/too large/);
  });

  it('reports unavailable storage', async () => {
    await expect(createAssetStore(null).get(CUSTOM_MUSIC_KEY)).rejects.toThrow(/not available/);
  });
});
