// Copyright (c) 2025 Asset Vault. All rights reserved.

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe;
  private readonly frontendUrl: string;

  constructor(private configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      this.logger.warn('STRIPE_SECRET_KEY not set - Stripe functionality will be disabled');
    } else {
      this.stripe = new Stripe(secretKey, {
        apiVersion: '2025-02-24.acacia',
      });
    }
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
  }

  async createCustomer(userId: string, email: string, name: string): Promise<Stripe.Customer> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    try {
      const customer = await this.stripe.customers.create({
        email,
        name,
        metadata: {
          userId,
        },
      });

      this.logger.log(`Created Stripe customer ${customer.id} for user ${userId}`);
      return customer;
    } catch (error: any) {
      this.logger.error(`Failed to create Stripe customer: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to create customer: ${error.message}`);
    }
  }

  async createSubscription(customerId: string, priceId: string): Promise<Stripe.Subscription> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    try {
      const subscription = await this.stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
      });

      this.logger.log(`Created Stripe subscription ${subscription.id} for customer ${customerId}`);
      return subscription;
    } catch (error: any) {
      this.logger.error(`Failed to create Stripe subscription: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to create subscription: ${error.message}`);
    }
  }

  async updateSubscription(subscriptionId: string, priceId: string): Promise<Stripe.Subscription> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      const updatedSubscription = await this.stripe.subscriptions.update(subscriptionId, {
        items: [
          {
            id: subscription.items.data[0].id,
            price: priceId,
          },
        ],
        proration_behavior: 'create_prorations',
      });

      this.logger.log(`Updated Stripe subscription ${subscriptionId}`);
      return updatedSubscription;
    } catch (error: any) {
      this.logger.error(`Failed to update Stripe subscription: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to update subscription: ${error.message}`);
    }
  }

  async cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    try {
      const subscription = await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });

      this.logger.log(`Canceled Stripe subscription ${subscriptionId} at period end`);
      return subscription;
    } catch (error: any) {
      this.logger.error(`Failed to cancel Stripe subscription: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to cancel subscription: ${error.message}`);
    }
  }

  async getCustomer(customerId: string): Promise<Stripe.Customer> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    try {
      return await this.stripe.customers.retrieve(customerId) as Stripe.Customer;
    } catch (error: any) {
      this.logger.error(`Failed to retrieve Stripe customer: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to retrieve customer: ${error.message}`);
    }
  }

  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    try {
      return await this.stripe.subscriptions.retrieve(subscriptionId);
    } catch (error: any) {
      this.logger.error(`Failed to retrieve Stripe subscription: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to retrieve subscription: ${error.message}`);
    }
  }

  async createCheckoutSession(customerId: string, priceId: string, userId: string): Promise<Stripe.Checkout.Session> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    try {
      const session = await this.stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${this.frontendUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${this.frontendUrl}/subscription/cancel`,
        metadata: {
          userId,
        },
        subscription_data: {
          metadata: {
            userId,
          },
        },
      });

      this.logger.log(`Created Stripe checkout session ${session.id} for user ${userId}`);
      return session;
    } catch (error: any) {
      this.logger.error(`Failed to create Stripe checkout session: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to create checkout session: ${error.message}`);
    }
  }

  async createPortalSession(customerId: string): Promise<Stripe.BillingPortal.Session> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    try {
      const session = await this.stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${this.frontendUrl}/subscription/billing`,
      });

      this.logger.log(`Created Stripe portal session ${session.id} for customer ${customerId}`);
      return session;
    } catch (error: any) {
      this.logger.error(`Failed to create Stripe portal session: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to create portal session: ${error.message}`);
    }
  }

  async getCustomerInvoices(customerId: string): Promise<Stripe.Invoice[]> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    try {
      const invoices = await this.stripe.invoices.list({
        customer: customerId,
        limit: 100,
      });

      return invoices.data;
    } catch (error: any) {
      this.logger.error(`Failed to retrieve customer invoices: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to retrieve invoices: ${error.message}`);
    }
  }

  async getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    try {
      return await this.stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['subscription'],
      });
    } catch (error: any) {
      this.logger.error(`Failed to retrieve checkout session: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to retrieve checkout session: ${error.message}`);
    }
  }

  constructEvent(payload: string | Buffer, signature: string, secret: string): Stripe.Event {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    try {
      return this.stripe.webhooks.constructEvent(payload, signature, secret);
    } catch (error: any) {
      this.logger.error(`Webhook signature verification failed: ${error.message}`);
      throw new BadRequestException(`Webhook signature verification failed: ${error.message}`);
    }
  }
}

