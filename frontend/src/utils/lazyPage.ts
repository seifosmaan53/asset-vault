// Copyright (c) 2025 Asset Vault. All rights reserved.

// Lazy page loading for routes; see components/common/LazyRoute.tsx.

import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/* Messages browsers use for a dynamic import that could not be fetched, plus Vite's own
   "Unable to preload CSS" for a missing stylesheet of a chunk. */
const CHUNK_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i, // Chromium
  /error loading dynamically imported module/i, // Firefox
  /Importing a module script failed/i, // Safari
  /Unable to preload CSS/i, // Vite
];

export const CHUNK_LOAD_ERROR = 'ChunkLoadError';

export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === CHUNK_LOAD_ERROR) return true;
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(error.message));
}

/**
 * `React.lazy` for a route's page. A failed chunk download is re-thrown as a ChunkLoadError so
 * the route boundary can offer a reload.
 *
 * There is deliberately no in-place retry: Chromium caches a failed dynamic import for the
 * life of the document, so importing the same URL again rejects at once without a request
 * (verified with scripts/browser-smoke.mjs). Only a reload fetches the chunk again.
 */
export function lazyPage<T extends ComponentType>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      if (!isChunkLoadError(error) || (error instanceof Error && error.name === CHUNK_LOAD_ERROR)) throw error;
      const failure = new Error(error instanceof Error ? error.message : 'A page chunk could not be loaded', {
        cause: error,
      });
      failure.name = CHUNK_LOAD_ERROR;
      throw failure;
    }
  });
}
