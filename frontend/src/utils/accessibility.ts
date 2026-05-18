// Copyright (c) 2025 Asset Vault. All rights reserved.

/**
 * Accessibility utility functions
 * Fixes Issue #42: Missing Accessibility Attributes
 */

/**
 * Get standard ARIA attributes for common UI elements
 */
export const a11y = {
  /**
   * Get ARIA attributes for a button
   */
  button: (label: string, options?: { disabled?: boolean; pressed?: boolean }) => ({
    'aria-label': label,
    'aria-disabled': options?.disabled || false,
    'aria-pressed': options?.pressed,
  }),

  /**
   * Get ARIA attributes for a text input
   */
  input: (label: string, options?: { required?: boolean; invalid?: boolean; describedBy?: string }) => ({
    'aria-label': label,
    'aria-required': options?.required || false,
    'aria-invalid': options?.invalid || false,
    'aria-describedby': options?.describedBy,
  }),

  /**
   * Get ARIA attributes for a table
   */
  table: (caption?: string) => ({
    role: 'table',
    'aria-label': caption,
  }),

  /**
   * Get ARIA attributes for a dialog/modal
   */
  dialog: (title: string, options?: { describedBy?: string }) => ({
    role: 'dialog',
    'aria-modal': true,
    'aria-labelledby': title,
    'aria-describedby': options?.describedBy,
  }),

  /**
   * Get ARIA attributes for a navigation region
   */
  navigation: (label: string) => ({
    role: 'navigation',
    'aria-label': label,
  }),

  /**
   * Get ARIA attributes for a search region
   */
  search: (label: string = 'Search') => ({
    role: 'search',
    'aria-label': label,
  }),

  /**
   * Get ARIA attributes for a loading state
   */
  loading: (label: string = 'Loading') => ({
    role: 'status',
    'aria-live': 'polite',
    'aria-label': label,
  }),

  /**
   * Get ARIA attributes for an alert/error message
   */
  alert: (label: string, level: 'error' | 'warning' | 'info' | 'success' = 'error') => ({
    role: 'alert',
    'aria-live': level === 'error' ? 'assertive' : 'polite',
    'aria-label': label,
  }),
};

/**
 * Keyboard navigation helpers
 */
export const keyboard = {
  /**
   * Check if Enter key was pressed
   */
  isEnter: (e: React.KeyboardEvent | KeyboardEvent): boolean => e.key === 'Enter',

  /**
   * Check if Escape key was pressed
   */
  isEscape: (e: React.KeyboardEvent | KeyboardEvent): boolean => e.key === 'Escape',

  /**
   * Check if Tab key was pressed
   */
  isTab: (e: React.KeyboardEvent | KeyboardEvent): boolean => e.key === 'Tab',

  /**
   * Check if Arrow key was pressed
   */
  isArrow: (e: React.KeyboardEvent | KeyboardEvent): boolean => 
    ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key),

  /**
   * Handle keyboard navigation for lists
   */
  handleListNavigation: (
    e: React.KeyboardEvent,
    currentIndex: number,
    totalItems: number,
    onSelect: (index: number) => void,
  ) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = currentIndex < totalItems - 1 ? currentIndex + 1 : 0;
      onSelect(nextIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : totalItems - 1;
      onSelect(prevIndex);
    } else if (e.key === 'Home') {
      e.preventDefault();
      onSelect(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      onSelect(totalItems - 1);
    }
  },
};

