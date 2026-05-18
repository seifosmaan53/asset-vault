import { format, parseISO, isValid, startOfDay, endOfDay, subMonths } from 'date-fns';

// Map user-friendly format strings to date-fns format tokens
const formatMap: Record<string, string> = {
  'MM/DD/YYYY': 'MM/dd/yyyy',
  'DD/MM/YYYY': 'dd/MM/yyyy',
  'YYYY-MM-DD': 'yyyy-MM-dd',
  'DD-MM-YYYY': 'dd-MM-yyyy',
  'MMM DD, YYYY': 'MMM dd, yyyy',
};

// Global settings cache (will be set by SettingsProvider)
// Initialize with defaults to ensure formatting works even before settings load
let globalSettings: { dateFormat?: string; timeFormat?: string; timezone?: string } = {
  dateFormat: 'MM/DD/YYYY',
  timeFormat: '12',
  timezone: 'America/New_York',
};

/**
 * Set global settings (called by SettingsProvider)
 * @internal
 */
export const setGlobalSettings = (settings: { dateFormat?: string; timeFormat?: string; timezone?: string }) => {
  globalSettings = {
    dateFormat: settings.dateFormat || 'MM/DD/YYYY',
    timeFormat: settings.timeFormat || '12',
    timezone: settings.timezone || 'America/New_York',
  };
};

/**
 * Format date using user's preferred format
 * Automatically uses global settings if available
 * Handles Postgres DATE format (YYYY-MM-DD) safely by treating as local calendar date
 * @param date - Date string or Date object
 * @param userDateFormat - Optional: User's date format preference (e.g., 'MM/DD/YYYY')
 * @param userTimeFormat - Optional: User's time format preference ('12' or '24')
 * @param userTimezone - Optional: User's timezone preference (for future use)
 * @returns Formatted date string
 */
export const formatDate = (
  date: string | Date | null | undefined,
  userDateFormat?: string,
  userTimeFormat?: string,
  userTimezone?: string,
): string => {
  if (!date) return '';
  
  try {
    let d: Date;
    
    // Handle Postgres DATE format (YYYY-MM-DD) - treat as local calendar date to avoid timezone shifts
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [y, m, day] = date.split('-').map(Number);
      d = new Date(y, m - 1, day); // local midnight
    } else {
      d = typeof date === 'string' ? parseISO(date) : date;
    }
    
    if (!isValid(d)) return '';

    // Use provided format, or global settings, or default
    const dateFormat = userDateFormat || globalSettings.dateFormat || 'MM/DD/YYYY';
    const formatStr = formatMap[dateFormat] || 'MMM dd, yyyy';

    return format(d, formatStr);
  } catch {
    return '';
  }
};

/**
 * Format date and time using user's preferred format
 * Automatically uses global settings if available
 * @param date - Date string or Date object
 * @param userDateFormat - Optional: User's date format preference
 * @param userTimeFormat - Optional: User's time format preference ('12' or '24')
 * @param userTimezone - Optional: User's timezone preference (for future use)
 * @returns Formatted date and time string
 */
export const formatDateTime = (
  date: string | Date,
  userDateFormat?: string,
  userTimeFormat?: string,
  userTimezone?: string,
): string => {
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(d)) return '';

    // Use provided format, or global settings, or default
    const dateFormat = userDateFormat || globalSettings.dateFormat || 'MM/DD/YYYY';
    const timeFormat = userTimeFormat || globalSettings.timeFormat || '12';
    
    const dateFormatStr = formatMap[dateFormat] || 'MMM dd, yyyy';
    const timeFormatStr = timeFormat === '24' ? 'HH:mm' : 'hh:mm a';
    const formatStr = `${dateFormatStr} ${timeFormatStr}`;

    return format(d, formatStr);
  } catch {
    return '';
  }
};

export const isOverdue = (dueDate: string | undefined): boolean => {
  if (!dueDate) return false;
  const due = parseISO(dueDate);
  const now = new Date();
  return isValid(due) && due < now;
};

export const getDaysUntilDue = (dueDate: string | undefined): number | null => {
  if (!dueDate) return null;
  const due = parseISO(dueDate);
  const now = new Date();
  if (!isValid(due)) return null;
  const diffTime = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

/**
 * Validates and normalizes a date range to ensure no future dates
 * @param start - Start date (can be null)
 * @param end - End date (can be null)
 * @param defaultMonthsBack - Number of months back for default start date (default: 6)
 * @returns Validated date range with no future dates
 */
export const validateDateRange = (
  start: Date | null,
  end: Date | null,
  defaultMonthsBack: number = 6
): { start: Date; end: Date } => {
  const now = new Date();
  const today = endOfDay(now);
  const todayStart = startOfDay(now);
  const currentYear = now.getFullYear();
  
  // Helper to check if date is in the future (date-only comparison)
  const isDateInFuture = (date: Date): boolean => {
    const dateUTC = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    return dateUTC > todayUTC;
  };
  
  let validatedStart = start;
  let validatedEnd = end;
  
  // Fix future dates
  if (validatedStart && (isDateInFuture(validatedStart) || validatedStart.getFullYear() > currentYear)) {
    validatedStart = subMonths(todayStart, defaultMonthsBack);
    validatedStart.setHours(0, 0, 0, 0);
  }
  
  if (validatedEnd && (isDateInFuture(validatedEnd) || validatedEnd.getFullYear() > currentYear)) {
    validatedEnd = new Date(today);
  }
  
  // If no dates or invalid range, use defaults
  if (!validatedStart || !validatedEnd) {
    const defaultStart = subMonths(todayStart, defaultMonthsBack);
    defaultStart.setHours(0, 0, 0, 0);
    return { start: defaultStart, end: today };
  }
  
  // Fix invalid range (start after end)
  if (validatedStart > validatedEnd) {
    const defaultStart = subMonths(todayStart, defaultMonthsBack);
    defaultStart.setHours(0, 0, 0, 0);
    return { start: defaultStart, end: today };
  }
  
  // Final safety check: ensure dates are not in the future
  if (isDateInFuture(validatedStart)) {
    const defaultStart = subMonths(todayStart, defaultMonthsBack);
    defaultStart.setHours(0, 0, 0, 0);
    validatedStart = defaultStart;
  }
  
  if (isDateInFuture(validatedEnd)) {
    validatedEnd = new Date(today);
  }
  
  return { start: validatedStart, end: validatedEnd };
};

