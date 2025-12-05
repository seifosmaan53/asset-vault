import { format, parseISO, isValid } from 'date-fns';

export const formatDate = (date: string | Date, formatStr: string = 'MMM dd, yyyy'): string => {
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(d)) return '';
    return format(d, formatStr);
  } catch {
    return '';
  }
};

export const formatDateTime = (date: string | Date): string => {
  return formatDate(date, 'MMM dd, yyyy HH:mm');
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

