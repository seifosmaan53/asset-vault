// Copyright (c) 2025 Asset Vault. All rights reserved.

import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class MigrateToClerkAuth1755000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add clerkUserId column
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'clerkUserId',
        type: 'varchar',
        isNullable: true,
        isUnique: true,
      }),
    );

    // Create index on clerkUserId
    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'IDX_users_clerkUserId',
        columnNames: ['clerkUserId'],
      }),
    );

    // Remove password-related columns
    await queryRunner.dropColumn('users', 'password');
    await queryRunner.dropColumn('users', 'passwordResetToken');
    await queryRunner.dropColumn('users', 'passwordResetTokenExpiresAt');
    await queryRunner.dropColumn('users', 'emailVerificationToken');
    await queryRunner.dropColumn('users', 'emailVerificationTokenExpiresAt');
    await queryRunner.dropColumn('users', 'failedLoginAttempts');
    await queryRunner.dropColumn('users', 'lockedUntil');

    // Update emailVerified default to true (Clerk handles verification)
    await queryRunner.query(`
      ALTER TABLE "users" 
      ALTER COLUMN "emailVerified" SET DEFAULT true,
      ALTER COLUMN "emailVerified" SET NOT NULL
    `);

    // Update existing users to have emailVerified = true
    await queryRunner.query(`
      UPDATE "users" SET "emailVerified" = true WHERE "emailVerified" = false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-add password-related columns
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'password',
        type: 'varchar',
        isNullable: false,
      }),
    );

    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'passwordResetToken',
        type: 'varchar',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'passwordResetTokenExpiresAt',
        type: 'timestamptz',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'emailVerificationToken',
        type: 'varchar',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'emailVerificationTokenExpiresAt',
        type: 'timestamptz',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'failedLoginAttempts',
        type: 'int',
        default: 0,
      }),
    );

    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'lockedUntil',
        type: 'timestamptz',
        isNullable: true,
      }),
    );

    // Revert emailVerified default
    await queryRunner.query(`
      ALTER TABLE "users" 
      ALTER COLUMN "emailVerified" SET DEFAULT false
    `);

    // Drop clerkUserId index and column
    await queryRunner.dropIndex('users', 'IDX_users_clerkUserId');
    await queryRunner.dropColumn('users', 'clerkUserId');
  }
}

