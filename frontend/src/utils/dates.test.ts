import { describe, it, expect } from 'vitest';
import { formatDate, formatDateTime } from './dates';

/* These tests were written when formatDate hardcoded "MMM dd, yyyy" and returned the
   literal string 'Invalid Date' for junk input. Both behaviours changed and the tests
   were never updated, so all six failed:

   - the format is now user-configurable (`userDateFormat`, falling back to global
     settings, defaulting to 'MM/DD/YYYY'), so the default output is 12/06/2024;
   - unparseable input returns an EMPTY STRING, which is deliberate — rendering the
     words "Invalid Date" into an invoice is worse than rendering nothing.

   The suite now asserts the current contract and also covers the configurable format,
   which had no test at all. */
describe('dates', () => {
  describe('formatDate', () => {
    it('formats ISO date strings using the default MM/DD/YYYY', () => {
      expect(formatDate('2024-12-06T10:30:00Z')).toMatch(/12\/06\/2024/);
    });

    it('formats Date objects', () => {
      expect(formatDate(new Date('2024-12-06T10:30:00Z'))).toMatch(/12\/06\/2024/);
    });

    it('treats a bare YYYY-MM-DD as a local calendar date, with no timezone shift', () => {
      // A Postgres DATE must not drift to the 5th for anyone west of UTC.
      expect(formatDate('2024-12-06')).toMatch(/12\/06\/2024/);
    });

    it('honours an explicit date format', () => {
      expect(formatDate('2024-12-06T10:30:00Z', 'DD/MM/YYYY')).toMatch(/06\/12\/2024/);
      expect(formatDate('2024-12-06T10:30:00Z', 'YYYY-MM-DD')).toMatch(/2024-12-06/);
    });

    it('returns an empty string for unparseable input rather than "Invalid Date"', () => {
      expect(formatDate('invalid-date')).toBe('');
    });

    it('returns an empty string for null and undefined', () => {
      expect(formatDate(null)).toBe('');
      expect(formatDate(undefined)).toBe('');
    });
  });

  describe('formatDateTime', () => {
    it('includes both the date and the time', () => {
      const formatted = formatDateTime('2024-12-06T10:30:00Z');
      expect(formatted).toMatch(/12\/06\/2024/);
      expect(formatted).toMatch(/\d{1,2}:\d{2}/);
    });

    it('formats Date objects', () => {
      expect(formatDateTime(new Date('2024-12-06T10:30:00Z'))).toMatch(/12\/06\/2024/);
    });

    it('returns an empty string for unparseable input', () => {
      expect(formatDateTime('invalid-date')).toBe('');
    });
  });
});
