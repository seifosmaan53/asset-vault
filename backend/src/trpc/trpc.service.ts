// Copyright (c) 2025 Asset Vault. All rights reserved.

import { Injectable } from '@nestjs/common';
import { initTRPC, TRPCError } from '@trpc/server';
import { ZodError } from 'zod';

import type * as SuperJsonModule from 'superjson' with { 'resolution-mode': 'import' };

// superjson 2 is ESM-only and this package compiles to CommonJS, so it is loaded with
// require() (Node's require(esm) returns the module namespace, which carries the
// named serialize/deserialize exports tRPC needs). TypeScript 5.7 cannot type a
// require() of an ES module, so the value is annotated with the namespace type taken
// from the type-only import above.
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment -- require() of an ESM-only package is untyped in TS 5.7; annotated with its namespace type
const superjson: typeof SuperJsonModule = require('superjson');

/**
 * Context for tRPC procedures
 * This will be populated by the NestJS adapter
 */
export interface Context {
  user?: {
    id: string;
    email: string;
    /** Set by ClerkAuthGuard alongside req.user; no procedure reads it today. */
    clerkUserId: string | undefined;
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
