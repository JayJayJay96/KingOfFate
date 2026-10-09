/**
 * Host-provided files that stay on this computer only (never bundled or uploaded anywhere),
 * e.g. the optional custom match music. Separate database from match data on purpose.
 */
export interface StoredAsset {
  readonly name: string;
  readonly type: string;
  readonly size: number;
  /** ISO-8601 UTC. */
  readonly savedAt: string;
  readonly blob: Blob;
}

export const CUSTOM_MUSIC_KEY = 'custom-music';
export const MAX_ASSET_BYTES = 25 * 1024 * 1024;

const DB_NAME = 'kof-assets';
const DB_VERSION = 1;
const STORE = 'files';

export interface AssetStore {
  get(key: string): Promise<StoredAsset | null>;
  put(key: string, file: File | Blob, name: string, savedAt: string): Promise<StoredAsset>;
  remove(key: string): Promise<void>;
}

export function createAssetStore(
  factory: IDBFactory | null = globalThis.indexedDB ?? null,
): AssetStore {
  let dbPromise: Promise<IDBDatabase> | null = null;
  function open(): Promise<IDBDatabase> {
    if (!factory) return Promise.reject(new Error('IndexedDB is not available in this browser.'));
    dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) {
          request.result.createObjectStore(STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Could not open file storage.'));
    }).catch((error: unknown) => {
      dbPromise = null;
      throw error;
    });
    return dbPromise;
  }

  async function run<T>(mode: IDBTransactionMode, work: (s: IDBObjectStore) => IDBRequest<T>) {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = work(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error ?? new Error('File storage failed.'));
      tx.onabort = () => reject(tx.error ?? new Error('File storage aborted.'));
    });
  }

  return {
    async get(key) {
      const value = await run<unknown>('readonly', (s) => s.get(key));
      if (!isStoredRecord(value)) return null;
      const { data, ...meta } = value;
      return { ...meta, blob: new Blob([data], { type: meta.type }) };
    },
    async put(key, file, name, savedAt) {
      if (file.size > MAX_ASSET_BYTES) {
        throw new Error(`File is too large (max ${MAX_ASSET_BYTES / 1024 / 1024} MB).`);
      }
      // Stored as raw bytes: ArrayBuffers clone reliably in every browser's IndexedDB.
      const data = await file.arrayBuffer();
      const record: StoredRecord = { name, type: file.type, size: file.size, savedAt, data };
      await run('readwrite', (s) => s.put(record, key));
      return { name, type: file.type, size: file.size, savedAt, blob: file };
    },
    async remove(key) {
      await run('readwrite', (s) => s.delete(key));
    },
  };
}

interface StoredRecord extends Omit<StoredAsset, 'blob'> {
  readonly data: ArrayBuffer;
}

function isStoredRecord(value: unknown): value is StoredRecord {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.name === 'string' &&
    typeof v.type === 'string' &&
    typeof v.size === 'number' &&
    typeof v.savedAt === 'string' &&
    // Realm-safe (cloned buffers may come from another global, where instanceof fails).
    Object.prototype.toString.call(v.data) === '[object ArrayBuffer]'
  );
}
