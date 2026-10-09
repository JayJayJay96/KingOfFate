import { afterEach, describe, expect, it, vi } from 'vitest';
import { createId, uuidFromBytes } from './ids';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('createId', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('formats random bytes as an RFC 4122 v4 UUID', () => {
    expect(uuidFromBytes(new Uint8Array(16).fill(0xff))).toBe(
      'ffffffff-ffff-4fff-bfff-ffffffffffff',
    );
    expect(uuidFromBytes(new Uint8Array(16))).toBe('00000000-0000-4000-8000-000000000000');
  });

  it('still works where randomUUID is missing (plain http on a LAN address)', () => {
    const real = globalThis.crypto;
    vi.stubGlobal('crypto', {
      getRandomValues: <T extends ArrayBufferView>(a: T) => real.getRandomValues(a as never),
    });
    const ids = new Set(Array.from({ length: 200 }, () => createId()));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(UUID_V4);
  });

  it('uses randomUUID when available', () => {
    expect(createId()).toMatch(UUID_V4);
  });
});
