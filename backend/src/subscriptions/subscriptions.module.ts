// Copyright (c) 2025 Asset Vault. All rights reserved.

import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionsService } from './subscriptions.service';
import { UsageService } from './usage.service';
import { StripeService } from './stripe.service';
import { SubscriptionsController } from './subscriptions.controller';
import { StripeWebhookController } from './stripe-webhook.controller';
import { Subscription } from './entities/subscription.entity';
import { Plan } from './entities/plan.entity';
import { Usage } from './entities/usage.entity';
import { SubscriptionGuard } from './subscription.guard';
import { QuotaGuard } from './quota.guard';
import { UsageResetScheduler } from './usage-reset.scheduler';
import { AuthModule } from '../auth/auth.module';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription, Plan, Usage, User]),
    forwardRef(() => AuthModule),
  ],
  controllers: [SubscriptionsController, StripeWebhookController],
  providers: [
    SubscriptionsService,
    UsageService,
    StripeService,
    SubscriptionGuard,
    QuotaGuard,
    UsageResetScheduler,
  ],
  exports: [
    SubscriptionsService,
    UsageService,
    StripeService,
    SubscriptionGuard,
    QuotaGuard,
  ],
})
export class SubscriptionsModule {}

