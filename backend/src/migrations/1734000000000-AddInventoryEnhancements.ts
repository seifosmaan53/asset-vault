import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInventoryEnhancements1734000000000 implements MigrationInterface {
  name = 'AddInventoryEnhancements1734000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new fields to inventory_items table
    await queryRunner.query(`
      ALTER TABLE "inventory_items" 
      ADD COLUMN IF NOT EXISTS "sizeInches" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "inventory_items" 
      ADD COLUMN IF NOT EXISTS "material" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "inventory_items" 
      ADD COLUMN IF NOT EXISTS "bundleSize" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "inventory_items" 
      ADD COLUMN IF NOT EXISTS "bundleUnit" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "inventory_items" 
      ADD COLUMN IF NOT EXISTS "spacePerBundle" numeric(10,2)
    `);
    await queryRunner.query(`
      ALTER TABLE "inventory_items" 
      ADD COLUMN IF NOT EXISTS "bundlesPerContainer" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "inventory_items" 
      ADD COLUMN IF NOT EXISTS "targetBundles" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "inventory_items" 
      ADD COLUMN IF NOT EXISTS "printType" character varying
    `);

    // Create stores table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stores" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "name" character varying NOT NULL,
        "code" character varying NOT NULL,
        "address" text,
        "active" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_stores" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "stores" 
      ADD CONSTRAINT "FK_stores_userId" 
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_stores_userId_code" 
      ON "stores" ("userId", "code")
    `);

    // Create store_item_settings table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "store_item_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "storeId" uuid NOT NULL,
        "inventoryItemId" uuid NOT NULL,
        "currentStock" integer NOT NULL DEFAULT 0,
        "minQty" integer NOT NULL DEFAULT 0,
        "targetQty" integer,
        "weeklyUsage" numeric(10,2),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_store_item_settings" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "store_item_settings" 
      ADD CONSTRAINT "FK_store_item_settings_storeId" 
      FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "store_item_settings" 
      ADD CONSTRAINT "FK_store_item_settings_inventoryItemId" 
      FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_store_item_settings_storeId_inventoryItemId" 
      ON "store_item_settings" ("storeId", "inventoryItemId")
    `);

    // Add weeksSupplyTarget to user_settings table
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "weeksSupplyTarget" integer DEFAULT 4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove weeksSupplyTarget from user_settings
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      DROP COLUMN IF EXISTS "weeksSupplyTarget"
    `);

    // Drop store_item_settings table
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_store_item_settings_storeId_inventoryItemId"
    `);
    await queryRunner.query(`
      ALTER TABLE "store_item_settings" 
      DROP CONSTRAINT IF EXISTS "FK_store_item_settings_inventoryItemId"
    `);
    await queryRunner.query(`
      ALTER TABLE "store_item_settings" 
      DROP CONSTRAINT IF EXISTS "FK_store_item_settings_storeId"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "store_item_settings"
    `);

    // Drop stores table
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_stores_userId_code"
    `);
    await queryRunner.query(`
      ALTER TABLE "stores" 
      DROP CONSTRAINT IF EXISTS "FK_stores_userId"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "stores"
    `);

    // Remove fields from inventory_items
    await queryRunner.query(`
      ALTER TABLE "inventory_items" 
      DROP COLUMN IF EXISTS "printType"
    `);
    await queryRunner.query(`
      ALTER TABLE "inventory_items" 
      DROP COLUMN IF EXISTS "targetBundles"
    `);
    await queryRunner.query(`
      ALTER TABLE "inventory_items" 
      DROP COLUMN IF EXISTS "bundlesPerContainer"
    `);
    await queryRunner.query(`
      ALTER TABLE "inventory_items" 
      DROP COLUMN IF EXISTS "spacePerBundle"
    `);
    await queryRunner.query(`
      ALTER TABLE "inventory_items" 
      DROP COLUMN IF EXISTS "bundleUnit"
    `);
    await queryRunner.query(`
      ALTER TABLE "inventory_items" 
      DROP COLUMN IF EXISTS "bundleSize"
    `);
    await queryRunner.query(`
      ALTER TABLE "inventory_items" 
      DROP COLUMN IF EXISTS "material"
    `);
    await queryRunner.query(`
      ALTER TABLE "inventory_items" 
      DROP COLUMN IF EXISTS "sizeInches"
    `);
  }
}

