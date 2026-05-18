// Global settings cache (will be set by SettingsProvider)
// Initialize with defaults to ensure formatting works even before settings load
let globalCurrencySettings: {
  decimalSeparator?: string;
  thousandsSeparator?: string;
  currencySymbolPosition?: string;
  showCurrencySymbol?: boolean;
  defaultCurrency?: string;
} = {
  decimalSeparator: '.',
  thousandsSeparator: ',',
  currencySymbolPosition: 'left',
  showCurrencySymbol: true,
  defaultCurrency: 'USD',
};

/**
 * Set global currency settings (called by SettingsProvider)
 * @internal
 */
export const setGlobalCurrencySettings = (settings: {
  decimalSeparator?: string;
  thousandsSeparator?: string;
  currencySymbolPosition?: string;
  showCurrencySymbol?: boolean;
  defaultCurrency?: string;
}) => {
  globalCurrencySettings = {
    decimalSeparator: settings.decimalSeparator || '.',
    thousandsSeparator: settings.thousandsSeparator || ',',
    currencySymbolPosition: settings.currencySymbolPosition || 'left',
    showCurrencySymbol: settings.showCurrencySymbol !== undefined ? settings.showCurrencySymbol : true,
    defaultCurrency: settings.defaultCurrency || 'USD',
  };
};

/**
 * Format currency using user's preferred format
 * Automatically uses global settings if available
 */
export const formatCurrency = (
  amount: number,
  currency?: string,
  customSettings?: {
    decimalSeparator?: string;
    thousandsSeparator?: string;
    currencySymbolPosition?: string;
    showCurrencySymbol?: boolean;
  },
): string => {
  const settings = customSettings || globalCurrencySettings;
  // Ensure we have default values if settings are empty
  const effectiveSettings = {
    decimalSeparator: settings?.decimalSeparator || '.',
    thousandsSeparator: settings?.thousandsSeparator || ',',
    currencySymbolPosition: settings?.currencySymbolPosition || 'left',
    showCurrencySymbol: settings?.showCurrencySymbol !== undefined ? settings.showCurrencySymbol : true,
    defaultCurrency: (settings && 'defaultCurrency' in settings ? settings.defaultCurrency : undefined) || 'USD',
  };
  const currencyCode = currency || effectiveSettings.defaultCurrency || 'USD';
  
  // Get currency symbol
  const currencySymbol = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode as string,
  })
    .formatToParts(0)
    .find((part) => part.type === 'currency')?.value || '$';

  // Always use custom formatting based on effective settings
  // Use standard US formatting with commas for thousands separators
  const parts = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode as string,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).formatToParts(amount);

  const decimalSep = effectiveSettings.decimalSeparator;
  const thousandsSep = effectiveSettings.thousandsSeparator;
  
  // Build number part first
  let numberPart = '';
  parts.forEach((part) => {
    if (part.type === 'group') {
      numberPart += thousandsSep;
    } else if (part.type === 'decimal') {
      numberPart += decimalSep;
    } else if (part.type === 'fraction' || part.type === 'integer') {
      numberPart += part.value;
    }
  });

  // Add currency symbol based on position
  if (effectiveSettings.showCurrencySymbol) {
    if (effectiveSettings.currencySymbolPosition === 'right') {
      return numberPart + ' ' + currencySymbol;
    } else {
      return currencySymbol + numberPart;
    }
  } else {
    return numberPart;
  }
};

// Re-export date formatting functions from dates.ts to ensure settings are used
export { formatDate, formatDateTime } from './dates';

export const formatInvoiceNumber = (number: string): string => {
  return number;
};

