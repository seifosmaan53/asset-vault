import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from '../users/entities/user.entity';
import { Client } from '../clients/entities/client.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { InvoiceItem } from '../invoices/entities/invoice-item.entity';
import { StockMovement } from '../inventory/entities/stock-movement.entity';
// Recurring invoices and invoice templates removed
import { UserSettings } from '../user-settings/entities/user-settings.entity';
import { Store } from '../inventory/entities/store.entity';
import { StoreItemSettings } from '../inventory/entities/store-item-settings.entity';
import { ApiKey } from '../api-keys/entities/api-key.entity';

config();

async function clearDemoData() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'invoiceme',
    entities: [User, Client, InventoryItem, Invoice, InvoiceItem, StockMovement, UserSettings, Store, StoreItemSettings, ApiKey], // RecurringInvoice and InvoiceTemplate removed
    synchronize: false,
    logging: false,
  });

  try {
    await dataSource.initialize();
    console.log('Database connection established');

    const userRepository = dataSource.getRepository(User);
    const invoiceRepository = dataSource.getRepository(Invoice);
    const invoiceItemRepository = dataSource.getRepository(InvoiceItem);
    const clientRepository = dataSource.getRepository(Client);
    const inventoryRepository = dataSource.getRepository(InventoryItem);
    const stockMovementRepository = dataSource.getRepository(StockMovement);
    // const recurringInvoiceRepository = dataSource.getRepository(RecurringInvoice); // Removed
    const userSettingsRepository = dataSource.getRepository(UserSettings);
    const storeRepository = dataSource.getRepository(Store);
    const storeItemSettingsRepository = dataSource.getRepository(StoreItemSettings);
    // const invoiceTemplateRepository = dataSource.getRepository(InvoiceTemplate); // Removed
    const apiKeyRepository = dataSource.getRepository(ApiKey);

    // Find demo user
    const demoUser = await userRepository.findOne({ where: { email: 'demo@example.com' } });

    if (!demoUser) {
      console.log('No demo user found (demo@example.com). Nothing to clear.');
      await dataSource.destroy();
      process.exit(0);
    }

    // Count data before deletion
    const invoiceCount = await invoiceRepository.count({ where: { userId: demoUser.id } });
    const clientCount = await clientRepository.count({ where: { userId: demoUser.id } });
    const inventoryCount = await inventoryRepository.count({ where: { userId: demoUser.id } });
    const storeCount = await storeRepository.count({ where: { userId: demoUser.id } });

    // Check for user-created invoices (not part of seed data)
    const demoClientNames = ['Acme Corporation', 'Tech Solutions Ltd', 'Global Enterprises', 'Small Business Co'];
    const allClients = await clientRepository.find({ where: { userId: demoUser.id } });
    const hasDemoClients = allClients.some(client => demoClientNames.includes(client.name));
    
    // If demo clients exist, check if there are invoices beyond the seed data
    // Seed data typically has 166 invoices, so if there are more, user created them
    const userCreatedInvoices = hasDemoClients && invoiceCount > 170 ? invoiceCount - 166 : (hasDemoClients ? 0 : invoiceCount);

    console.log('\n⚠️  WARNING: This will PERMANENTLY DELETE all demo user data!');
    console.log('='.repeat(60));
    console.log(`Demo User: ${demoUser.email} (ID: ${demoUser.id})`);
    console.log(`\nData to be deleted:`);
    console.log(`  - ${invoiceCount} invoice(s)`);
    if (userCreatedInvoices > 0) {
      console.log(`    ⚠️  WARNING: ${userCreatedInvoices} of these appear to be user-created (not seed data)!`);
    }
    console.log(`  - ${clientCount} client(s)`);
    console.log(`  - ${inventoryCount} inventory item(s)`);
    console.log(`  - ${storeCount} store(s)`);
    console.log(`  - All user settings, templates, and API keys`);
    console.log('='.repeat(60));
    console.log('\n⚠️  THIS ACTION CANNOT BE UNDONE!');
    console.log('\nIf you have created invoices or other data, it will be PERMANENTLY LOST.');
    console.log('\nTo proceed, you must set the environment variable:');
    console.log('  CONFIRM_DELETE_DEMO_DATA=true');
    console.log('\nExample:');
    console.log('  CONFIRM_DELETE_DEMO_DATA=true npm run clear-demo-data');
    console.log('\nExiting without deleting data...');
    
    if (process.env.CONFIRM_DELETE_DEMO_DATA !== 'true') {
      await dataSource.destroy();
      process.exit(0);
    }

    console.log('\n⚠️  Confirmation received. Proceeding with deletion...\n');

    // Clear existing data for this user (order matters due to foreign keys)
    // 1. Delete invoice items first (they reference invoices)
    const userInvoices = await invoiceRepository.find({ where: { userId: demoUser.id } });
    const invoiceIds = userInvoices.map(inv => inv.id);
    if (invoiceIds.length > 0) {
      await invoiceItemRepository
        .createQueryBuilder()
        .delete()
        .where('invoiceId IN (:...ids)', { ids: invoiceIds })
        .execute();
      console.log(`  ✓ Deleted ${invoiceIds.length} invoice(s) and their items`);
    }

    // 2. Delete invoices (they reference clients)
    await invoiceRepository.delete({ userId: demoUser.id });

    // 3. Recurring invoices removed - no longer needed

    // 4. Delete stock movements (they reference inventory items)
    await stockMovementRepository.delete({ userId: demoUser.id });

    // 5. Delete store item settings (they reference stores and inventory)
    await storeItemSettingsRepository
      .createQueryBuilder()
      .delete()
      .where('"storeId" IN (SELECT id FROM stores WHERE "userId" = :userId)', { userId: demoUser.id })
      .execute();

    // 6. Delete stores
    await storeRepository.delete({ userId: demoUser.id });

    // 7. Delete inventory items
    await inventoryRepository.delete({ userId: demoUser.id });

    // 8. Delete clients
    await clientRepository.delete({ userId: demoUser.id });

    // 9. Delete user settings
    await userSettingsRepository.delete({ userId: demoUser.id });

    // 10. Invoice templates removed - no longer needed

    // 11. Delete API keys
    await apiKeyRepository.delete({ userId: demoUser.id });

    // 12. Finally delete the demo user
    await userRepository.delete({ id: demoUser.id });

    console.log('✅ All demo data cleared successfully!');
    console.log('   (Deleted demo user: demo@example.com and all associated data)');

    await dataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('Error clearing demo data:', error);
    await dataSource.destroy();
    process.exit(1);
  }
}

clearDemoData();

