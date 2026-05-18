// Copyright (c) 2025 Asset Vault. All rights reserved.

/**
 * Pagination Links Utility
 * Fixes Issue #71: Missing Database Query Result Pagination Links
 * 
 * Generates HATEOAS-style pagination links
 */
export interface PaginationLinks {
  first?: string;
  prev?: string;
  next?: string;
  last?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
  links: PaginationLinks;
}

/**
 * Generate pagination links
 */
export function generatePaginationLinks(
  baseUrl: string,
  page: number,
  limit: number,
  total: number,
  queryParams?: Record<string, string | number | boolean>,
): PaginationLinks {
  const totalPages = Math.ceil(total / limit);
  const links: PaginationLinks = {};

  // Build query string from params
  const buildQueryString = (pageNum: number): string => {
    const params = new URLSearchParams();
    params.append('page', pageNum.toString());
    params.append('limit', limit.toString());

    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }

    return params.toString();
  };

  // First page
  if (page > 1) {
    links.first = `${baseUrl}?${buildQueryString(1)}`;
  }

  // Previous page
  if (page > 1) {
    links.prev = `${baseUrl}?${buildQueryString(page - 1)}`;
  }

  // Next page
  if (page < totalPages) {
    links.next = `${baseUrl}?${buildQueryString(page + 1)}`;
  }

  // Last page
  if (page < totalPages && totalPages > 1) {
    links.last = `${baseUrl}?${buildQueryString(totalPages)}`;
  }

  return links;
}

/**
 * Create paginated response with links
 */
export function createPaginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
  baseUrl: string,
  queryParams?: Record<string, string | number | boolean>,
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages,
    },
    links: generatePaginationLinks(baseUrl, page, limit, total, queryParams),
  };
}

