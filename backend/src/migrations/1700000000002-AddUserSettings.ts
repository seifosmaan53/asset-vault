import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserSettings1700000000002 implements MigrationInterface {
  name = 'AddUserSettings1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create user_settings table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "invoiceNumberFormat" character varying,
        "defaultCurrency" character varying NOT NULL DEFAULT 'USD',
        "defaultTaxRate" numeric(5,2) NOT NULL DEFAULT 0,
        "companyName" character varying,
        "companyAddress" text,
        "companyPhone" character varying,
        "companyEmail" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_user_settings_userId" UNIQUE ("userId"),
        CONSTRAINT "PK_user_settings" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "user_settings" 
      ADD CONSTRAINT "FK_user_settings_userId" 
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_settings"`);
  }
}

