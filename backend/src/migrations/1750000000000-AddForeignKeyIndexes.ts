import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add Indexes on Foreign Key Columns
 * Fixes Issue #26: Missing Database Index on Foreign Keys
 * 
 * Adds indexes on foreign key columns to improve join performance
 */
export class AddForeignKeyIndexes1750000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Invoice foreign keys
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_invoices_userId" 
      ON "invoices" ("userId");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_invoices_clientId" 
      ON "invoices" ("clientId");
    `);

    // Invoice items foreign keys
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_invoice_items_invoiceId" 
      ON "invoice_items" ("invoiceId");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_invoice_items_inventoryItemId" 
      ON "invoice_items" ("inventoryItemId")
      WHERE "inventoryItemId" IS NOT NULL;
    `);

    // Client foreign keys
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_clients_userId" 
      ON "clients" ("userId");
    `);

    // Store foreign keys
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_stores_userId" 
      ON "stores" ("userId");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_stores_clientId" 
      ON "stores" ("clientId");
    `);

    // Store item settings foreign keys
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_store_item_settings_storeId" 
      ON "store_item_settings" ("storeId");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_store_item_settings_inventoryItemId" 
      ON "store_item_settings" ("inventoryItemId");
    `);

    // Inventory items foreign keys
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_inventory_items_userId" 
      ON "inventory_items" ("userId");
    `);

    // Stock movements foreign keys
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_stock_movements_userId" 
      ON "stock_movements" ("userId");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_stock_movements_inventoryItemId" 
      ON "stock_movements" ("inventoryItemId");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_stock_movements_storeId" 
      ON "stock_movements" ("storeId")
      WHERE "storeId" IS NOT NULL;
    `);

    // Recurring invoices foreign keys
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_recurring_invoices_userId" 
      ON "recurring_invoices" ("userId");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_recurring_invoices_clientId" 
      ON "recurring_invoices" ("clientId");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_recurring_invoices_storeId" 
      ON "recurring_invoices" ("storeId")
      WHERE "storeId" IS NOT NULL;
    `);

    // Invoice templates foreign keys
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_invoice_templates_userId" 
      ON "invoice_templates" ("userId");
    `);

    // API keys foreign keys
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_api_keys_userId" 
      ON "api_keys" ("userId");
    `);

    // User organizations foreign keys
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_organizations_userId" 
      ON "user_organizations" ("userId");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_organizations_organizationId" 
      ON "user_organizations" ("organizationId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes in reverse order
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_organizations_organizationId";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_organizations_userId";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_api_keys_userId";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoice_templates_userId";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_recurring_invoices_storeId";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_recurring_invoices_clientId";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_recurring_invoices_userId";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_stock_movements_storeId";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_stock_movements_inventoryItemId";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_stock_movements_userId";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_inventory_items_userId";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_store_item_settings_inventoryItemId";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_store_item_settings_storeId";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_stores_clientId";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_stores_userId";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_clients_userId";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoice_items_inventoryItemId";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoice_items_invoiceId";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoices_clientId";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoices_userId";`);
  }
}

