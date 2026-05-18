// Copyright (c) 2025 Asset Vault. All rights reserved.

import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddEmailVerification1749000000000 implements MigrationInterface {
  name = 'AddEmailVerification1749000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add email verification fields to users table
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'emailVerified',
        type: 'boolean',
        default: false,
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

    // Set existing users as verified (backward compatibility)
    await queryRunner.query(`
      UPDATE users SET "emailVerified" = true WHERE "emailVerified" IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'emailVerificationTokenExpiresAt');
    await queryRunner.dropColumn('users', 'emailVerificationToken');
    await queryRunner.dropColumn('users', 'emailVerified');
  }
}

