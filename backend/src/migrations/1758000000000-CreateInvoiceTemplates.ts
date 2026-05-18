import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInvoiceTemplates1758000000000 implements MigrationInterface {
  name = 'CreateInvoiceTemplates1758000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "invoice_templates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "name" character varying(255) NOT NULL,
        "description" text,
        "templateData" jsonb NOT NULL,
        "isDefault" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        CONSTRAINT "PK_invoice_templates" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_invoice_templates_userId" ON "invoice_templates" ("userId", "deletedAt")
    `);

    await queryRunner.query(`
      ALTER TABLE "invoice_templates" 
      ADD CONSTRAINT "FK_invoice_templates_userId" 
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "invoice_templates" 
      DROP CONSTRAINT IF EXISTS "FK_invoice_templates_userId"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_invoice_templates_userId"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "invoice_templates"
    `);
  }
}
