// Copyright (c) 2025 Asset Vault. All rights reserved.

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

/**
 * Pagination decorator to extract and validate pagination parameters
 * Fixes Issue #25: Missing Pagination for Large Lists
 * 
 * Usage: @Get() findAll(@Pagination() pagination: PaginationParams)
 */
export const Pagination = createParamDecorator(
  (data: { defaultLimit?: number; maxLimit?: number } = {}, ctx: ExecutionContext): PaginationParams => {
    const request = ctx.switchToHttp().getRequest();
    const query = request.query;

    const defaultLimit = data.defaultLimit ?? 20;
    const maxLimit = data.maxLimit ?? 1000;
    
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
    const skip = (page - 1) * limit;

    return { page, limit, skip };
  },
);

