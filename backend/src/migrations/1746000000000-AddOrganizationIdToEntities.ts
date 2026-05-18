import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from 'typeorm';

export class AddOrganizationIdToEntities1746000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add organizationId to clients
    await queryRunner.addColumn(
      'clients',
      new TableColumn({
        name: 'organizationId',
        type: 'uuid',
        isNullable: true, // Allow null during migration
      }),
    );

    // Add organizationId to invoices
    await queryRunner.addColumn(
      'invoices',
      new TableColumn({
        name: 'organizationId',
        type: 'uuid',
        isNullable: true,
      }),
    );

    // Add organizationId to inventory_items
    await queryRunner.addColumn(
      'inventory_items',
      new TableColumn({
        name: 'organizationId',
        type: 'uuid',
        isNullable: true,
      }),
    );

    // Add organizationId to stores
    await queryRunner.addColumn(
      'stores',
      new TableColumn({
        name: 'organizationId',
        type: 'uuid',
        isNullable: true,
      }),
    );

    // Add organizationId to recurring_invoices
    await queryRunner.addColumn(
      'recurring_invoices',
      new TableColumn({
        name: 'organizationId',
        type: 'uuid',
        isNullable: true,
      }),
    );

    // Add organizationId to stock_movements
    await queryRunner.addColumn(
      'stock_movements',
      new TableColumn({
        name: 'organizationId',
        type: 'uuid',
        isNullable: true,
      }),
    );

    // Add organizationId to store_item_settings
    await queryRunner.addColumn(
      'store_item_settings',
      new TableColumn({
        name: 'organizationId',
        type: 'uuid',
        isNullable: true,
      }),
    );

    // Add organizationId to user_settings
    await queryRunner.addColumn(
      'user_settings',
      new TableColumn({
        name: 'organizationId',
        type: 'uuid',
        isNullable: true,
      }),
    );

    // Add organizationId to invoice_templates
    await queryRunner.addColumn(
      'invoice_templates',
      new TableColumn({
        name: 'organizationId',
        type: 'uuid',
        isNullable: true,
      }),
    );

    // Add organizationId to api_keys
    await queryRunner.addColumn(
      'api_keys',
      new TableColumn({
        name: 'organizationId',
        type: 'uuid',
        isNullable: true,
      }),
    );

    // Add foreign keys (deferrable to allow null during migration)
    await queryRunner.query(`
      ALTER TABLE "clients" 
      ADD CONSTRAINT "FK_clients_organization" 
      FOREIGN KEY ("organizationId") 
      REFERENCES "organizations"("id") 
      ON DELETE CASCADE 
      DEFERRABLE INITIALLY DEFERRED;
    `);

    await queryRunner.query(`
      ALTER TABLE "invoices" 
      ADD CONSTRAINT "FK_invoices_organization" 
      FOREIGN KEY ("organizationId") 
      REFERENCES "organizations"("id") 
      ON DELETE CASCADE 
      DEFERRABLE INITIALLY DEFERRED;
    `);

    await queryRunner.query(`
      ALTER TABLE "inventory_items" 
      ADD CONSTRAINT "FK_inventory_items_organization" 
      FOREIGN KEY ("organizationId") 
      REFERENCES "organizations"("id") 
      ON DELETE CASCADE 
      DEFERRABLE INITIALLY DEFERRED;
    `);

    await queryRunner.query(`
      ALTER TABLE "stores" 
      ADD CONSTRAINT "FK_stores_organization" 
      FOREIGN KEY ("organizationId") 
      REFERENCES "organizations"("id") 
      ON DELETE CASCADE 
      DEFERRABLE INITIALLY DEFERRED;
    `);

    await queryRunner.query(`
      ALTER TABLE "recurring_invoices" 
      ADD CONSTRAINT "FK_recurring_invoices_organization" 
      FOREIGN KEY ("organizationId") 
      REFERENCES "organizations"("id") 
      ON DELETE CASCADE 
      DEFERRABLE INITIALLY DEFERRED;
    `);

    await queryRunner.query(`
      ALTER TABLE "stock_movements" 
      ADD CONSTRAINT "FK_stock_movements_organization" 
      FOREIGN KEY ("organizationId") 
      REFERENCES "organizations"("id") 
      ON DELETE CASCADE 
      DEFERRABLE INITIALLY DEFERRED;
    `);

    await queryRunner.query(`
      ALTER TABLE "store_item_settings" 
      ADD CONSTRAINT "FK_store_item_settings_organization" 
      FOREIGN KEY ("organizationId") 
      REFERENCES "organizations"("id") 
      ON DELETE CASCADE 
      DEFERRABLE INITIALLY DEFERRED;
    `);

    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD CONSTRAINT "FK_user_settings_organization" 
      FOREIGN KEY ("organizationId") 
      REFERENCES "organizations"("id") 
      ON DELETE CASCADE 
      DEFERRABLE INITIALLY DEFERRED;
    `);

    await queryRunner.query(`
      ALTER TABLE "invoice_templates" 
      ADD CONSTRAINT "FK_invoice_templates_organization" 
      FOREIGN KEY ("organizationId") 
      REFERENCES "organizations"("id") 
      ON DELETE CASCADE 
      DEFERRABLE INITIALLY DEFERRED;
    `);

    await queryRunner.query(`
      ALTER TABLE "api_keys" 
      ADD CONSTRAINT "FK_api_keys_organization" 
      FOREIGN KEY ("organizationId") 
      REFERENCES "organizations"("id") 
      ON DELETE CASCADE 
      DEFERRABLE INITIALLY DEFERRED;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys
    await queryRunner.query(`ALTER TABLE "clients" DROP CONSTRAINT "FK_clients_organization"`);
    await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "FK_invoices_organization"`);
    await queryRunner.query(`ALTER TABLE "inventory_items" DROP CONSTRAINT "FK_inventory_items_organization"`);
    await queryRunner.query(`ALTER TABLE "stores" DROP CONSTRAINT "FK_stores_organization"`);
    await queryRunner.query(`ALTER TABLE "recurring_invoices" DROP CONSTRAINT "FK_recurring_invoices_organization"`);
    await queryRunner.query(`ALTER TABLE "stock_movements" DROP CONSTRAINT "FK_stock_movements_organization"`);
    await queryRunner.query(`ALTER TABLE "store_item_settings" DROP CONSTRAINT "FK_store_item_settings_organization"`);
    await queryRunner.query(`ALTER TABLE "user_settings" DROP CONSTRAINT "FK_user_settings_organization"`);
    await queryRunner.query(`ALTER TABLE "invoice_templates" DROP CONSTRAINT "FK_invoice_templates_organization"`);
    await queryRunner.query(`ALTER TABLE "api_keys" DROP CONSTRAINT "FK_api_keys_organization"`);

    // Drop columns
    await queryRunner.dropColumn('clients', 'organizationId');
    await queryRunner.dropColumn('invoices', 'organizationId');
    await queryRunner.dropColumn('inventory_items', 'organizationId');
    await queryRunner.dropColumn('stores', 'organizationId');
    await queryRunner.dropColumn('recurring_invoices', 'organizationId');
    await queryRunner.dropColumn('stock_movements', 'organizationId');
    await queryRunner.dropColumn('store_item_settings', 'organizationId');
    await queryRunner.dropColumn('user_settings', 'organizationId');
    await queryRunner.dropColumn('invoice_templates', 'organizationId');
    await queryRunner.dropColumn('api_keys', 'organizationId');
  }
}

