import { UserRole } from '../../users/entities/user.entity';

/**
 * Standardized shape for req.user across all auth endpoints
 * This ensures consistency between LocalStrategy and JwtStrategy
 */
export interface RequestUser {
  userId: string;
  email: string;
  role: UserRole;
}

