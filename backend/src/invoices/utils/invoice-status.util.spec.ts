// Copyright (c) 2025 Asset Vault. All rights reserved.

import {
  validateStatusTransition,
  validateStatusBusinessRules,
  shouldAffectStock,
  getValidTransitions,
  isTerminalStatus,
  InvoiceStatus,
} from './invoice-status.util';
import { BadRequestException } from '@nestjs/common';

describe('invoice-status.util', () => {
  describe('validateStatusTransition', () => {
    it('should allow valid transitions', () => {
      expect(() => validateStatusTransition('draft', 'sent')).not.toThrow();
      expect(() => validateStatusTransition('draft', 'paid')).not.toThrow(); // Allow direct draft to paid
      expect(() => validateStatusTransition('draft', 'cancelled')).not.toThrow();
      expect(() => validateStatusTransition('sent', 'paid')).not.toThrow();
      expect(() => validateStatusTransition('sent', 'overdue')).not.toThrow();
      expect(() => validateStatusTransition('overdue', 'paid')).not.toThrow();
    });

    it('should allow same status (no-op)', () => {
      expect(() => validateStatusTransition('draft', 'draft')).not.toThrow();
      expect(() => validateStatusTransition('paid', 'paid')).not.toThrow();
    });

    it('should reject invalid transitions', () => {
      expect(() => validateStatusTransition('paid', 'draft')).toThrow(BadRequestException);
      expect(() => validateStatusTransition('cancelled', 'sent')).toThrow(BadRequestException);
      expect(() => validateStatusTransition('paid', 'sent')).toThrow(BadRequestException);
    });

    it('should provide helpful error messages', () => {
      try {
        validateStatusTransition('paid', 'draft');
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).message).toContain('Invalid status transition');
        expect((error as BadRequestException).message).toContain('paid');
        expect((error as BadRequestException).message).toContain('draft');
      }
    });
  });

  describe('validateStatusBusinessRules', () => {
    it('should allow marking as paid with valid invoice', () => {
      expect(() => validateStatusBusinessRules('paid', 100, 1)).not.toThrow();
    });

    it('should reject marking as paid with zero total', () => {
      expect(() => validateStatusBusinessRules('paid', 0, 1)).toThrow(BadRequestException);
      expect(() => validateStatusBusinessRules('paid', -10, 1)).toThrow(BadRequestException);
    });

    it('should reject marking as paid with no items', () => {
      expect(() => validateStatusBusinessRules('paid', 100, 0)).toThrow(BadRequestException);
    });

    it('should reject marking as sent without client email', () => {
      expect(() => validateStatusBusinessRules('sent', 100, 1, null)).toThrow(BadRequestException);
      expect(() => validateStatusBusinessRules('sent', 100, 1, '')).toThrow(BadRequestException);
    });

    it('should allow marking as sent with client email', () => {
      expect(() => validateStatusBusinessRules('sent', 100, 1, 'client@example.com')).not.toThrow();
    });
  });

  describe('shouldAffectStock', () => {
    it('should return true when moving from draft to sent', () => {
      expect(shouldAffectStock('draft', 'sent')).toBe(true);
    });

    it('should return true when moving from draft to paid', () => {
      expect(shouldAffectStock('draft', 'paid')).toBe(true);
    });

    it('should return true when moving from sent to paid', () => {
      expect(shouldAffectStock('sent', 'paid')).toBe(true);
    });

    it('should return true when moving to cancelled from active status', () => {
      expect(shouldAffectStock('sent', 'cancelled')).toBe(true);
      expect(shouldAffectStock('paid', 'cancelled')).toBe(true);
    });

    it('should return false when staying in draft', () => {
      expect(shouldAffectStock('draft', 'draft')).toBe(false);
    });

    it('should return false when moving from sent to draft', () => {
      expect(shouldAffectStock('sent', 'draft')).toBe(false);
    });
  });

  describe('getValidTransitions', () => {
    it('should return valid transitions for draft', () => {
      const transitions = getValidTransitions('draft');
      expect(transitions).toContain('sent');
      expect(transitions).toContain('paid'); // Allow direct draft to paid
      expect(transitions).toContain('cancelled');
    });

    it('should return empty array for cancelled (terminal)', () => {
      const transitions = getValidTransitions('cancelled');
      expect(transitions).toHaveLength(0);
    });
  });

  describe('isTerminalStatus', () => {
    it('should return true for cancelled', () => {
      expect(isTerminalStatus('cancelled')).toBe(true);
    });

    it('should return false for non-terminal statuses', () => {
      expect(isTerminalStatus('draft')).toBe(false);
      expect(isTerminalStatus('sent')).toBe(false);
      expect(isTerminalStatus('paid')).toBe(false);
      expect(isTerminalStatus('overdue')).toBe(false);
    });
  });
});

