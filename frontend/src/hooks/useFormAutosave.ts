// Copyright (c) 2025 Asset Vault. All rights reserved.

import { useEffect, useRef, useCallback } from 'react';
import { logger } from '../utils/logger';

const AUTOSAVE_DELAY = 30000; // 30 seconds
const STORAGE_PREFIX = 'form-draft-';

/**
 * Hook for autosaving form data to localStorage
 * Automatically saves form data periodically and on unmount
 * Provides draft recovery functionality
 */
export const useFormAutosave = <T extends Record<string, unknown>>(
  formId: string,
  formData: T,
  isDirty: boolean,
  enabled: boolean = true,
) => {
  const storageKey = `${STORAGE_PREFIX}${formId}`;
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>('');

  // Save form data to localStorage
  const saveDraft = useCallback((data: T) => {
    if (!enabled || !isDirty) return;
    
    try {
      const dataString = JSON.stringify(data);
      // Only save if data has changed
      if (dataString !== lastSavedRef.current) {
        localStorage.setItem(storageKey, dataString);
        lastSavedRef.current = dataString;
        logger.debug(`Form draft saved: ${formId}`);
      }
    } catch (error) {
      logger.warn(`Failed to save form draft for ${formId}:`, error);
    }
  }, [enabled, isDirty, storageKey, formId]);

  // Autosave on data changes (debounced)
  // FIX: Use stringified comparison to detect actual data changes, not object reference changes
  const formDataStringRef = useRef<string>('');
  
  useEffect(() => {
    if (!enabled || !isDirty) return;

    // Stringify formData to compare actual content, not object reference
    let formDataString: string;
    try {
      formDataString = JSON.stringify(formData);
    } catch (error) {
      // If stringification fails, skip this update
      return;
    }

    // Only proceed if data has actually changed (by content, not reference)
    if (formDataString === formDataStringRef.current) {
      return;
    }

    // Update ref with new stringified data
    formDataStringRef.current = formDataString;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for autosave
    saveTimeoutRef.current = setTimeout(() => {
      saveDraft(formData);
    }, AUTOSAVE_DELAY);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [formData, isDirty, enabled, formId, saveDraft]);

  // Save on unmount - use ref to get latest values
  const formDataRef = useRef(formData);
  const isDirtyRef = useRef(isDirty);
  const enabledRef = useRef(enabled);
  
  useEffect(() => {
    formDataRef.current = formData;
    isDirtyRef.current = isDirty;
    enabledRef.current = enabled;
  }, [formData, isDirty, enabled]);

  useEffect(() => {
    return () => {
      if (enabledRef.current && isDirtyRef.current) {
        saveDraft(formDataRef.current);
      }
    };
  }, [saveDraft]); // Only saveDraft as dependency

  // Load draft from localStorage
  // FIX: Use useCallback to ensure stable function reference
  const loadDraft = useCallback((): T | null => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        logger.debug(`Form draft loaded: ${formId}`);
        return parsed as T;
      }
    } catch (error) {
      logger.warn(`Failed to load form draft for ${formId}:`, error);
    }
    return null;
  }, [storageKey, formId]);

  // Clear draft
  // FIX: Use useCallback to ensure stable function reference
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      lastSavedRef.current = '';
      logger.debug(`Form draft cleared: ${formId}`);
    } catch (error) {
      logger.warn(`Failed to clear form draft for ${formId}:`, error);
    }
  }, [storageKey, formId]);

  return {
    loadDraft,
    clearDraft,
    saveDraft: () => saveDraft(formData),
  };
};
