import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStoreToRecurringInvoices1739000000000 implements MigrationInterface {
  name = 'AddStoreToRecurringInvoices1739000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add storeId column to recurring_invoices table
    await queryRunner.query(`
      ALTER TABLE "recurring_invoices" 
      ADD COLUMN IF NOT EXISTS "storeId" uuid
    `);

    // Add foreign key constraint for recurring_invoices.storeId -> stores.id
    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'FK_recurring_invoices_storeId'
        ) THEN
          ALTER TABLE "recurring_invoices" 
          ADD CONSTRAINT "FK_recurring_invoices_storeId" 
          FOREIGN KEY ("storeId") 
          REFERENCES "stores"("id") 
          ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove foreign key constraint from recurring_invoices
    await queryRunner.query(`
      ALTER TABLE "recurring_invoices" 
      DROP CONSTRAINT IF EXISTS "FK_recurring_invoices_storeId"
    `);

    // Remove storeId column from recurring_invoices
    await queryRunner.query(`
      ALTER TABLE "recurring_invoices" 
      DROP COLUMN IF EXISTS "storeId"
    `);
  }
}

