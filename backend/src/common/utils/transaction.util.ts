// Copyright (c) 2025 Asset Vault. All rights reserved.

import { DataSource } from 'typeorm';

/**
 * Transaction utility with configurable isolation levels
 * Fixes Issue #27: Missing Transaction Isolation Level Configuration
 */
export enum IsolationLevel {
  READ_UNCOMMITTED = 'READ UNCOMMITTED',
  READ_COMMITTED = 'READ COMMITTED',
  REPEATABLE_READ = 'REPEATABLE READ',
  SERIALIZABLE = 'SERIALIZABLE',
}

export async function runInTransaction<T>(
  dataSource: DataSource,
  operation: (queryRunner: any) => Promise<T>,
  isolationLevel: IsolationLevel = IsolationLevel.READ_COMMITTED,
): Promise<T> {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction(isolationLevel);

  try {
    const result = await operation(queryRunner);
    await queryRunner.commitTransaction();
    return result;
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
}

/**
 * Common isolation levels:
 * - READ_UNCOMMITTED: Lowest isolation, allows dirty reads
 * - READ_COMMITTED: Default, prevents dirty reads
 * - REPEATABLE_READ: Prevents non-repeatable reads
 * - SERIALIZABLE: Highest isolation, prevents all anomalies
 */
export const IsolationLevels = {
  READ_UNCOMMITTED: IsolationLevel.READ_UNCOMMITTED,
  READ_COMMITTED: IsolationLevel.READ_COMMITTED,
  REPEATABLE_READ: IsolationLevel.REPEATABLE_READ,
  SERIALIZABLE: IsolationLevel.SERIALIZABLE,
};

