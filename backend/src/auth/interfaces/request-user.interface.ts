import type { Request } from 'express';
import type { UserRole } from '../../users/entities/user.entity';

/**
 * Standardized shape for req.user across all auth endpoints
 * This ensures consistency between LocalStrategy and JwtStrategy
 */
export interface RequestUser {
  userId: string;
  email: string;
  role: UserRole;
}

/**
 * An Express request as seen by the auth guards. Both fields are optional because a
 * guard reads the request before ClerkAuthGuard has populated it (or on a public
 * route, where it never does).
 */
export interface GuardRequest extends Request {
  user?: RequestUser;
  clerkUserId?: string;
}
