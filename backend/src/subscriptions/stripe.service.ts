// Copyright (c) 2025 Asset Vault. All rights reserved.

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { errorMessage, errorStack } from '../invoices/utils/error-details.util';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe;
  private readonly frontendUrl: string;

  constructor(private configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      this.logger.warn(
        'STRIPE_SECRET_KEY not set - Stripe functionality will be disabled',
      );
    } else {
      this.stripe = new Stripe(secretKey, {
        apiVersion: '2025-02-24.acacia',
      });
    }
    this.frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
  }

  async createCustomer(
    userId: string,
    email: string,
    name: string,
  ): Promise<Stripe.Customer> {
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

      this.logger.log(
        `Created Stripe customer ${customer.id} for user ${userId}`,
      );
      return customer;
    } catch (error: unknown) {
      this.logger.error(
        `Failed to create Stripe customer: ${errorMessage(error)}`,
        errorStack(error),
      );
      throw new BadRequestException(
        `Failed to create customer: ${errorMessage(error)}`,
      );
    }
  }

  async createSubscription(
    customerId: string,
    priceId: string,
  ): Promise<Stripe.Subscription> {
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

      this.logger.log(
        `Created Stripe subscription ${subscription.id} for customer ${customerId}`,
      );
      return subscription;
    } catch (error: unknown) {
      this.logger.error(
        `Failed to create Stripe subscription: ${errorMessage(error)}`,
        errorStack(error),
      );
      throw new BadRequestException(
        `Failed to create subscription: ${errorMessage(error)}`,
      );
    }
  }

  async updateSubscription(
    subscriptionId: string,
    priceId: string,
  ): Promise<Stripe.Subscription> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    try {
      const subscription =
        await this.stripe.subscriptions.retrieve(subscriptionId);
      const updatedSubscription = await this.stripe.subscriptions.update(
        subscriptionId,
        {
          items: [
            {
              id: subscription.items.data[0].id,
              price: priceId,
            },
          ],
          proration_behavior: 'create_prorations',
        },
      );

      this.logger.log(`Updated Stripe subscription ${subscriptionId}`);
      return updatedSubscription;
    } catch (error: unknown) {
      this.logger.error(
        `Failed to update Stripe subscription: ${errorMessage(error)}`,
        errorStack(error),
      );
      throw new BadRequestException(
        `Failed to update subscription: ${errorMessage(error)}`,
      );
    }
  }

  async cancelSubscription(
    subscriptionId: string,
  ): Promise<Stripe.Subscription> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    try {
      const subscription = await this.stripe.subscriptions.update(
        subscriptionId,
        {
          cancel_at_period_end: true,
        },
      );

      this.logger.log(
        `Canceled Stripe subscription ${subscriptionId} at period end`,
      );
      return subscription;
    } catch (error: unknown) {
      this.logger.error(
        `Failed to cancel Stripe subscription: ${errorMessage(error)}`,
        errorStack(error),
      );
      throw new BadRequestException(
        `Failed to cancel subscription: ${errorMessage(error)}`,
      );
    }
  }

  async getCustomer(customerId: string): Promise<Stripe.Customer> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    try {
      return (await this.stripe.customers.retrieve(
        customerId,
      )) as Stripe.Customer;
    } catch (error: unknown) {
      this.logger.error(
        `Failed to retrieve Stripe customer: ${errorMessage(error)}`,
        errorStack(error),
      );
      throw new BadRequestException(
        `Failed to retrieve customer: ${errorMessage(error)}`,
      );
    }
  }

  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    try {
      return await this.stripe.subscriptions.retrieve(subscriptionId);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to retrieve Stripe subscription: ${errorMessage(error)}`,
        errorStack(error),
      );
      throw new BadRequestException(
        `Failed to retrieve subscription: ${errorMessage(error)}`,
      );
    }
  }

  async createCheckoutSession(
    customerId: string,
    priceId: string,
    userId: string,
  ): Promise<Stripe.Checkout.Session> {
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

      this.logger.log(
        `Created Stripe checkout session ${session.id} for user ${userId}`,
      );
      return session;
    } catch (error: unknown) {
      this.logger.error(
        `Failed to create Stripe checkout session: ${errorMessage(error)}`,
        errorStack(error),
      );
      throw new BadRequestException(
        `Failed to create checkout session: ${errorMessage(error)}`,
      );
    }
  }

  async createPortalSession(
    customerId: string,
  ): Promise<Stripe.BillingPortal.Session> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    try {
      const session = await this.stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${this.frontendUrl}/subscription/billing`,
      });

      this.logger.log(
        `Created Stripe portal session ${session.id} for customer ${customerId}`,
      );
      return session;
    } catch (error: unknown) {
      this.logger.error(
        `Failed to create Stripe portal session: ${errorMessage(error)}`,
        errorStack(error),
      );
      throw new BadRequestException(
        `Failed to create portal session: ${errorMessage(error)}`,
      );
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
    } catch (error: unknown) {
      this.logger.error(
        `Failed to retrieve customer invoices: ${errorMessage(error)}`,
        errorStack(error),
      );
      throw new BadRequestException(
        `Failed to retrieve invoices: ${errorMessage(error)}`,
      );
    }
  }

  async getCheckoutSession(
    sessionId: string,
  ): Promise<Stripe.Checkout.Session> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    try {
      return await this.stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['subscription'],
      });
    } catch (error: unknown) {
      this.logger.error(
        `Failed to retrieve checkout session: ${errorMessage(error)}`,
        errorStack(error),
      );
      throw new BadRequestException(
        `Failed to retrieve checkout session: ${errorMessage(error)}`,
      );
    }
  }

  constructEvent(
    payload: string | Buffer,
    signature: string,
    secret: string,
  ): Stripe.Event {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    try {
      return this.stripe.webhooks.constructEvent(payload, signature, secret);
    } catch (error: unknown) {
      this.logger.error(
        `Webhook signature verification failed: ${errorMessage(error)}`,
      );
      throw new BadRequestException(
        `Webhook signature verification failed: ${errorMessage(error)}`,
      );
    }
  }
}
