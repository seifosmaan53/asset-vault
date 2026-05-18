import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add Performance Indexes for Category 5 Issues (#171-185)
 * Fixes all database performance issues by adding missing indexes
 */
export class AddPerformanceIndexes1759000000000 implements MigrationInterface {
  name = 'AddPerformanceIndexes1759000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // FIX #171: Missing Index on Invoice Status
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_invoices_status" 
      ON "invoices" ("status")
    `);

    // FIX #172: Missing Index on Invoice Type
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_invoices_type" 
      ON "invoices" ("type")
    `);

    // FIX #173: Missing Composite Index on UserId + Status
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_invoices_userId_status" 
      ON "invoices" ("userId", "status")
    `);

    // FIX #175: Missing Index on Invoice Date Fields
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_invoices_issueDate" 
      ON "invoices" ("issueDate")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_invoices_dueDate" 
      ON "invoices" ("dueDate")
    `);

    // FIX #176: Full Table Scan on Search - Add trigram index for ILIKE searches
    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS pg_trgm
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_invoices_number_trgm" 
      ON "invoices" USING gin ("number" gin_trgm_ops)
    `);

    // FIX #177: Missing Index on Client Name
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_clients_name" 
      ON "clients" ("name")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_clients_name_trgm" 
      ON "clients" USING gin ("name" gin_trgm_ops)
    `);

    // FIX #178: Missing Unique Index on Inventory SKU (already exists as UQ_inventory_items_sku, but ensure it's indexed)
    // Note: inventory_items doesn't have deletedAt (no soft delete)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_inventory_items_sku_userId" 
      ON "inventory_items" ("sku", "userId")
    `);

    // FIX #179: Query Not Using Index - Ensure userId index exists
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_inventory_items_userId" 
      ON "inventory_items" ("userId")
    `);

    // FIX #180: Missing Index on Stock Movements Date
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_stock_movements_createdAt" 
      ON "stock_movements" ("createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_stock_movements_inventoryItemId_createdAt" 
      ON "stock_movements" ("inventoryItemId", "createdAt")
    `);

    // FIX #181: Missing Index on Store Item Settings
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_store_item_settings_storeId_inventoryItemId" 
      ON "store_item_settings" ("storeId", "inventoryItemId")
    `);

    // FIX #183: Soft Delete Queries Not Optimized
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_invoices_deletedAt" 
      ON "invoices" ("deletedAt") 
      WHERE "deletedAt" IS NULL
    `);
    // Note: inventory_items doesn't have deletedAt (no soft delete), so no index needed
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_clients_deletedAt" 
      ON "clients" ("deletedAt") 
      WHERE "deletedAt" IS NULL
    `);

    // FIX #184: Missing Index on Foreign Keys (ensure all FKs are indexed)
    // Invoice foreign keys
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_invoices_clientId" 
      ON "invoices" ("clientId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_invoices_storeId" 
      ON "invoices" ("storeId")
    `);
    
    // Invoice items foreign keys
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_invoice_items_invoiceId" 
      ON "invoice_items" ("invoiceId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_invoice_items_inventoryItemId" 
      ON "invoice_items" ("inventoryItemId")
    `);
    
    // Stock movements foreign keys
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_stock_movements_inventoryItemId" 
      ON "stock_movements" ("inventoryItemId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_stock_movements_storeId" 
      ON "stock_movements" ("storeId")
    `);
    
    // Store item settings foreign keys
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_store_item_settings_storeId" 
      ON "store_item_settings" ("storeId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_store_item_settings_inventoryItemId" 
      ON "store_item_settings" ("inventoryItemId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop all indexes created in up()
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoices_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoices_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoices_userId_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoices_issueDate"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoices_dueDate"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoices_number_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_clients_name"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_clients_name_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_inventory_items_sku_userId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_inventory_items_userId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_stock_movements_createdAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_stock_movements_inventoryItemId_createdAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_store_item_settings_storeId_inventoryItemId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoices_deletedAt"`);
    // Note: IDX_inventory_items_deletedAt was never created (inventory_items has no deletedAt)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_clients_deletedAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoices_clientId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoices_storeId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoice_items_invoiceId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoice_items_inventoryItemId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_stock_movements_inventoryItemId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_stock_movements_storeId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_store_item_settings_storeId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_store_item_settings_inventoryItemId"`);
  }
}

