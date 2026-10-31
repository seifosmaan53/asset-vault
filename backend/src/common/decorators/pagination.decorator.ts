// Copyright (c) 2025 Asset Vault. All rights reserved.

import { type ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

/**
 * The string a query parameter carries. `?page=2&page=3` arrives as an array, and
 * parseInt of the array's string form reads its first element; a nested object or a
 * missing value has no number in it, so '' (parsed as NaN) is equivalent.
 */
function firstQueryValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return '';
}

/**
 * Pagination decorator to extract and validate pagination parameters
 * Fixes Issue #25: Missing Pagination for Large Lists
 *
 * Usage: @Get() findAll(@Pagination() pagination: PaginationParams)
 */
export const Pagination = createParamDecorator(
  (
    data: { defaultLimit?: number; maxLimit?: number } = {},
    ctx: ExecutionContext,
  ): PaginationParams => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const query = request.query;

    const defaultLimit = data.defaultLimit ?? 20;
    const maxLimit = data.maxLimit ?? 1000;

    const page = Math.max(1, parseInt(firstQueryValue(query.page), 10) || 1);
    const limit = Math.min(
      maxLimit,
      Math.max(1, parseInt(firstQueryValue(query.limit), 10) || defaultLimit),
    );
    const skip = (page - 1) * limit;

    return { page, limit, skip };
  },
);
