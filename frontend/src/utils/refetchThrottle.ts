// Copyright (c) 2025 Asset Vault. All rights reserved.
// Utility for throttling background refetches
// FIX #120: Background Tab Refetch Not Throttled

let lastRefetchTime = 0;
const MIN_REFETCH_INTERVAL = 1000; // Minimum 1 second between refetches

/**
 * Throttle refetch operations to prevent overwhelming the server
 * when multiple tabs regain focus simultaneously
 */
export function shouldRefetchOnFocus(): boolean {
  const now = Date.now();
  if (now - lastRefetchTime < MIN_REFETCH_INTERVAL) {
    return false; // Too soon, skip this refetch
  }
  lastRefetchTime = now;
  return true;
}

/**
 * Reset the throttle timer (useful for testing or manual refresh)
 */
export function resetRefetchThrottle(): void {
  lastRefetchTime = 0;
}

