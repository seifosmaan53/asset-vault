// Copyright (c) 2025 Asset Vault. All rights reserved.

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add indexes on userId and organizationId columns
 * Fixes Issue #18-19: Missing indexes causing performance issues
 * 
 * This migration adds indexes to improve query performance for:
 * - Organization-scoped queries (organizationId with partial index WHERE IS NOT NULL)
 * - Composite indexes for common query patterns (organizationId, userId) - org first for multi-tenant
 * - Legacy NULL-org queries (userId WHERE organizationId IS NULL) for backward compatibility
 * 
 * Note: Single-column userId indexes are already created by migration 1750000000000-AddForeignKeyIndexes
 * This migration focuses on organizationId indexes, composite indexes, and legacy NULL-org support.
 * 
 * Query patterns observed:
 * - WHERE organizationId = ? (org-scoped - most common)
 * - WHERE organizationId = ? AND userId = ? (composite filter)
 * - WHERE organizationId = ? OR (organizationId IS NULL AND userId = ?) (legacy support)
 * 
 * Index strategy:
 * - Partial indexes on organizationId (WHERE IS NOT NULL) for org-scoped queries
 * - Composite indexes (organizationId, userId) - org first since it's more selective in multi-tenant
 * - Partial indexes on userId (WHERE organizationId IS NULL) for legacy personal rows
 */
export class AddUserIdAndOrganizationIdIndexes1751000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add userId index for user_settings (not covered by previous migration)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_settings_userId"
      ON "user_settings" ("userId");
    `);

    // Add organizationId indexes for tables that don't have composite indexes
    // Note: invoices, clients, inventory_items, user_settings, and stock_movements get composite indexes below,
    // which already support org-only queries via prefix scan, so we skip single-column org indexes for those
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_stores_organizationId"
      ON "stores" ("organizationId")
      WHERE "organizationId" IS NOT NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_recurring_invoices_organizationId"
      ON "recurring_invoices" ("organizationId")
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

    // Note: user_settings gets a composite index below which supports org-only queries via prefix scan

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_store_item_settings_organizationId"
      ON "store_item_settings" ("organizationId")
      WHERE "organizationId" IS NOT NULL;
    `);

    // Partial indexes for legacy NULL-org rows (critical for OR query performance)
    // These optimize the (organizationId IS NULL AND userId = ?) branch of legacy OR queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_invoices_userId_orgId_null"
      ON "invoices" ("userId")
      WHERE "organizationId" IS NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_clients_userId_orgId_null"
      ON "clients" ("userId")
      WHERE "organizationId" IS NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_inventory_items_userId_orgId_null"
      ON "inventory_items" ("userId")
      WHERE "organizationId" IS NULL;
    `);

    // Composite indexes for common query patterns
    // Order: (organizationId, userId) - organizationId first since:
    // 1. It's more selective in multi-tenant systems (many users per org)
    // 2. Supports WHERE organizationId = ? (index prefix usage) - eliminates need for single-column org index
    // 3. Supports WHERE organizationId = ? AND userId = ? (full index usage)
    // 4. Single-column userId indexes already exist from previous migration
    // 
    // Note: These composite indexes replace the need for single-column organizationId indexes
    // on these tables, reducing write overhead while maintaining query performance
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_invoices_organizationId_userId"
      ON "invoices" ("organizationId", "userId")
      WHERE "organizationId" IS NOT NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_clients_organizationId_userId"
      ON "clients" ("organizationId", "userId")
      WHERE "organizationId" IS NOT NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_inventory_items_organizationId_userId"
      ON "inventory_items" ("organizationId", "userId")
      WHERE "organizationId" IS NOT NULL;
    `);

    // Composite index for user_settings
    // Supports both WHERE organizationId = ? (prefix scan) and WHERE organizationId = ? AND userId = ?
    // Single-column userId index already exists from previous migration
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_settings_organizationId_userId"
      ON "user_settings" ("organizationId", "userId")
      WHERE "organizationId" IS NOT NULL;
    `);

    // Composite index for stock_movements to optimize org-scoped queries with inventoryItemId filter and createdAt sort
    // Query pattern: WHERE organizationId = ? AND inventoryItemId = ? ORDER BY createdAt DESC
    // Also supports: WHERE organizationId = ? (prefix scan) - eliminates need for single-column org index
    // Note: There's already an index on (inventoryItemId, organizationId) from migration 1748000000000,
    // but this org-first index with createdAt helps with org-scoped "recent movements" queries and sorting.
    // The composite index can serve org-only queries via prefix scan, so we skip the single-column org index.
    // 
    // IMPORTANT: This index does NOT help org-wide activity feeds (WHERE organizationId = ? ORDER BY createdAt DESC)
    // because createdAt is only ordered within each inventoryItemId group. If you add an org activity feed endpoint,
    // consider adding: (organizationId, createdAt DESC) WHERE organizationId IS NOT NULL
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_stock_movements_org_inventoryItem_createdAt"
      ON "stock_movements" ("organizationId", "inventoryItemId", "createdAt" DESC)
      WHERE "organizationId" IS NOT NULL;
    `);

    // Note: Invoices primarily sort by issueDate DESC (not createdAt), so we skip (organizationId, createdAt) index.
    // The composite (organizationId, userId) index already supports org-scoped filtering efficiently.
    // 
    // IMPORTANT: If invoice list queries (WHERE organizationId = ? ORDER BY issueDate DESC LIMIT N) become a bottleneck,
    // consider adding: (organizationId, issueDate DESC) WHERE organizationId IS NOT NULL
    // The current (organizationId, userId) index helps filtering but doesn't optimize the issueDate sort.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove composite indexes first (reverse order of creation)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_stock_movements_org_inventoryItem_createdAt";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_settings_organizationId_userId";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_inventory_items_organizationId_userId";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_clients_organizationId_userId";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoices_organizationId_userId";`);

    // Remove legacy NULL-org partial indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_inventory_items_userId_orgId_null";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_clients_userId_orgId_null";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoices_userId_orgId_null";`);

    // Remove organizationId partial indexes (only for tables without composite indexes)
    // Note: invoices, clients, inventory_items, user_settings, and stock_movements don't need single-column
    // org indexes since their composite indexes support org-only queries via prefix scan
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_store_item_settings_organizationId";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_api_keys_organizationId";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoice_templates_organizationId";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_recurring_invoices_organizationId";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_stores_organizationId";`);

    // Remove userId index for user_settings
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_settings_userId";`);
  }
}

