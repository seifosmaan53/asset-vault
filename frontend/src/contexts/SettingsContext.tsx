import { createContext, useContext, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { settingsApi, type UserSettings } from '../api/settings';
import { setGlobalSettings } from '../utils/dates';
import { setGlobalCurrencySettings } from '../utils/formatters';
import { 
  saveSettingsToCache, 
  loadSettingsFromCache, 
  clearSettingsCache 
} from '../utils/settingsCache';
import { logger } from '../utils/logger';
// Organizations removed - data is now user-scoped

interface SettingsContextType {
  settings: UserSettings;
  isLoading: boolean;
  error: Error | null;
}

export const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const useSettingsContext = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    // Return default settings if context is not available
    return {
      settings: {
        dateFormat: 'MM/DD/YYYY',
        timeFormat: '12',
        timezone: 'America/New_York',
        decimalSeparator: '.',
        thousandsSeparator: ',',
        currencySymbolPosition: 'left',
        showCurrencySymbol: true,
        defaultCurrency: 'USD',
      } as UserSettings,
      isLoading: false,
      error: null,
    };
  }
  return context;
};

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider = ({ children }: SettingsProviderProps) => {
  // Get queryClient instance for cache invalidation
  const queryClient = useQueryClient();
  
  // Check if user is authenticated before making API call
  const hasToken = typeof window !== 'undefined' ? !!localStorage.getItem('accessToken') : false;
  
  // Organizations removed - data is now user-scoped
  
  // Load cached settings as initial data (fallback)
  const cachedSettings = useMemo(() => loadSettingsFromCache(null), []);
  
  const { data: settings, isLoading, error } = useQuery({
    queryKey: ['settings'], // Organizations removed - settings are now user-scoped
    queryFn: async () => {
      try {
        const result = await settingsApi.getSettings();
        // Fix Issue #12: Validate settings structure before caching
        if (result && typeof result === 'object' && !Array.isArray(result)) {
          // Organizations removed - save to cache without organizationId
          saveSettingsToCache(result, null);
          return result;
        } else {
          logger.warn('Invalid settings structure from API, using defaults');
          throw new Error('Invalid settings structure');
        }
      } catch (err: unknown) {
        // Fix Issue #12: Validate cached settings before using
        if (cachedSettings) {
          // Validate cached settings structure
          if (cachedSettings && typeof cachedSettings === 'object' && !Array.isArray(cachedSettings)) {
            // Check for error response properties
            const errorProps = ['statusCode', 'timestamp', 'path', 'message', 'error'];
            const hasErrorProps = errorProps.some(prop => prop in cachedSettings);
            
            if (!hasErrorProps) {
              logger.warn('Settings API failed, using validated cached settings:', err);
              return cachedSettings;
            } else {
              logger.warn('Cached settings appear to be error response, clearing cache');
              clearSettingsCache(null);
            }
          } else {
            logger.warn('Cached settings invalid structure, clearing cache');
            clearSettingsCache(null);
          }
        }
        throw err;
      }
    },
    enabled: hasToken, // Only fetch if user is authenticated
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes (increased for better performance)
    gcTime: 30 * 60 * 1000, // Keep in memory for 30 minutes (was cacheTime)
    initialData: cachedSettings || undefined, // Use cached data as initial data
    refetchOnWindowFocus: false,
    refetchOnReconnect: true, // Refetch when network reconnects
    retry: (failureCount, error: unknown) => {
      // Don't retry on 401 (Unauthorized) or 403 (Forbidden) errors
      if (error && typeof error === 'object' && 'response' in error) {
        const response = (error as { response?: { status?: number } }).response;
        if (response?.status === 401 || response?.status === 403) {
          return false;
        }
      }
      // Retry up to 2 times for other errors (increased for better reliability)
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });

  // Fix Issue #26: Save settings to cache with organizationId whenever they change
  useEffect(() => {
    if (settings) {
      saveSettingsToCache(settings, null);
    }
  }, [settings]);
  
  // Organizations removed - settings are now user-scoped

  // Update global settings cache whenever settings change
  useEffect(() => {
    if (!settings && isLoading) {
      // Still loading, don't update yet
      return;
    }

    try {
      // Always set settings, even if empty (will use defaults in formatters)
      const dateSettings = {
        dateFormat: settings?.dateFormat || 'MM/DD/YYYY',
        timeFormat: settings?.timeFormat || '12',
        timezone: settings?.timezone || 'America/New_York',
      };
      
      const currencySettings = {
        decimalSeparator: settings?.decimalSeparator || '.',
        thousandsSeparator: settings?.thousandsSeparator || ',',
        currencySymbolPosition: settings?.currencySymbolPosition || 'left',
        showCurrencySymbol: settings?.showCurrencySymbol !== undefined ? settings.showCurrencySymbol : true,
        defaultCurrency: settings?.defaultCurrency || 'USD',
      };

      // Update date/time settings
      setGlobalSettings(dateSettings);

      // Update currency settings
      setGlobalCurrencySettings(currencySettings);
    } catch (err) {
      // Fail silently if formatter update fails - use defaults
      logger.warn('Failed to update global settings cache:', err);
    }
  }, [settings, isLoading]);

  // Merge with defaults to ensure all properties exist - memoize to prevent unnecessary re-renders
  const settingsWithDefaults: UserSettings = useMemo(() => ({
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12',
    timezone: 'America/New_York',
    decimalSeparator: '.',
    thousandsSeparator: ',',
    currencySymbolPosition: 'left',
    showCurrencySymbol: true,
    defaultCurrency: 'USD',
    ...settings,
  } as UserSettings), [settings]);

  return (
    <SettingsContext.Provider 
      value={{ 
        settings: settingsWithDefaults, 
        isLoading,
        error: error as Error | null,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

