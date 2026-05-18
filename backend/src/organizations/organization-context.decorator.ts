import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator to extract organization context from request
 * Usage: @OrganizationId() organizationId: string
 */
export const OrganizationId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.organizationId || null;
  },
);

/**
 * Decorator to extract organization role from request
 * Usage: @OrganizationRole() role: OrganizationRole
 */
export const OrganizationRole = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.organizationRole || null;
  },
);

