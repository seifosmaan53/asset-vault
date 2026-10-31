/**
 * Rate limits and connection bounds of POST /user-settings/test-email, through the real HTTP
 * stack (real AppModule, real PostgreSQL, the real ThrottlerGuard and ClerkAuthGuard order).
 *
 * The limits are set small through the environment before the app boots:
 * 3 per user per minute, 8 per client address per minute, 2 tests in flight per process, and a
 * 1.5 s deadline. Only synthetic servers on 127.0.0.1 are contacted.
 */
import { Logger } from '@nestjs/common';
import {
  ThrottlerStorage,
  type ThrottlerStorageService,
} from '@nestjs/throttler';
import * as net from 'net';
import type * as ClerkBackend from '@clerk/backend';
import type * as NestCommon from '@nestjs/common';
import type * as JsonWebToken from 'jsonwebtoken';
import type * as HarnessModule from '../support/access-control-harness';
import { MailService } from '../../src/mail/mail.service';
import { at } from '../support/json';
import {
  bootHarness,
  cleanupSynthetic,
  clerkDirectory,
  forgedToken,
  type Harness,
  provisionSubscribedUser,
  rows,
  TEST_CLERK_SIGNING_SECRET,
} from '../support/access-control-harness';

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

const PASSWORD = 'synthetic-right-pass';

interface Listener {
  port: number;
  readonly connections: number;
  readonly closed: number;
  readonly commands: string[];
  close: () => Promise<void>;
}

/** Greeting, EHLO with AUTH PLAIN, AUTH, QUIT; records every command; refuses MAIL/DATA. */
function smtpListener(): Promise<Listener> {
  const state = { connections: 0, closed: 0, commands: [] as string[] };
  const server = net.createServer((socket) => {
    state.connections += 1;
    socket.on('close', () => (state.closed += 1));
    socket.write('220 synthetic ESMTP\r\n');
    let buffer = '';
    socket.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      let index = buffer.indexOf('\r\n');
      while (index >= 0) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        const verb = line.split(' ')[0].toUpperCase();
        state.commands.push(verb);
        if (verb === 'EHLO')
          socket.write('250-synthetic\r\n250 AUTH PLAIN\r\n');
        else if (verb === 'AUTH') {
          const initial = line.split(' ')[2] ?? '';
          const [, user, pass] = Buffer.from(initial, 'base64')
            .toString('utf8')
            .split('\u0000');
          socket.write(
            user === 'alice' && pass === PASSWORD ? '235 ok\r\n' : '535 no\r\n',
          );
        } else if (verb === 'QUIT') {
          socket.end('221 bye\r\n');
        } else socket.write('503 no\r\n');
        index = buffer.indexOf('\r\n');
      }
    });
  });
  return listen(server, state);
}

/** Accepts and then says nothing, so the client's deadline is what ends the test. */
function silentListener(): Promise<Listener> {
  const state = { connections: 0, closed: 0, commands: [] as string[] };
  const server = net.createServer((socket) => {
    state.connections += 1;
    socket.on('close', () => (state.closed += 1));
  });
  return listen(server, state);
}

function listen(
  server: net.Server,
  state: { connections: number; closed: number; commands: string[] },
): Promise<Listener> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        port: typeof address === 'object' && address ? address.port : 0,
        get connections() {
          return state.connections;
        },
        get closed() {
          return state.closed;
        },
        get commands() {
          return state.commands;
        },
        close: () =>
          new Promise<void>((done) => {
            server.close(() => done());
          }),
      });
    });
  });
}

async function waitFor(done: () => boolean, ms = 2000): Promise<void> {
  const until = Date.now() + ms;
  while (!done() && Date.now() < until) {
    await new Promise((r) => setTimeout(r, 20));
  }
}

