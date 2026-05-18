import { config } from 'dotenv';
import { AppDataSource } from './data-source';
import { User } from '../users/entities/user.entity';
import { Client } from '../clients/entities/client.entity';
import { Store } from '../inventory/entities/store.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';

config();

async function verifyData() {
  try {
    await AppDataSource.initialize();
    console.log('Database connection established\n');

    const userRepository = AppDataSource.getRepository(User);
    const clientRepository = AppDataSource.getRepository(Client);
    const storeRepository = AppDataSource.getRepository(Store);
    const invoiceRepository = AppDataSource.getRepository(Invoice);
    const inventoryRepository = AppDataSource.getRepository(InventoryItem);

    // Get all users
    const allUsers = await userRepository.find();
    console.log(`Total users: ${allUsers.length}`);
    allUsers.forEach(user => {
      console.log(`  - ${user.email} (ID: ${user.id}, Role: ${user.role})`);
    });

    // Get demo user
    const demoUser = await userRepository.findOne({ where: { email: 'demo@example.com' } });
    if (!demoUser) {
      console.log('\n❌ Demo user NOT found!');
      process.exit(1);
    }

    console.log(`\n✅ Demo user found: ${demoUser.email} (ID: ${demoUser.id})`);

    // Count data for demo user
    const clients = await clientRepository.count({ where: { userId: demoUser.id } });
    const stores = await storeRepository.count({ where: { userId: demoUser.id } });
    const invoices = await invoiceRepository.count({ where: { userId: demoUser.id } });
    const inventoryItems = await inventoryRepository.count({ where: { userId: demoUser.id } });

    console.log(`\nData counts for demo user:`);
    console.log(`  Clients: ${clients}`);
    console.log(`  Stores: ${stores}`);
    console.log(`  Invoices: ${invoices}`);
    console.log(`  Inventory Items: ${inventoryItems}`);

    if (stores > 0) {
      const sampleStore = await storeRepository.findOne({
        where: { userId: demoUser.id },
        relations: ['client'],
      });
      if (sampleStore) {
        console.log(`\nSample store:`);
        console.log(`  Name: ${sampleStore.name}`);
        console.log(`  Code: ${sampleStore.code}`);
        console.log(`  Client ID: ${sampleStore.clientId}`);
        console.log(`  Client Name: ${sampleStore.client?.name || 'NOT LOADED'}`);
      }
    }

    if (clients === 0 || stores === 0 || invoices === 0) {
      console.log('\n⚠️  WARNING: Demo user has insufficient data!');
      console.log('   Run: npm run clear-demo-data && npm run seed');
    } else {
      console.log('\n✅ Demo user has data!');
    }

    await AppDataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

verifyData();

