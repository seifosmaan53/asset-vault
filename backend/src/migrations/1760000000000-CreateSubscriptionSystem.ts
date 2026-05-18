// Copyright (c) 2025 Asset Vault. All rights reserved.

import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateSubscriptionSystem1760000000000 implements MigrationInterface {
  name = 'CreateSubscriptionSystem1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create plans table
    await queryRunner.createTable(
      new Table({
        name: 'plans',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'name',
            type: 'varchar',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'price',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'billingCycle',
            type: 'varchar',
            default: "'monthly'",
            isNullable: false,
          },
          {
            name: 'features',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updatedAt',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // Create subscriptions table
    await queryRunner.createTable(
      new Table({
        name: 'subscriptions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'planId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            default: "'pending'",
            isNullable: false,
          },
          {
            name: 'stripeCustomerId',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'stripeSubscriptionId',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'stripePriceId',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'currentPeriodStart',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'currentPeriodEnd',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'cancelAtPeriodEnd',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'canceledAt',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'trialEndsAt',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updatedAt',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // Create usage_tracking table
    await queryRunner.createTable(
      new Table({
        name: 'usage_tracking',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'metric',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'count',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'periodStart',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'periodEnd',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updatedAt',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // Add foreign keys
    await queryRunner.createForeignKey(
      'subscriptions',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'subscriptions',
      new TableForeignKey({
        columnNames: ['planId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'plans',
        onDelete: 'RESTRICT',
      }),
    );

    await queryRunner.createForeignKey(
      'usage_tracking',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    // Create indexes
    await queryRunner.createIndex(
      'subscriptions',
      new TableIndex({
        name: 'IDX_subscriptions_userId',
        columnNames: ['userId'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'subscriptions',
      new TableIndex({
        name: 'IDX_subscriptions_stripeCustomerId',
        columnNames: ['stripeCustomerId'],
      }),
    );

    await queryRunner.createIndex(
      'subscriptions',
      new TableIndex({
        name: 'IDX_subscriptions_stripeSubscriptionId',
        columnNames: ['stripeSubscriptionId'],
      }),
    );

    await queryRunner.createIndex(
      'subscriptions',
      new TableIndex({
        name: 'IDX_subscriptions_status',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'usage_tracking',
      new TableIndex({
        name: 'IDX_usage_tracking_userId_metric_periodStart',
        columnNames: ['userId', 'metric', 'periodStart'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'usage_tracking',
      new TableIndex({
        name: 'IDX_usage_tracking_userId',
        columnNames: ['userId'],
      }),
    );

    await queryRunner.createIndex(
      'usage_tracking',
      new TableIndex({
        name: 'IDX_usage_tracking_metric',
        columnNames: ['metric'],
      }),
    );

    // Insert default "Pro" plan ($49.99/month)
    await queryRunner.query(`
      INSERT INTO "plans" ("id", "name", "price", "billingCycle", "features", "isActive", "createdAt", "updatedAt")
      VALUES (
        uuid_generate_v4(),
        'Pro',
        49.99,
        'monthly',
        '{"maxInvoices": null, "maxClients": null, "maxInventoryItems": null, "maxStorageGB": 10, "advancedAnalytics": true, "apiAccess": true, "whiteLabel": false}'::jsonb,
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('usage_tracking', 'IDX_usage_tracking_metric');
    await queryRunner.dropIndex('usage_tracking', 'IDX_usage_tracking_userId');
    await queryRunner.dropIndex('usage_tracking', 'IDX_usage_tracking_userId_metric_periodStart');
    await queryRunner.dropIndex('subscriptions', 'IDX_subscriptions_status');
    await queryRunner.dropIndex('subscriptions', 'IDX_subscriptions_stripeSubscriptionId');
    await queryRunner.dropIndex('subscriptions', 'IDX_subscriptions_stripeCustomerId');
    await queryRunner.dropIndex('subscriptions', 'IDX_subscriptions_userId');

    // Drop foreign keys
    const usageTable = await queryRunner.getTable('usage_tracking');
    const usageForeignKey = usageTable?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('userId') !== -1,
    );
    if (usageForeignKey) {
      await queryRunner.dropForeignKey('usage_tracking', usageForeignKey);
    }

    const subscriptionsTable = await queryRunner.getTable('subscriptions');
    const planForeignKey = subscriptionsTable?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('planId') !== -1,
    );
    if (planForeignKey) {
      await queryRunner.dropForeignKey('subscriptions', planForeignKey);
    }

    const userForeignKey = subscriptionsTable?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('userId') !== -1,
    );
    if (userForeignKey) {
      await queryRunner.dropForeignKey('subscriptions', userForeignKey);
    }

    // Drop tables
    await queryRunner.dropTable('usage_tracking');
    await queryRunner.dropTable('subscriptions');
    await queryRunner.dropTable('plans');
  }
}

