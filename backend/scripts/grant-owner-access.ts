// Copyright (c) 2025 Asset Vault. All rights reserved.
// Script to grant owner access to a user by email

import { DataSource } from 'typeorm';
import { User, UserRole } from '../src/users/entities/user.entity';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

async function grantOwnerAccess() {
  // Get email from command line argument
  const email = process.argv[2];

  if (!email) {
    console.error('❌ Error: Please provide an email address');
    console.log('Usage: npm run grant-owner <email>');
    console.log('Example: npm run grant-owner user@example.com');
    process.exit(1);
  }

  // Database connection
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'invoiceme',
    entities: [User],
    synchronize: false,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Connected to database');

    const userRepository = dataSource.getRepository(User);
    const normalizedEmail = email.toLowerCase().trim();

    // Find user by email
    const user = await userRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (!user) {
      console.error(`❌ Error: User with email "${email}" not found`);
      console.log('\nAvailable users:');
      const allUsers = await userRepository.find({
        select: ['id', 'email', 'name', 'role'],
      });
      allUsers.forEach((u) => {
        console.log(`  - ${u.email} (${u.name}) - Role: ${u.role}`);
      });
      await dataSource.destroy();
      process.exit(1);
    }

    if (user.role === UserRole.OWNER) {
      console.log(`ℹ️  User "${email}" already has owner access`);
      await dataSource.destroy();
      process.exit(0);
    }

    // Update role to owner
    user.role = UserRole.OWNER;
    await userRepository.save(user);

    console.log(`✅ Successfully granted owner access to "${email}"`);
    console.log(`   User: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);

    await dataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await dataSource.destroy();
    process.exit(1);
  }
}

grantOwnerAccess();

