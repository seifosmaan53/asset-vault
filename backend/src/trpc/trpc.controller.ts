// Copyright (c) 2025 Asset Vault. All rights reserved.

import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { GuardRequest } from '../auth/interfaces/request-user.interface';
import { TrpcRouter } from './trpc.router';
import { TrpcService } from './trpc.service';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { createContext } from './trpc.context';
import { errorField } from './error-fields';
import { readProperty } from '../common/utils/read-property.util';
import { ApiTags } from '@nestjs/swagger';

/** A tRPC caller procedure: takes the raw input, resolves to the procedure's output. */
function isProcedure(
  value: unknown,
): value is (input: unknown) => Promise<unknown> {
  return typeof value === 'function';
}

/**
 * tRPC Controller
 *
 * Note: This is a simplified implementation. For production, consider using
 * @trpc/server/adapters/express or a dedicated NestJS tRPC adapter.
 *
 * Current implementation provides basic tRPC endpoint that can be extended.
 */
@ApiTags('trpc')
@Controller('trpc')
@UseGuards(ClerkAuthGuard)
export class TrpcController {
  constructor(
    private readonly trpcRouter: TrpcRouter,
    private readonly trpc: TrpcService,
  ) {}

  @Post('*')
  async handler(@Req() req: GuardRequest, @Body() body: unknown) {
    try {
      const ctx = await createContext(req);
      const caller = this.trpcRouter.appRouter.createCaller(ctx);

      // Extract procedure path from URL
      // URL format: /api/v1/trpc/invoices.list or /api/v1/trpc/invoices.get
      const path = (req.url || '')
        .replace('/api/v1/trpc/', '')
        .split('?')[0]
        .split('.');

      if (path.length !== 2) {
        throw new HttpException(
          'Invalid tRPC path format',
          HttpStatus.BAD_REQUEST,
        );
      }

      const [routerName, procedureName] = path;

      // Get the router. The caller is a tRPC proxy, so routers and procedures are
      // looked up by name at runtime.
      const router = readProperty(caller, routerName);
      if (!router) {
        throw new HttpException(
          `Router "${routerName}" not found`,
          HttpStatus.NOT_FOUND,
        );
      }

      // Get the procedure
      const procedure = readProperty(router, procedureName);
      if (!isProcedure(procedure)) {
        throw new HttpException(
          `Procedure "${procedureName}" not found in router "${routerName}"`,
          HttpStatus.NOT_FOUND,
        );
      }

      // Call the procedure
      const result = await procedure(body);
      return result;
    } catch (error: unknown) {
      // Handle tRPC errors
      const code = errorField(error, 'code');
      const message = errorField(error, 'message');
      if (code && message) {
        throw new HttpException(
          {
            code,
            message,
            data: errorField(error, 'data'),
          },
          code === 'UNAUTHORIZED'
            ? HttpStatus.UNAUTHORIZED
            : HttpStatus.BAD_REQUEST,
        );
      }

      // Handle other errors
      throw new HttpException(
        typeof message === 'string' && message
          ? message
          : 'Internal server error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
