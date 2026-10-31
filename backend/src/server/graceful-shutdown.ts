// Copyright (c) 2025 Asset Vault. All rights reserved.
//
// Graceful shutdown on SIGTERM / SIGINT (docker stop, Compose, Kubernetes, Ctrl-C).
//
//   1. Stop accepting connections: the listening socket is closed at once, so new connections
//      are refused, and idle keep-alive connections are closed (and swept every 250 ms, since an
//      in-flight request's connection becomes idle once its response is sent).
//   2. Wait for in-flight requests to finish.
//   3. app.close(): Nest's lifecycle hooks (onModuleDestroy, beforeApplicationShutdown,
//      onApplicationShutdown), which stop the @nestjs/schedule cron jobs, close the Puppeteer
//      browser, and destroy the TypeORM DataSource (the PostgreSQL pool). The cache is in-memory
//      and owns no connection. The cache-stampede cleanup timer is cleared too.
//   4. Exit 0.
//
// If all of that has not finished within SHUTDOWN_TIMEOUT_MS (default 8000 ms) of the signal,
// the remaining connections are destroyed and the process exits 1. The default stays under
// Docker's 10 s stop timeout, so the API exits on its own rather than being SIGKILLed (137);
// an orchestrator's grace period must be longer than SHUTDOWN_TIMEOUT_MS.
//
// Why not app.enableShutdownHooks(): after closing, Nest re-sends the signal to its own process.
// As PID 1 in a container (CMD ["node", "dist/main"]) a signal with no handler is ignored, and
// elsewhere it ends the process with 143 instead of 0. The hooks it would run are the ones
// app.close() runs here.

import type { LoggerService } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Server } from 'node:http';
import { stopCleanupInterval } from '../common/utils/cache-stampede-prevention.util';

export interface GracefulShutdownOptions {
  timeoutMs: number;
  logger: LoggerService;
  signals?: NodeJS.Signals[];
  /** Injected in tests; process.exit otherwise. */
  exit?: (code: number) => void;
}

export interface GracefulShutdown {
  /** Runs the shutdown sequence once; later calls return the same promise. */
  shutdown: (reason: string) => Promise<void>;
  /** Removes the signal listeners (tests). */
  dispose: () => void;
}

const IDLE_SWEEP_MS = 250;

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve) => {
    // The callback runs once every connection has ended. An error here only means the server
    // was not listening, which is the state we want.
    server.close(() => resolve());
    server.closeIdleConnections();
  });
}

export function installGracefulShutdown(
  app: NestExpressApplication<Server>,
  options: GracefulShutdownOptions,
): GracefulShutdown {
  const { timeoutMs, logger } = options;
  const exit = options.exit ?? ((code: number) => process.exit(code));
  const signals = options.signals ?? ['SIGTERM', 'SIGINT'];
  let running: Promise<void> | undefined;

  const shutdown = (reason: string): Promise<void> => {
    if (running) return running;
    running = (async () => {
      const started = Date.now();
      const elapsed = () => `${Date.now() - started} ms`;
      const server = app.getHttpServer();
      logger.log(
        `Shutdown: ${reason} received; refusing new connections, waiting up to ${timeoutMs} ms for in-flight requests.`,
      );

      const force = setTimeout(() => {
        server.getConnections((_err, open) => {
          logger.error(
            `Shutdown: not finished after ${elapsed()} (bound ${timeoutMs} ms, ${open} connection(s) still open); forcing exit 1.`,
          );
          server.closeAllConnections();
          exit(1);
        });
      }, timeoutMs);

      const sweep = setInterval(
        () => server.closeIdleConnections(),
        IDLE_SWEEP_MS,
      );
      try {
        await closeServer(server);
        clearInterval(sweep);
        logger.log(
          `Shutdown: HTTP server drained after ${elapsed()}; closing application resources.`,
        );
        stopCleanupInterval();
        await app.close();
      } catch (error) {
        clearInterval(sweep);
        clearTimeout(force);
        logger.error(
          `Shutdown: failed after ${elapsed()}: ${error instanceof Error ? error.message : String(error)}`,
        );
        exit(1);
        return;
      }
      clearTimeout(force);
      logger.log(`Shutdown: complete in ${elapsed()}; exiting 0.`);
      exit(0);
    })();
    return running;
  };

  const onSignal = (signal: NodeJS.Signals) => {
    void shutdown(signal);
  };
  for (const signal of signals) process.on(signal, onSignal);

  return {
    shutdown,
    dispose: () => {
      for (const signal of signals) process.removeListener(signal, onSignal);
    },
  };
}
