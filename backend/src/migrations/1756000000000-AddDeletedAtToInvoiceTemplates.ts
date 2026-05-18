import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeletedAtToInvoiceTemplates1756000000000 implements MigrationInterface {
  name = 'AddDeletedAtToInvoiceTemplates1756000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add deletedAt column to invoice_templates table for soft delete support
    await queryRunner.query(`
      ALTER TABLE "invoice_templates" 
      ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove deletedAt column
    await queryRunner.query(`
      ALTER TABLE "invoice_templates" 
      DROP COLUMN IF EXISTS "deletedAt"
    `);
  }
}

