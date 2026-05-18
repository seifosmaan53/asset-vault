import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStoreToInvoices1736000000000 implements MigrationInterface {
  name = 'AddStoreToInvoices1736000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add storeId column to invoices table
    await queryRunner.query(`
      ALTER TABLE "invoices" 
      ADD COLUMN IF NOT EXISTS "storeId" uuid
    `);

    // Add foreign key constraint for invoices.storeId -> stores.id
    await queryRunner.query(`
      ALTER TABLE "invoices" 
      ADD CONSTRAINT "FK_invoices_storeId" 
      FOREIGN KEY ("storeId") 
      REFERENCES "stores"("id") 
      ON DELETE SET NULL
    `);

    // Add storeId column to stock_movements table
    await queryRunner.query(`
      ALTER TABLE "stock_movements" 
      ADD COLUMN IF NOT EXISTS "storeId" uuid
    `);

    // Add foreign key constraint for stock_movements.storeId -> stores.id
    await queryRunner.query(`
      ALTER TABLE "stock_movements" 
      ADD CONSTRAINT "FK_stock_movements_storeId" 
      FOREIGN KEY ("storeId") 
      REFERENCES "stores"("id") 
      ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove foreign key constraint from stock_movements
    await queryRunner.query(`
      ALTER TABLE "stock_movements" 
      DROP CONSTRAINT IF EXISTS "FK_stock_movements_storeId"
    `);

    // Remove storeId column from stock_movements
    await queryRunner.query(`
      ALTER TABLE "stock_movements" 
      DROP COLUMN IF EXISTS "storeId"
    `);

    // Remove foreign key constraint from invoices
    await queryRunner.query(`
      ALTER TABLE "invoices" 
      DROP CONSTRAINT IF EXISTS "FK_invoices_storeId"
    `);

    // Remove storeId column from invoices
    await queryRunner.query(`
      ALTER TABLE "invoices" 
      DROP COLUMN IF EXISTS "storeId"
    `);
  }
}

