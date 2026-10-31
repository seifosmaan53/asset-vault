// Copyright (c) 2025 Asset Vault. All rights reserved.
//
// Everything the API configures on the Nest application between NestFactory.create() and
// listen(): body limits, HTTPS enforcement, timeouts, compression, request ids, security headers,
// CORS, request logging, validation, the exception filter, the /api/v1 prefix and Swagger.
// Shared by src/main.ts and the server tests (test/server), so both run the same stack.

import { BadRequestException, Logger, ValidationPipe } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import * as express from 'express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { v4 as uuidv4 } from 'uuid';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { createCorsMiddleware } from './cors.middleware';
import { createHttpsRedirectMiddleware } from './https-redirect.middleware';
import type { ServerSettings } from './server-settings';

export function configureHttpApp(
  app: NestExpressApplication,
  settings: ServerSettings,
  configService: ConfigService,
): void {
  const logger = new Logger('Bootstrap');
  const { isProduction } = settings;

  // Which peers may set X-Forwarded-For / -Proto / -Host (TRUST_PROXY; default: none). This
  // decides req.secure (HTTPS enforcement below), req.ip (rate limiting) and req.hostname.
  app.set('trust proxy', settings.trustProxy);

  // Security: Request body size limits (Issue #2)
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use(express.json({ limit: '10mb' }));
  expressApp.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Security: HTTPS enforcement in production. HTTPS = a TLS socket, or X-Forwarded-Proto: https
  // from a TRUSTED proxy; the redirect goes to the configured public origin, never to Host.
  if (isProduction) {
    app.use(createHttpsRedirectMiddleware(settings.httpsRedirectOrigin));
  }

  // Security: Request timeout (Issue #8) - 30 seconds
  app.use((req: Request, res: Response, next: NextFunction) => {
    req.setTimeout(30000, () => {
      res.status(408).json({ message: 'Request timeout' });
    });
    next();
  });

  // Performance: Response compression (Issue #15)
  // FIX #167: Enable gzip compression for large JSON responses
  app.use(
    compression({
      filter: (req: Request, res: Response) => {
        // Compress responses larger than 1KB
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      },
      level: 6, // Compression level (1-9, 6 is good balance)
    }),
  );

  // FIX #168: Configure HTTP keep-alive for connection reuse
  const server = app.getHttpServer();
  server.keepAliveTimeout = 65000; // 65 seconds (slightly longer than default 60s)
  server.headersTimeout = 66000; // 66 seconds (must be > keepAliveTimeout)

  // Security: Request ID tracking for distributed tracing (Issue #13)
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = req.headers['x-request-id'] || uuidv4();
    // Read by RequestLoggingInterceptor and HttpExceptionFilter.
    Object.assign(req, { requestId });
    res.setHeader('X-Request-ID', requestId);
    next();
  });

  // Security: Helmet for HTTP security headers
  app.use(
    helmet({
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              scriptSrc: ["'self'"],
              imgSrc: ["'self'", 'data:', 'https:'],
              connectSrc: ["'self'"],
              fontSrc: ["'self'"],
              objectSrc: ["'none'"],
              mediaSrc: ["'self'"],
              frameSrc: ["'none'"],
            },
          }
        : false, // Disable in development for easier debugging
      crossOriginEmbedderPolicy: false, // Allow embedding for Swagger
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // CORS: exact-origin allowlist; a disallowed Origin gets a 403 JSON, never a 500.
  // See src/server/cors.middleware.ts for the behaviour and the reasons.
  app.use(createCorsMiddleware(settings.allowedOrigins, logger));

  // Request logging middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.log(`${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
    });
    next();
  });

  // Global validation pipe with detailed error messages
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors) => {
        // Format validation errors with field names and messages
        const formattedErrors = errors.map((error) => {
          const constraints = error.constraints || {};
          const messages = Object.values(constraints);
          return `${error.property}: ${messages.join(', ')}`;
        });

        return new BadRequestException({
          message: formattedErrors,
          error: 'Validation failed',
          statusCode: 400,
        });
      },
    }),
  );

  // Global exception filter with ConfigService
  app.useGlobalFilters(new HttpExceptionFilter(configService));

  // API prefix
  app.setGlobalPrefix('api/v1');

  // Swagger/OpenAPI setup
  const config = new DocumentBuilder()
    .setTitle('Asset Vault API')
    .setDescription(
      'Invoice and Inventory Management API - Complete API documentation for managing invoices, clients, inventory, and analytics.',
    )
    .setVersion('2.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management')
    .addTag('clients', 'Client management')
    .addTag('invoices', 'Invoice management')
    .addTag('inventory', 'Inventory management')
    // .addTag('recurring-invoices', 'Recurring invoice management') // Removed
    // .addTag('invoice-templates', 'Invoice template management') // Removed
    .addTag('api-keys', 'API key management')
    .addTag('feedback', 'Feedback submission')
    .addTag('settings', 'User settings')
    .addTag('analytics', 'Analytics and reporting')
    .addTag('stores', 'Store management')
    .addTag('subscriptions', 'Billing and subscriptions')
    .addTag('health', 'Service health and metrics')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'Asset Vault API Documentation',
  });
}
