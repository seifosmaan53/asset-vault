import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';

/**
 * Asset Vault data is scoped PER USER (every record carries the owning userId and every query filters
 * on the authenticated user), so there is no request-level organization context. These decorators
 * are kept only so existing controller signatures keep compiling; they always resolve to null.
 *
 * Organization MEMBERSHIP (the /organizations API) is a separate feature that is authorised
 * server-side in OrganizationsService from the caller's own membership rows, never from a
 * client-supplied organization id. Do not use these as proof of access.
 *
 * @deprecated no organization context exists; remove call sites when convenient.
 */
export const OrganizationId = createParamDecorator(
  (_data: unknown, _ctx: ExecutionContext): string | null => null,
);

/** @deprecated see OrganizationId. Always null. */
export const OrganizationRole = createParamDecorator(
  (_data: unknown, _ctx: ExecutionContext): string | null => null,
);
