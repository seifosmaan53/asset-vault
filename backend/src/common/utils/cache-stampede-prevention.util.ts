// Copyright (c) 2025 Asset Vault. All rights reserved.
// Cache stampede prevention utility
// FIX #137: Prevents multiple requests from repopulating cache simultaneously

import { Logger } from '@nestjs/common';

const logger = new Logger('CacheStampedePrevention');

interface CacheRequest {
  promise: Promise<any>;
  timestamp: number;
}

// Track pending cache requests to prevent stampede
const pendingCacheRequests = new Map<string, CacheRequest>();

// Cleanup old requests (older than 5 seconds)
const CLEANUP_INTERVAL = 5000;
let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Start the cleanup interval (called automatically on first use)
 */
function startCleanupInterval(): void {
  if (cleanupInterval) return; // Already started
  
  cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, request] of pendingCacheRequests.entries()) {
    if (now - request.timestamp > CLEANUP_INTERVAL) {
      pendingCacheRequests.delete(key);
    }
  }
}, CLEANUP_INTERVAL);
}

/**
 * Stop the cleanup interval (useful for testing or graceful shutdown)
 */
export function stopCleanupInterval(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

/**
 * FIX #137: Prevent cache stampede by deduplicating concurrent cache repopulation requests
 * 
 * If multiple requests try to repopulate the same cache key simultaneously,
 * only one request will actually fetch the data, and others will wait for that result.
 * 
 * @param cacheKey - The cache key being repopulated
 * @param fetchFn - Function that fetches the data
 * @returns The fetched data (shared across all concurrent requests)
 */
export async function preventCacheStampede<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
): Promise<T> {
  // Start cleanup interval on first use
  if (!cleanupInterval) {
    startCleanupInterval();
  }
  
  // Check if there's already a pending request for this key
  const pendingRequest = pendingCacheRequests.get(cacheKey);
  
  if (pendingRequest) {
    // Another request is already fetching this data, wait for it
    logger.debug(`Cache stampede prevented for key: ${cacheKey} - reusing pending request`);
    return pendingRequest.promise as Promise<T>;
  }
  
  // Create new request
  const requestPromise = fetchFn()
    .then((result) => {
      // Remove from pending requests after completion
      pendingCacheRequests.delete(cacheKey);
      return result;
    })
    .catch((error) => {
      // Remove from pending requests on error
      pendingCacheRequests.delete(cacheKey);
      throw error;
    });
  
  // Track the pending request
  pendingCacheRequests.set(cacheKey, {
    promise: requestPromise,
    timestamp: Date.now(),
  });
  
  return requestPromise;
}

