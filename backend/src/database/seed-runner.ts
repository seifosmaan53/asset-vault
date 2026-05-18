import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { seedDatabase } from './seed';
import { User } from '../users/entities/user.entity';
import { Client } from '../clients/entities/client.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { InvoiceItem } from '../invoices/entities/invoice-item.entity';
import { StockMovement } from '../inventory/entities/stock-movement.entity';
// Recurring invoices removed
import { Store } from '../inventory/entities/store.entity';
import { StoreItemSettings } from '../inventory/entities/store-item-settings.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { UserOrganization } from '../organizations/entities/user-organization.entity';

config();

async function runSeed() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'invoiceme',
    entities: [User, Client, InventoryItem, Invoice, InvoiceItem, StockMovement, Store, StoreItemSettings, Organization, UserOrganization], // RecurringInvoice removed
    synchronize: false,
    logging: false,
  });

  try {
    await dataSource.initialize();
    console.log('Database connection established');
    await seedDatabase(dataSource);
    await dataSource.destroy();
    console.log('Seed completed');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

runSeed();

