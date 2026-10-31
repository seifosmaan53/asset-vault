import { useSettings } from './useSettings';
import { formatDate as formatDateUtil, formatDateTime as formatDateTimeUtil } from '../utils/dates';

/**
 * Hook to format dates using user's settings
 * Applies the user's date and time format preferences. The timezone preference is
 * returned for display but not applied to formatting yet.
 */
export const useFormattedDate = () => {
  const { settings } = useSettings();

  const formatDate = (date: string | Date): string => {
    return formatDateUtil(date, settings.dateFormat);
  };

  const formatDateTime = (date: string | Date): string => {
    return formatDateTimeUtil(date, settings.dateFormat, settings.timeFormat);
  };

  return {
    formatDate,
    formatDateTime,
    dateFormat: settings.dateFormat || 'MM/DD/YYYY',
    timeFormat: settings.timeFormat || '12',
    timezone: settings.timezone || 'America/New_York',
  };
};

