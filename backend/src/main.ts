// Copyright (c) 2025 Asset Vault. All rights reserved.

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, BadRequestException } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { v4 as uuidv4 } from 'uuid';
import * as express from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  let app;
  try {
    app = await NestFactory.create(AppModule, {
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
  const isProduction = configService.get('NODE_ENV') === 'production';
  
  // Security: Request body size limits (Issue #2)
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use(express.json({ limit: '10mb' }));
  expressApp.use(express.urlencoded({ extended: true, limit: '10mb' }));
  
  // Security: HTTPS enforcement in production
  if (isProduction) {
    app.use((req, res, next) => {
      if (req.headers['x-forwarded-proto'] !== 'https' && req.protocol !== 'https') {
        return res.redirect(301, `https://${req.headers.host}${req.url}`);
      }
      next();
    });
  }
  
  // Security: Request timeout (Issue #8) - 30 seconds
  app.use((req, res, next) => {
    req.setTimeout(30000, () => {
      res.status(408).json({ message: 'Request timeout' });
    });
    next();
  });
  
  // Performance: Response compression (Issue #15)
  // FIX #167: Enable gzip compression for large JSON responses
  app.use(compression({
    filter: (req, res) => {
      // Compress responses larger than 1KB
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
    level: 6, // Compression level (1-9, 6 is good balance)
  }));
  
  // FIX #168: Configure HTTP keep-alive for connection reuse
  const server = app.getHttpServer();
  server.keepAliveTimeout = 65000; // 65 seconds (slightly longer than default 60s)
  server.headersTimeout = 66000; // 66 seconds (must be > keepAliveTimeout)
  
  // Security: Request ID tracking for distributed tracing (Issue #13)
  app.use((req, res, next) => {
    const requestId = req.headers['x-request-id'] || uuidv4();
    req['requestId'] = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
  });
  
  // Security: Helmet for HTTP security headers
  app.use(
    helmet({
      contentSecurityPolicy: isProduction ? {
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
      } : false, // Disable in development for easier debugging
      crossOriginEmbedderPolicy: false, // Allow embedding for Swagger
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );
  
  // Enable CORS with proper security (works in all environments)
  const frontendUrl = configService.get('FRONTEND_URL') || 'http://localhost:5173';
  app.enableCors({
    origin: (origin, callback) => {
      // In production, strictly validate origins
      if (isProduction) {
        const allowedOrigins = [frontendUrl];
        // Also allow same-origin requests (no origin header)
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          logger.warn(`CORS blocked request from origin: ${origin}`);
          callback(new Error('Not allowed by CORS'));
        }
      } else {
        // In development, allow localhost and local network IPs
        // Also allow requests with no origin (same-origin, mobile apps, etc.)
        if (!origin) {
          callback(null, true);
          return;
        }
        
        const allowedOrigins = [
          frontendUrl,
          'http://localhost:5173',
          'http://localhost:3000',
          'http://127.0.0.1:5173',
          'http://127.0.0.1:3000',
          /^http:\/\/192\.168\.\d+\.\d+:\d+$/, // Local network IPs
          /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/,  // Private network IPs
          /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+:\d+$/, // Private network IPs
        ];
        
        const isAllowed = allowedOrigins.some(allowed => {
          if (typeof allowed === 'string') return origin === allowed;
          return allowed.test(origin);
        });
        
        if (isAllowed) {
          callback(null, true);
        } else {
          logger.warn(`CORS blocked request from origin: ${origin} (development mode)`);
          callback(new Error('Not allowed by CORS'));
        }
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // Allow custom tenant header for multi-organization context
    // Also allow x-duplicate header for invoice duplication feature
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Organization-Id', 'x-organization-id', 'x-duplicate', 'X-Duplicate'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400, // 24 hours
  });

  // Request logging middleware
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.log(
        `${req.method} ${req.url} ${res.statusCode} - ${duration}ms`,
      );
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
    })
  );

  // Global exception filter with ConfigService
  app.useGlobalFilters(new HttpExceptionFilter(configService));

  // API prefix
  app.setGlobalPrefix('api/v1');

  // Swagger/OpenAPI setup
  const config = new DocumentBuilder()
    .setTitle('Asset Vault API')
    .setDescription('Invoice and Inventory Management API - Complete API documentation for managing invoices, clients, inventory, and analytics.')
    .setVersion('1.1.0')
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

  const port = configService.get('PORT') || 3000;
  const host = '0.0.0.0'; // Listen on all network interfaces (allows phone access on same Wi-Fi)
  
  try {
    await app.listen(port, host);
    
    // Get actual server address (works in all environments)
    const serverAddress = app.getHttpServer().address();
    const protocol = isProduction ? 'https' : 'http';
    
    if (typeof serverAddress === 'string') {
      logger.log(`Application is running on: ${protocol}://${serverAddress}`);
      logger.log(`Swagger documentation: ${protocol}://${serverAddress}/api/docs`);
    } else if (serverAddress && typeof serverAddress === 'object') {
      const address = serverAddress.address === '::' ? 'localhost' : serverAddress.address;
      logger.log(`Application is running on: ${protocol}://${address}:${serverAddress.port}`);
      logger.log(`Swagger documentation: ${protocol}://${address}:${serverAddress.port}/api/docs`);
    } else {
      logger.log(`Application is running on port ${port}`);
      logger.log(`Swagger documentation: http://localhost:${port}/api/docs`);
    }
    
    if (!isProduction) {
      logger.log(`Network access: http://<your-ip>:${port} (accessible from other devices on same network)`);
    }
  } catch (error) {
    logger.error(`Failed to start server on port ${port}:`, error);
    if (error instanceof Error && error.message.includes('EADDRINUSE')) {
      logger.error(`Port ${port} is already in use. Please change PORT in .env or stop the process using this port.`);
    }
    process.exit(1);
  }
}
bootstrap();
