// Copyright (c) 2025 Asset Vault. All rights reserved.

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { checkDatabaseSchema } from './database/schema-check';
import { configureHttpApp } from './server/configure-app';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Refuse to serve against a database that is unreachable or behind this build's
  // migrations. The API never applies migrations itself (no `synchronize`, no
  // `migrationsRun`); the operator runs them explicitly after a backup — see
  // docs/operations/MIGRATIONS.md. Runs before the app connects or listens.
  const schema = await checkDatabaseSchema();
  if (!schema.ok) {
    logger.error(
      schema.reason === 'unreachable'
        ? 'Startup aborted: database unreachable.'
        : 'Startup aborted: database schema is not current.',
    );
    schema.message.split('\n').forEach((line) => logger.error(line));
    process.exit(1);
  }
  if (schema.status.unknownApplied.length > 0) {
    logger.warn(
      `The database records migration(s) this build does not contain (is this build older than the schema?): ${schema.status.unknownApplied.join(', ')}`,
    );
  }
  logger.log(
    `Database schema is current (${schema.status.known} migrations applied).`,
  );

  let app: NestExpressApplication;
  try {
    app = await NestFactory.create<NestExpressApplication>(AppModule, {
      bodyParser: true, // Enable body parser
      rawBody: true, // Enable raw body for webhooks
    });
  } catch (error) {
    logger.error('Failed to create application:', error);
    if (error instanceof Error) {
      logger.error(`Error message: ${error.message}`);
      logger.error(`Stack trace: ${error.stack}`);
    }
    process.exit(1);
  }

  const configService = app.get(ConfigService);
  const isProduction = configService.get<string>('NODE_ENV') === 'production';
  configureHttpApp(app, configService);

  const port = configService.get<number>('PORT') || 3000;
  const host = '0.0.0.0'; // Listen on all network interfaces (allows phone access on same Wi-Fi)

  try {
    await app.listen(port, host);

    // Get actual server address (works in all environments)
    const serverAddress = app.getHttpServer().address();
    const protocol = isProduction ? 'https' : 'http';

    if (typeof serverAddress === 'string') {
      logger.log(`Application is running on: ${protocol}://${serverAddress}`);
      logger.log(
        `Swagger documentation: ${protocol}://${serverAddress}/api/docs`,
      );
    } else if (serverAddress && typeof serverAddress === 'object') {
      const address =
        serverAddress.address === '::' ? 'localhost' : serverAddress.address;
      logger.log(
        `Application is running on: ${protocol}://${address}:${serverAddress.port}`,
      );
      logger.log(
        `Swagger documentation: ${protocol}://${address}:${serverAddress.port}/api/docs`,
      );
    } else {
      logger.log(`Application is running on port ${port}`);
      logger.log(`Swagger documentation: http://localhost:${port}/api/docs`);
    }

    if (!isProduction) {
      logger.log(
        `Network access: http://<your-ip>:${port} (accessible from other devices on same network)`,
      );
    }
  } catch (error) {
    logger.error(`Failed to start server on port ${port}:`, error);
    if (error instanceof Error && error.message.includes('EADDRINUSE')) {
      logger.error(
        `Port ${port} is already in use. Please change PORT in .env or stop the process using this port.`,
      );
    }
    process.exit(1);
  }
}
bootstrap().catch((error: unknown) => {
  new Logger('Bootstrap').error('Unhandled startup failure', error);
  process.exit(1);
});
