// Copyright (c) 2025 Asset Vault. All rights reserved.

import { computeInvoiceTotalsCents, invoiceTotalsToMoney } from './invoice-totals.util';
import { InvoiceItemDto } from '../dto';
import { BadRequestException } from '@nestjs/common';

describe('computeInvoiceTotalsCents', () => {
  describe('Basic calculations', () => {
    it('should calculate totals correctly with single item', () => {
      const items: InvoiceItemDto[] = [
        {
          quantity: 2,
          unitPrice: 100,
          taxRate: 10,
          discountRate: 5,
          description: 'Test item',
        },
      ];

      const result = computeInvoiceTotalsCents(items);
      const totals = invoiceTotalsToMoney(result);

      // Line subtotal: 2 * 100 = 200
      expect(totals.lines[0].lineSubtotal).toBe(200);
      // Line discount: 200 * 0.05 = 10
      expect(totals.lines[0].lineDiscount).toBe(10);
      // Line after discount: 200 - 10 = 190
      // Line tax: 190 * 0.10 = 19
      expect(totals.lines[0].lineTax).toBe(19);
      // Line total: 190 + 19 = 209
      expect(totals.lines[0].lineTotal).toBe(209);

      // Invoice totals
      expect(totals.invoice.subtotal).toBe(200);
      expect(totals.invoice.discount).toBe(10);
      expect(totals.invoice.tax).toBe(19);
      expect(totals.invoice.total).toBe(209);
    });

    it('should calculate totals correctly with multiple items', () => {
      const items: InvoiceItemDto[] = [
        {
          quantity: 2,
          unitPrice: 100,
          taxRate: 10,
          discountRate: 5,
          description: 'Item 1',
        },
        {
          quantity: 3,
          unitPrice: 50,
          taxRate: 8,
          discountRate: 0,
          description: 'Item 2',
        },
      ];

      const result = computeInvoiceTotalsCents(items);
      const totals = invoiceTotalsToMoney(result);

      // Item 1: 200 - 10 + 19 = 209
      // Item 2: 150 - 0 + 12 = 162
      expect(totals.invoice.subtotal).toBe(350);
      expect(totals.invoice.discount).toBe(10);
      expect(totals.invoice.tax).toBe(31); // 19 + 12
      expect(totals.invoice.total).toBe(371); // 350 - 10 + 31
    });

    it('should handle zero tax and discount', () => {
      const items: InvoiceItemDto[] = [
        {
          quantity: 1,
          unitPrice: 100,
          taxRate: 0,
          discountRate: 0,
          description: 'Item',
        },
      ];

      const result = computeInvoiceTotalsCents(items);
      const totals = invoiceTotalsToMoney(result);

      expect(totals.invoice.subtotal).toBe(100);
      expect(totals.invoice.discount).toBe(0);
      expect(totals.invoice.tax).toBe(0);
      expect(totals.invoice.total).toBe(100);
    });
  });

  describe('Edge cases', () => {
    it('should reject negative totals when discount exceeds subtotal', () => {
      const items: InvoiceItemDto[] = [
        {
          quantity: 1,
          unitPrice: 100,
          taxRate: 0,
          discountRate: 150, // 150% discount exceeds subtotal
          description: 'Item',
        },
      ];

      expect(() => computeInvoiceTotalsCents(items)).toThrow(BadRequestException);
      expect(() => computeInvoiceTotalsCents(items)).toThrow(/discount.*exceeds subtotal/i);
    });

    it('should reject decimal quantities', () => {
      const items: InvoiceItemDto[] = [
        {
          quantity: 1.5, // Decimal quantity
          unitPrice: 100,
          taxRate: 0,
          discountRate: 0,
          description: 'Item',
        },
      ];

      expect(() => computeInvoiceTotalsCents(items)).toThrow(BadRequestException);
      expect(() => computeInvoiceTotalsCents(items)).toThrow(/quantity.*integer/i);
    });

    it('should reject zero quantity', () => {
      const items: InvoiceItemDto[] = [
        {
          quantity: 0,
          unitPrice: 100,
          taxRate: 0,
          discountRate: 0,
          description: 'Item',
        },
      ];

      expect(() => computeInvoiceTotalsCents(items)).toThrow(BadRequestException);
      expect(() => computeInvoiceTotalsCents(items)).toThrow(/quantity.*at least 1/i);
    });

    it('should handle empty items array', () => {
      const result = computeInvoiceTotalsCents([]);
      const totals = invoiceTotalsToMoney(result);

      expect(totals.lines).toHaveLength(0);
      expect(totals.invoice.subtotal).toBe(0);
      expect(totals.invoice.discount).toBe(0);
      expect(totals.invoice.tax).toBe(0);
      expect(totals.invoice.total).toBe(0);
    });

    it('should handle 100% discount correctly', () => {
      const items: InvoiceItemDto[] = [
        {
          quantity: 1,
          unitPrice: 100,
          taxRate: 10,
          discountRate: 100, // 100% discount
          description: 'Item',
        },
      ];

      const result = computeInvoiceTotalsCents(items);
      const totals = invoiceTotalsToMoney(result);

      expect(totals.lines[0].lineSubtotal).toBe(100);
      expect(totals.lines[0].lineDiscount).toBe(100);
      expect(totals.lines[0].lineTax).toBe(0); // Tax on 0 = 0
      expect(totals.lines[0].lineTotal).toBe(0);
      expect(totals.invoice.total).toBe(0);
    });
  });

  describe('Rounding', () => {
    it('should round per-line (per-line rounding policy)', () => {
      const items: InvoiceItemDto[] = [
        {
          quantity: 3,
          unitPrice: 33.33, // 99.99 total
          taxRate: 10,
          discountRate: 0,
          description: 'Item',
        },
      ];

      const result = computeInvoiceTotalsCents(items);
      const totals = invoiceTotalsToMoney(result);

      // Line subtotal: 3 * 33.33 = 99.99
      // Line tax: 99.99 * 0.10 = 9.999 -> rounded to 10.00
      // Line total: 99.99 + 10.00 = 109.99
      expect(totals.lines[0].lineSubtotal).toBeCloseTo(99.99, 2);
      expect(totals.lines[0].lineTax).toBeCloseTo(10.00, 2);
      expect(totals.lines[0].lineTotal).toBeCloseTo(109.99, 2);
    });
  });
});

