import { describe, it, expect } from 'vitest';
import { formatDate, formatDateTime } from './dates';

describe('dates', () => {
  describe('formatDate', () => {
    it('should format ISO date strings', () => {
      const date = '2024-12-06T10:30:00Z';
      const formatted = formatDate(date);
      expect(formatted).toMatch(/Dec 06, 2024/);
    });

    it('should format Date objects', () => {
      const date = new Date('2024-12-06T10:30:00Z');
      const formatted = formatDate(date);
      expect(formatted).toMatch(/Dec 06, 2024/);
    });

    it('should handle invalid dates gracefully', () => {
      const formatted = formatDate('invalid-date');
      expect(formatted).toBe('Invalid Date');
    });
  });

  describe('formatDateTime', () => {
    it('should format ISO date strings with time', () => {
      const date = '2024-12-06T10:30:00Z';
      const formatted = formatDateTime(date);
      expect(formatted).toMatch(/Dec 06, 2024/);
      expect(formatted).toMatch(/10:30/);
    });

    it('should format Date objects with time', () => {
      const date = new Date('2024-12-06T10:30:00Z');
      const formatted = formatDateTime(date);
      expect(formatted).toMatch(/Dec 06, 2024/);
    });

    it('should handle invalid dates gracefully', () => {
      const formatted = formatDateTime('invalid-date');
      expect(formatted).toBe('Invalid Date');
    });
  });
});

