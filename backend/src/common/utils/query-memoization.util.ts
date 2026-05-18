// Copyright (c) 2025 Asset Vault. All rights reserved.

/**
 * Query Memoization Utility
 * Fixes Issue #80: Missing Database Query Result Memoization
 * 
 * Provides memoization for expensive queries
 */
export class QueryMemoization {
  private static cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  /**
   * Memoize a query result
   */
  static memoize<T>(
    key: string,
    queryFn: () => Promise<T>,
    ttl: number = 60000, // 1 minute default
  ): Promise<T> {
    const cached = this.cache.get(key);
    const now = Date.now();

    // Return cached result if still valid
    if (cached && (now - cached.timestamp) < cached.ttl) {
      return Promise.resolve(cached.data as T);
    }

    // Execute query and cache result
    return queryFn().then((result) => {
      this.cache.set(key, {
        data: result,
        timestamp: now,
        ttl,
      });
      return result;
    });
  }

  /**
   * Clear a specific cache entry
   */
  static clear(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  static clearAll(): void {
    this.cache.clear();
  }

  /**
   * Clear expired cache entries
   */
  static clearExpired(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if ((now - value.timestamp) >= value.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  static getStats(): {
    size: number;
    keys: string[];
  } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

