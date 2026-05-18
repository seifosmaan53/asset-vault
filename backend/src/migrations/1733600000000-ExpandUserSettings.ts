import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExpandUserSettings1733600000000 implements MigrationInterface {
  name = 'ExpandUserSettings1733600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Invoice Defaults
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "defaultPaymentTermsDays" integer DEFAULT 30
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "defaultInvoiceNotes" text
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "defaultInvoiceTerms" text
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "autoGenerateInvoiceNumber" boolean DEFAULT true
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "showInvoiceNumberOnPDF" boolean DEFAULT true
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "showPaymentInstructions" boolean DEFAULT true
    `);

    // Date & Time Formats
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "dateFormat" character varying DEFAULT 'MM/DD/YYYY'
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "timeFormat" character varying DEFAULT '12'
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "timezone" character varying DEFAULT 'America/New_York'
    `);

    // Number & Currency Formats
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "decimalSeparator" character varying DEFAULT '.'
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "thousandsSeparator" character varying DEFAULT ','
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "currencySymbolPosition" character varying DEFAULT 'left'
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "showCurrencySymbol" boolean DEFAULT true
    `);

    // Tax Settings
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "taxInclusive" boolean DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "taxRegistrationNumber" text
    `);

    // Client Defaults
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "autoCreateClients" boolean DEFAULT true
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "defaultClientNotes" text
    `);

    // Inventory Defaults
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "defaultReorderLevel" numeric DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "defaultInventoryUnit" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "trackInventory" boolean DEFAULT true
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "allowNegativeStock" boolean DEFAULT true
    `);

    // Email/SMTP Settings
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "smtpHost" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "smtpPort" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "smtpSecure" boolean DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "smtpUser" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "smtpPassword" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "emailFromName" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "emailFromAddress" character varying
    `);

    // Notification Settings
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "emailInvoiceSent" boolean DEFAULT true
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "emailInvoicePaid" boolean DEFAULT true
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "emailInvoiceOverdue" boolean DEFAULT true
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "emailLowStockAlert" boolean DEFAULT true
    `);

    // UI/Display Settings
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "theme" character varying DEFAULT 'light'
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "itemsPerPage" integer DEFAULT 10
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "showDashboardCharts" boolean DEFAULT true
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "showNotifications" boolean DEFAULT true
    `);

    // Backup & Export
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "autoBackup" boolean DEFAULT true
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "backupRetentionDays" integer DEFAULT 7
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "allowDataExport" boolean DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove all added columns
    const columns = [
      'defaultPaymentTermsDays',
      'defaultInvoiceNotes',
      'defaultInvoiceTerms',
      'autoGenerateInvoiceNumber',
      'showInvoiceNumberOnPDF',
      'showPaymentInstructions',
      'dateFormat',
      'timeFormat',
      'timezone',
      'decimalSeparator',
      'thousandsSeparator',
      'currencySymbolPosition',
      'showCurrencySymbol',
      'taxInclusive',
      'taxRegistrationNumber',
      'autoCreateClients',
      'defaultClientNotes',
      'defaultReorderLevel',
      'defaultInventoryUnit',
      'trackInventory',
      'allowNegativeStock',
      'smtpHost',
      'smtpPort',
      'smtpSecure',
      'smtpUser',
      'smtpPassword',
      'emailFromName',
      'emailFromAddress',
      'emailInvoiceSent',
      'emailInvoicePaid',
      'emailInvoiceOverdue',
      'emailLowStockAlert',
      'theme',
      'itemsPerPage',
      'showDashboardCharts',
      'showNotifications',
      'autoBackup',
      'backupRetentionDays',
      'allowDataExport',
    ];

    for (const column of columns) {
      await queryRunner.query(`
        ALTER TABLE "user_settings" 
        DROP COLUMN IF EXISTS "${column}"
      `);
    }
  }
}

