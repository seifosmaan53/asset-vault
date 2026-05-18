import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEnhancedSettingsFields1733700000000 implements MigrationInterface {
  name = 'AddEnhancedSettingsFields1733700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Company additional fields
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "companyWebsite" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "companyLogo" text
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "companyTaxId" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "companyRegistrationNumber" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "companyVatNumber" character varying
    `);

    // Invoice customization fields
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "invoiceFooterText" text
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "invoiceHeaderText" text
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "showInvoiceWatermark" boolean DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "invoiceWatermarkText" character varying
    `);

    // Tax additional fields
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "additionalTaxRates" text
    `);

    // Client defaults additional fields
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "defaultClientPaymentMethod" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "defaultClientCreditLimit" numeric(10,2)
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "defaultClientCurrency" character varying
    `);

    // Inventory additional fields
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "autoReorderEnabled" boolean DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "stockAlertThreshold" integer DEFAULT 10
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "inventoryUnitConversion" character varying
    `);

    // Notification additional fields
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "emailInvoiceReminder" boolean DEFAULT true
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "emailWeeklyReport" boolean DEFAULT true
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "emailMonthlyReport" boolean DEFAULT true
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "notificationFrequency" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "quietHoursStart" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "quietHoursEnd" character varying
    `);

    // Display additional fields
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "fontSize" character varying DEFAULT 'medium'
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "compactMode" boolean DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "language" character varying DEFAULT 'en'
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "primaryColor" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "secondaryColor" character varying
    `);

    // Backup & Export additional fields
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "backupSchedule" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "backupTime" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "exportFormats" text
    `);

    // Security fields
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "enableTwoFactorAuth" boolean DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD COLUMN IF NOT EXISTS "twoFactorSecret" character varying
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const columns = [
      'companyWebsite',
      'companyLogo',
      'companyTaxId',
      'companyRegistrationNumber',
      'companyVatNumber',
      'invoiceFooterText',
      'invoiceHeaderText',
      'showInvoiceWatermark',
      'invoiceWatermarkText',
      'additionalTaxRates',
      'defaultClientPaymentMethod',
      'defaultClientCreditLimit',
      'defaultClientCurrency',
      'autoReorderEnabled',
      'stockAlertThreshold',
      'inventoryUnitConversion',
      'emailInvoiceReminder',
      'emailWeeklyReport',
      'emailMonthlyReport',
      'notificationFrequency',
      'quietHoursStart',
      'quietHoursEnd',
      'fontSize',
      'compactMode',
      'language',
      'primaryColor',
      'secondaryColor',
      'backupSchedule',
      'backupTime',
      'exportFormats',
      'enableTwoFactorAuth',
      'twoFactorSecret',
    ];

    for (const column of columns) {
      await queryRunner.query(`
        ALTER TABLE "user_settings" 
        DROP COLUMN IF EXISTS "${column}"
      `);
    }
  }
}

