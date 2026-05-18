// Copyright (c) 2025 Asset Vault. All rights reserved.
// Script to list all users in the database

import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from '../users/entities/user.entity';

config();

async function listUsers() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'invoiceme',
    entities: [User],
    synchronize: false,
    logging: false,
  });

  try {
    await dataSource.initialize();
    console.log('Database connection established\n');

    const userRepository = dataSource.getRepository(User);
    const users = await userRepository.find({
      order: { createdAt: 'DESC' },
    });

    if (users.length === 0) {
      console.log('❌ No users found in the database.');
      console.log('\n💡 Users are created automatically when they sign up through Clerk.');
      console.log('   Please make sure:');
      console.log('   1. The user has signed up through your Clerk application');
      console.log('   2. The Clerk webhook is configured and working');
      console.log('   3. The user exists in your Clerk dashboard\n');
    } else {
      console.log(`✅ Found ${users.length} user(s) in the database:\n`);
      users.forEach((user, index) => {
        console.log(`${index + 1}. Email: ${user.email}`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Name: ${user.name || 'N/A'}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Created: ${user.createdAt.toISOString()}`);
        console.log('');
      });
    }

    await dataSource.destroy();
    process.exit(0);
  } catch (error: any) {
    console.error('Error listing users:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

listUsers();

