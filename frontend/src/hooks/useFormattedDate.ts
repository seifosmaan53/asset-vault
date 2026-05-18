import { useSettings } from './useSettings';
import { formatDate as formatDateUtil, formatDateTime as formatDateTimeUtil } from '../utils/dates';

/**
 * Hook to format dates using user's settings
 * Automatically applies user's date format, time format, and timezone preferences
 */
export const useFormattedDate = () => {
  const { settings } = useSettings();

  const formatDate = (date: string | Date): string => {
    return formatDateUtil(
      date,
      settings.dateFormat,
      settings.timeFormat,
      settings.timezone,
    );
  };

  const formatDateTime = (date: string | Date): string => {
    return formatDateTimeUtil(
      date,
      settings.dateFormat,
      settings.timeFormat,
      settings.timezone,
    );
  };

  return {
    formatDate,
    formatDateTime,
    dateFormat: settings.dateFormat || 'MM/DD/YYYY',
    timeFormat: settings.timeFormat || '12',
    timezone: settings.timezone || 'America/New_York',
  };
};

