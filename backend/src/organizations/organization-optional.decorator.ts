import { SetMetadata } from '@nestjs/common';

export const IS_ORGANIZATION_OPTIONAL_KEY = 'isOrganizationOptional';

/**
 * Decorator to mark endpoints where organization context is optional
 * If not provided, the guard will try to use the user's default organization
 * or allow the request if the user has no organizations
 */
export const OrganizationOptional = () => SetMetadata(IS_ORGANIZATION_OPTIONAL_KEY, true);

