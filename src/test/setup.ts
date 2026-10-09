import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach } from 'vitest';

beforeEach(() => {
  localStorage.clear();
  // Fresh, empty IndexedDB per test.
  globalThis.indexedDB = new IDBFactory();
});

afterEach(() => {
  cleanup();
});
