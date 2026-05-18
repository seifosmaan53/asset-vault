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
import { Organization } from '../organizations/entities/organization.entity';
import { UserOrganization } from '../organizations/entities/user-organization.entity';

config();

async function checkCurrentUser() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'invoiceme',
    entities: [User, Client, Invoice, InvoiceItem, InventoryItem, StockMovement, Store, StoreItemSettings, Organization, UserOrganization],
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

    // Get all users
    const allUsers = await userRepository.find({
      select: ['id', 'email', 'role', 'name', 'createdAt'],
      order: { createdAt: 'ASC' },
    });

    console.log('All users in database:');
    console.log('='.repeat(60));
    for (const user of allUsers) {
      const clientCount = await clientRepository.count({ where: { userId: user.id } });
      const invoiceCount = await invoiceRepository.count({ where: { userId: user.id } });
      const inventoryCount = await inventoryRepository.count({ where: { userId: user.id } });
      
      const isDemo = user.email.toLowerCase() === 'demo@example.com';
      const marker = isDemo ? ' 👈 DEMO USER' : '';
      
      console.log(`\n${user.email}${marker}`);
      console.log(`  ID: ${user.id}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Name: ${user.name || 'N/A'}`);
      console.log(`  Created: ${user.createdAt}`);
      console.log(`  Data: ${clientCount} clients, ${invoiceCount} invoices, ${inventoryCount} items`);
    }

    // Highlight demo user
    const demoUser = allUsers.find(u => u.email.toLowerCase() === 'demo@example.com');
    if (demoUser) {
      console.log('\n' + '='.repeat(60));
      console.log('DEMO USER INFO:');
      console.log('='.repeat(60));
      console.log(`Email: ${demoUser.email}`);
      console.log(`ID: ${demoUser.id}`);
      console.log(`Password: password123`);
      console.log('\n💡 If you\'re logged in but not seeing data:');
      console.log('   1. Log out completely');
      console.log('   2. Clear browser localStorage (or use incognito)');
      console.log('   3. Log back in with:');
      console.log(`      Email: ${demoUser.email}`);
      console.log('      Password: password123');
      console.log(`   4. Your JWT token should contain userId: ${demoUser.id}`);
    } else {
      console.log('\n⚠️  No demo user found! Run: npm run seed');
    }

    await dataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('Error checking users:', error);
    try {
      await dataSource.destroy();
    } catch {
      // Ignore destroy errors
    }
    process.exit(1);
  }
}

checkCurrentUser();

