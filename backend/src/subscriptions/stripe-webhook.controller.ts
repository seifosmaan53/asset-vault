// Copyright (c) 2025 Asset Vault. All rights reserved.

import { Controller, Post, Req, Res, Headers, Logger, BadRequestException } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { StripeService } from './stripe.service';
import { SubscriptionsService } from './subscriptions.service';
import { Public } from '../auth/public.decorator';
import Stripe from 'stripe';

@Controller('subscriptions/webhook')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private stripeService: StripeService,
    private subscriptionsService: SubscriptionsService,
    private configService: ConfigService,
  ) {}

  @Public()
  @Post()
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
    @Headers('stripe-signature') signature: string | string[] | undefined,
  ) {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');

    // Validate webhook secret is configured
    if (!webhookSecret || webhookSecret.trim() === '') {
      this.logger.error('STRIPE_WEBHOOK_SECRET not set - webhook verification cannot proceed');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    // Validate signature header is present and is a string
    if (!signature) {
      this.logger.warn('Missing stripe-signature header');
      return res.status(400).json({ error: 'Missing signature header' });
    }

    // Handle case where signature might be an array (shouldn't happen, but be safe)
    const signatureString = Array.isArray(signature) ? signature[0] : signature;
    if (!signatureString || signatureString.trim() === '') {
      this.logger.warn('Empty stripe-signature header');
      return res.status(400).json({ error: 'Invalid signature header' });
    }

    // Validate raw body is present
    if (!req.rawBody) {
      this.logger.error('Raw body is required for webhook verification');
      return res.status(400).json({ error: 'Raw body is required' });
    }

    // Get raw body for signature verification (defined outside try block for error logging)
    const rawBody = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(req.rawBody);
    let event: Stripe.Event;

    try {
      event = this.stripeService.constructEvent(
        rawBody,
        signatureString,
        webhookSecret,
      );
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Webhook signature verification failed: ${errorMessage}`, {
        signatureLength: signatureString.length,
        bodyLength: rawBody.length,
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
      return res.status(400).json({ error: `Webhook signature verification failed: ${errorMessage}` });
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
          break;

        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        default:
          this.logger.log(`Unhandled webhook event type: ${event.type}`);
      }

      return res.json({ received: true });
    } catch (error: any) {
      this.logger.error(`Error handling webhook event ${event.type}:`, error);
      return res.status(500).json({ error: 'Webhook handler failed' });
    }
  }

  private async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
    try {
      this.logger.log(`Checkout session completed: ${session.id}`);

      if (session.mode === 'subscription' && session.subscription) {
        const subscriptionId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription.id;

        const userId = session.metadata?.userId;
        if (!userId) {
          this.logger.warn(`No userId in checkout session metadata: ${session.id}`);
          return;
        }

        this.logger.log(`Processing subscription ${subscriptionId} for user ${userId}`);

        // Get subscription from Stripe to update local record
        const stripeSubscription = await this.stripeService.getSubscription(subscriptionId);
        
        this.logger.log(`Stripe subscription status: ${stripeSubscription.status} for subscription ${subscriptionId}`);
        
        // Update subscription by userId (since stripeSubscriptionId might not be set yet)
        const updatedSubscription = await this.subscriptionsService.updateSubscriptionFromStripeByUserId(
          userId,
          subscriptionId,
          stripeSubscription,
        );
        
        this.logger.log(`Successfully updated subscription for user ${userId} to status: ${updatedSubscription.status}`);
      } else {
        this.logger.warn(`Checkout session ${session.id} is not a subscription session or missing subscription`);
      }
    } catch (error: any) {
      this.logger.error(`Error handling checkout session completed for ${session.id}:`, error);
      this.logger.error(`Error stack: ${error.stack}`);
      throw error; // Re-throw to be caught by main handler
    }
  }

  private async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
    try {
    this.logger.log(`Subscription created: ${subscription.id}`);

    const userId = subscription.metadata?.userId;
    if (!userId) {
      this.logger.warn(`No userId in subscription metadata: ${subscription.id}`);
      return;
    }

    await this.subscriptionsService.updateSubscriptionFromStripe(subscription.id, subscription);
    } catch (error: any) {
      this.logger.error(`Error handling subscription created for ${subscription.id}:`, error);
      throw error; // Re-throw to be caught by main handler
    }
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    try {
    this.logger.log(`Subscription updated: ${subscription.id}`);

    await this.subscriptionsService.updateSubscriptionFromStripe(subscription.id, subscription);
    } catch (error: any) {
      this.logger.error(`Error handling subscription updated for ${subscription.id}:`, error);
      throw error; // Re-throw to be caught by main handler
    }
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    try {
    this.logger.log(`Subscription deleted: ${subscription.id}`);

    await this.subscriptionsService.updateSubscriptionFromStripe(subscription.id, subscription);
    } catch (error: any) {
      this.logger.error(`Error handling subscription deleted for ${subscription.id}:`, error);
      throw error; // Re-throw to be caught by main handler
    }
  }

  private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    try {
    this.logger.log(`Invoice payment succeeded: ${invoice.id}`);

    if (invoice.subscription && typeof invoice.subscription === 'string') {
      const subscription = await this.stripeService.getSubscription(invoice.subscription);
      await this.subscriptionsService.updateSubscriptionFromStripe(invoice.subscription, subscription);
      }
    } catch (error: any) {
      this.logger.error(`Error handling invoice payment succeeded for ${invoice.id}:`, error);
      throw error; // Re-throw to be caught by main handler
    }
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    try {
    this.logger.warn(`Invoice payment failed: ${invoice.id}`);

    if (invoice.subscription && typeof invoice.subscription === 'string') {
      const subscription = await this.stripeService.getSubscription(invoice.subscription);
      await this.subscriptionsService.updateSubscriptionFromStripe(invoice.subscription, subscription);
      }
    } catch (error: any) {
      this.logger.error(`Error handling invoice payment failed for ${invoice.id}:`, error);
      throw error; // Re-throw to be caught by main handler
    }
  }
}

