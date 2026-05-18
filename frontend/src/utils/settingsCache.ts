/**
 * Settings cache utilities
 * Provides localStorage fallback for settings persistence
 */

import type { UserSettings } from '../api/settings';
import { logger } from './logger';

const SETTINGS_CACHE_KEY_PREFIX = 'app_settings_cache';
const SETTINGS_CACHE_VERSION = '1.0';
const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CachedSettings {
  version: string;
  timestamp: number;
  organizationId?: string; // Fix Issue #26: Include organizationId in cache
  settings: UserSettings;
}

/**
 * Get cache key with organizationId
 * Fix Issue #26: Include organizationId in cache key to prevent cross-org cache issues
 */
const getCacheKey = (organizationId?: string | null): string => {
  const orgId = organizationId || 'default';
  return `${SETTINGS_CACHE_KEY_PREFIX}_${orgId}`;
};

/**
 * Save settings to localStorage as backup cache
 * Fix Issue #26: Include organizationId in cache
 */
export const saveSettingsToCache = (settings: UserSettings, organizationId?: string | null): void => {
  if (typeof window === 'undefined') return;

  try {
    const cached: CachedSettings = {
      version: SETTINGS_CACHE_VERSION,
      timestamp: Date.now(),
      organizationId: organizationId || undefined,
      settings,
    };

    const cacheKey = getCacheKey(organizationId);
    localStorage.setItem(cacheKey, JSON.stringify(cached));
  } catch (error) {
    // Silently fail if localStorage is unavailable (private browsing, quota exceeded, etc.)
    logger.warn('Failed to cache settings to localStorage:', error);
  }
};

/**
 * Load settings from localStorage cache
 * Returns null if cache is invalid, expired, or doesn't exist
 * Fix Issue #26: Load cache for specific organizationId
 */
export const loadSettingsFromCache = (organizationId?: string | null): UserSettings | null => {
  if (typeof window === 'undefined') return null;

  try {
    const cacheKey = getCacheKey(organizationId);
    const cachedStr = localStorage.getItem(cacheKey);
    if (!cachedStr) return null;

    const cached: CachedSettings = JSON.parse(cachedStr);

    // Validate cache structure
    if (!cached.version || !cached.settings || !cached.timestamp) {
      return null;
    }

    // Check cache version
    if (cached.version !== SETTINGS_CACHE_VERSION) {
      // Clear old cache version
      clearSettingsCache(organizationId);
      return null;
    }
    
    // Fix Issue #26: Verify organizationId matches
    if (cached.organizationId && organizationId && cached.organizationId !== organizationId) {
      // Organization mismatch - don't use this cache
      return null;
    }

    // Check cache age
    const age = Date.now() - cached.timestamp;
    if (age > CACHE_MAX_AGE) {
      // Cache expired, clear it
      clearSettingsCache(organizationId);
      return null;
    }

    return cached.settings;
  } catch (error) {
    // Clear corrupted cache
    logger.warn('Failed to load settings from cache:', error);
    clearSettingsCache();
    return null;
  }
};

/**
 * Clear settings cache from localStorage
 * Fix Issue #26: Clear cache for specific organizationId or all
 */
export const clearSettingsCache = (organizationId?: string | null): void => {
  if (typeof window === 'undefined') return;

  try {
    if (organizationId !== undefined) {
      // Clear specific organization cache
      const cacheKey = getCacheKey(organizationId);
      localStorage.removeItem(cacheKey);
    } else {
      // Clear all organization caches (for migration/cleanup)
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(SETTINGS_CACHE_KEY_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    }
  } catch (error) {
    logger.warn('Failed to clear settings cache:', error);
  }
};

/**
 * Check if cached settings exist and are valid
 * Fix Issue #26: Check cache for specific organizationId
 */
export const hasValidSettingsCache = (organizationId?: string | null): boolean => {
  return loadSettingsFromCache(organizationId) !== null;
};

