import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddUserRole1700000000001 implements MigrationInterface {
  name = 'AddUserRole1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type for user roles
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "user_role_enum" AS ENUM ('owner', 'admin', 'staff');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Add role column with default 'admin'
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "role" "user_role_enum" NOT NULL DEFAULT 'admin';
    `);

    // Set the first user (by creation date) as owner
    await queryRunner.query(`
      UPDATE "users"
      SET "role" = 'owner'
      WHERE "id" = (
        SELECT "id" FROM "users"
        ORDER BY "createdAt" ASC
        LIMIT 1
      )
      AND NOT EXISTS (
        SELECT 1 FROM "users" WHERE "role" = 'owner'
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'role');
    await queryRunner.query(`DROP TYPE IF EXISTS "user_role_enum"`);
  }
}

