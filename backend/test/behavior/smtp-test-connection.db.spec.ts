/**
 * POST /user-settings/test-email — REAL application, REAL PostgreSQL (shared harness in
 * test/support/access-control-harness.ts), against a synthetic SMTP endpoint started inside this
 * file on 127.0.0.1. No real SMTP host is ever contacted and no email can be sent: the endpoint
 * implements no MAIL/DATA, and the tests assert those commands never arrive.
 *
 * Loopback is refused for real requests (MailService.isValidSmtpHost); the spy below allows
 * exactly 127.0.0.1 and nothing else, so every other host keeps the production check.
 */
import {
  bootHarness,
  cleanupSynthetic,
  clerkDirectory,
  type Harness,
  provisionSubscribedUser,
  rows,
} from '../support/access-control-harness';
import * as net from 'net';
import { MailService } from '../../src/mail/mail.service';
import { MASKED_SMTP_PASSWORD } from '../../src/user-settings/user-settings.service';
import type * as HarnessModule from '../support/access-control-harness';
import type * as NestCommon from '@nestjs/common';
import type * as ClerkBackend from '@clerk/backend';
import type * as JsonWebToken from 'jsonwebtoken';

// Same stubs as access-control.db.spec.ts (tRPC is ESM-only; Clerk is not called over the network),
// typed so the factories stay lint-clean. Type-only imports are erased, so jest's hoisting is unaffected.
jest.mock('../../src/trpc/trpc.module', () => ({
  TrpcModule: class TrpcModule {},
}));
jest.mock('../../src/trpc/trpc.controller', () => {
  const { Controller } =
    jest.requireActual<typeof NestCommon>('@nestjs/common');
  class TrpcController {}
  Controller('trpc-stub')(TrpcController);
  return { TrpcController };
});
jest.mock('@clerk/backend', () => {
  const actual = jest.requireActual<typeof ClerkBackend>('@clerk/backend');
  const jsonwebtoken = jest.requireActual<typeof JsonWebToken>('jsonwebtoken');
  const harness = jest.requireActual<typeof HarnessModule>(
    '../support/access-control-harness',
  );
  return {
    ...actual,
    verifyToken: jest.fn((token: string) =>
      Promise.resolve(
        jsonwebtoken.verify(token, harness.TEST_CLERK_SIGNING_SECRET),
      ),
    ),
    createClerkClient: () => ({
      users: {
        getUser: (id: string) => {
          const u = harness.clerkDirectory.get(id);
          return u
            ? Promise.resolve(u)
            : Promise.reject(new Error('user not found'));
        },
      },
    }),
  };
});

/**
 * A synthetic SMTP endpoint on 127.0.0.1 that speaks just enough SMTP for nodemailer's verify():
 * greeting, EHLO, AUTH PLAIN / AUTH LOGIN, QUIT. It records every connection, every credential
 * pair it is given and every command, so the tests can prove what reached the server and that no
 * message (MAIL FROM / DATA) was ever started. Never a real SMTP host.
 */
interface SyntheticSmtp {
  port: number;
  connections: number;
  auths: { user: string; pass: string }[];
  commands: string[];
  /** Every credential pair since the server started (auths is per-test, see reset). */
  allAuths: { user: string; pass: string }[];
  reset: () => void;
  close: () => Promise<void>;
}

