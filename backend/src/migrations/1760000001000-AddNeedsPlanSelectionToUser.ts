// Copyright (c) 2025 Asset Vault. All rights reserved.

import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddNeedsPlanSelectionToUser1760000001000 implements MigrationInterface {
  name = 'AddNeedsPlanSelectionToUser1760000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'needsPlanSelection',
        type: 'boolean',
        default: false,
        isNullable: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'needsPlanSelection');
  }
}

