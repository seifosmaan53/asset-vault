import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // no roles requirements
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as { role?: UserRole; userId?: string; email?: string };

    if (!user || !user.role) {
      this.logger.warn(
        `RBAC Denial: User ${user?.userId || 'unknown'} attempted to access protected endpoint without role`,
      );
      throw new ForbiddenException('Access denied');
    }

    if (!requiredRoles.includes(user.role)) {
      this.logger.warn(
        `RBAC Denial: User ${user.email || user.userId} (role: ${user.role}) attempted to access endpoint requiring [${requiredRoles.join(', ')}] at ${request.method} ${request.url}`,
      );
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}

