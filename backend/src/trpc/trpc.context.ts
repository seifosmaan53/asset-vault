// Copyright (c) 2025 Asset Vault. All rights reserved.

import type { GuardRequest } from '../auth/interfaces/request-user.interface';
import type { Context } from './trpc.service';

/**
 * Create tRPC context from Express request
 */
export function createContext(req: GuardRequest): Promise<Context> {
  // Extract user from request (set by ClerkAuthGuard)
  const user = req.user;

  // ClerkAuthGuard attaches { userId, email, role }, and `req.clerkUserId` separately. This used to read
  // `user.id` and `user.clerkUserId`, which do not exist, so every procedure received an undefined
  // owner id. That failed closed (an undefined id matches no rows) but meant the routers never worked.
  return Promise.resolve({
    user: user?.userId
      ? {
          id: user.userId,
          email: user.email,
          clerkUserId: req.clerkUserId,
        }
      : undefined,
  });
}