function startSyntheticSmtp(accept: {
  user: string;
  pass: string;
}): Promise<SyntheticSmtp> {
  const state = {
    connections: 0,
    auths: [] as { user: string; pass: string }[],
    commands: [] as string[],
    allAuths: [] as { user: string; pass: string }[],
  };
  const decode = (b64: string) => Buffer.from(b64, 'base64').toString('utf8');
  const server = net.createServer((socket) => {
    state.connections += 1;
    let buffer = '';
    let loginStep: 'user' | 'pass' | null = null;
    let loginUser = '';
    const reply = (line: string) => socket.write(`${line}\r\n`);
    const finishAuth = (user: string, pass: string) => {
      state.auths.push({ user, pass });
      state.allAuths.push({ user, pass });
      reply(
        user === accept.user && pass === accept.pass
          ? '235 2.7.0 Authentication successful'
          : '535 5.7.8 Authentication credentials invalid',
      );
    };
    reply('220 synthetic.invalid ESMTP test endpoint');
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      let i: number;
      while ((i = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, i);
        buffer = buffer.slice(i + 2);
        if (loginStep === 'user') {
          loginUser = decode(line);
          loginStep = 'pass';
          reply('334 UGFzc3dvcmQ6');
          continue;
        }
        if (loginStep === 'pass') {
          loginStep = null;
          finishAuth(loginUser, decode(line));
          continue;
        }
        const verb = line.split(' ')[0].toUpperCase();
        state.commands.push(verb);
        if (verb === 'EHLO' || verb === 'HELO') {
          socket.write('250-synthetic.invalid\r\n250 AUTH PLAIN LOGIN\r\n');
        } else if (verb === 'AUTH') {
          const [, mech, initial] = line.split(' ');
          if (mech.toUpperCase() === 'PLAIN' && initial) {
            const [, user, pass] = decode(initial).split('\u0000');
            finishAuth(user, pass);
          } else if (mech.toUpperCase() === 'LOGIN') {
            loginStep = 'user';
            reply('334 VXNlcm5hbWU6');
          } else {
            reply('504 5.5.4 Unsupported');
          }
        } else if (verb === 'QUIT') {
          reply('221 2.0.0 Bye');
          socket.end();
        } else {
          reply('502 5.5.1 Not implemented by the synthetic endpoint');
        }
      }
    });
    socket.on('error', () => undefined);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({
        get connections() {
          return state.connections;
        },
        get auths() {
          return state.auths;
        },
        get commands() {
          return state.commands;
        },
        get allAuths() {
          return state.allAuths;
        },
        reset: () => {
          state.connections = 0;
          state.auths = [];
          state.commands = [];
        },
        port,
        close: () =>
          new Promise<void>((done) => {
            server.close(() => done());
          }),
      });
    });
  });
}

interface TestResult {
  success: boolean;
  message: string;
}

const STORED_HASH =
  '$2b$10$abcdefghijklmnopqrstuuS1o2p3q4r5s6t7u8v9w0x1y2z3A4B5C6';

