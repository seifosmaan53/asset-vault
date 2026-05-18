import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentFieldsToInvoices1760000002000 implements MigrationInterface {
  name = 'AddPaymentFieldsToInvoices1760000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add paymentMethod column
    await queryRunner.query(`
      ALTER TABLE "invoices"
      ADD COLUMN IF NOT EXISTS "paymentMethod" varchar
    `);

    // Add amountPaid column for partial payments
    await queryRunner.query(`
      ALTER TABLE "invoices"
      ADD COLUMN IF NOT EXISTS "amountPaid" decimal(12,4) DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove amountPaid column
    await queryRunner.query(`
      ALTER TABLE "invoices"
      DROP COLUMN IF EXISTS "amountPaid"
    `);

    // Remove paymentMethod column
    await queryRunner.query(`
      ALTER TABLE "invoices"
      DROP COLUMN IF EXISTS "paymentMethod"
    `);
  }
}
