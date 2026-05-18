// Copyright (c) 2025 Asset Vault. All rights reserved.

// Copyright (c) 2025 Asset Vault. All rights reserved.

import { Controller, Post, Body, Req, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import type { Request } from 'express';
import { TrpcRouter } from './trpc.router';
import { TrpcService } from './trpc.service';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { createContext } from './trpc.context';

/**
 * tRPC Controller
 * 
 * Note: This is a simplified implementation. For production, consider using
 * @trpc/server/adapters/express or a dedicated NestJS tRPC adapter.
 * 
 * Current implementation provides basic tRPC endpoint that can be extended.
 */
@Controller('trpc')
@UseGuards(ClerkAuthGuard)
export class TrpcController {
  constructor(
    private readonly trpcRouter: TrpcRouter,
    private readonly trpc: TrpcService,
  ) {}

  @Post('*')
  async handler(@Req() req: Request, @Body() body: any) {
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
        throw new HttpException('Invalid tRPC path format', HttpStatus.BAD_REQUEST);
      }

      const [routerName, procedureName] = path;

      // Get the router
      const router = (caller as any)[routerName];
      if (!router) {
        throw new HttpException(`Router "${routerName}" not found`, HttpStatus.NOT_FOUND);
      }

      // Get the procedure
      const procedure = router[procedureName];
      if (!procedure) {
        throw new HttpException(
          `Procedure "${procedureName}" not found in router "${routerName}"`,
          HttpStatus.NOT_FOUND,
        );
      }

      // Call the procedure
      const result = await procedure(body);
      return result;
    } catch (error: any) {
      // Handle tRPC errors
      if (error.code && error.message) {
        throw new HttpException(
          {
            code: error.code,
            message: error.message,
            data: error.data,
          },
          error.code === 'UNAUTHORIZED' ? HttpStatus.UNAUTHORIZED : HttpStatus.BAD_REQUEST,
        );
      }

      // Handle other errors
      throw new HttpException(
        error.message || 'Internal server error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
