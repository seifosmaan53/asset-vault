import { MigrationInterface, QueryRunner } from 'typeorm';

export class OrgSharedUniqueIndexes1747000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop legacy unique constraints/indexes that were user-scoped, so we can enforce org-scoped uniqueness.
    // We do this defensively using pg catalogs to avoid relying on generated names.

    // 1) inventory_items.sku: was globally unique (@Column({ unique: true })) in older schema.
    // Drop any UNIQUE constraint that includes (sku).
    await queryRunner.query(`
      DO $$
      DECLARE c RECORD;
      BEGIN
        FOR c IN
          SELECT conname
          FROM pg_constraint
          WHERE conrelid = 'inventory_items'::regclass
            AND contype = 'u'
            AND pg_get_constraintdef(oid) ILIKE '%(sku)%'
        LOOP
          EXECUTE format('ALTER TABLE "inventory_items" DROP CONSTRAINT IF EXISTS %I', c.conname);
        END LOOP;
      END $$;
    `);

    // 2) stores unique index that included (userId, code) without org scoping.
    await queryRunner.query(`
      DO $$
      DECLARE i RECORD;
      BEGIN
        FOR i IN
          SELECT indexname
          FROM pg_indexes
          WHERE schemaname = current_schema()
            AND tablename = 'stores'
            AND indexdef ILIKE '%UNIQUE%'
            AND indexdef ILIKE '%("userId", "code")%'
        LOOP
          EXECUTE format('DROP INDEX IF EXISTS %I', i.indexname);
        END LOOP;
      END $$;
    `);

    // Create org-scoped unique indexes (plus safe legacy partial indexes).
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UX_inventory_items_org_sku"
      ON "inventory_items" ("organizationId", "sku")
      WHERE "organizationId" IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UX_inventory_items_user_sku_legacy"
      ON "inventory_items" ("userId", "sku")
      WHERE "organizationId" IS NULL;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UX_stores_org_code"
      ON "stores" ("organizationId", "code")
      WHERE "organizationId" IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UX_stores_user_code_legacy"
      ON "stores" ("userId", "code")
      WHERE "organizationId" IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UX_inventory_items_org_sku";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UX_inventory_items_user_sku_legacy";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UX_stores_org_code";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UX_stores_user_code_legacy";`);
  }
}


