import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemovePrintSpecifications1757000000000 implements MigrationInterface {
  name = 'RemovePrintSpecifications1757000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remove printSpecificationTemplates column from clients table
    await queryRunner.query(`
      ALTER TABLE "clients" 
      DROP COLUMN IF EXISTS "printSpecificationTemplates"
    `);

    // Remove printSpecifications column from invoice_items table
    await queryRunner.query(`
      ALTER TABLE "invoice_items" 
      DROP COLUMN IF EXISTS "printSpecifications"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-add printSpecificationTemplates column to clients table
    await queryRunner.query(`
      ALTER TABLE "clients" 
      ADD COLUMN IF NOT EXISTS "printSpecificationTemplates" jsonb
    `);

    // Re-add printSpecifications column to invoice_items table
    await queryRunner.query(`
      ALTER TABLE "invoice_items" 
      ADD COLUMN IF NOT EXISTS "printSpecifications" jsonb
    `);
  }
}