describe('POST /user-settings/test-email (real app + real PostgreSQL + synthetic SMTP)', () => {
  let h: Harness;
  let alice: { token: string; userId: string };
  let bob: { token: string; userId: string };
  let smtp: SyntheticSmtp;
  let aliceRowBefore: string;
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  const settingsRow = async (userId: string) =>
    JSON.stringify(
      await rows(h, 'select * from user_settings where "userId" = $1', [
        userId,
      ]),
    );

  const post = (token: string, body: Record<string, unknown>) =>
    h.http().post('/user-settings/test-email').set(auth(token)).send(body);

  beforeAll(async () => {
    jest
      .spyOn(MailService.prototype, 'isValidSmtpHost')
      .mockImplementation((host: string) => host === '127.0.0.1');
    jest
      .spyOn(MailService.prototype, 'isAllowedSmtpAddress')
      .mockImplementation((address: string) => address === '127.0.0.1');
    // The synthetic server is plaintext; production never allows AUTH without TLS.
    jest
      .spyOn(MailService.prototype, 'allowsPlaintextAuth')
      .mockReturnValue(true);
    // This suite's own requests must not be rate limited; the limits have their own suite.
    process.env.SMTP_TEST_LIMIT_PER_MINUTE = '1000';
    process.env.SMTP_TEST_LIMIT_PER_HOUR = '1000';
    process.env.SMTP_TEST_IP_LIMIT_PER_MINUTE = '1000';
    smtp = await startSyntheticSmtp({ user: 'alice', pass: 'right-pass' });
    h = await bootHarness();
    await cleanupSynthetic(h);
    alice = await provisionSubscribedUser(
      h,
      'user_smtp_alice_t',
      'smtp-alice@access-test.invalid',
    );
    bob = await provisionSubscribedUser(
      h,
      'user_smtp_bob_t',
      'smtp-bob@access-test.invalid',
    );
    // Alice has stored SMTP settings, including a stored (one-way) password, pointing at the
    // synthetic endpoint, exactly as an account configured by an earlier version would.
    expect(
      (await h.http().get('/user-settings').set(auth(alice.token))).status,
    ).toBe(200);
    await h.ds.query(
      `update user_settings set "smtpHost" = '127.0.0.1', "smtpPort" = $2, "smtpUser" = 'alice',
         "smtpPassword" = $3 where "userId" = $1`,
      [alice.userId, smtp.port, STORED_HASH],
    );
    aliceRowBefore = await settingsRow(alice.userId);
  }, 120000);

  afterAll(async () => {
    jest.restoreAllMocks();
    await smtp.close();
    await cleanupSynthetic(h);
    await h.close();
    clerkDirectory.clear();
  });

  beforeEach(() => {
    smtp.reset();
  });

  it('fixture: the settings response shows the stored password only as the placeholder', async () => {
    const r = await h.http().get('/user-settings').set(auth(alice.token));
    const body = r.body as Record<string, unknown>;
    const settings = (body.data ?? body) as Record<string, unknown>;
    expect(settings.smtpPassword).toBe(MASKED_SMTP_PASSWORD);
    expect(JSON.stringify(r.body)).not.toContain(STORED_HASH);
  });

  it('tests the SUBMITTED configuration, not the stored one', async () => {
    const r = await post(alice.token, {
      smtpHost: '127.0.0.1',
      smtpPort: smtp.port,
      smtpSecure: false,
      smtpUser: 'alice',
      smtpPassword: 'right-pass',
    });
    expect(r.status).toBe(201);
    expect((r.body as TestResult).success).toBe(true);
    expect(smtp.auths).toEqual([{ user: 'alice', pass: 'right-pass' }]);
    expect(smtp.commands).not.toContain('MAIL');
    expect(smtp.commands).not.toContain('DATA');
  });

  it('a submitted username/password that differ from the stored ones are what the server sees', async () => {
    const r = await post(alice.token, {
      smtpHost: '127.0.0.1',
      smtpPort: smtp.port,
      smtpSecure: false,
      smtpUser: 'someone-else',
      smtpPassword: 'other-pass',
    });
    expect(r.status).toBe(201);
    expect((r.body as TestResult).success).toBe(false);
    expect(smtp.auths).toEqual([{ user: 'someone-else', pass: 'other-pass' }]);
  });

  it('redacted password with the stored host and user: 400, and the server is never contacted', async () => {
    const r = await post(alice.token, {
      smtpHost: '127.0.0.1',
      smtpPort: smtp.port,
      smtpSecure: false,
      smtpUser: 'alice',
      smtpPassword: MASKED_SMTP_PASSWORD,
    });
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.body)).toMatch(/Enter the SMTP password/);
    expect(smtp.connections).toBe(0);
  });

  it('redacted, empty or omitted password with a different host: 400 without contacting anything', async () => {
    const other = await startSyntheticSmtp({ user: 'alice', pass: 'x' });
    try {
      for (const password of [MASKED_SMTP_PASSWORD, '', undefined]) {
        const r = await post(alice.token, {
          smtpHost: '127.0.0.1',
          smtpPort: other.port,
          smtpUser: 'alice',
          ...(password === undefined ? {} : { smtpPassword: password }),
        });
        expect(r.status).toBe(400);
      }
      expect(other.connections).toBe(0);
      expect(smtp.connections).toBe(0);
    } finally {
      await other.close();
    }
  });

  it('rejects an incomplete or malformed body with 400', async () => {
    for (const body of [
      {},
      { smtpHost: '127.0.0.1', smtpPassword: 'p' },
      { smtpUser: 'alice', smtpPassword: 'p' },
      {
        smtpHost: '127.0.0.1',
        smtpUser: 'alice',
        smtpPassword: 'p',
        smtpPort: 70000,
      },
      {
        smtpHost: '127.0.0.1',
        smtpUser: 'alice',
        smtpPassword: 'p',
        unexpected: 1,
      },
    ]) {
      expect((await post(alice.token, body)).status).toBe(400);
    }
    expect(smtp.connections).toBe(0);
  });

  it("user B's test never uses user A's stored password", async () => {
    // B names A's host and user and sends the placeholder: refused, nothing contacted.
    const redacted = await post(bob.token, {
      smtpHost: '127.0.0.1',
      smtpPort: smtp.port,
      smtpUser: 'alice',
      smtpPassword: MASKED_SMTP_PASSWORD,
    });
    expect(redacted.status).toBe(400);
    expect(smtp.connections).toBe(0);

    // With a password of B's own, the server receives exactly that and nothing of A's.
    const own = await post(bob.token, {
      smtpHost: '127.0.0.1',
      smtpPort: smtp.port,
      smtpSecure: false,
      smtpUser: 'alice',
      smtpPassword: 'bobs-guess',
    });
    expect(own.status).toBe(201);
    expect((own.body as TestResult).success).toBe(false);
    expect(smtp.auths).toEqual([{ user: 'alice', pass: 'bobs-guess' }]);
  });

  it('the stored password never reached the SMTP server in any test', () => {
    expect(smtp.allAuths.map((a) => a.pass)).not.toContain(STORED_HASH);
    expect(smtp.allAuths.length).toBeGreaterThan(0);
  });

  it('nothing was written to user settings by any test', async () => {
    expect(await settingsRow(alice.userId)).toBe(aliceRowBefore);
    expect(
      await rows(
        h,
        'select 1 from user_settings where "userId" = $1 and "smtpHost" is not null',
        [bob.userId],
      ),
    ).toEqual([]);
  });
});
