import { describe, it, expect } from 'vitest';
import { formatCurrency } from './formatters';

describe('formatters', () => {
  describe('formatCurrency', () => {
    it('should format positive numbers correctly', () => {
      expect(formatCurrency(1000)).toBe('$1,000.00');
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('should format negative numbers correctly', () => {
      expect(formatCurrency(-100)).toBe('-$100.00');
      expect(formatCurrency(-1234.56)).toBe('-$1,234.56');
    });

    it('should handle decimal values', () => {
      expect(formatCurrency(99.99)).toBe('$99.99');
      expect(formatCurrency(0.01)).toBe('$0.01');
      expect(formatCurrency(1000.1)).toBe('$1,000.10');
    });

    it('should handle large numbers', () => {
      expect(formatCurrency(1000000)).toBe('$1,000,000.00');
      expect(formatCurrency(1234567.89)).toBe('$1,234,567.89');
    });

    it('should handle string numbers', () => {
      expect(formatCurrency('1000' as any)).toBe('$1,000.00');
      expect(formatCurrency('1234.56' as any)).toBe('$1,234.56');
    });
  });
});

