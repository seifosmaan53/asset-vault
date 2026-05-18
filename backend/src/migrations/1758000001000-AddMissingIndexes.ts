// Copyright (c) 2025 Asset Vault. All rights reserved.
// Migration to add missing indexes for performance optimization
// Fixes issues #171-185: Database Performance & Queries

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMissingIndexes1758000001000 implements MigrationInterface {
  name = 'AddMissingIndexes1758000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // FIX #171: Missing index on invoice status
    // Use "deletedAt" (camelCase) to match TypeORM column naming
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status) WHERE "deletedAt" IS NULL;
    `);

    // FIX #172: Missing index on invoice type
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_invoices_type ON invoices(type) WHERE "deletedAt" IS NULL;
    `);

    // FIX #173: Composite index on userId + status (common query pattern)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_invoices_user_status ON invoices("userId", status) WHERE "deletedAt" IS NULL;
    `);

    // FIX #175: Missing indexes on invoice date fields
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON invoices("issueDate") WHERE "deletedAt" IS NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices("dueDate") WHERE "deletedAt" IS NULL;
    `);

    // FIX #176: Full-text search index for invoice search (using trigram for ILIKE)
    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS pg_trgm;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_invoices_number_trgm ON invoices USING gin(number gin_trgm_ops) WHERE "deletedAt" IS NULL;
    `);

    // FIX #177: Missing index on client name
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_clients_name_trgm ON clients USING gin(name gin_trgm_ops) WHERE "deletedAt" IS NULL;
    `);

    // FIX #178: Unique index on inventory SKU (prevents duplicates)
    // Note: inventory_items doesn't have deletedAt (no soft delete)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_items_sku_user ON inventory_items(sku, "userId");
    `);

    // FIX #179: Index on inventory userId (already exists but ensure it's there)
    // Note: inventory_items doesn't have deletedAt (no soft delete)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_items_user_id ON inventory_items("userId");
    `);

    // FIX #180: Missing index on stock movements date
    // Check if column is created_at or createdAt
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements("createdAt");
    `);

    // FIX #181: Composite index on store item settings
    // Note: store_item_settings doesn't have deletedAt (no soft delete)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_store_item_settings_store_item ON store_item_settings("storeId", "inventoryItemId");
    `);

    // FIX #183: Index on deletedAt for soft delete queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_invoices_deleted_at ON invoices("deletedAt") WHERE "deletedAt" IS NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_clients_deleted_at ON clients("deletedAt") WHERE "deletedAt" IS NULL;
    `);
    // Note: inventory_items doesn't have deletedAt (no soft delete), so no index needed

    // FIX #184: Indexes on foreign keys
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices("clientId") WHERE "deletedAt" IS NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_invoices_store_id ON invoices("storeId") WHERE "deletedAt" IS NULL;
    `);
    // Note: invoice_items uses camelCase column names (invoiceId, inventoryItemId)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items("invoiceId");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_invoice_items_inventory_item_id ON invoice_items("inventoryItemId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes in reverse order
    await queryRunner.query(`DROP INDEX IF EXISTS idx_invoice_items_inventory_item_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_invoice_items_invoice_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_invoices_store_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_invoices_client_id;`);
    // Note: idx_inventory_items_deleted_at was never created (inventory_items has no deletedAt)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_clients_deleted_at;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_invoices_deleted_at;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_store_item_settings_store_item;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_stock_movements_created_at;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_inventory_items_user_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_inventory_items_sku_user;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_clients_name_trgm;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_invoices_number_trgm;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_invoices_due_date;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_invoices_issue_date;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_invoices_user_status;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_invoices_type;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_invoices_status;`);
  }
}

