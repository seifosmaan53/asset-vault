import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStoreIndexes1738000000000 implements MigrationInterface {
  name = 'AddStoreIndexes1738000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Invoices table indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_invoices_storeId" ON "invoices" ("storeId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_invoices_userId_storeId" ON "invoices" ("userId", "storeId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_invoices_status_storeId" ON "invoices" ("status", "storeId")
    `);

    // Stock movements table indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_stock_movements_storeId" ON "stock_movements" ("storeId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_stock_movements_userId_storeId" ON "stock_movements" ("userId", "storeId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_stock_movements_type_storeId" ON "stock_movements" ("type", "storeId")
    `);

    // Store item settings table indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_store_item_settings_storeId" ON "store_item_settings" ("storeId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_store_item_settings_currentStock" 
      ON "store_item_settings" ("currentStock") 
      WHERE "currentStock" < "minQty"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes in reverse order
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_store_item_settings_currentStock"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_store_item_settings_storeId"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_stock_movements_type_storeId"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_stock_movements_userId_storeId"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_stock_movements_storeId"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_invoices_status_storeId"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_invoices_userId_storeId"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_invoices_storeId"
    `);
  }
}

