// Copyright (c) 2025 Asset Vault. All rights reserved.

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Increase Decimal Precision for Financial Fields
 * Fixes Issue #9: Currency calculations may need higher precision
 * 
 * Changes decimal precision from (10,2) to (12,4) for financial calculations
 * to support higher precision currency values and calculations.
 * 
 * Affected tables:
 * - invoices: subtotal, taxTotal, discountTotal, total
 * - inventory_items: defaultUnitPrice, costPrice
 */
export class IncreaseDecimalPrecision1754000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Update invoice financial fields
    await queryRunner.query(`
      ALTER TABLE "invoices"
      ALTER COLUMN "subtotal" TYPE DECIMAL(12,4),
      ALTER COLUMN "taxTotal" TYPE DECIMAL(12,4),
      ALTER COLUMN "discountTotal" TYPE DECIMAL(12,4),
      ALTER COLUMN "total" TYPE DECIMAL(12,4);
    `);

    // Update inventory item price fields
    await queryRunner.query(`
      ALTER TABLE "inventory_items"
      ALTER COLUMN "defaultUnitPrice" TYPE DECIMAL(12,4),
      ALTER COLUMN "costPrice" TYPE DECIMAL(12,4);
    `);

    // Update invoice_items lineTotal for consistency
    await queryRunner.query(`
      ALTER TABLE "invoice_items"
      ALTER COLUMN "unitPrice" TYPE DECIMAL(12,4),
      ALTER COLUMN "lineTotal" TYPE DECIMAL(12,4);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert invoice financial fields
    await queryRunner.query(`
      ALTER TABLE "invoices"
      ALTER COLUMN "subtotal" TYPE DECIMAL(10,2),
      ALTER COLUMN "taxTotal" TYPE DECIMAL(10,2),
      ALTER COLUMN "discountTotal" TYPE DECIMAL(10,2),
      ALTER COLUMN "total" TYPE DECIMAL(10,2);
    `);

    // Revert inventory item price fields
    await queryRunner.query(`
      ALTER TABLE "inventory_items"
      ALTER COLUMN "defaultUnitPrice" TYPE DECIMAL(10,2),
      ALTER COLUMN "costPrice" TYPE DECIMAL(10,2);
    `);

    // Revert invoice_items lineTotal
    await queryRunner.query(`
      ALTER TABLE "invoice_items"
      ALTER COLUMN "unitPrice" TYPE DECIMAL(10,2),
      ALTER COLUMN "lineTotal" TYPE DECIMAL(10,2);
    `);
  }
}

