import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The `count` of the first row of a `SELECT COUNT(*) as count` result, as text
 * ('0' when absent). node-postgres returns COUNT(*) (a bigint) as a string.
 */
function firstRowCount(rows: unknown): string {
  const first: unknown = Array.isArray(rows) ? rows[0] : undefined;
  const count: unknown =
    typeof first === 'object' && first !== null
      ? Reflect.get(first, 'count')
      : undefined;
  if (typeof count === 'number') return String(count);
  return typeof count === 'string' && count ? count : '0';
}

export class AddClientIdToStores1743000000000 implements MigrationInterface {
  name = 'AddClientIdToStores1743000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if there are any existing stores
    const existingStores: unknown = await queryRunner.query(`
      SELECT COUNT(*) as count FROM "stores"
    `);
    const storeCount = parseInt(firstRowCount(existingStores), 10);

    // Add clientId column to stores table (nullable initially for existing data)
    await queryRunner.query(`
      ALTER TABLE "stores" 
      ADD COLUMN "clientId" uuid
    `);

    // If there are existing stores, we need to assign them to a client
    // For each user, get their first client and assign all their stores to it
    if (storeCount > 0) {
      // Get first client for each user and assign their stores to it
      await queryRunner.query(`
        UPDATE "stores" s
        SET "clientId" = (
          SELECT c.id 
          FROM "clients" c 
          WHERE c."userId" = s."userId" 
          ORDER BY c."createdAt" ASC 
          LIMIT 1
        )
        WHERE s."clientId" IS NULL
        AND EXISTS (
          SELECT 1 FROM "clients" c WHERE c."userId" = s."userId"
        )
      `);

      // Check if there are any stores without a client assigned
      const storesWithoutClient: unknown = await queryRunner.query(`
        SELECT COUNT(*) as count FROM "stores" WHERE "clientId" IS NULL
      `);
      const orphanedStores = parseInt(firstRowCount(storesWithoutClient), 10);

      if (orphanedStores > 0) {
        throw new Error(
          `Migration failed: ${orphanedStores} store(s) cannot be assigned to a client because their users have no clients. ` +
            `Please create at least one client for each user with stores before running this migration.`,
        );
      }
    }

    // Add foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "stores" 
      ADD CONSTRAINT "FK_stores_clientId" 
      FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // Make clientId NOT NULL after assigning clients to existing stores
    // At this point, all stores should have a clientId assigned
    await queryRunner.query(`
      ALTER TABLE "stores" 
      ALTER COLUMN "clientId" SET NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "stores" 
      DROP CONSTRAINT IF EXISTS "FK_stores_clientId"
    `);

    // Drop clientId column
    await queryRunner.query(`
      ALTER TABLE "stores" 
      DROP COLUMN IF EXISTS "clientId"
    `);
  }
}
