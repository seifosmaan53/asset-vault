// Copyright (c) 2025 Asset Vault. All rights reserved.

import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionsService } from './subscriptions.service';
import { IS_PUBLIC_KEY } from '../auth/public.decorator';
import { RequestUser } from '../auth/interfaces/request-user.interface';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  private readonly logger = new Logger(SubscriptionGuard.name);

  constructor(
    private reflector: Reflector,
    private subscriptionsService: SubscriptionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Allow public routes
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as RequestUser;

    if (!user || !user.userId) {
      // If no user, let other guards handle it
      return true;
    }

    // Allow access to subscription management endpoints even without active subscription
    const isSubscriptionEndpoint = request.url?.includes('/subscriptions/') && 
      (request.url?.includes('/create-checkout') || 
       request.url?.includes('/create-portal') || 
       request.url?.includes('/current') ||
       request.url?.includes('/cancel') ||
       request.url?.includes('/reactivate') ||
       request.url?.includes('/usage') ||
       request.url?.includes('/billing-history'));

    if (isSubscriptionEndpoint) {
      return true; // Allow access to subscription management
    }

    const hasAccess = await this.subscriptionsService.checkSubscriptionAccess(user.userId);

    if (!hasAccess) {
      this.logger.warn(`Subscription access denied for user ${user.userId}`);
      throw new ForbiddenException(
        'Active subscription required. Please subscribe to continue using the service.',
      );
    }

    return true;
  }
}

