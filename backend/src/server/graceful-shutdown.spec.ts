import {
  Controller,
  Get,
  Injectable,
  Query,
  type OnApplicationShutdown,
} from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import * as http from 'node:http';
import { installGracefulShutdown } from './graceful-shutdown';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

@Injectable()
class OwnedResource implements OnApplicationShutdown {
  static closedAt: number | null = null;
  onApplicationShutdown(): void {
    OwnedResource.closedAt = Date.now();
  }
}

@Controller()
class SlowController {
  @Get('slow')
  async slow(@Query('ms') ms: string): Promise<{ done: true }> {
    await sleep(Number(ms));
    return { done: true };
  }
}

function get(
  port: number,
  path: string,
): Promise<{ status: number; body: string; at: number }> {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path }, (res) => {
      let body = '';
      res.on('data', (d: Buffer) => (body += d.toString()));
      res.on('end', () =>
        resolve({ status: res.statusCode ?? 0, body, at: Date.now() }),
      );
    });
    req.on('error', reject);
  });
}

async function boot() {
  const mod = await Test.createTestingModule({
    controllers: [SlowController],
    providers: [OwnedResource],
  }).compile();
  const app = mod.createNestApplication<NestExpressApplication>({
    logger: false,
  });
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address();
  if (address === null || typeof address === 'string') {
    throw new Error('expected a TCP address');
  }
  return { app, port: address.port };
}

const silent = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

describe('installGracefulShutdown', () => {
  beforeEach(() => {
    OwnedResource.closedAt = null;
  });

  it('refuses new connections, finishes the in-flight request, closes resources, exits 0', async () => {
    const { app, port } = await boot();
    const exit = jest.fn();
    const handle = installGracefulShutdown(app, {
      timeoutMs: 5000,
      logger: silent,
      signals: [],
      exit,
    });
    const inFlight = get(port, '/slow?ms=800');
    await sleep(100);
    const signalledAt = Date.now();
    const done = handle.shutdown('SIGTERM');
    await sleep(50);

    await expect(get(port, '/slow?ms=0')).rejects.toMatchObject({
      code: 'ECONNREFUSED',
    });

    const res = await inFlight;
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ done: true });

    await done;
    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
    expect(OwnedResource.closedAt).not.toBeNull();
    // Resources are closed only after the in-flight response was sent.
    expect(OwnedResource.closedAt ?? 0).toBeGreaterThanOrEqual(res.at - 5);
    expect(Date.now() - signalledAt).toBeLessThan(5000);
    handle.dispose();
  });

  it('a second signal does not start a second shutdown', async () => {
    const { app } = await boot();
    const exit = jest.fn();
    const handle = installGracefulShutdown(app, {
      timeoutMs: 5000,
      logger: silent,
      signals: [],
      exit,
    });
    const a = handle.shutdown('SIGTERM');
    const b = handle.shutdown('SIGINT');
    expect(b).toBe(a);
    await a;
    expect(exit).toHaveBeenCalledTimes(1);
    handle.dispose();
  });

  it('forces exit 1 at the bound when a request does not finish', async () => {
    const { app, port } = await boot();
    const exit = jest.fn();
    const handle = installGracefulShutdown(app, {
      timeoutMs: 1000,
      logger: silent,
      signals: [],
      exit,
    });
    const hung = get(port, '/slow?ms=2500').catch((e: unknown) => e);
    await sleep(100);
    const started = Date.now();
    void handle.shutdown('SIGTERM');
    while (exit.mock.calls.length === 0 && Date.now() - started < 4000) {
      await sleep(20);
    }
    const elapsed = Date.now() - started;
    expect(exit).toHaveBeenCalledWith(1);
    expect(elapsed).toBeGreaterThanOrEqual(950);
    expect(elapsed).toBeLessThan(2000);
    // The hung connection is destroyed rather than left open.
    expect(await hung).toMatchObject({ code: 'ECONNRESET' });
    // Nothing runs after the forced exit (exit(0) is not requested as well).
    await sleep(300);
    expect(exit).toHaveBeenCalledTimes(1);
    handle.dispose();
    await sleep(2500); // let the abandoned handler's timer finish
  }, 15000);

  it('registers on SIGTERM and SIGINT by default and dispose() removes the listeners', async () => {
    const { app } = await boot();
    const before = process.listenerCount('SIGTERM');
    const handle = installGracefulShutdown(app, {
      timeoutMs: 1000,
      logger: silent,
      exit: jest.fn(),
    });
    expect(process.listenerCount('SIGTERM')).toBe(before + 1);
    expect(process.listenerCount('SIGINT')).toBeGreaterThan(0);
    handle.dispose();
    expect(process.listenerCount('SIGTERM')).toBe(before);
    await app.close();
  });
});
