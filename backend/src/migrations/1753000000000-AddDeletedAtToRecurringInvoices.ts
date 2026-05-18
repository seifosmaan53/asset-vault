import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeletedAtToRecurringInvoices1753000000000 implements MigrationInterface {
  name = 'AddDeletedAtToRecurringInvoices1753000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add deletedAt column to recurring_invoices table for soft delete support
    await queryRunner.query(`
      ALTER TABLE "recurring_invoices" 
      ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove deletedAt column
    await queryRunner.query(`
      ALTER TABLE "recurring_invoices" 
      DROP COLUMN IF EXISTS "deletedAt"
    `);
  }
}

