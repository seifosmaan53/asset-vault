// Copyright (c) 2025 Asset Vault. All rights reserved.

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useSearchHistory } from '../hooks/useSearchHistory';
import { logger } from '../utils/logger';

interface SearchContextType {
  searchHistory: string[];
  addToHistory: (term: string, context?: string) => void;
  clearHistory: (context?: string) => void;
  removeFromHistory: (term: string, context?: string) => void;
  savedSearches: string[];
  saveSearch: (term: string, context?: string) => void;
  removeSavedSearch: (term: string, context?: string) => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export const useSearch = () => {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within SearchProvider');
  }
  return context;
};

interface SearchProviderProps {
  children: ReactNode;
}

const SAVED_SEARCHES_PREFIX = 'saved-searches-';

export const SearchProvider = ({ children }: SearchProviderProps) => {
  const globalHistory = useSearchHistory('global');
  const [savedSearches, setSavedSearches] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(`${SAVED_SEARCHES_PREFIX}global`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      logger.warn('Failed to load saved searches:', error);
    }
    return [];
  });

  const addToHistory = useCallback(
    (term: string, context: string = 'global') => {
      if (context === 'global') {
        globalHistory.addToHistory(term);
      } else {
        // For context-specific history, we could create separate hooks
        // For now, we'll use global history
        globalHistory.addToHistory(term);
      }
    },
    [globalHistory],
  );

  const clearHistory = useCallback(
    (context: string = 'global') => {
      if (context === 'global') {
        globalHistory.clearHistory();
      }
    },
    [globalHistory],
  );

  const removeFromHistory = useCallback(
    (term: string, context: string = 'global') => {
      if (context === 'global') {
        globalHistory.removeFromHistory(term);
      }
    },
    [globalHistory],
  );

  const saveSearch = useCallback((term: string, context: string = 'global') => {
    if (!term || term.trim() === '') return;
    const trimmedTerm = term.trim();
    setSavedSearches((prev) => {
      if (prev.includes(trimmedTerm)) return prev;
      const updated = [...prev, trimmedTerm];
      try {
        localStorage.setItem(`${SAVED_SEARCHES_PREFIX}${context}`, JSON.stringify(updated));
      } catch (error) {
        logger.warn('Failed to save search:', error);
      }
      return updated;
    });
  }, []);

  const removeSavedSearch = useCallback((term: string, context: string = 'global') => {
    setSavedSearches((prev) => {
      const updated = prev.filter((item) => item !== term);
      try {
        localStorage.setItem(`${SAVED_SEARCHES_PREFIX}${context}`, JSON.stringify(updated));
      } catch (error) {
        logger.warn('Failed to remove saved search:', error);
      }
      return updated;
    });
  }, []);

  return (
    <SearchContext.Provider
      value={{
        searchHistory: globalHistory.history,
        addToHistory,
        clearHistory,
        removeFromHistory,
        savedSearches,
        saveSearch,
        removeSavedSearch,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
};
