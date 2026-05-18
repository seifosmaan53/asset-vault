import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveRecurringInvoicesAndTemplates1757000000000 implements MigrationInterface {
  name = 'RemoveRecurringInvoicesAndTemplates1757000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints first
    await queryRunner.query(`
      ALTER TABLE "recurring_invoices" 
      DROP CONSTRAINT IF EXISTS "FK_recurring_invoices_userId";
    `);
    await queryRunner.query(`
      ALTER TABLE "recurring_invoices" 
      DROP CONSTRAINT IF EXISTS "FK_recurring_invoices_clientId";
    `);
    await queryRunner.query(`
      ALTER TABLE "recurring_invoices" 
      DROP CONSTRAINT IF EXISTS "FK_recurring_invoices_storeId";
    `);
    await queryRunner.query(`
      ALTER TABLE "recurring_invoices" 
      DROP CONSTRAINT IF EXISTS "FK_recurring_invoices_organization";
    `);
    await queryRunner.query(`
      ALTER TABLE "invoice_templates" 
      DROP CONSTRAINT IF EXISTS "FK_invoice_templates_userId";
    `);
    await queryRunner.query(`
      ALTER TABLE "invoice_templates" 
      DROP CONSTRAINT IF EXISTS "FK_invoice_templates_organization";
    `);

    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_recurring_invoices_userId";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_recurring_invoices_clientId";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_recurring_invoices_storeId";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_recurring_invoices_organizationId";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UX_recurring_invoices_org_code";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoice_templates_userId";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoice_templates_organizationId";`);

    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS "recurring_invoices";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invoice_templates";`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate invoice_templates table
    await queryRunner.query(`
      CREATE TABLE "invoice_templates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "organizationId" uuid,
        "name" character varying NOT NULL,
        "description" text,
        "templateData" jsonb NOT NULL,
        "isDefault" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        CONSTRAINT "PK_invoice_templates" PRIMARY KEY ("id")
      );
    `);

    // Recreate recurring_invoices table
    await queryRunner.query(`
      CREATE TABLE "recurring_invoices" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "organizationId" uuid,
        "clientId" uuid NOT NULL,
        "storeId" uuid,
        "name" character varying NOT NULL,
        "frequency" character varying NOT NULL,
        "interval" integer NOT NULL,
        "startDate" date NOT NULL,
        "endDate" date,
        "nextRunDate" date NOT NULL,
        "currency" character varying NOT NULL DEFAULT 'USD',
        "items" jsonb NOT NULL,
        "notes" text,
        "isActive" boolean NOT NULL DEFAULT true,
        "invoicesGenerated" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        CONSTRAINT "PK_recurring_invoices" PRIMARY KEY ("id")
      );
    `);

    // Recreate foreign keys
    await queryRunner.query(`
      ALTER TABLE "invoice_templates" 
      ADD CONSTRAINT "FK_invoice_templates_userId" 
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    `);
    await queryRunner.query(`
      ALTER TABLE "invoice_templates" 
      ADD CONSTRAINT "FK_invoice_templates_organization" 
      FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    `);
    await queryRunner.query(`
      ALTER TABLE "recurring_invoices" 
      ADD CONSTRAINT "FK_recurring_invoices_userId" 
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    `);
    await queryRunner.query(`
      ALTER TABLE "recurring_invoices" 
      ADD CONSTRAINT "FK_recurring_invoices_clientId" 
      FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
    `);
    await queryRunner.query(`
      ALTER TABLE "recurring_invoices" 
      ADD CONSTRAINT "FK_recurring_invoices_storeId" 
      FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
    `);
    await queryRunner.query(`
      ALTER TABLE "recurring_invoices" 
      ADD CONSTRAINT "FK_recurring_invoices_organization" 
      FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    `);

    // Recreate indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_invoice_templates_userId" 
      ON "invoice_templates" ("userId");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_invoice_templates_organizationId" 
      ON "invoice_templates" ("organizationId");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_recurring_invoices_userId" 
      ON "recurring_invoices" ("userId");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_recurring_invoices_clientId" 
      ON "recurring_invoices" ("clientId");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_recurring_invoices_storeId" 
      ON "recurring_invoices" ("storeId");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_recurring_invoices_organizationId" 
      ON "recurring_invoices" ("organizationId");
    `);
  }
}

