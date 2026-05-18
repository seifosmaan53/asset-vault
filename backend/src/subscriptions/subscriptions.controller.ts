// Copyright (c) 2025 Asset Vault. All rights reserved.

import {
  Controller,
  Get,
  Post,
  UseGuards,
  Req,
  Body,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { StripeService } from './stripe.service';
import { UsageService } from './usage.service';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@ApiTags('subscriptions')
@Controller('subscriptions')
@UseGuards(ClerkAuthGuard)
@ApiBearerAuth('Bearer')
export class SubscriptionsController {
  private readonly logger = new Logger(SubscriptionsController.name);

  constructor(
    private subscriptionsService: SubscriptionsService,
    private stripeService: StripeService,
    private usageService: UsageService,
    private configService: ConfigService,
  ) {}

  @Get('current')
  @ApiOperation({ summary: 'Get current subscription', description: 'Retrieve the authenticated user\'s current subscription status' })
  @ApiResponse({ status: 200, description: 'Subscription retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCurrentSubscription(@Req() req: AuthenticatedRequest) {
    const subscription = await this.subscriptionsService.getSubscription(req.user.userId);
    if (!subscription) {
      return { subscription: null, status: 'none' };
    }
    return {
      subscription: {
        id: subscription.id,
        status: subscription.status,
        plan: subscription.plan,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        trialEndsAt: subscription.trialEndsAt,
      },
    };
  }

  @Post('create-checkout')
  @ApiOperation({ summary: 'Create checkout session', description: 'Create a Stripe checkout session for subscription' })
  @ApiResponse({ status: 200, description: 'Checkout session created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createCheckoutSession(@Req() req: AuthenticatedRequest) {
    const subscription = await this.subscriptionsService.getSubscription(req.user.userId);
    const plan = await this.subscriptionsService.getDefaultPlan();

    if (!plan) {
      throw new BadRequestException('No plan available');
    }

    // Get Stripe price ID from ConfigService (validated at startup)
    const stripePriceId = this.configService.get<string>('STRIPE_PRICE_ID');
    if (!stripePriceId) {
      throw new BadRequestException('Stripe price ID is not configured. Please set STRIPE_PRICE_ID environment variable.');
    }

    // Get or create Stripe customer
    let customerId = subscription?.stripeCustomerId;
    if (!customerId) {
      const user = req.user;
      const customer = await this.stripeService.createCustomer(
        user.userId,
        user.email,
        user.email || 'user@example.com',
      );
      customerId = customer.id;

      // Update subscription with customer ID if exists
      if (subscription && !subscription.stripeCustomerId) {
        await this.subscriptionsService.updateSubscriptionCustomerId(req.user.userId, customerId);
      } else if (!subscription) {
        // Create pending subscription if doesn't exist
        const defaultPlan = await this.subscriptionsService.getDefaultPlan();
        if (defaultPlan) {
          await this.subscriptionsService.createPendingSubscription(req.user.userId, defaultPlan.id);
          // Update with customer ID
          await this.subscriptionsService.updateSubscriptionCustomerId(req.user.userId, customerId);
        }
      }
    }

    const session = await this.stripeService.createCheckoutSession(
      customerId,
      stripePriceId,
      req.user.userId,
    );

    return {
      sessionId: session.id,
      url: session.url,
    };
  }

  @Post('create-portal')
  @ApiOperation({ summary: 'Create billing portal session', description: 'Create a Stripe billing portal session for managing subscription' })
  @ApiResponse({ status: 200, description: 'Portal session created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createPortalSession(@Req() req: AuthenticatedRequest) {
    const subscription = await this.subscriptionsService.getSubscription(req.user.userId);

    if (!subscription || !subscription.stripeCustomerId) {
      throw new BadRequestException('No active subscription found');
    }

    const session = await this.stripeService.createPortalSession(subscription.stripeCustomerId);

    return {
      url: session.url,
    };
  }

  @Post('cancel')
  @ApiOperation({ summary: 'Cancel subscription', description: 'Cancel the subscription at the end of the current billing period' })
  @ApiResponse({ status: 200, description: 'Subscription canceled successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async cancelSubscription(@Req() req: AuthenticatedRequest) {
    const subscription = await this.subscriptionsService.cancelSubscription(req.user.userId);
    return {
      message: 'Subscription will be canceled at the end of the current period',
      subscription: {
        id: subscription.id,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        canceledAt: subscription.canceledAt,
      },
    };
  }

  @Post('reactivate')
  @ApiOperation({ summary: 'Reactivate subscription', description: 'Reactivate a canceled subscription' })
  @ApiResponse({ status: 200, description: 'Subscription reactivated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async reactivateSubscription(@Req() req: AuthenticatedRequest) {
    const subscription = await this.subscriptionsService.reactivateSubscription(req.user.userId);
    return {
      message: 'Subscription reactivated successfully',
      subscription: {
        id: subscription.id,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      },
    };
  }

  @Get('usage')
  @ApiOperation({ summary: 'Get usage metrics', description: 'Get current usage metrics for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Usage retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUsage(@Req() req: AuthenticatedRequest) {
    const usage = await this.usageService.getAllUsage(req.user.userId);
    return { usage };
  }

  @Get('billing-history')
  @ApiOperation({ summary: 'Get billing history', description: 'Get invoice history from Stripe' })
  @ApiResponse({ status: 200, description: 'Billing history retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getBillingHistory(@Req() req: AuthenticatedRequest) {
    const invoices = await this.subscriptionsService.getBillingHistory(req.user.userId);
    return {
      invoices: invoices.map((invoice) => ({
        id: invoice.id,
        amount: invoice.amount_paid / 100, // Convert from cents
        currency: invoice.currency,
        status: invoice.status,
        created: new Date(invoice.created * 1000),
        hostedInvoiceUrl: invoice.hosted_invoice_url,
        invoicePdf: invoice.invoice_pdf,
      })),
    };
  }

  @Post('verify-checkout')
  @ApiOperation({ summary: 'Verify checkout session', description: 'Verify a Stripe checkout session and sync subscription status' })
  @ApiResponse({ status: 200, description: 'Checkout session verified successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async verifyCheckoutSession(@Req() req: AuthenticatedRequest, @Body() body: { sessionId: string }) {
    const { sessionId } = body;
    if (!sessionId) {
      throw new BadRequestException('Session ID is required');
    }

    try {
      // Retrieve checkout session from Stripe
      const session = await this.stripeService.getCheckoutSession(sessionId);

      // Verify session belongs to this user
      const userId = session.metadata?.userId;
      if (!userId || userId !== req.user.userId) {
        throw new BadRequestException('Invalid checkout session');
      }

      // If session is completed and has a subscription, sync it
      if (session.status === 'complete' && session.mode === 'subscription' && session.subscription) {
        const subscriptionId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription.id;

        // Get subscription from Stripe
        const stripeSubscription = await this.stripeService.getSubscription(subscriptionId);

        // Update local subscription
        await this.subscriptionsService.updateSubscriptionFromStripeByUserId(
          req.user.userId,
          subscriptionId,
          stripeSubscription,
        );

        // Return updated subscription
        const subscription = await this.subscriptionsService.getSubscription(req.user.userId);
        return {
          verified: true,
          subscription: subscription ? {
            id: subscription.id,
            status: subscription.status,
            plan: subscription.plan,
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            trialEndsAt: subscription.trialEndsAt,
          } : null,
        };
      }

      // Session not completed yet
      return {
        verified: false,
        status: session.status,
        subscription: null,
      };
    } catch (error: any) {
      this.logger.error(`Failed to verify checkout session: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to verify checkout session: ${error.message}`);
    }
  }

  @Post('sync')
  @ApiOperation({ summary: 'Sync subscription from Stripe', description: 'Manually sync subscription status from Stripe (useful when webhooks are not working)' })
  @ApiResponse({ status: 200, description: 'Subscription synced successfully' })
  @ApiResponse({ status: 200, description: 'No subscription to sync - user has no active Stripe subscription' })
  async syncSubscription(@Req() req: AuthenticatedRequest) {
    try {
      const subscription = await this.subscriptionsService.getSubscription(req.user.userId);
      
      if (!subscription) {
        // No subscription found - return success with message (not an error)
        return {
          message: 'No subscription found. No sync needed.',
          subscription: null,
        };
      }

      if (!subscription.stripeSubscriptionId) {
        // Subscription exists but no Stripe ID - this is expected for users who haven't completed checkout
        // Return success instead of error
        this.logger.debug(`User ${req.user.userId} has subscription but no Stripe subscription ID yet`);
        return {
          message: 'Subscription found but no Stripe subscription ID. Please complete checkout first.',
          subscription: {
            id: subscription.id,
            status: subscription.status,
            plan: subscription.plan,
          },
        };
      }

      // Fetch latest subscription data from Stripe
      const stripeSubscription = await this.stripeService.getSubscription(subscription.stripeSubscriptionId);
      
      // Update local subscription with latest Stripe data
      const updatedSubscription = await this.subscriptionsService.updateSubscriptionFromStripeByUserId(
        req.user.userId,
        subscription.stripeSubscriptionId,
        stripeSubscription,
      );

      return {
        message: 'Subscription synced successfully',
        subscription: {
          id: updatedSubscription.id,
          status: updatedSubscription.status,
          plan: updatedSubscription.plan,
          currentPeriodStart: updatedSubscription.currentPeriodStart,
          currentPeriodEnd: updatedSubscription.currentPeriodEnd,
          cancelAtPeriodEnd: updatedSubscription.cancelAtPeriodEnd,
          trialEndsAt: updatedSubscription.trialEndsAt,
        },
      };
    } catch (error: any) {
      // Only log as error if it's an unexpected error (not a handled case)
      if (error instanceof BadRequestException && 
          (error.message.includes('No subscription found') || 
           error.message.includes('no Stripe subscription ID'))) {
        // These are expected cases, log as debug
        this.logger.debug(`Subscription sync info: ${error.message}`);
        return {
          message: error.message,
          subscription: null,
        };
      }
      
      this.logger.error(`Failed to sync subscription: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to sync subscription: ${error.message}`);
    }
  }
}

