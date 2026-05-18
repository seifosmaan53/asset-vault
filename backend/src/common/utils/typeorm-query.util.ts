// Copyright (c) 2025 Asset Vault. All rights reserved.

import { SelectQueryBuilder, IsNull, ObjectLiteral } from 'typeorm';

/**
 * TypeORM Query Utility
 * Fixes Issue #1: Replace 'as any' type assertions with proper TypeORM query builder
 * 
 * Provides type-safe utilities for common TypeORM query patterns
 */

/**
 * Build a where condition for organization-scoped queries
 * Supports both org-shared (organizationId) and safe legacy (organizationId IS NULL AND userId)
 */
export function buildOrgScopedWhere<T extends ObjectLiteral>(
  queryBuilder: SelectQueryBuilder<T>,
  alias: string,
  organizationId: string | null,
  userId: string,
): SelectQueryBuilder<T> {
  // Organizations removed - filter by userId only (user-scoped data)
  return queryBuilder.where(`${alias}.userId = :userId`, { userId });
}

/**
 * Build a findOne query with organization scope
 * Returns a query builder that can be further customized
 */
export function buildOrgScopedFindOneQuery<T extends ObjectLiteral>(
  queryBuilder: SelectQueryBuilder<T>,
  alias: string,
  id: string,
  organizationId: string | null,
  userId: string,
): SelectQueryBuilder<T> {
  // Organizations removed - filter by userId only (user-scoped data)
  return queryBuilder
    .where(`${alias}.id = :id`, { id })
    .andWhere(`${alias}.userId = :userId`, { userId });
}

/**
 * Type-safe where condition for organization-scoped queries
 * Can be used with Repository.findOne() when you need a simple object condition
 */
export interface OrgScopedWhereCondition {
  id: string;
  organizationId?: string;
  userId?: string;
}

/**
 * Create a type-safe where condition array for organization-scoped queries
 * Note: This still requires query builder for proper OR logic, but provides type safety
 */
export function createOrgScopedWhereConditions(
  id: string,
  organizationId: string,
  userId: string,
): Array<{ id: string; organizationId: string } | { id: string; userId: string; organizationId: null }> {
  return [
    { id, organizationId },
    { id, userId, organizationId: null },
  ];
}

