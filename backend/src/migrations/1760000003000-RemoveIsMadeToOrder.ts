// Copyright (c) 2025 Asset Vault. All rights reserved.

import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveIsMadeToOrder1760000003000 implements MigrationInterface {
  name = 'RemoveIsMadeToOrder1760000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remove isMadeToOrder column from invoice_items table
    await queryRunner.query(`
      ALTER TABLE "invoice_items" 
      DROP COLUMN IF EXISTS "isMadeToOrder"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-add isMadeToOrder column to invoice_items table (for rollback)
    await queryRunner.query(`
      ALTER TABLE "invoice_items" 
      ADD COLUMN IF NOT EXISTS "isMadeToOrder" boolean DEFAULT false
    `);
  }
}
