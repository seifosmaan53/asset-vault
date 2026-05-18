// Copyright (c) 2025 Asset Vault. All rights reserved.
// Script to verify data for a specific user

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

async function verifyUserData() {
  const userEmail = process.argv[2] || 'seifosman52@gmail.com';
  
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
    const storeRepository = dataSource.getRepository(Store);

    // Find user
    const user = await userRepository.findOne({ 
      where: { email: userEmail.toLowerCase().trim() } 
    });

    if (!user) {
      console.error(`❌ User not found: ${userEmail}`);
      console.log('\nAvailable users:');
      const allUsers = await userRepository.find();
      allUsers.forEach(u => console.log(`  - ${u.email} (${u.id})`));
      process.exit(1);
    }

    console.log(`✅ User found: ${user.email}`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Role: ${user.role}\n`);

    // Count data
    const clients = await clientRepository.count({ 
      where: { userId: user.id },
    });
    
    const stores = await storeRepository.count({ 
      where: { userId: user.id },
    });
    
    const inventory = await inventoryRepository.count({ 
      where: { userId: user.id },
    });
    
    const invoices = await invoiceRepository.count({ 
      where: { userId: user.id },
    });

    console.log('📊 Data Counts:');
    console.log(`   Clients: ${clients}`);
    console.log(`   Stores: ${stores}`);
    console.log(`   Inventory Items: ${inventory}`);
    console.log(`   Invoices: ${invoices}\n`);

    if (clients === 0 && stores === 0 && inventory === 0 && invoices === 0) {
      console.log('⚠️  No data found for this user!');
      console.log('\nTo add sample data, run:');
      console.log(`   npm run add-data-for-user ${userEmail}\n`);
    } else {
      console.log('✅ Data exists for this user!');
      
      // Show sample records
      if (clients > 0) {
        const sampleClient = await clientRepository.findOne({ 
          where: { userId: user.id },
        });
        console.log(`\n   Sample Client: ${sampleClient?.name} (${sampleClient?.id})`);
      }
      
      if (inventory > 0) {
        const sampleItem = await inventoryRepository.findOne({ 
          where: { userId: user.id },
        });
        console.log(`   Sample Inventory: ${sampleItem?.sku} - ${sampleItem?.name}`);
      }
      
      if (invoices > 0) {
        const sampleInvoice = await invoiceRepository.findOne({ 
          where: { userId: user.id },
        });
        console.log(`   Sample Invoice: ${sampleInvoice?.number} (${sampleInvoice?.status})`);
      }
    }

    await dataSource.destroy();
    process.exit(0);
  } catch (error: any) {
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('\nStack:', error.stack);
    }
    process.exit(1);
  }
}

verifyUserData();

