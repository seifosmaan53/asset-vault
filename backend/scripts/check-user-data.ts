#!/usr/bin/env ts-node
// Copyright (c) 2025 Asset Vault. All rights reserved.
// Diagnostic script to check user data in database
// Usage: npx ts-node scripts/check-user-data.ts seifosman52@gmail.com

import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { Invoice } from '../src/invoices/entities/invoice.entity';
import { Client } from '../src/clients/entities/client.entity';
import { InventoryItem } from '../src/inventory/entities/inventory-item.entity';
import { Store } from '../src/inventory/entities/store.entity';
import { User } from '../src/users/entities/user.entity';

// Load environment variables
config();

async function checkUserData(userEmail: string) {
  console.log(`\n=== Checking data for user: ${userEmail} ===\n`);

  // Create DataSource
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'invoiceme',
    entities: [User, Invoice, Client, InventoryItem, Store],
    synchronize: false,
    logging: false,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Connected to database\n');

    // Find user by email
    const userRepo = dataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { email: userEmail } });

    if (!user) {
      console.log(`❌ User not found with email: ${userEmail}`);
      await dataSource.destroy();
      return;
    }

    console.log(`✅ User found:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Clerk User ID: ${user.clerkUserId || 'N/A'}`);
    console.log(`\n`);

    // Check invoices
    const invoiceRepo = dataSource.getRepository(Invoice);
    const allInvoices = await invoiceRepo
      .createQueryBuilder('invoice')
      .withDeleted()
      .where('invoice.userId = :userId', { userId: user.id })
      .getMany();
    
    const activeInvoices = allInvoices.filter(i => !i.deletedAt);
    const deletedInvoices = allInvoices.filter(i => i.deletedAt);

    console.log(`📄 Invoices:`);
    console.log(`   Total (including deleted): ${allInvoices.length}`);
    console.log(`   Active: ${activeInvoices.length}`);
    console.log(`   Deleted: ${deletedInvoices.length}`);
    
    if (allInvoices.length > 0) {
      const sample = allInvoices[0];
      console.log(`   Sample invoice: id=${sample.id}, number=${sample.number}, userId=${sample.userId}`);
    }

    // Check clients
    const clientRepo = dataSource.getRepository(Client);
    const allClients = await clientRepo
      .createQueryBuilder('client')
      .withDeleted()
      .where('client.userId = :userId', { userId: user.id })
      .getMany();
    
    const activeClients = allClients.filter(c => !c.deletedAt);
    const deletedClients = allClients.filter(c => c.deletedAt);

    console.log(`\n👥 Clients:`);
    console.log(`   Total (including deleted): ${allClients.length}`);
    console.log(`   Active: ${activeClients.length}`);
    console.log(`   Deleted: ${deletedClients.length}`);
    
    if (allClients.length > 0) {
      const sample = allClients[0];
      console.log(`   Sample client: id=${sample.id}, name=${sample.name}, userId=${sample.userId}`);
    }

    // Check inventory
    const inventoryRepo = dataSource.getRepository(InventoryItem);
    const allItems = await inventoryRepo
      .createQueryBuilder('item')
      .withDeleted()
      .where('item.userId = :userId', { userId: user.id })
      .getMany();
    
    // InventoryItem does not have soft delete (deletedAt), so all items are active
    const activeItems = allItems;
    const deletedItems: InventoryItem[] = [];

    console.log(`\n📦 Inventory Items:`);
    console.log(`   Total (including deleted): ${allItems.length}`);
    console.log(`   Active: ${activeItems.length}`);
    console.log(`   Deleted: ${deletedItems.length}`);
    
    if (allItems.length > 0) {
      const sample = allItems[0];
      console.log(`   Sample item: id=${sample.id}, name=${sample.name}, userId=${sample.userId}`);
    }

    // Check stores
    const storeRepo = dataSource.getRepository(Store);
    const allStores = await storeRepo
      .createQueryBuilder('store')
      .withDeleted()
      .where('store.userId = :userId', { userId: user.id })
      .getMany();
    
    const activeStores = allStores.filter(s => !s.deletedAt);
    const deletedStores = allStores.filter(s => s.deletedAt);

    console.log(`\n🏪 Stores:`);
    console.log(`   Total (including deleted): ${allStores.length}`);
    console.log(`   Active: ${activeStores.length}`);
    console.log(`   Deleted: ${deletedStores.length}`);
    
    if (allStores.length > 0) {
      const sample = allStores[0];
      console.log(`   Sample store: id=${sample.id}, name=${sample.name}, userId=${sample.userId}`);
    }

    console.log(`\n=== Summary ===`);
    console.log(`Active data: ${activeInvoices.length} invoices, ${activeClients.length} clients, ${activeItems.length} items, ${activeStores.length} stores`);
    console.log(`\n`);

    await dataSource.destroy();
  } catch (error) {
    console.error('❌ Error:', error);
    await dataSource.destroy();
    process.exit(1);
  }
}

// Get email from command line argument
const userEmail = process.argv[2];
if (!userEmail) {
  console.error('Usage: npx ts-node scripts/check-user-data.ts <email>');
  process.exit(1);
}

checkUserData(userEmail);

