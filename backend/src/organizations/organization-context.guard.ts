import { Injectable, CanActivate, ExecutionContext, BadRequestException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrganizationsService } from './organizations.service';
import { IS_ORGANIZATION_OPTIONAL_KEY } from './organization-optional.decorator';

/**
 * Organization Context Guard
 * 
 * This guard extracts the organizationId from the request (header or query param)
 * and verifies the user has access to it. It attaches the organization context
 * to the request object for use in services.
 * 
 * If organizationId is not provided, the guard will:
 * - Allow the request if @OrganizationOptional() decorator is used
 * - Otherwise, try to use the user's default organization (first one they belong to)
 */
@Injectable()
export class OrganizationContextGuard implements CanActivate {
  private readonly logger = new Logger(OrganizationContextGuard.name);

  constructor(
    private reflector: Reflector,
    private organizationsService: OrganizationsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as { userId?: string; email?: string };

    if (!user || !user.userId) {
      // If no user, let JWT guard handle it
      return true;
    }

    // Organizations removed - all data is now user-scoped
    // Set organizationId to null so services know to use userId only
    request.organizationId = null;
    request.organizationRole = null;

    return true;
  }
}

