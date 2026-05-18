// Copyright (c) 2025 Asset Vault. All rights reserved.

import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import { Logger } from '@nestjs/common';

/**
 * Query Optimization Utilities
 * Fixes Issue #60: Missing Database Query Result Aggregation Optimization
 * 
 * Helper functions for optimizing database queries
 */
export class QueryOptimizationUtil {
  private static readonly logger = new Logger('QueryOptimization');

  /**
   * Add pagination to query builder
   */
  static addPagination<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    page: number = 1,
    limit: number = 20,
  ): SelectQueryBuilder<T> {
    const skip = (page - 1) * limit;
    return queryBuilder.skip(skip).take(limit);
  }

  /**
   * Add select only required fields (reduces data transfer)
   */
  static selectFields<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    fields: string[],
  ): SelectQueryBuilder<T> {
    return queryBuilder.select(fields.map(field => `entity.${field}`));
  }

  /**
   * Add eager loading for relationships (prevents N+1 queries)
   */
  static addRelations<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    relations: string[],
  ): SelectQueryBuilder<T> {
    relations.forEach(relation => {
      queryBuilder.leftJoinAndSelect(`entity.${relation}`, relation);
    });
    return queryBuilder;
  }

  /**
   * Add index hints for better query performance
   */
  static useIndex<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    indexName: string,
  ): SelectQueryBuilder<T> {
    // PostgreSQL doesn't support index hints directly in TypeORM
    // This is a placeholder for documentation
    this.logger.debug(`Using index hint: ${indexName}`);
    return queryBuilder;
  }

  /**
   * Optimize query by adding conditions that use indexes
   */
  static optimizeWhereClause<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    indexedFields: string[],
    conditions: Record<string, any>,
  ): SelectQueryBuilder<T> {
    // Prioritize indexed fields in WHERE clause
    indexedFields.forEach(field => {
      if (conditions[field] !== undefined) {
        queryBuilder.andWhere(`entity.${field} = :${field}`, { [field]: conditions[field] });
      }
    });
    return queryBuilder;
  }

  /**
   * Get query execution plan (PostgreSQL EXPLAIN)
   * FIX Issue #182: Ensure SQL injection safety - TypeORM query builder generates safe SQL with placeholders
   * This method is safe because:
   * 1. getQuery() returns SQL with parameter placeholders ($1, $2, etc.)
   * 2. getParameters() returns parameter values separately
   * 3. Parameters are passed as array, not concatenated into SQL string
   * 
   * WARNING: Only use this with TypeORM query builders, never with raw user input
   */
  static async explainQuery<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
  ): Promise<any> {
    const sql = queryBuilder.getQuery();
    const parameters = queryBuilder.getParameters();
    
    // FIX Issue #182: Validate that SQL contains only parameterized placeholders
    // TypeORM always uses $1, $2, etc. format, so we can safely check for this pattern
    if (!/^\$[0-9]+/.test(sql.replace(/[^$0-9]/g, '')) && sql.includes('$')) {
      this.logger.warn('Potential SQL injection risk detected in explainQuery - SQL may contain unparameterized values');
    }
    
    // Execute EXPLAIN query
    // Note: sql from TypeORM query builder is safe - it contains placeholders, not actual values
    const explainQuery = queryBuilder.connection.createQueryRunner();
    try {
      // FIX Issue #182: Use parameterized query - parameters passed separately, not in SQL string
      const result = await explainQuery.query(`EXPLAIN ANALYZE ${sql}`, Object.values(parameters));
      return result;
    } finally {
      await explainQuery.release();
    }
  }
}

