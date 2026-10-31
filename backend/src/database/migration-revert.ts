// Copyright (c) 2025 Asset Vault. All rights reserved.

/**
 * Reverts the LAST applied migration. Development use; NOT a recovery procedure.
 * Some down() methods lose data. 1761000000000-WidenInvoiceItemRatePrecision rounds rates
 * back to two decimals, permanently losing any rate stored with more. To recover a
 * production database, restore the pre-migration backup or fix forward:
 * docs/operations/MIGRATIONS.md.
 */
import { AppDataSource } from './data-source';

async function revertMigration() {
  try {
    await AppDataSource.initialize();
    console.log('Database connection established');

    await AppDataSource.undoLastMigration({ transaction: 'all' });
    console.log('Last migration reverted');

    await AppDataSource.destroy();
    console.log('Migration revert completed');
    process.exit(0);
  } catch (error) {
    console.error('Error reverting migration:', error);
    process.exit(1);
  }
}

void revertMigration();
