// Copyright (c) 2025 Asset Vault. All rights reserved.

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { APP_GUARD } from '@nestjs/core';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ClientsModule } from './clients/clients.module';
import { InvoicesModule } from './invoices/invoices.module';
import { InventoryModule } from './inventory/inventory.module';
import { InvoiceTemplatesModule } from './invoice-templates/invoice-templates.module';
// Recurring invoices removed
import { ApiKeysModule } from './api-keys/api-keys.module';
import { FeedbackModule } from './feedback/feedback.module';
import { UserSettingsModule } from './user-settings/user-settings.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ReportsModule } from './reports/reports.module';
import { CurrencyModule } from './currency/currency.module';
import { CommonModule } from './common/common.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { SampleDataModule } from './sample-data/sample-data.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { StorageModule } from './storage/storage.module';
import { TrpcModule } from './trpc/trpc.module';
import { TrpcController } from './trpc/trpc.controller';
import { ClerkAuthGuard } from './auth/clerk-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { OrganizationContextGuard } from './organizations/organization-context.guard';
import { SubscriptionGuard } from './subscriptions/subscription.guard';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { RateLimitHeadersInterceptor } from './common/interceptors/rate-limit-headers.interceptor';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import { CacheHeadersInterceptor } from './common/interceptors/cache-headers.interceptor';
import { QueryLoggingInterceptor } from './common/interceptors/query-logging.interceptor';
import { ContentNegotiationInterceptor } from './common/interceptors/content-negotiation.interceptor';
import { DataSource } from 'typeorm';

@Module({
  imports: [
    // Issue #54: Enhanced environment variable validation
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
        PORT: Joi.number().default(3000).min(1).max(65535),

        DB_HOST: Joi.string().required(),
        DB_PORT: Joi.number().default(5432).min(1).max(65535),
        DB_USERNAME: Joi.string().required(),
        DB_PASSWORD: Joi.string().allow('').required(),
        DB_DATABASE: Joi.string().required(),

        CLERK_SECRET_KEY: Joi.string().required(),
        CLERK_WEBHOOK_SECRET: Joi.string().allow('', null).optional(),

        FRONTEND_URL: Joi.string().uri().default('http://localhost:5173'),
        FRONTEND_BASE_URL: Joi.string().uri().default('http://localhost:5173'),

        SMTP_HOST: Joi.string().allow('', null).optional(),
        SMTP_PORT: Joi.number().allow(null).min(1).max(65535).optional(),
        SMTP_USER: Joi.string().allow('', null).optional(),
        SMTP_PASS: Joi.string().allow('', null).optional(),
        SMTP_FROM: Joi.string().allow('', null).optional().custom((value, helpers) => {
          if (!value || value === '') return value;
          // Allow format: "Name <email@domain.com>" or just "email@domain.com"
          const emailMatch = value.match(/<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/);
          if (emailMatch) {
            // Validate the extracted email
            const email = emailMatch[1];
            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            if (emailRegex.test(email)) {
              return value;
            }
          }
          return helpers.error('string.email');
        }),

        // Optional: IP filtering
        IP_WHITELIST: Joi.string().allow('', null).optional(),
        IP_BLACKLIST: Joi.string().allow('', null).optional(),

        // Stripe Configuration
        STRIPE_SECRET_KEY: Joi.string().allow('', null).optional(),
        STRIPE_PUBLISHABLE_KEY: Joi.string().allow('', null).optional(),
        STRIPE_WEBHOOK_SECRET: Joi.string().allow('', null).optional(),
        STRIPE_PRICE_ID: Joi.string().allow('', null).optional(),

        // AWS S3 / Cloudflare R2 Configuration
        AWS_ACCESS_KEY_ID: Joi.string().allow('', null).optional(),
        AWS_SECRET_ACCESS_KEY: Joi.string().allow('', null).optional(),
        AWS_REGION: Joi.string().default('us-east-1'),
        AWS_S3_BUCKET: Joi.string().allow('', null).optional(),
        USE_CLOUDFLARE_R2: Joi.string().valid('true', 'false').default('false'),
        CLOUDFLARE_R2_ENDPOINT: Joi.string().uri().allow('', null).optional(),
      }),
      validationOptions: {
        allowUnknown: true, // Allow additional env vars
        abortEarly: false, // Report all validation errors at once
      },
    }),
    // FIX #165: Rate limiting to prevent overwhelming server
    ThrottlerModule.forRoot({
      throttlers: [{
        ttl: 60000, // Time window in milliseconds (60 seconds)
        limit: 100, // Max requests per time window per IP
      }],
      // Custom storage for distributed systems (optional)
      // storage: new ThrottlerStorageRedisService(),
    }),
    CacheModule.register({
      ttl: 300000, // 5 minutes default TTL
      max: 100, // Maximum number of items in cache
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_DATABASE || 'invoiceme',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      migrations: [__dirname + '/../migrations/*{.ts,.js}'],
      synchronize: false, // Always false - use migrations instead
      logging: process.env.NODE_ENV === 'development',
      // Issue #17: Database connection pool limits
      // Issue #22: Database query timeout configuration
      // Issue #13: Environment-based connection pool tuning
      connectTimeoutMS: 10000, // Connection timeout
      extra: {
        max: process.env.NODE_ENV === 'production' ? 50 : 20, // Higher pool for production, lower for development
        min: 5, // Minimum number of connections in the pool
        idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
        connectionTimeoutMillis: 10000, // Timeout after 10 seconds if connection cannot be established
        statement_timeout: 30000, // Query timeout (30 seconds) - PostgreSQL statement_timeout
        // Connection pool monitoring (logged via TypeORM logging when enabled)
      },
    }),
    UsersModule, // Required for ClerkAuthGuard - must be imported before AuthModule
    OrganizationsModule, // Required for ClerkAuthGuard - must be imported before AuthModule
    AuthModule,
    ClientsModule,
    InvoicesModule,
    InventoryModule,
    InvoiceTemplatesModule,
    // RecurringInvoicesModule, // Removed
    ApiKeysModule,
    FeedbackModule,
    UserSettingsModule,
    AnalyticsModule,
    ReportsModule,
    CurrencyModule,
    CommonModule,
    SampleDataModule,
    SubscriptionsModule,
    StorageModule,
    TrpcModule,
  ],
  controllers: [AppController, TrpcController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RateLimitHeadersInterceptor, // Issue #18: Add rate limit headers to responses
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggingInterceptor, // Issue #23: Request/response logging
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheHeadersInterceptor, // Issue #29: API response caching headers
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: QueryLoggingInterceptor, // Issue #32: Query execution plan logging
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ContentNegotiationInterceptor, // Issue #47 & #74: API response content negotiation and Content-Type validation
    },
    {
      provide: APP_GUARD,
      useClass: ClerkAuthGuard,
    },
    // Must run after JWT so request.user exists (used for membership verification)
    {
      provide: APP_GUARD,
      useClass: OrganizationContextGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: SubscriptionGuard,
    },
  ],
})
export class AppModule {}
