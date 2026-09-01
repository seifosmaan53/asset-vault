import '@testing-library/jest-dom';
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';

/* This jsdom build exposes `localStorage` as an object but WITHOUT the Storage methods —
   `typeof localStorage.getItem` is 'undefined'. Any component that remembers a
   preference (InvoicesList restores its status filter this way) therefore threw
   "localStorage.getItem is not a function" the moment it rendered, and the failure
   looked like a bug in the component rather than a gap in the environment.

   An in-memory implementation, installed once here, fixes it for every test. It is also
   cleared between tests: a filter persisted by one case must not decide what another
   case renders. */
function createStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  } as Storage;
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  Object.defineProperty(window, name, {
    value: createStorage(),
    writable: true,
    configurable: true,
  });
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

// Cleanup after each test
afterEach(() => {
  cleanup();
});
