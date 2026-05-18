import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeletedAtToStores1752000000000 implements MigrationInterface {
  name = 'AddDeletedAtToStores1752000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add deletedAt column to stores table for soft delete support
    await queryRunner.query(`
      ALTER TABLE "stores" 
      ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove deletedAt column
    await queryRunner.query(`
      ALTER TABLE "stores" 
      DROP COLUMN IF EXISTS "deletedAt"
    `);
  }
}

