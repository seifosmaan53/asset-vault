// Copyright (c) 2025 Asset Vault. All rights reserved.

import type { Request } from 'express';
import type { Context } from './trpc.service';

/**
 * Create tRPC context from Express request
 */
export function createContext(req: Request): Promise<Context> {
  // Extract user from request (set by ClerkAuthGuard)
  const user = (req as any).user;

  // ClerkAuthGuard attaches { userId, email, role }, and `req.clerkUserId` separately. This used to read
  // `user.id` and `user.clerkUserId`, which do not exist, so every procedure received an undefined
  // owner id. That failed closed (an undefined id matches no rows) but meant the routers never worked.
  return Promise.resolve({
    user: user?.userId
      ? {
          id: user.userId as string,
          email: user.email as string,
          clerkUserId: (req as any).clerkUserId as string,
        }
      : undefined,
  });
}
