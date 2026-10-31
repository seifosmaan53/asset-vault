import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerOptions } from '@nestjs/throttler';
import { positiveIntFromEnv } from '../common/utils/env-int.util';

/** Documented defaults; each can be raised or lowered with the environment variable named. */
export const SMTP_TEST_LIMITS = {
  /** SMTP_TEST_LIMIT_PER_MINUTE: connection tests per authenticated user per minute. */
  perUserPerMinute: 5,
  /** SMTP_TEST_LIMIT_PER_HOUR: connection tests per authenticated user per hour. */
  perUserPerHour: 20,
  /** SMTP_TEST_IP_LIMIT_PER_MINUTE: connection tests per client address per minute (any user). */
  perIpPerMinute: 20,
} as const;

/**
 * Per-user rate limit for POST /user-settings/test-email.
 *
 * The module's global ThrottlerGuard runs before authentication and keys on the client address
 * (which TRUST_PROXY controls), so it cannot see the user. This guard is applied on the route,
 * after ClerkAuthGuard, and keys on the verified user id instead; a request without one is
 * refused rather than counted against an address. It replaces the module's throttlers with its
 * own two windows, so `@Throttle` metadata for the global `default` throttler on the same route
 * still sets the per-address limit independently.
 *
 * Counts live in the throttler module's storage. With the default in-memory storage they are
 * per process: with N replicas a user gets up to N times the documented limit. That is the
 * same scope as every other limit in this API; a shared store would need a shared storage
 * provider on ThrottlerModule.
 */
@Injectable()
export class SmtpTestThrottlerGuard extends ThrottlerGuard {
  async onModuleInit(): Promise<void> {
    await super.onModuleInit();
    this.throttlers = smtpTestThrottlers();
  }

  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req.user;
    const userId =
      typeof user === 'object' && user !== null && 'userId' in user
        ? user.userId
        : undefined;
    if (typeof userId !== 'string' || userId.length === 0) {
      // Only reachable if the guard is placed before authentication; fail closed.
      return Promise.reject(new UnauthorizedException());
    }
    return Promise.resolve(`user:${userId}`);
  }
}

export function smtpTestThrottlers(): ThrottlerOptions[] {
  return [
    {
      name: 'smtp-test-user-minute',
      ttl: 60_000,
      limit: positiveIntFromEnv(
        'SMTP_TEST_LIMIT_PER_MINUTE',
        SMTP_TEST_LIMITS.perUserPerMinute,
      ),
    },
    {
      name: 'smtp-test-user-hour',
      ttl: 3_600_000,
      limit: positiveIntFromEnv(
        'SMTP_TEST_LIMIT_PER_HOUR',
        SMTP_TEST_LIMITS.perUserPerHour,
      ),
    },
  ];
}
