import { UnauthorizedException } from '@nestjs/common';
import { positiveIntFromEnv } from '../common/utils/env-int.util';
import {
  SMTP_TEST_LIMITS,
  SmtpTestThrottlerGuard,
  smtpTestThrottlers,
} from './smtp-test-throttler.guard';

describe('positiveIntFromEnv', () => {
  const name = 'SMTP_TEST_SPEC_VALUE';
  afterEach(() => {
    delete process.env[name];
  });

  it.each([undefined, '', '  '])(
    'falls back when unset or blank (%p)',
    (raw) => {
      if (raw !== undefined) process.env[name] = raw;
      expect(positiveIntFromEnv(name, 7)).toBe(7);
    },
  );

  it('reads a positive integer', () => {
    process.env[name] = '12';
    expect(positiveIntFromEnv(name, 7)).toBe(12);
  });

  it.each(['0', '-1', '1.5', 'abc', '1e3x'])('rejects %s', (raw) => {
    process.env[name] = raw;
    expect(() => positiveIntFromEnv(name, 7)).toThrow(/positive integer/);
  });
});

describe('smtpTestThrottlers', () => {
  afterEach(() => {
    delete process.env.SMTP_TEST_LIMIT_PER_MINUTE;
    delete process.env.SMTP_TEST_LIMIT_PER_HOUR;
  });

  it('uses the documented defaults', () => {
    expect(smtpTestThrottlers()).toEqual([
      {
        name: 'smtp-test-user-minute',
        ttl: 60_000,
        limit: SMTP_TEST_LIMITS.perUserPerMinute,
      },
      {
        name: 'smtp-test-user-hour',
        ttl: 3_600_000,
        limit: SMTP_TEST_LIMITS.perUserPerHour,
      },
    ]);
  });

  it('reads overrides from the environment', () => {
    process.env.SMTP_TEST_LIMIT_PER_MINUTE = '2';
    process.env.SMTP_TEST_LIMIT_PER_HOUR = '9';
    expect(smtpTestThrottlers().map((t) => t.limit)).toEqual([2, 9]);
  });
});

describe('SmtpTestThrottlerGuard tracker', () => {
  // getTracker is protected; reach it through a minimal subclass rather than a cast.
  class Exposed extends SmtpTestThrottlerGuard {
    track(req: Record<string, unknown>): Promise<string> {
      return this.getTracker(req);
    }
  }
  const guard = Object.create(Exposed.prototype) as Exposed;

  it('keys on the verified user id, never on the address', async () => {
    await expect(
      guard.track({ user: { userId: 'u-1' }, ip: '203.0.113.9' }),
    ).resolves.toBe('user:u-1');
  });

  it.each([
    ['no user', { ip: '203.0.113.9' }],
    ['empty id', { user: { userId: '' } }],
    ['non-string id', { user: { userId: 42 } }],
  ])('refuses a request with %s instead of counting it', async (_l, req) => {
    await expect(guard.track(req)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
