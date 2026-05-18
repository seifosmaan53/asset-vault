// Copyright (c) 2025 Asset Vault. All rights reserved.

import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Subscription, SubscriptionStatus } from '../subscriptions/entities/subscription.entity';
import { Plan } from '../subscriptions/entities/plan.entity';

/**
 * Migration script to add subscription records for existing users
 * Sets needsPlanSelection flag to true so they're prompted to choose a plan
 */
export async function migrateExistingUsers(dataSource: DataSource) {
  const userRepository = dataSource.getRepository(User);
  const subscriptionRepository = dataSource.getRepository(Subscription);
  const planRepository = dataSource.getRepository(Plan);

  console.log('Starting migration of existing users to subscription system...');

  // Get default plan
  const defaultPlan = await planRepository.findOne({
    where: { name: 'Pro', isActive: true },
  });

  if (!defaultPlan) {
    console.error('Default "Pro" plan not found. Please run migrations first.');
    process.exit(1);
  }

  // Get all existing users
  const users = await userRepository.find();

  console.log(`Found ${users.length} existing users to migrate`);

  let migrated = 0;
  let skipped = 0;

  for (const user of users) {
    // Check if user already has a subscription
    const existingSubscription = await subscriptionRepository.findOne({
      where: { userId: user.id },
    });

    if (existingSubscription) {
      console.log(`User ${user.email} already has a subscription, skipping...`);
      skipped++;
      continue;
    }

    // Create pending subscription
    const subscription = subscriptionRepository.create({
      userId: user.id,
      planId: defaultPlan.id,
      status: SubscriptionStatus.PENDING,
    });

    await subscriptionRepository.save(subscription);

    // Set needsPlanSelection flag
    user.needsPlanSelection = true;
    await userRepository.save(user);

    console.log(`Migrated user ${user.email} - created pending subscription`);
    migrated++;
  }

  console.log(`\nMigration complete!`);
  console.log(`- Migrated: ${migrated} users`);
  console.log(`- Skipped: ${skipped} users (already have subscriptions)`);
  console.log(`\nExisting users will be prompted to select a plan on their next login.`);
}

// Run migration if called directly
if (require.main === module) {
  import('../database/data-source.js').then(({ AppDataSource }) => {
    AppDataSource
      .initialize()
      .then(async () => {
        await migrateExistingUsers(AppDataSource);
        await AppDataSource.destroy();
        process.exit(0);
      })
      .catch((error) => {
        console.error('Migration failed:', error);
        process.exit(1);
      });
  });
}

