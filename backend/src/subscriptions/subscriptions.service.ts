// Copyright (c) 2025 Asset Vault. All rights reserved.

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Subscription, SubscriptionStatus } from './entities/subscription.entity';
import { Plan } from './entities/plan.entity';
import { StripeService } from './stripe.service';
import { User } from '../users/entities/user.entity';
import { SubscriptionRequiredException, TrialExpiredException } from '../common/exceptions/subscription.exception';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    @InjectRepository(Plan)
    private planRepository: Repository<Plan>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private stripeService: StripeService,
    private configService: ConfigService,
  ) {}

  async createSubscription(userId: string, planId: string): Promise<Subscription> {
    // Check if user already has a subscription
    const existing = await this.getSubscription(userId);
    if (existing && existing.status === SubscriptionStatus.ACTIVE) {
      throw new BadRequestException('User already has an active subscription');
    }

    const plan = await this.planRepository.findOne({ where: { id: planId } });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Create Stripe customer if not exists
    let stripeCustomerId = existing?.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await this.stripeService.createCustomer(userId, user.email, user.name);
      stripeCustomerId = customer.id;
    }

    // Get Stripe price ID from ConfigService (validated at startup)
    const stripePriceId = this.configService.get<string>('STRIPE_PRICE_ID');
    if (!stripePriceId) {
      throw new BadRequestException('Stripe price ID is not configured. Please set STRIPE_PRICE_ID environment variable.');
    }

    // Create subscription in Stripe
    const stripeSubscription = await this.stripeService.createSubscription(
      stripeCustomerId,
      stripePriceId,
    );

    // Create or update subscription record
    let subscription = existing;
    if (subscription) {
      subscription.planId = planId;
      subscription.status = SubscriptionStatus.ACTIVE;
      subscription.stripeCustomerId = stripeCustomerId;
      subscription.stripeSubscriptionId = stripeSubscription.id;
      subscription.stripePriceId = stripePriceId;
      subscription.currentPeriodStart = new Date(stripeSubscription.current_period_start * 1000);
      subscription.currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);
      subscription.cancelAtPeriodEnd = false;
      subscription.canceledAt = null;
    } else {
      subscription = this.subscriptionRepository.create({
        userId,
        planId,
        status: SubscriptionStatus.ACTIVE,
        stripeCustomerId,
        stripeSubscriptionId: stripeSubscription.id,
        stripePriceId: stripePriceId,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        cancelAtPeriodEnd: false,
      });
    }

    return this.subscriptionRepository.save(subscription);
  }

  async getSubscription(userId: string): Promise<Subscription | null> {
    return this.subscriptionRepository.findOne({
      where: { userId },
      relations: ['plan'],
    });
  }

  async updateSubscription(userId: string, planId: string): Promise<Subscription> {
    const subscription = await this.getSubscription(userId);
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    const plan = await this.planRepository.findOne({ where: { id: planId } });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    if (!subscription.stripeSubscriptionId) {
      throw new BadRequestException('Subscription is not linked to Stripe');
    }

    // Get Stripe price ID from ConfigService (validated at startup)
    const stripePriceId = this.configService.get<string>('STRIPE_PRICE_ID');
    if (!stripePriceId) {
      throw new BadRequestException('Stripe price ID is not configured. Please set STRIPE_PRICE_ID environment variable.');
    }

    // Update subscription in Stripe
    const updatedStripeSubscription = await this.stripeService.updateSubscription(
      subscription.stripeSubscriptionId,
      stripePriceId,
    );

    // Update local subscription
    subscription.planId = planId;
    subscription.stripePriceId = stripePriceId;
    subscription.currentPeriodStart = new Date(updatedStripeSubscription.current_period_start * 1000);
    subscription.currentPeriodEnd = new Date(updatedStripeSubscription.current_period_end * 1000);

    return this.subscriptionRepository.save(subscription);
  }

  async cancelSubscription(userId: string): Promise<Subscription> {
    const subscription = await this.getSubscription(userId);
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (subscription.status === SubscriptionStatus.CANCELED) {
      return subscription;
    }

    if (!subscription.stripeSubscriptionId) {
      // If no Stripe subscription, just mark as canceled locally
      subscription.status = SubscriptionStatus.CANCELED;
      subscription.canceledAt = new Date();
      subscription.cancelAtPeriodEnd = true;
      return this.subscriptionRepository.save(subscription);
    }

    // Cancel in Stripe (at period end)
    await this.stripeService.cancelSubscription(subscription.stripeSubscriptionId);

    subscription.cancelAtPeriodEnd = true;
    subscription.canceledAt = new Date();

    return this.subscriptionRepository.save(subscription);
  }

  async reactivateSubscription(userId: string): Promise<Subscription> {
    const subscription = await this.getSubscription(userId);
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (!subscription.stripeSubscriptionId) {
      throw new BadRequestException('Subscription is not linked to Stripe');
    }

    // Reactivate in Stripe
    const stripeSubscription = await this.stripeService.getSubscription(subscription.stripeSubscriptionId);
    
    // Update subscription status based on Stripe status
    subscription.status = this.mapStripeStatusToSubscriptionStatus(stripeSubscription.status);
    subscription.cancelAtPeriodEnd = false;
    subscription.canceledAt = null;
    subscription.currentPeriodStart = new Date(stripeSubscription.current_period_start * 1000);
    subscription.currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);

    return this.subscriptionRepository.save(subscription);
  }

  async getSubscriptionStatus(userId: string): Promise<SubscriptionStatus | null> {
    const subscription = await this.getSubscription(userId);
    return subscription?.status || null;
  }

  async checkSubscriptionAccess(userId: string): Promise<boolean> {
    const subscription = await this.getSubscription(userId);
    if (!subscription) {
      return false; // No subscription = no access
    }

    const activeStatuses = [
      SubscriptionStatus.ACTIVE,
      SubscriptionStatus.TRIALING,
    ];

    // Allow access if active or trialing
    if (activeStatuses.includes(subscription.status)) {
      return true;
    }

    // Allow access during grace period (7 days after cancellation)
    if (subscription.status === SubscriptionStatus.CANCELED && subscription.canceledAt) {
      const gracePeriodEnd = new Date(subscription.canceledAt);
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);
      return new Date() < gracePeriodEnd;
    }

    // Allow access if pending (user is in the process of subscribing)
    if (subscription.status === SubscriptionStatus.PENDING) {
      return true;
    }

    return false;
  }

  async getBillingHistory(userId: string): Promise<any[]> {
    const subscription = await this.getSubscription(userId);
    if (!subscription || !subscription.stripeCustomerId) {
      return [];
    }

    return this.stripeService.getCustomerInvoices(subscription.stripeCustomerId);
  }

  async createPendingSubscription(userId: string, planId: string): Promise<Subscription> {
    // Check if subscription already exists
    const existing = await this.getSubscription(userId);
    if (existing) {
      return existing;
    }

    const subscription = this.subscriptionRepository.create({
      userId,
      planId,
      status: SubscriptionStatus.PENDING,
    });

    return this.subscriptionRepository.save(subscription);
  }

  async updateSubscriptionCustomerId(userId: string, stripeCustomerId: string): Promise<Subscription> {
    const subscription = await this.getSubscription(userId);
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    subscription.stripeCustomerId = stripeCustomerId;
    return this.subscriptionRepository.save(subscription);
  }

  async updateSubscriptionFromStripe(
    stripeSubscriptionId: string,
    stripeData: any,
  ): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { stripeSubscriptionId },
      relations: ['plan'],
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    subscription.status = this.mapStripeStatusToSubscriptionStatus(stripeData.status);
    subscription.currentPeriodStart = new Date(stripeData.current_period_start * 1000);
    subscription.currentPeriodEnd = new Date(stripeData.current_period_end * 1000);
    subscription.cancelAtPeriodEnd = stripeData.cancel_at_period_end || false;

    if (stripeData.canceled_at) {
      subscription.canceledAt = new Date(stripeData.canceled_at * 1000);
    }

    if (stripeData.trial_end) {
      subscription.trialEndsAt = new Date(stripeData.trial_end * 1000);
    }

    return this.subscriptionRepository.save(subscription);
  }

  async updateSubscriptionFromStripeByUserId(
    userId: string,
    stripeSubscriptionId: string,
    stripeData: any,
  ): Promise<Subscription> {
    // Find subscription by userId (since stripeSubscriptionId might not be set yet)
    let subscription = await this.subscriptionRepository.findOne({
      where: { userId },
      relations: ['plan'],
    });

    if (!subscription) {
      // If not found by userId, try by stripeSubscriptionId
      subscription = await this.subscriptionRepository.findOne({
        where: { stripeSubscriptionId },
        relations: ['plan'],
      });
    }

    // If subscription doesn't exist, create it
    if (!subscription) {
      this.logger.log(`Creating new subscription for user ${userId} from Stripe subscription ${stripeSubscriptionId}`);
      
      // Get default plan
      const defaultPlan = await this.getDefaultPlan();
      if (!defaultPlan) {
        throw new BadRequestException('No default plan found. Cannot create subscription.');
      }

      // Get customer ID from Stripe subscription
      const customerId = typeof stripeData.customer === 'string' 
        ? stripeData.customer 
        : stripeData.customer?.id;

      subscription = this.subscriptionRepository.create({
        userId,
        planId: defaultPlan.id,
        stripeSubscriptionId,
        stripeCustomerId: customerId,
        status: this.mapStripeStatusToSubscriptionStatus(stripeData.status),
        currentPeriodStart: new Date(stripeData.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeData.current_period_end * 1000),
        cancelAtPeriodEnd: stripeData.cancel_at_period_end || false,
        canceledAt: stripeData.canceled_at ? new Date(stripeData.canceled_at * 1000) : null,
        trialEndsAt: stripeData.trial_end ? new Date(stripeData.trial_end * 1000) : null,
      });
    } else {
      // Update existing subscription
      subscription.stripeSubscriptionId = stripeSubscriptionId;
      subscription.status = this.mapStripeStatusToSubscriptionStatus(stripeData.status);
      subscription.currentPeriodStart = new Date(stripeData.current_period_start * 1000);
      subscription.currentPeriodEnd = new Date(stripeData.current_period_end * 1000);
      subscription.cancelAtPeriodEnd = stripeData.cancel_at_period_end || false;

      if (stripeData.canceled_at) {
        subscription.canceledAt = new Date(stripeData.canceled_at * 1000);
      } else {
        subscription.canceledAt = null;
      }

      if (stripeData.trial_end) {
        subscription.trialEndsAt = new Date(stripeData.trial_end * 1000);
      } else {
        subscription.trialEndsAt = null;
      }

      // Update customer ID if not set
      if (!subscription.stripeCustomerId && stripeData.customer) {
        subscription.stripeCustomerId = typeof stripeData.customer === 'string' 
          ? stripeData.customer 
          : stripeData.customer?.id;
      }
    }

    this.logger.log(`Updated subscription for user ${userId} to status: ${subscription.status}`);
    return this.subscriptionRepository.save(subscription);
  }

  private mapStripeStatusToSubscriptionStatus(stripeStatus: string): SubscriptionStatus {
    const statusMap: Record<string, SubscriptionStatus> = {
      trialing: SubscriptionStatus.TRIALING,
      active: SubscriptionStatus.ACTIVE,
      past_due: SubscriptionStatus.PAST_DUE,
      canceled: SubscriptionStatus.CANCELED,
      unpaid: SubscriptionStatus.UNPAID,
      incomplete: SubscriptionStatus.INCOMPLETE,
      incomplete_expired: SubscriptionStatus.INCOMPLETE_EXPIRED,
    };

    return statusMap[stripeStatus] || SubscriptionStatus.PENDING;
  }

  async getDefaultPlan(): Promise<Plan | null> {
    return this.planRepository.findOne({
      where: { name: 'Pro', isActive: true },
    });
  }
}

