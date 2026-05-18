// Copyright (c) 2025 Asset Vault. All rights reserved.

import { useState, useEffect } from 'react';
import { useDebounce } from './useDebounce';

/**
 * Hook for debounced search input
 * Fixes Issue #41: Missing Debouncing on Search Inputs
 * 
 * @param initialValue - Initial search value
 * @param delay - Debounce delay in milliseconds (default: 300ms)
 * @returns [searchInput, debouncedSearchTerm, setSearchInput]
 */
export function useDebouncedSearch(
  initialValue: string = '',
  delay: number = 300,
): [string, string, (value: string) => void] {
  const [searchInput, setSearchInput] = useState(initialValue);
  const debouncedSearchTerm = useDebounce(searchInput, delay);

  // Reset search input when initialValue changes externally
  useEffect(() => {
    setSearchInput(initialValue);
  }, [initialValue]);

  return [searchInput, debouncedSearchTerm, setSearchInput];
}