describe('POST /user-settings/test-email rate limits and connection bounds', () => {
  let h: Harness;
  let smtp: Listener;
  let silent: Listener;
  const users: Record<string, { token: string; userId: string }> = {};
  const logged: string[] = [];
  const rawLogged: string[] = [];
  const bodies: string[] = [];
  const auth = (name: string) => ({
    Authorization: `Bearer ${users[name].token}`,
  });
  const body = (port: number, extra: Record<string, unknown> = {}) => ({
    smtpHost: '127.0.0.1',
    smtpPort: port,
    smtpSecure: false,
    smtpUser: 'alice',
    smtpPassword: PASSWORD,
    ...extra,
  });
  const post = async (
    name: string,
    port: number,
    extra: Record<string, unknown> = {},
    headers: Record<string, string> = {},
  ) => {
    const r = await h
      .http()
      .post('/user-settings/test-email')
      .set(auth(name))
      .set(headers)
      .send(body(port, extra));
    bodies.push(JSON.stringify(r.body));
    return r;
  };
  const resetCounters = () =>
    h.app.get<ThrottlerStorageService>(ThrottlerStorage).storage.clear();

  beforeAll(async () => {
    expect(TEST_CLERK_SIGNING_SECRET).toBeTruthy();
    process.env.SMTP_TEST_LIMIT_PER_MINUTE = '3';
    process.env.SMTP_TEST_LIMIT_PER_HOUR = '100';
    process.env.SMTP_TEST_IP_LIMIT_PER_MINUTE = '8';
    process.env.SMTP_TEST_MAX_CONCURRENT = '2';
    process.env.SMTP_TEST_TIMEOUT_MS = '1500';
    for (const method of [
      'log',
      'warn',
      'error',
      'debug',
      'verbose',
    ] as const) {
      jest
        .spyOn(Logger.prototype, method)
        .mockImplementation((...args: unknown[]) => {
          logged.push(JSON.stringify(args));
          for (const arg of args)
            if (typeof arg === 'string') rawLogged.push(arg);
        });
    }
    smtp = await smtpListener();
    silent = await silentListener();
    h = await bootHarness();
    await cleanupSynthetic(h);
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
    for (const name of ['alice', 'bob', 'carol', 'dave', 'erin', 'frank']) {
      users[name] = await provisionSubscribedUser(
        h,
        `user_rl_${name}_t`,
        `rl-${name}@access-test.invalid`,
      );
    }
  }, 120000);

  afterAll(async () => {
    await cleanupSynthetic(h);
    await h.close();
    await smtp.close();
    await silent.close();
    clerkDirectory.clear();
    jest.restoreAllMocks();
    delete process.env.SMTP_TEST_LIMIT_PER_MINUTE;
    delete process.env.SMTP_TEST_LIMIT_PER_HOUR;
    delete process.env.SMTP_TEST_IP_LIMIT_PER_MINUTE;
    delete process.env.SMTP_TEST_MAX_CONCURRENT;
    delete process.env.SMTP_TEST_TIMEOUT_MS;
  });

  beforeEach(() => resetCounters());

  it('unauthenticated and forged requests are 401 and open no connection', async () => {
    const none = await h
      .http()
      .post('/user-settings/test-email')
      .send(body(smtp.port));
    const forged = await h
      .http()
      .post('/user-settings/test-email')
      .set({ Authorization: `Bearer ${forgedToken(users.alice.userId)}` })
      .send(body(smtp.port));
    expect([none.status, forged.status]).toEqual([401, 401]);
    expect(smtp.connections).toBe(0);
  });

  it('an authorized request connects, authenticates, sends no mail and succeeds', async () => {
    const r = await post('alice', smtp.port);
    expect(r.status).toBe(201);
    expect(at(r.body, 'success')).toBe(true);
    expect(smtp.connections).toBe(1);
    expect(smtp.commands).toEqual(['EHLO', 'AUTH', 'QUIT']);
  });

  it('a user gets 429 after the per-user limit, whatever the body or forwarded headers', async () => {
    const before = smtp.connections;
    for (let i = 0; i < 3; i += 1) {
      expect((await post('alice', smtp.port)).status).toBe(201);
    }
    const fourth = await post('alice', smtp.port);
    expect(fourth.status).toBe(429);
    // @nestjs/throttler names the header after the throttler that tripped.
    expect(fourth.headers['retry-after-smtp-test-user-minute']).toBeDefined();
    const otherBody = await post('alice', smtp.port, {
      smtpUser: 'someone-else',
    });
    expect(otherBody.status).toBe(429);
    const spoofed = await post(
      'alice',
      smtp.port,
      {},
      { 'X-Forwarded-For': '203.0.113.9', 'X-Real-IP': '203.0.113.10' },
    );
    expect(spoofed.status).toBe(429);
    expect(smtp.connections - before).toBe(3);
  });

  it('the client address has its own limit across users, and forwarded headers cannot dodge it', async () => {
    // 8 per address: alice 3 + bob 3 + carol 2 fill it; carol's third is within her own limit.
    for (const name of ['alice', 'bob', 'carol']) {
      for (let i = 0; i < (name === 'carol' ? 2 : 3); i += 1) {
        expect([name, (await post(name, smtp.port)).status]).toEqual([
          name,
          201,
        ]);
      }
    }
    const before = smtp.connections;
    expect((await post('carol', smtp.port)).status).toBe(429);
    expect((await post('dave', smtp.port)).status).toBe(429);
    expect(
      (await post('dave', smtp.port, {}, { 'X-Forwarded-For': '198.51.100.7' }))
        .status,
    ).toBe(429);
    expect(smtp.connections).toBe(before);
  });

  it('one test in flight per user: a second concurrent request is 429, and the deadline frees the socket', async () => {
    const started = Date.now();
    const [a, b] = await Promise.all([
      post('carol', silent.port),
      post('carol', silent.port),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 429]);
    const rejected = a.status === 429 ? a : b;
    const timedOut = a.status === 201 ? a : b;
    expect(at(rejected.body, 'message')).toMatch(/already running/);
    expect(at(timedOut.body, 'success')).toBe(false);
    expect(at(timedOut.body, 'message')).toMatch(/Connection timeout/);
    expect(Date.now() - started).toBeLessThan(6000);
    expect(silent.connections).toBe(1);
    await waitFor(() => silent.closed === 1);
    expect(silent.closed).toBe(1);
    expect(h.app.get(MailService).connectionTestsInFlight).toBe(0);
    // The lock is released: a new test for the same user runs.
    const again = await post('carol', smtp.port);
    expect(again.status).toBe(201);
    expect(at(again.body, 'success')).toBe(true);
  });

  it('the per-process cap refuses a third concurrent test and recovers afterwards', async () => {
    const closedBefore = silent.closed;
    const first = post('dave', silent.port);
    const second = post('erin', silent.port);
    await new Promise((r) => setTimeout(r, 150));
    const third = await post('frank', silent.port);
    expect(third.status).toBe(429);
    expect(at(third.body, 'message')).toMatch(/Too many connection tests/);
    const [d, e] = await Promise.all([first, second]);
    expect([d.status, e.status]).toEqual([201, 201]);
    // The listener sees each close a moment after the HTTP response; wait for both.
    await waitFor(() => silent.closed - closedBefore === 2);
    expect(silent.closed - closedBefore).toBe(2);
    expect(h.app.get(MailService).connectionTestsInFlight).toBe(0);
    const after = await post('frank', smtp.port);
    expect(after.status).toBe(201);
  });

  it('a host with control characters or a null password is a 400 before any connection', async () => {
    const before = smtp.connections;
    const forged = await post('bob', smtp.port, {
      smtpHost: 'smtp.x.invalid\n[Nest] 1 - FAKE LOG LINE',
    });
    const spaced = await post('bob', smtp.port, { smtpHost: 'smtp x.invalid' });
    const nullPassword = await post('bob', smtp.port, { smtpPassword: null });
    expect([forged.status, spaced.status, nullPassword.status]).toEqual([
      400, 400, 400,
    ]);
    expect(smtp.connections).toBe(before);
    // A forged line needs a real newline in a logged string; JSON-encoded bodies escape it.
    expect(
      rawLogged.filter((line) => line.includes('\n[Nest] 1 - FAKE LOG LINE')),
    ).toEqual([]);
  });

  it('a refused login is reported with fixed text', async () => {
    const r = await post('bob', smtp.port, {
      smtpPassword: 'synthetic-wrong-pw',
    });
    expect(r.status).toBe(201);
    expect(at(r.body, 'success')).toBe(false);
    expect(at(r.body, 'message')).toMatch(/authentication failed/);
  });

  it('no submitted password reached a response or a log line, and nothing was saved', async () => {
    const haystack = `${bodies.join('\n')}\n${logged.join('\n')}`;
    expect(haystack).not.toContain(PASSWORD);
    expect(haystack).not.toContain('synthetic-wrong-pw');
    expect(bodies.length).toBeGreaterThan(10);
    const saved = await rows(
      h,
      `select 1 from user_settings where "smtpHost" is not null and "userId" = any($1)`,
      [Object.values(users).map((u) => u.userId)],
    );
    expect(saved).toHaveLength(0);
  });
});
