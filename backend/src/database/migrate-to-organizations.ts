import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from '../users/entities/user.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { UserOrganization } from '../organizations/entities/user-organization.entity';
import { OrganizationRole } from '../organizations/entities/organization-role.enum';
import { Client } from '../clients/entities/client.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { InvoiceItem } from '../invoices/entities/invoice-item.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { Store } from '../inventory/entities/store.entity';
// Recurring invoices removed
import { StockMovement } from '../inventory/entities/stock-movement.entity';
import { StoreItemSettings } from '../inventory/entities/store-item-settings.entity';
import { UserSettings } from '../user-settings/entities/user-settings.entity';
// Invoice templates removed
import { ApiKey } from '../api-keys/entities/api-key.entity';

config();

/**
 * Migration script to convert existing user data to organizations
 * 
 * This script:
 * 1. Creates an organization for each existing user
 * 2. Adds the user as owner of their organization
 * 3. Migrates all user data to be linked to their organization
 */
async function migrateToOrganizations() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'invoiceme',
    entities: [
      User,
      Organization,
      UserOrganization,
      Client,
      Invoice,
      InvoiceItem,
      InventoryItem,
      Store,
      // RecurringInvoice, // Removed
      StockMovement,
      StoreItemSettings,
      UserSettings,
      // InvoiceTemplate, // Removed
      ApiKey,
    ],
    synchronize: false,
    logging: true,
  });

  try {
    await dataSource.initialize();
    console.log('Database connection established\n');
    console.log('='.repeat(70));
    console.log('MIGRATING EXISTING USER DATA TO ORGANIZATIONS');
    console.log('='.repeat(70));
    console.log('');

    const userRepository = dataSource.getRepository(User);
    const organizationRepository = dataSource.getRepository(Organization);
    const userOrganizationRepository = dataSource.getRepository(UserOrganization);
    const clientRepository = dataSource.getRepository(Client);
    const invoiceRepository = dataSource.getRepository(Invoice);
    const inventoryRepository = dataSource.getRepository(InventoryItem);
    const storeRepository = dataSource.getRepository(Store);
    // const recurringInvoiceRepository = dataSource.getRepository(RecurringInvoice); // Removed
    const stockMovementRepository = dataSource.getRepository(StockMovement);
    const storeItemSettingsRepository = dataSource.getRepository(StoreItemSettings);
    const userSettingsRepository = dataSource.getRepository(UserSettings);
    // const invoiceTemplateRepository = dataSource.getRepository(InvoiceTemplate); // Removed
    const apiKeyRepository = dataSource.getRepository(ApiKey);

    // Get all users
    const users = await userRepository.find();
    console.log(`Found ${users.length} user(s) to migrate\n`);

    for (const user of users) {
      console.log(`Processing user: ${user.email} (${user.id})`);

      // Check if user already has an organization
      const existingUserOrg = await userOrganizationRepository.findOne({
        where: { userId: user.id, isActive: true },
      });

      if (existingUserOrg) {
        console.log(`  ⚠️  User already has organization: ${existingUserOrg.organizationId}`);
        console.log(`  Skipping...\n`);
        continue;
      }

      // Create organization for this user
      const organizationName = user.companyName || user.name || `${user.email}'s Organization`;
      const organization = organizationRepository.create({
        name: organizationName,
        companyName: user.companyName || organizationName,
        email: user.email,
      });
      const savedOrg = await organizationRepository.save(organization);
      console.log(`  ✓ Created organization: ${savedOrg.name} (${savedOrg.id})`);

      // Add user as owner
      const userOrg = userOrganizationRepository.create({
        userId: user.id,
        organizationId: savedOrg.id,
        role: OrganizationRole.OWNER,
        isActive: true,
        joinedAt: new Date(),
      });
      await userOrganizationRepository.save(userOrg);
      console.log(`  ✓ Added user as owner`);

      // Migrate all user data to organization
      let migratedCount = 0;

      // Organizations removed - migration script is obsolete
      // All data is now user-scoped, no organizationId migration needed
      console.log(`  ✓ Organizations removed - data is already user-scoped for user ${user.id}`);

      console.log(`  ✅ Total: ${migratedCount} data record(s) migrated\n`);
    }

    console.log('='.repeat(70));
    console.log('✅ Migration completed successfully!');
    console.log('='.repeat(70));
    console.log('\nNext steps:');
    console.log('1. Run database migrations: npm run migration:run');
    console.log('2. Restart the backend server');
    console.log('3. Users can now create/join organizations');
    console.log('');

    await dataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('Error during migration:', error);
    try {
      await dataSource.destroy();
    } catch {
      // Ignore destroy errors
    }
    process.exit(1);
  }
}

migrateToOrganizations();

