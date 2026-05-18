// Copyright (c) 2025 Asset Vault. All rights reserved.
// Script to add sample data for a specific user

import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from '../users/entities/user.entity';
import { SampleDataService } from '../sample-data/sample-data.service';
import { AppModule } from '../app.module';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';

config();

async function addDataForUser() {
  // Get user identifier from command line arguments
  const userIdentifier = process.argv[2]; // Can be email or userId
  
  if (!userIdentifier) {
    console.error('❌ Error: Please provide a user email or user ID');
    console.log('\nUsage:');
    console.log('  npm run add-data-for-user <email>');
    console.log('  npm run add-data-for-user <userId>');
    console.log('\nExample:');
    console.log('  npm run add-data-for-user user@example.com');
    console.log('  npm run add-data-for-user user_abc123xyz');
    process.exit(1);
  }

  // Create NestJS application context to use services
  const app = await NestFactory.createApplicationContext(AppModule);
  const sampleDataService = app.get(SampleDataService);
  const userRepository = app.get(getRepositoryToken(User));

  try {
    // Find user by email or ID
    let user: User | null = null;
    const isEmail = userIdentifier.includes('@');
    
    // Try as email first (most common)
    if (isEmail) {
      user = await userRepository.findOne({ 
        where: { email: userIdentifier.toLowerCase().trim() } 
      });
    } else {
      // If doesn't look like email, try as userId (UUID)
      user = await userRepository.findOne({ 
        where: { id: userIdentifier } 
      });
    }

    if (!user) {
      console.error(`❌ Error: User not found with identifier: ${userIdentifier}`);
      console.log('\nPlease check:');
      console.log('  - Email is correct and user exists in database');
      console.log('  - User ID is correct');
      console.log('\nTo list all users, you can check the database or use a query script.');
      process.exit(1);
    }

    console.log(`\n✅ Found user: ${user.email} (ID: ${user.id})`);
    console.log(`   Role: ${user.role}`);
    console.log(`\n📊 Adding sample data...`);
    console.log('   This will create:');
    console.log('   - 50 clients');
    console.log('   - 100 stores');
    console.log('   - 300 inventory items');
    console.log('   - 200 invoices with items\n');

    // Add sample data
    const result = await sampleDataService.addSampleData(user.id);

    console.log('\n✅ Sample data added successfully!');
    console.log('\n📈 Summary:');
    console.log(`   Clients: ${result.clients}`);
    console.log(`   Stores: ${result.stores}`);
    console.log(`   Inventory Items: ${result.inventory}`);
    console.log(`   Invoices: ${result.invoices}`);
    console.log('\n✨ The user can now see this data in their dashboard!\n');

    await app.close();
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Error adding sample data:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    await app.close();
    process.exit(1);
  }
}

addDataForUser();

