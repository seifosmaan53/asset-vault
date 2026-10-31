// Copyright (c) 2025 Asset Vault. All rights reserved.

import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Invoice line tax and discount rates: numeric(5,2) -> numeric(7,4).
 *
 * Totals are computed with the rate as entered (shared invoice-money module),
 * which accepts up to four decimal places (e.g. 8.875%), while the column kept
 * only two (stored as 8.88%), so an invoice reloaded for editing recomputed
 * different totals. Widening keeps every existing value exactly (8.88 becomes
 * 8.8800) and changes no stored total; nothing is recalculated.
 *
 * down() narrows back to two decimals: rates entered with more are rounded
 * (half away from zero), which is the precision they had before this migration.
 */
export class WidenInvoiceItemRatePrecision1761000000000
  implements MigrationInterface
{
  name = 'WidenInvoiceItemRatePrecision1761000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "invoice_items"
        ALTER COLUMN "taxRate" TYPE numeric(7,4),
        ALTER COLUMN "discountRate" TYPE numeric(7,4)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "invoice_items"
        ALTER COLUMN "taxRate" TYPE numeric(5,2) USING round("taxRate", 2),
        ALTER COLUMN "discountRate" TYPE numeric(5,2) USING round("discountRate", 2)
    `);
  }
}
