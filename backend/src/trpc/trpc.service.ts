// Copyright (c) 2025 Asset Vault. All rights reserved.

import { Injectable } from '@nestjs/common';
import { initTRPC, TRPCError } from '@trpc/server';
import { ZodError } from 'zod';

// Use require for superjson to handle ESM/CommonJS compatibility
// eslint-disable-next-line @typescript-eslint/no-require-imports
const superjson = require('superjson');

/**
 * Context for tRPC procedures
 * This will be populated by the NestJS adapter
 */
export interface Context {
  user?: {
    id: string;
    email: string;
    clerkUserId: string;
  };
}

@Injectable()
export class TrpcService {
  trpc = initTRPC.context<Context>().create({
    transformer: superjson,
    errorFormatter({ shape, error }) {
      return {
        ...shape,
        data: {
          ...shape.data,
          zodError:
            error.cause instanceof ZodError ? error.cause.flatten() : null,
        },
      };
    },
  });

  procedure = this.trpc.procedure;
  router = this.trpc.router;
  mergeRouters = this.trpc.mergeRouters;

  /**
   * Protected procedure - requires authentication
   */
  protectedProcedure = this.trpc.procedure.use(({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'You must be logged in to access this resource',
      });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user, // Now guaranteed to be defined
      },
    });
  });
}
