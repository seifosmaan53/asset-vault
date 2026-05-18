import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable UUID extension if not already enabled
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Create users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying NOT NULL,
        "password" character varying NOT NULL,
        "name" character varying NOT NULL,
        "companyName" character varying,
        "passwordResetToken" character varying,
        "passwordResetTokenExpiresAt" timestamptz,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    // Create clients table
    await queryRunner.query(`
      CREATE TABLE "clients" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "name" character varying NOT NULL,
        "email" character varying,
        "phone" character varying,
        "addressJson" jsonb,
        "notes" text,
        "tags" text array DEFAULT '{}',
        "avatarUrl" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        CONSTRAINT "PK_clients" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "clients" 
      ADD CONSTRAINT "FK_clients_userId" 
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Create inventory_items table
    await queryRunner.query(`
      CREATE TABLE "inventory_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "sku" character varying NOT NULL,
        "name" character varying NOT NULL,
        "description" text,
        "category" character varying,
        "unit" character varying NOT NULL,
        "barcode" character varying,
        "costPrice" numeric(10,2),
        "defaultUnitPrice" numeric(10,2) NOT NULL,
        "defaultTaxRate" numeric(5,2),
        "currentStock" integer NOT NULL DEFAULT 0,
        "reservedStock" integer NOT NULL DEFAULT 0,
        "reorderLevel" integer NOT NULL DEFAULT 0,
        "maxStockLevel" integer,
        "status" character varying NOT NULL DEFAULT 'active',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_inventory_items_sku" UNIQUE ("sku"),
        CONSTRAINT "PK_inventory_items" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "inventory_items" 
      ADD CONSTRAINT "FK_inventory_items_userId" 
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Create stock_movements table
    await queryRunner.query(`
      CREATE TABLE "stock_movements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "inventoryItemId" uuid NOT NULL,
        "type" character varying NOT NULL,
        "quantity" integer NOT NULL,
        "sourceType" character varying NOT NULL,
        "sourceId" character varying,
        "note" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_stock_movements" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "stock_movements" 
      ADD CONSTRAINT "FK_stock_movements_userId" 
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "stock_movements" 
      ADD CONSTRAINT "FK_stock_movements_inventoryItemId" 
      FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Create invoices table
    await queryRunner.query(`
      CREATE TABLE "invoices" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "clientId" uuid NOT NULL,
        "type" character varying NOT NULL,
        "number" character varying NOT NULL,
        "status" character varying NOT NULL,
        "issueDate" date NOT NULL,
        "dueDate" date,
        "currency" character varying NOT NULL DEFAULT 'USD',
        "subtotal" numeric(10,2) NOT NULL DEFAULT 0,
        "taxTotal" numeric(10,2) NOT NULL DEFAULT 0,
        "discountTotal" numeric(10,2) NOT NULL DEFAULT 0,
        "total" numeric(10,2) NOT NULL DEFAULT 0,
        "notes" text,
        "metadataJson" jsonb,
        "paidAt" TIMESTAMP,
        "paymentMethodNote" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        CONSTRAINT "PK_invoices" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "invoices" 
      ADD CONSTRAINT "FK_invoices_userId" 
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "invoices" 
      ADD CONSTRAINT "FK_invoices_clientId" 
      FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Create invoice_items table
    await queryRunner.query(`
      CREATE TABLE "invoice_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "invoiceId" uuid NOT NULL,
        "inventoryItemId" uuid,
        "description" text NOT NULL,
        "quantity" integer NOT NULL,
        "unitPrice" numeric(10,2) NOT NULL,
        "taxRate" numeric(5,2) NOT NULL DEFAULT 0,
        "discountRate" numeric(5,2) NOT NULL DEFAULT 0,
        "lineTotal" numeric(10,2) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_invoice_items" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "invoice_items" 
      ADD CONSTRAINT "FK_invoice_items_invoiceId" 
      FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "invoice_items" 
      ADD CONSTRAINT "FK_invoice_items_inventoryItemId" 
      FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Create recurring_invoices table
    await queryRunner.query(`
      CREATE TABLE "recurring_invoices" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "clientId" uuid NOT NULL,
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
        CONSTRAINT "PK_recurring_invoices" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "recurring_invoices" 
      ADD CONSTRAINT "FK_recurring_invoices_userId" 
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "recurring_invoices" 
      ADD CONSTRAINT "FK_recurring_invoices_clientId" 
      FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Create invoice_templates table
    await queryRunner.query(`
      CREATE TABLE "invoice_templates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "name" character varying NOT NULL,
        "description" text,
        "templateData" jsonb NOT NULL,
        "isDefault" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_invoice_templates" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "invoice_templates" 
      ADD CONSTRAINT "FK_invoice_templates_userId" 
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Create api_keys table
    await queryRunner.query(`
      CREATE TABLE "api_keys" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "name" character varying NOT NULL,
        "permissions" text array DEFAULT '{}',
        "expiresAt" TIMESTAMP,
        "isActive" boolean NOT NULL DEFAULT true,
        "lastUsedAt" TIMESTAMP,
        "keyHash" character varying NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_api_keys_keyHash" UNIQUE ("keyHash"),
        CONSTRAINT "PK_api_keys" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "api_keys" 
      ADD CONSTRAINT "FK_api_keys_userId" 
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // Create feedback table
    await queryRunner.query(`
      CREATE TABLE "feedback" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "message" text NOT NULL,
        "type" character varying,
        "isRead" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_feedback" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "feedback" 
      ADD CONSTRAINT "FK_feedback_userId" 
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order (respecting foreign key constraints)
    await queryRunner.query(`DROP TABLE IF EXISTS "feedback"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "api_keys"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invoice_templates"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "recurring_invoices"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invoice_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invoices"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_movements"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "clients"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}

