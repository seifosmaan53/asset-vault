// Copyright (c) 2025 Asset Vault. All rights reserved.

// Lazy page loading with one retry for a failed chunk download; see components/common/LazyRoute.tsx.

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

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * `React.lazy` with one retry for a failed chunk download. Only chunk-load failures are
 * retried; an error thrown while the module evaluates is a bug and surfaces as is.
 */
export function lazyWithRetry<T extends ComponentType>(
  factory: () => Promise<{ default: T }>,
  { retries = 1, retryDelayMs = 400 }: { retries?: number; retryDelayMs?: number } = {},
): LazyExoticComponent<T> {
  return lazy(async () => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await factory();
      } catch (error) {
        if (!isChunkLoadError(error)) throw error;
        if (attempt >= retries) {
          const failure = new Error(
            error instanceof Error ? error.message : 'A page chunk could not be loaded',
            { cause: error },
          );
          failure.name = CHUNK_LOAD_ERROR;
          throw failure;
        }
        await wait(retryDelayMs);
      }
    }
  });
}
