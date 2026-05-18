import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnhanceStoreFields1740000000000 implements MigrationInterface {
  name = 'EnhanceStoreFields1740000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add phone column
    await queryRunner.query(`
      ALTER TABLE "stores" 
      ADD COLUMN IF NOT EXISTS "phone" character varying
    `);

    // Add email column
    await queryRunner.query(`
      ALTER TABLE "stores" 
      ADD COLUMN IF NOT EXISTS "email" character varying
    `);

    // Add city column
    await queryRunner.query(`
      ALTER TABLE "stores" 
      ADD COLUMN IF NOT EXISTS "city" character varying
    `);

    // Add state column
    await queryRunner.query(`
      ALTER TABLE "stores" 
      ADD COLUMN IF NOT EXISTS "state" character varying
    `);

    // Add zip column
    await queryRunner.query(`
      ALTER TABLE "stores" 
      ADD COLUMN IF NOT EXISTS "zip" character varying
    `);

    // Add country column
    await queryRunner.query(`
      ALTER TABLE "stores" 
      ADD COLUMN IF NOT EXISTS "country" character varying
    `);

    // Add notes column
    await queryRunner.query(`
      ALTER TABLE "stores" 
      ADD COLUMN IF NOT EXISTS "notes" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove notes column
    await queryRunner.query(`
      ALTER TABLE "stores" 
      DROP COLUMN IF EXISTS "notes"
    `);

    // Remove country column
    await queryRunner.query(`
      ALTER TABLE "stores" 
      DROP COLUMN IF EXISTS "country"
    `);

    // Remove zip column
    await queryRunner.query(`
      ALTER TABLE "stores" 
      DROP COLUMN IF EXISTS "zip"
    `);

    // Remove state column
    await queryRunner.query(`
      ALTER TABLE "stores" 
      DROP COLUMN IF EXISTS "state"
    `);

    // Remove city column
    await queryRunner.query(`
      ALTER TABLE "stores" 
      DROP COLUMN IF EXISTS "city"
    `);

    // Remove email column
    await queryRunner.query(`
      ALTER TABLE "stores" 
      DROP COLUMN IF EXISTS "email"
    `);

    // Remove phone column
    await queryRunner.query(`
      ALTER TABLE "stores" 
      DROP COLUMN IF EXISTS "phone"
    `);
  }
}

