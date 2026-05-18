import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrganizationIdIndexes1748000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add performance indexes on organizationId for frequently queried tables
    // These indexes improve query performance when filtering by organizationId
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_clients_organizationId"
      ON "clients" ("organizationId")
      WHERE "organizationId" IS NOT NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_invoices_organizationId"
      ON "invoices" ("organizationId")
      WHERE "organizationId" IS NOT NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_recurring_invoices_organizationId"
      ON "recurring_invoices" ("organizationId")
      WHERE "organizationId" IS NOT NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_stock_movements_organizationId"
      ON "stock_movements" ("organizationId")
      WHERE "organizationId" IS NOT NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_stock_movements_inventory_org"
      ON "stock_movements" ("inventoryItemId", "organizationId")
      WHERE "organizationId" IS NOT NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_store_item_settings_organizationId"
      ON "store_item_settings" ("organizationId")
      WHERE "organizationId" IS NOT NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_invoice_templates_organizationId"
      ON "invoice_templates" ("organizationId")
      WHERE "organizationId" IS NOT NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_api_keys_organizationId"
      ON "api_keys" ("organizationId")
      WHERE "organizationId" IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_clients_organizationId";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoices_organizationId";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_recurring_invoices_organizationId";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_stock_movements_organizationId";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_stock_movements_inventory_org";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_store_item_settings_organizationId";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoice_templates_organizationId";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_api_keys_organizationId";`);
  }
}

