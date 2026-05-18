// Copyright (c) 2025 Asset Vault. All rights reserved.

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvoiceStatusHistory1758000000000 implements MigrationInterface {
  name = 'AddInvoiceStatusHistory1758000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create invoice_status_history table
    // Use snake_case column names to match TypeORM default naming strategy
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "invoice_status_history" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "invoiceId" uuid NOT NULL,
        "fromStatus" character varying NOT NULL,
        "toStatus" character varying NOT NULL,
        "userId" character varying NOT NULL,
        "note" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_invoice_status_history" PRIMARY KEY ("id")
      )
    `);

    // Add foreign key constraint to invoices table
    // Check if constraint already exists before adding
    const constraintExists = await queryRunner.query(`
      SELECT 1 FROM pg_constraint WHERE conname = 'FK_invoice_status_history_invoiceId'
    `);
    
    if (constraintExists.length === 0) {
      await queryRunner.query(`
        ALTER TABLE "invoice_status_history" 
        ADD CONSTRAINT "FK_invoice_status_history_invoiceId" 
        FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      `);
    }

    // Add index on invoiceId for faster lookups
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_invoice_status_history_invoice_id" 
      ON "invoice_status_history" ("invoiceId")
    `);

    // Add index on userId for user-scoped queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_invoice_status_history_user_id" 
      ON "invoice_status_history" ("userId")
    `);

    // Add index on createdAt for time-based queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_invoice_status_history_created_at" 
      ON "invoice_status_history" ("createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_invoice_status_history_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_invoice_status_history_user_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_invoice_status_history_invoice_id"`);

    // Drop foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "invoice_status_history" 
      DROP CONSTRAINT IF EXISTS "FK_invoice_status_history_invoiceId"
    `);

    // Drop table
    await queryRunner.query(`DROP TABLE IF EXISTS "invoice_status_history"`);
  }
}

