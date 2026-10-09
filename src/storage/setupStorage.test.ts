import { describe, expect, it } from 'vitest';
import { DEFAULT_SETUP, type SetupConfig } from '../game/setup/setupConfig';
import {
  CORRUPT_BACKUP_KEY,
  loadSetup,
  saveSetup,
  SETUP_SCHEMA_VERSION,
  SETUP_STORAGE_KEY,
} from './setupStorage';

const sample: SetupConfig = {
  roster: [
    { id: 'p1', name: 'An', active: true },
    { id: 'p2', name: 'Bình', active: false },
  ],
  winnerCount: 2,
  presetId: 'chaotic',
  stage: 'mamak',
};

function storeRaw(value: unknown) {
  localStorage.setItem(
    SETUP_STORAGE_KEY,
    typeof value === 'string' ? value : JSON.stringify(value),
  );
}

describe('setup storage', () => {
  it('returns defaults with status "empty" on first run', () => {
    expect(loadSetup(localStorage)).toEqual({ config: DEFAULT_SETUP, status: 'empty' });
  });

  it('round-trips roster, attendance, winners and preset', () => {
    expect(saveSetup(sample, localStorage)).toEqual({ ok: true });
    expect(loadSetup(localStorage)).toEqual({ config: sample, status: 'loaded' });
    expect(JSON.parse(localStorage.getItem(SETUP_STORAGE_KEY)!).schemaVersion).toBe(
      SETUP_SCHEMA_VERSION,
    );
  });

  it('treats unparseable JSON as corrupt, uses defaults and keeps a backup', () => {
    storeRaw('{not json');
    expect(loadSetup(localStorage)).toEqual({ config: DEFAULT_SETUP, status: 'corrupt' });
    expect(localStorage.getItem(CORRUPT_BACKUP_KEY)).toBe('{not json');
  });

  it('treats an unknown schema version as corrupt', () => {
    storeRaw({ ...sample, schemaVersion: 99 });
    expect(loadSetup(localStorage).status).toBe('corrupt');
  });

  it('repairs invalid entries and fields instead of discarding everything', () => {
    storeRaw({
      schemaVersion: 1,
      roster: [
        { id: 'p1', name: '  An ', active: true },
        { id: 'p1', name: 'Dup id', active: true },
        { id: 'p3', name: 'an', active: false },
        { id: 'p4', name: 'X'.repeat(21), active: true },
        { id: 'p5', name: 'Chi' },
        'garbage',
        { id: 'p6', name: 'Dung', active: false },
      ],
      winnerCount: 9,
      presetId: 'insane',
    });
    const result = loadSetup(localStorage);
    expect(result.status).toBe('repaired');
    expect(result.config).toEqual({
      roster: [
        { id: 'p1', name: 'An', active: true },
        { id: 'p6', name: 'Dung', active: false },
      ],
      winnerCount: DEFAULT_SETUP.winnerCount,
      presetId: DEFAULT_SETUP.presetId,
      stage: DEFAULT_SETUP.stage,
    });
  });

  it('keeps custom looks and the pinned stage; drops a damaged look or stage', () => {
    const look = {
      hair: 'long',
      hairColour: 'black',
      headwear: 'tudung',
      face: 'glasses',
      outfit: 'baju-melayu',
      outfitColour: 'teal',
      skin: 'tan',
      accent: 'beige',
    } as const;
    const withLook: SetupConfig = {
      ...sample,
      roster: [{ ...sample.roster[0]!, look }, sample.roster[1]!],
    };
    expect(saveSetup(withLook, localStorage).ok).toBe(true);
    expect(loadSetup(localStorage)).toEqual({ config: withLook, status: 'loaded' });

    storeRaw({
      schemaVersion: 1,
      roster: [{ id: 'p1', name: 'An', active: true, look: { ...look, headwear: 'crown' } }],
      winnerCount: 1,
      presetId: 'normal',
      stage: 'moon',
    });
    const result = loadSetup(localStorage);
    expect(result.status).toBe('repaired');
    expect(result.config.roster).toEqual([{ id: 'p1', name: 'An', active: true }]);
    expect(result.config.stage).toBe('random');
  });

  it('loads settings saved before stages existed', () => {
    storeRaw({ schemaVersion: 1, roster: [], winnerCount: 1, presetId: 'normal' });
    expect(loadSetup(localStorage)).toEqual({ config: DEFAULT_SETUP, status: 'loaded' });
  });

  it('reports storage as unavailable when there is no storage', () => {
    expect(loadSetup(null).status).toBe('unavailable');
    expect(saveSetup(sample, null).ok).toBe(false);
  });

  it('surfaces a write failure instead of pretending it saved', () => {
    const failing = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    } as unknown as Storage;
    const result = saveSetup(sample, failing);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toMatch(/QuotaExceededError/);
  });

  it('reports unavailable when reading throws (e.g. blocked storage)', () => {
    const blocked = {
      getItem: () => {
        throw new Error('SecurityError');
      },
    } as unknown as Storage;
    expect(loadSetup(blocked).status).toBe('unavailable');
  });
});
