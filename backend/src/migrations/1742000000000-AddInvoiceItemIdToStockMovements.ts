import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvoiceItemIdToStockMovements1742000000000 implements MigrationInterface {
  name = 'AddInvoiceItemIdToStockMovements1742000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add invoiceItemId column
    await queryRunner.query(`
      ALTER TABLE "stock_movements"
      ADD COLUMN IF NOT EXISTS "invoiceItemId" uuid
    `);

    // Add FK (SET NULL so old movements can remain even if invoice items change)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_stock_movements_invoiceItemId'
        ) THEN
          ALTER TABLE "stock_movements"
          ADD CONSTRAINT "FK_stock_movements_invoiceItemId"
          FOREIGN KEY ("invoiceItemId")
          REFERENCES "invoice_items"("id")
          ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    // Helpful index for audits / joins
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_stock_movements_invoiceItemId"
      ON "stock_movements" ("invoiceItemId")
    `);

    // Best-effort backfill for existing invoice movements.
    // If there are multiple invoice_items for the same invoice+inventoryItemId,
    // we pick the earliest created one to avoid nondeterminism.
    await queryRunner.query(`
      UPDATE "stock_movements" sm
      SET "invoiceItemId" = ii_map."id"
      FROM (
        SELECT DISTINCT ON (ii."invoiceId", ii."inventoryItemId")
          ii."id",
          ii."invoiceId",
          ii."inventoryItemId"
        FROM "invoice_items" ii
        ORDER BY ii."invoiceId", ii."inventoryItemId", ii."createdAt" ASC, ii."id" ASC
      ) ii_map
      WHERE sm."invoiceItemId" IS NULL
        AND sm."sourceType" = 'invoice'
        AND sm."sourceId" IS NOT NULL
        -- Only cast UUID-looking sourceIds to avoid runtime errors.
        AND sm."sourceId" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND sm."sourceId"::uuid = ii_map."invoiceId"
        AND sm."inventoryItemId" = ii_map."inventoryItemId"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_stock_movements_invoiceItemId"
    `);

    await queryRunner.query(`
      ALTER TABLE "stock_movements"
      DROP CONSTRAINT IF EXISTS "FK_stock_movements_invoiceItemId"
    `);

    await queryRunner.query(`
      ALTER TABLE "stock_movements"
      DROP COLUMN IF EXISTS "invoiceItemId"
    `);
  }
}


