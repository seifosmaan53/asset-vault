import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStoreAlerts1737000000000 implements MigrationInterface {
  name = 'CreateStoreAlerts1737000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create store_alerts table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "store_alerts" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "storeId" uuid NOT NULL,
        "inventoryItemId" uuid NOT NULL,
        "alertType" varchar NOT NULL,
        "currentStock" integer NOT NULL,
        "minQty" integer NOT NULL,
        "resolved" boolean NOT NULL DEFAULT false,
        "resolvedAt" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_store_alerts_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_store_alerts_storeId" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_store_alerts_inventoryItemId" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE CASCADE
      )
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_store_alerts_userId_resolved" ON "store_alerts" ("userId", "resolved")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_store_alerts_storeId_resolved" ON "store_alerts" ("storeId", "resolved")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_store_alerts_inventoryItemId_resolved" ON "store_alerts" ("inventoryItemId", "resolved")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_store_alerts_inventoryItemId_resolved"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_store_alerts_storeId_resolved"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_store_alerts_userId_resolved"
    `);

    // Drop table
    await queryRunner.query(`
      DROP TABLE IF EXISTS "store_alerts"
    `);
  }
}

