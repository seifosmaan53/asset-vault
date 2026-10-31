import type { RequestUser } from '../../auth/interfaces/request-user.interface';

/**
 * The part of the request a handler may rely on after ClerkAuthGuard has run.
 *
 * The guard rejects the request (401) unless it can attach a RequestUser, so a
 * handler on a controller guarded by ClerkAuthGuard can rely on `user` being set.
 * Do not use this type on routes that are not behind ClerkAuthGuard.
 *
 * Only `user` is declared on purpose: handlers here read nothing else from the
 * request, and unit tests can pass a plain `{ user }` object without a cast.
 */
export interface AuthenticatedRequest {
  user: RequestUser;
}
