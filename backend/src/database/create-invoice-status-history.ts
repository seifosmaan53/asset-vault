// Copyright (c) 2025 Asset Vault. All rights reserved.
// Script to create invoice_status_history table directly
// Run: npm run ts-node src/database/create-invoice-status-history.ts

import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

async function createInvoiceStatusHistoryTable() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'invoiceme',
    synchronize: false,
    logging: true,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Database connection established\n');

    const queryRunner = dataSource.createQueryRunner();

    // Check if table already exists
    const tableExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'invoice_status_history'
      );
    `);

    if (tableExists[0].exists) {
      console.log('⚠️  Table "invoice_status_history" already exists. Skipping creation.');
      await queryRunner.release();
      await dataSource.destroy();
      process.exit(0);
    }

    console.log('Creating invoice_status_history table...\n');

    // Create table
    await queryRunner.query(`
      CREATE TABLE "invoice_status_history" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "invoiceId" uuid NOT NULL,
        "fromStatus" character varying NOT NULL,
        "toStatus" character varying NOT NULL,
        "userId" character varying NOT NULL,
        "note" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_invoice_status_history" PRIMARY KEY ("id")
      )
    `);
    console.log('✅ Table created');

    // Add foreign key constraint
    const constraintExists = await queryRunner.query(`
      SELECT 1 FROM pg_constraint WHERE conname = 'FK_invoice_status_history_invoiceId'
    `);

    if (constraintExists.length === 0) {
      await queryRunner.query(`
        ALTER TABLE "invoice_status_history" 
        ADD CONSTRAINT "FK_invoice_status_history_invoiceId" 
        FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      `);
      console.log('✅ Foreign key constraint added');
    } else {
      console.log('⚠️  Foreign key constraint already exists');
    }

    // Add indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_invoice_status_history_invoice_id" 
      ON "invoice_status_history" ("invoiceId")
    `);
    console.log('✅ Index on invoiceId created');

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_invoice_status_history_user_id" 
      ON "invoice_status_history" ("userId")
    `);
    console.log('✅ Index on userId created');

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_invoice_status_history_created_at" 
      ON "invoice_status_history" ("createdAt")
    `);
    console.log('✅ Index on createdAt created');

    await queryRunner.release();
    await dataSource.destroy();

    console.log('\n✅ Successfully created invoice_status_history table and indexes!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating table:', error);
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    process.exit(1);
  }
}

createInvoiceStatusHistoryTable();

