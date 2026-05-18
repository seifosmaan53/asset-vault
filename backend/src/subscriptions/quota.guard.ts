// Copyright (c) 2025 Asset Vault. All rights reserved.

import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UsageService, UsageMetric } from './usage.service';
import { SubscriptionsService } from './subscriptions.service';
import { IS_PUBLIC_KEY } from '../auth/public.decorator';
import { SKIP_QUOTA_KEY } from './skip-quota.decorator';
import { RequestUser } from '../auth/interfaces/request-user.interface';

@Injectable()
export class QuotaGuard implements CanActivate {
  private readonly logger = new Logger(QuotaGuard.name);

  constructor(
    private reflector: Reflector,
    private usageService: UsageService,
    private subscriptionsService: SubscriptionsService,
  ) {}

  /**
   * Convert UsageMetric (snake_case) to plan feature key (camelCase)
   * Examples:
   * - "invoices_created" -> "maxInvoices"
   * - "clients_created" -> "maxClients"
   * - "inventory_items_created" -> "maxInventoryItems"
   * - "storage_used_mb" -> "maxStorageGB"
   */
  private metricToFeatureKey(metric: UsageMetric): string {
    // Handle special case for storage
    if (metric === UsageMetric.STORAGE_USED_MB) {
      return 'maxStorageGB';
    }

    // Remove "_created" suffix and convert snake_case to camelCase
    let base = metric.replace(/_created$/, '');
    
    // Convert snake_case to camelCase
    // e.g., "invoices" -> "Invoices", "inventory_items" -> "InventoryItems"
    const parts = base.split('_');
    const camelCase = parts
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
    
    return `max${camelCase}`;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Allow public routes
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Allow routes that skip quota checks (e.g., invoice duplication)
    const skipQuota = this.reflector.getAllAndOverride<boolean>(SKIP_QUOTA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const user = request.user as RequestUser;

    // Allow skipping quota if it's a duplication (check query param, header, or body flag)
    const isDuplication = 
      request.query?.duplicate === 'true' || 
      request.headers['x-duplicate'] === 'true' ||
      (request.body && (request.body.isDuplicate === true || request.body.isDuplicate === 'true'));
    
    if (skipQuota || isDuplication) {
      this.logger.debug(`Skipping quota check for duplication: query=${request.query?.duplicate}, header=${request.headers['x-duplicate']}, body=${request.body?.isDuplicate}`);
      return true;
    }

    if (!user || !user.userId) {
      // If no user, let other guards handle it
      return true;
    }

    // Get subscription to check plan limits
    const subscription = await this.subscriptionsService.getSubscription(user.userId);
    if (!subscription || !subscription.plan) {
      throw new ForbiddenException('No active subscription found');
    }

    // Get the metric from metadata (set by decorator or default)
    const metric = this.reflector.get<UsageMetric>('quota-metric', context.getHandler()) ||
      UsageMetric.INVOICES_CREATED; // Default metric

    // Convert snake_case metric to camelCase feature key
    // e.g., "invoices_created" -> "maxInvoices", "clients_created" -> "maxClients"
    const featureKey = this.metricToFeatureKey(metric);
    const limit = subscription.plan.features?.[featureKey] as number | null;
    
    // Log for debugging
    this.logger.debug(`Checking quota: metric=${metric}, featureKey=${featureKey}, limit=${limit}`);

    const hasQuota = await this.usageService.checkQuota(user.userId, metric, limit);

    if (!hasQuota) {
      this.logger.warn(`Quota exceeded for user ${user.userId}, metric: ${metric}`);
      throw new ForbiddenException(
        `You have reached your plan limit for ${metric}. Please upgrade your plan or wait for the next billing cycle.`,
      );
    }

    return true;
  }
}

