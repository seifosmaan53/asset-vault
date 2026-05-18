import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPrintSpecsAndShape1741000000000 implements MigrationInterface {
  name = 'AddPrintSpecsAndShape1741000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add shape column to inventory_items table
    await queryRunner.query(`
      ALTER TABLE "inventory_items" 
      ADD COLUMN IF NOT EXISTS "shape" varchar
    `);

    // Add printSpecifications column to invoice_items table
    await queryRunner.query(`
      ALTER TABLE "invoice_items" 
      ADD COLUMN IF NOT EXISTS "printSpecifications" jsonb
    `);

    // Add isMadeToOrder column to invoice_items table
    await queryRunner.query(`
      ALTER TABLE "invoice_items" 
      ADD COLUMN IF NOT EXISTS "isMadeToOrder" boolean DEFAULT false
    `);

    // Add printSpecificationTemplates column to clients table
    await queryRunner.query(`
      ALTER TABLE "clients" 
      ADD COLUMN IF NOT EXISTS "printSpecificationTemplates" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove printSpecificationTemplates column from clients
    await queryRunner.query(`
      ALTER TABLE "clients" 
      DROP COLUMN IF EXISTS "printSpecificationTemplates"
    `);

    // Remove isMadeToOrder column from invoice_items
    await queryRunner.query(`
      ALTER TABLE "invoice_items" 
      DROP COLUMN IF EXISTS "isMadeToOrder"
    `);

    // Remove printSpecifications column from invoice_items
    await queryRunner.query(`
      ALTER TABLE "invoice_items" 
      DROP COLUMN IF EXISTS "printSpecifications"
    `);

    // Remove shape column from inventory_items
    await queryRunner.query(`
      ALTER TABLE "inventory_items" 
      DROP COLUMN IF EXISTS "shape"
    `);
  }
}

