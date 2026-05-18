import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from '../users/entities/user.entity';
import { Client } from '../clients/entities/client.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { InvoiceItem } from '../invoices/entities/invoice-item.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { StockMovement } from '../inventory/entities/stock-movement.entity';
import { Store } from '../inventory/entities/store.entity';
import { StoreItemSettings } from '../inventory/entities/store-item-settings.entity';

config();

async function diagnoseDemoUser() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'invoiceme',
    entities: [User, Client, Invoice, InvoiceItem, InventoryItem, StockMovement, Store, StoreItemSettings],
    synchronize: false,
    logging: false,
  });

  try {
    await dataSource.initialize();
    console.log('Database connection established\n');

    const userRepository = dataSource.getRepository(User);
    const clientRepository = dataSource.getRepository(Client);
    const invoiceRepository = dataSource.getRepository(Invoice);
    const inventoryRepository = dataSource.getRepository(InventoryItem);

    // Find demo user using case-insensitive search (more efficient)
    const demoEmail = 'demo@example.com';
    console.log(`Looking for demo user with email: "${demoEmail}"`);
    
    // Use ILIKE for case-insensitive search in PostgreSQL (single efficient query)
    const demoUser = await userRepository
      .createQueryBuilder('user')
      .where('LOWER(user.email) = LOWER(:email)', { email: demoEmail })
      .getOne();

    if (!demoUser) {
      console.log('\n❌ Demo user NOT FOUND!');
      console.log('\nAll users in database:');
      // Only load users if demo user not found (avoid unnecessary query if found)
      const allUsers = await userRepository.find({ 
        select: ['id', 'email', 'role'],
        take: 20 // Limit to first 20 users
      });
      if (allUsers.length > 0) {
        allUsers.forEach(u => {
          console.log(`  - ${u.email} (ID: ${u.id}, Role: ${u.role})`);
        });
        if (allUsers.length === 20) {
          console.log('  ... (showing first 20 users)');
        }
      } else {
        console.log('  (No users found in database)');
      }
      console.log('\n💡 Solution: Run "npm run seed" to create demo user and data');
      await dataSource.destroy();
      process.exit(1);
    }

    console.log(`\n✅ Demo user found:`);
    console.log(`   Email: ${demoUser.email}`);
    console.log(`   ID: ${demoUser.id}`);
    console.log(`   Role: ${demoUser.role}`);
    console.log(`   Created: ${demoUser.createdAt}`);

    // Check for clients (use count for efficiency, only load sample if needed)
    const clientCount = await clientRepository.count({ where: { userId: demoUser.id } });
    console.log(`\n📋 Clients: ${clientCount}`);
    if (clientCount > 0) {
      const sampleClients = await clientRepository.find({ 
        where: { userId: demoUser.id },
        take: 5,
        select: ['name', 'email']
      });
      console.log('   Sample clients:');
      sampleClients.forEach(c => {
        console.log(`     - ${c.name} (${c.email || 'no email'})`);
      });
      if (clientCount > 5) {
        console.log(`     ... and ${clientCount - 5} more`);
      }
    } else {
      console.log('   ⚠️  No clients found for demo user');
    }

    // Check for invoices (use count for efficiency)
    const totalInvoices = await invoiceRepository.count({ where: { userId: demoUser.id } });
    console.log(`\n📄 Invoices: ${totalInvoices}`);
    if (totalInvoices > 0) {
      const sampleInvoices = await invoiceRepository.find({ 
        where: { userId: demoUser.id },
        take: 10,
        select: ['number', 'status', 'total']
      });
      console.log('   Sample invoices:');
      sampleInvoices.forEach(inv => {
        console.log(`     - ${inv.number} (${inv.status}, $${inv.total})`);
      });
      if (totalInvoices > 10) {
        console.log(`     ... and ${totalInvoices - 10} more`);
      }
    } else {
      console.log('   ⚠️  No invoices found for demo user');
    }

    // Check for inventory items (use count for efficiency)
    const totalInventory = await inventoryRepository.count({ where: { userId: demoUser.id } });
    console.log(`\n📦 Inventory Items: ${totalInventory}`);
    if (totalInventory > 0) {
      const sampleItems = await inventoryRepository.find({ 
        where: { userId: demoUser.id },
        take: 10,
        select: ['name', 'sku', 'currentStock']
      });
      console.log('   Sample items:');
      sampleItems.forEach(item => {
        console.log(`     - ${item.name} (SKU: ${item.sku}, Stock: ${item.currentStock})`);
      });
      if (totalInventory > 10) {
        console.log(`     ... and ${totalInventory - 10} more`);
      }
    } else {
      console.log('   ⚠️  No inventory items found for demo user');
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY:');
    console.log('='.repeat(60));
    console.log(`Demo User ID: ${demoUser.id}`);
    console.log(`Demo User Email: ${demoUser.email}`);
    console.log(`Clients: ${clientCount}`);
    console.log(`Invoices: ${totalInvoices}`);
    console.log(`Inventory Items: ${totalInventory}`);
    
    if (clientCount === 0 && totalInvoices === 0 && totalInventory === 0) {
      console.log('\n⚠️  WARNING: Demo user exists but has NO DATA!');
      console.log('💡 Solution: Run "npm run seed" to populate demo data');
    } else if (clientCount === 0 || totalInvoices === 0 || totalInventory === 0) {
      console.log('\n⚠️  WARNING: Demo user has incomplete data!');
      console.log('💡 Solution: Run "npm run clear-demo-data" then "npm run seed"');
    } else {
      console.log('\n✅ Demo user has data!');
      console.log('\nIf you still don\'t see data in the frontend:');
      console.log('1. Check that you\'re logged in with the correct user');
      console.log('2. Check browser console for errors');
      console.log('3. Verify the JWT token contains the correct userId');
      console.log(`4. Expected userId in JWT: ${demoUser.id}`);
    }

    await dataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('Error diagnosing demo user:', error);
    try {
      await dataSource.destroy();
    } catch {
      // Ignore destroy errors
    }
    process.exit(1);
  }
}

diagnoseDemoUser();

