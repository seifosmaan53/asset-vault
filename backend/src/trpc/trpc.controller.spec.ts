import { HttpException, HttpStatus } from '@nestjs/common';
import type { GuardRequest } from '../auth/interfaces/request-user.interface';
import { TrpcController } from './trpc.controller';
import type { TrpcRouter } from './trpc.router';
import type { TrpcService } from './trpc.service';

// The real router pulls in superjson (ESM-only), which ts-jest cannot load.
jest.mock('./trpc.router', () => ({ TrpcRouter: class TrpcRouter {} }));
jest.mock('./trpc.service', () => ({ TrpcService: class TrpcService {} }));
jest.mock('./trpc.context', () => ({
  createContext: jest.fn(() => Promise.resolve({})),
}));
jest.mock('../auth/clerk-auth.guard', () => ({
  ClerkAuthGuard: class ClerkAuthGuard {},
}));

function controllerWith(caller: Record<string, unknown>): TrpcController {
  const router = {
    appRouter: { createCaller: () => caller },
  } as unknown as TrpcRouter;
  return new TrpcController(router, {} as TrpcService);
}

const request = (url: string) => ({ url }) as unknown as GuardRequest;

async function statusOf(promise: Promise<unknown>): Promise<number> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) return error.getStatus();
    throw error;
  }
  throw new Error('expected the handler to throw');
}

// Regression: the catch block wrapped the controller's own HttpExceptions into a 500.
describe('TrpcController error statuses', () => {
  const caller = {
    invoices: { list: jest.fn(() => Promise.resolve(['ok'])) },
  };

  it('returns the procedure result', async () => {
    await expect(
      controllerWith(caller).handler(request('/api/v1/trpc/invoices.list'), {}),
    ).resolves.toEqual(['ok']);
  });

  it.each([
    ['an unknown router', '/api/v1/trpc/nope.list', HttpStatus.NOT_FOUND],
    [
      'an unknown procedure',
      '/api/v1/trpc/invoices.nope',
      HttpStatus.NOT_FOUND,
    ],
    ['a malformed path', '/api/v1/trpc/invoices', HttpStatus.BAD_REQUEST],
  ])('answers %s with its own status, not 500', async (_label, url, status) => {
    expect(
      await statusOf(controllerWith(caller).handler(request(url), {})),
    ).toBe(status);
  });

  it('still reports an unexpected procedure failure as 500', async () => {
    const failing = {
      invoices: { list: jest.fn(() => Promise.reject(new Error('boom'))) },
    };
    expect(
      await statusOf(
        controllerWith(failing).handler(
          request('/api/v1/trpc/invoices.list'),
          {},
        ),
      ),
    ).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
  });
});
