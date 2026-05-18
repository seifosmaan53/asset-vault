// Copyright (c) 2025 Asset Vault. All rights reserved.

import { useState, useEffect, useCallback } from 'react';
import { logger } from '../utils/logger';

const STORAGE_PREFIX = 'search-history-';
const MAX_HISTORY_ITEMS = 10;

/**
 * Hook for managing search history
 */
export const useSearchHistory = (context: string = 'global') => {
  const storageKey = `${STORAGE_PREFIX}${context}`;

  const [history, setHistory] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      logger.warn('Failed to load search history:', error);
    }
    return [];
  });

  // Save history to localStorage
  const saveHistory = useCallback(
    (newHistory: string[]) => {
      setHistory(newHistory);
      try {
        localStorage.setItem(storageKey, JSON.stringify(newHistory));
      } catch (error) {
        logger.warn('Failed to save search history:', error);
      }
    },
    [storageKey],
  );

  // Add a search term to history
  const addToHistory = useCallback(
    (term: string) => {
      if (!term || term.trim() === '') return;
      const trimmedTerm = term.trim();
      setHistory((prev) => {
        // Remove duplicates and add to beginning
        const filtered = prev.filter((item) => item !== trimmedTerm);
        const updated = [trimmedTerm, ...filtered].slice(0, MAX_HISTORY_ITEMS);
        saveHistory(updated);
        return updated;
      });
    },
    [saveHistory],
  );

  // Clear history
  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      logger.warn('Failed to clear search history:', error);
    }
  }, [storageKey]);

  // Remove a specific item from history
  const removeFromHistory = useCallback(
    (term: string) => {
      setHistory((prev) => {
        const updated = prev.filter((item) => item !== term);
        saveHistory(updated);
        return updated;
      });
    },
    [saveHistory],
  );

  return {
    history,
    addToHistory,
    clearHistory,
    removeFromHistory,
  };
};
