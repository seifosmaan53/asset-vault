import { useContext } from 'react';
import { SettingsContext } from '../contexts/SettingsContext';
import type { UserSettings } from '../api/settings';

/**
 * Hook to access user settings throughout the application
 * Uses SettingsContext to access settings that are loaded and cached by SettingsProvider
 * This ensures all components use the same settings data and updates propagate correctly
 */
export const useSettings = () => {
  const context = useContext(SettingsContext);
  
  // If context is available (which it should be if SettingsProvider wraps the app), use it
  if (context) {
    return context;
  }

  // Fallback: return default settings if context is not available
  // This should rarely happen if SettingsProvider is properly set up
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
};

