// Copyright (c) 2025 Asset Vault. All rights reserved.

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

export const REQUIRED_HEADERS_KEY = 'requiredHeaders';

/**
 * Decorator to specify required headers for an endpoint
 * Fixes Issue #64: Missing API Request Header Validation
 */
export const RequireHeaders = (...headers: string[]) =>
  SetMetadata(REQUIRED_HEADERS_KEY, headers);

/**
 * Header Validation Guard
 * Fixes Issue #64: Missing API Request Header Validation
 */
@Injectable()
export class HeaderValidationGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const requiredHeaders = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_HEADERS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredHeaders || requiredHeaders.length === 0) {
      return true; // No header requirements
    }

    const missingHeaders: string[] = [];

    for (const header of requiredHeaders) {
      const headerValue = request.headers[header.toLowerCase()];
      // Node only delivers repeated headers as an array for set-cookie; any other
      // header arrives as one string.
      const value = Array.isArray(headerValue)
        ? headerValue.join(', ')
        : headerValue;
      if (!value || value.trim() === '') {
        missingHeaders.push(header);
      }
    }

    if (missingHeaders.length > 0) {
      throw new BadRequestException(
        `Missing required headers: ${missingHeaders.join(', ')}`,
      );
    }

    return true;
  }
}
