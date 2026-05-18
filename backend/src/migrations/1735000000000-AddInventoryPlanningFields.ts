import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInventoryPlanningFields1735000000000 implements MigrationInterface {
  name = 'AddInventoryPlanningFields1735000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new planning and container fields to inventory_items table
    await queryRunner.query(`
      ALTER TABLE "inventory_items" 
      ADD COLUMN IF NOT EXISTS "fluteType" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "inventory_items" 
      ADD COLUMN IF NOT EXISTS "packSize" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "inventory_items" 
      ADD COLUMN IF NOT EXISTS "unitsPerContainer" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "inventory_items" 
      ADD COLUMN IF NOT EXISTS "containerType" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "inventory_items" 
      ADD COLUMN IF NOT EXISTS "weeksSupplyTargetOverride" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "inventory_items" 
      ADD COLUMN IF NOT EXISTS "averageWeeklyUsage" numeric(10,2)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove fields from inventory_items
    await queryRunner.query(`
      ALTER TABLE "inventory_items" 
      DROP COLUMN IF EXISTS "averageWeeklyUsage"
    `);
    await queryRunner.query(`
      ALTER TABLE "inventory_items" 
      DROP COLUMN IF EXISTS "weeksSupplyTargetOverride"
    `);
    await queryRunner.query(`
      ALTER TABLE "inventory_items" 
      DROP COLUMN IF EXISTS "containerType"
    `);
    await queryRunner.query(`
      ALTER TABLE "inventory_items" 
      DROP COLUMN IF EXISTS "unitsPerContainer"
    `);
    await queryRunner.query(`
      ALTER TABLE "inventory_items" 
      DROP COLUMN IF EXISTS "packSize"
    `);
    await queryRunner.query(`
      ALTER TABLE "inventory_items" 
      DROP COLUMN IF EXISTS "fluteType"
    `);
  }
}

