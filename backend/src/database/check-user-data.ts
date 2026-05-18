// Copyright (c) 2025 Asset Vault. All rights reserved.
// Diagnostic script to check user data in database

import { DataSource } from 'typeorm';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Client } from '../clients/entities/client.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { Store } from '../inventory/entities/store.entity';
import { User } from '../users/entities/user.entity';

/**
 * Check user data in database
 * Usage: Run this script to verify data exists for a user
 */
export async function checkUserData(dataSource: DataSource, userEmail: string) {
  console.log(`\n=== Checking data for user: ${userEmail} ===\n`);

  // Find user by email
  const userRepo = dataSource.getRepository(User);
  const user = await userRepo.findOne({ where: { email: userEmail } });

  if (!user) {
    console.log(`❌ User not found with email: ${userEmail}`);
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
    console.log(`   Sample invoice: id=${allInvoices[0].id}, number=${allInvoices[0].number}, userId=${allInvoices[0].userId}`);
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
    console.log(`   Sample client: id=${allClients[0].id}, name=${allClients[0].name}, userId=${allClients[0].userId}`);
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
    console.log(`   Sample item: id=${allItems[0].id}, name=${allItems[0].name}, userId=${allItems[0].userId}`);
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
    console.log(`   Sample store: id=${allStores[0].id}, name=${allStores[0].name}, userId=${allStores[0].userId}`);
  }

  console.log(`\n=== Summary ===`);
  console.log(`Active data: ${activeInvoices.length} invoices, ${activeClients.length} clients, ${activeItems.length} items, ${activeStores.length} stores`);
  console.log(`\n`);
}
