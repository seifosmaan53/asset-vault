// Copyright (c) 2025 Asset Vault. All rights reserved.

import { Request } from 'express';
import { Context } from './trpc.service';

/**
 * Create tRPC context from Express request
 */
export async function createContext(req: Request): Promise<Context> {
  // Extract user from request (set by ClerkAuthGuard)
  const user = (req as any).user;

  return {
    user: user
      ? {
          id: user.id,
          email: user.email,
          clerkUserId: user.clerkUserId,
        }
      : undefined,
  };
}
