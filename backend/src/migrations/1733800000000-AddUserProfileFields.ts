import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserProfileFields1733800000000 implements MigrationInterface {
  name = 'AddUserProfileFields1733800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "phone" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "address" text
    `);
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "timezone" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "bio" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" 
      DROP COLUMN IF EXISTS "phone"
    `);
    await queryRunner.query(`
      ALTER TABLE "users" 
      DROP COLUMN IF EXISTS "address"
    `);
    await queryRunner.query(`
      ALTER TABLE "users" 
      DROP COLUMN IF EXISTS "timezone"
    `);
    await queryRunner.query(`
      ALTER TABLE "users" 
      DROP COLUMN IF EXISTS "bio"
    `);
  }
}

