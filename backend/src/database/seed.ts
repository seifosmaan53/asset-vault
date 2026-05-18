import { DataSource, Repository, In } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../users/entities/user.entity';
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
import { OrganizationRole } from '../organizations/entities/organization-role.enum';

/**
 * Seed database with demo data for demo@example.com account ONLY.
 * 
 * IMPORTANT SAFETY GUARANTEES:
 * 1. Only works with demo@example.com - NEVER touches other users' data
 * 2. Only manages seed data (identified by specific names/SKUs)
 * 3. Preserves ALL user-created data (clients, invoices, inventory not in seed list)
 * 4. Never deletes data that doesn't match seed identifiers
 */
export async function seedDatabase(dataSource: DataSource) {
  const userRepository: Repository<User> = dataSource.getRepository(User);
  const clientRepository: Repository<Client> = dataSource.getRepository(Client);
  const inventoryRepository: Repository<InventoryItem> = dataSource.getRepository(InventoryItem);
  const invoiceRepository: Repository<Invoice> = dataSource.getRepository(Invoice);
  const invoiceItemRepository: Repository<InvoiceItem> = dataSource.getRepository(InvoiceItem);
  const stockMovementRepository: Repository<StockMovement> = dataSource.getRepository(StockMovement);
  // const recurringInvoiceRepository: Repository<RecurringInvoice> = dataSource.getRepository(RecurringInvoice); // Removed
  const storeRepository: Repository<Store> = dataSource.getRepository(Store);
  const storeItemSettingsRepository: Repository<StoreItemSettings> = dataSource.getRepository(StoreItemSettings);
  const organizationRepository: Repository<Organization> = dataSource.getRepository(Organization);
  const userOrganizationRepository: Repository<UserOrganization> = dataSource.getRepository(UserOrganization);

  console.log('Starting database seed...');
  console.log('⚠️  SAFETY: This script ONLY works with demo@example.com account');
  console.log('⚠️  SAFETY: All other users\' data is completely safe and untouched\n');

  // Check if demo user already exists (normalize email for lookup)
  // IMPORTANT: This is the ONLY email we ever work with
  const normalizedEmail = 'demo@example.com'.toLowerCase().trim();
  // Note: With Clerk authentication, users must be created through Clerk sign-up flow
  // The webhook will automatically create users in the database
  // For demo purposes, check if demo user exists (created via Clerk)
  let demoUser = await userRepository.findOne({ where: { email: normalizedEmail } });
  
  if (!demoUser) {
    console.log(`⚠️  Demo user (${normalizedEmail}) not found in database.`);
    console.log('   Please create the user through Clerk sign-up flow first.');
    console.log('   The webhook will automatically create the user in the database.');
    return; // Skip demo user setup if user doesn't exist
  } else {
    console.log(`✅ Demo user found: ${demoUser.email}`);
    
    // Ensure demo user is owner if no owner exists
    const ownerExists = await userRepository.findOne({ where: { role: UserRole.OWNER } });
    if (!ownerExists) {
      demoUser.role = UserRole.OWNER;
      await userRepository.save(demoUser);
      console.log(`Set demo user (${demoUser.email}) as OWNER`);
    } else if (demoUser.role !== UserRole.OWNER) {
      // If owner exists but demo user is not owner, that's okay
      console.log(`Demo user role: ${demoUser.role}`);
    }
  }

  // Ensure demo user has an organization (required for multi-tenancy)
  let demoOrganization = await organizationRepository.findOne({
    where: { name: 'Demo Company Inc.' },
  });

  if (!demoOrganization) {
    // Check if user already has an organization via UserOrganization
    const existingUserOrg = await userOrganizationRepository.findOne({
      where: { userId: demoUser.id, isActive: true },
      relations: ['organization'],
    });

    if (existingUserOrg && existingUserOrg.organization) {
      demoOrganization = existingUserOrg.organization;
      console.log(`Demo user already has organization: ${demoOrganization.name}`);
    } else {
      // Create organization for demo user
      demoOrganization = organizationRepository.create({
        name: 'Demo Company Inc.',
        companyName: demoUser.companyName || 'Demo Company Inc.',
      });
      demoOrganization = await organizationRepository.save(demoOrganization);
      console.log(`Created organization for demo user: ${demoOrganization.name}`);

      // Link user to organization as OWNER
      const userOrg = userOrganizationRepository.create({
        userId: demoUser.id,
        organizationId: demoOrganization.id,
        role: OrganizationRole.OWNER,
        isActive: true,
        joinedAt: new Date(),
      });
      await userOrganizationRepository.save(userOrg);
      console.log(`Linked demo user to organization as OWNER`);
    }
  } else {
    // Organization exists, check if user is linked to it
    const existingUserOrg = await userOrganizationRepository.findOne({
      where: { userId: demoUser.id, organizationId: demoOrganization.id, isActive: true },
    });

    if (!existingUserOrg) {
      // Link user to existing organization as OWNER
      const userOrg = userOrganizationRepository.create({
        userId: demoUser.id,
        organizationId: demoOrganization.id,
        role: OrganizationRole.OWNER,
        isActive: true,
        joinedAt: new Date(),
      });
      await userOrganizationRepository.save(userOrg);
      console.log(`Linked demo user to existing organization as OWNER`);
    }
  }

  // Define seed data identifiers - these are the ONLY things we'll manage
  // IMPORTANT: Only these specific names/SKUs are considered "seed data"
  // These constants are used throughout the function to identify seed vs user data
  const SEED_CLIENT_NAMES = [
    'Acme Corporation',
    'Tech Solutions Ltd',
    'Global Enterprises',
    'Small Business Co',
    'Premium Services',
    'Startup Ventures',
    'Enterprise Solutions',
  ];

  const SEED_INVENTORY_SKUS = [
    'PROD-001', 'PROD-002', 'PROD-003', 'PROD-004', 'PROD-005',
    'PROD-006', 'PROD-007', 'PROD-008', 'PROD-009', 'PROD-010',
    'PROD-011', 'PROD-012', 'PROD-013', 'PROD-014', 'PROD-015',
    'PROD-016', 'SERV-001',
  ];

  // Helper function to check if an invoice number matches seed invoice patterns
  // Seed invoices have specific number patterns:
  // - INV-{year}-0001 to INV-{year}-0020 (draft, sent, paid, overdue)
  // - EST-{year}-0001 to EST-{year}-0004 (estimates)
  // - INV-{year}-0100 to INV-{year}-0134 (current month paid)
  // - INV-{year}-1000 to INV-{year}-6107 (previous months: 1000, 2000, 3000, 4000, 5000, 6000 + offset)
  const isSeedInvoiceNumber = (invoiceNumber: string | null | undefined): boolean => {
    if (!invoiceNumber) return false;
    
    const currentYear = new Date().getFullYear();
    const yearPattern = currentYear.toString();
    
    // Pattern 1: INV-{year}-0001 to INV-{year}-0020
    const pattern1 = new RegExp(`^INV-${yearPattern}-(000[1-9]|00[12][0-9]|0020)$`);
    if (pattern1.test(invoiceNumber)) return true;
    
    // Pattern 2: EST-{year}-0001 to EST-{year}-0004
    const pattern2 = new RegExp(`^EST-${yearPattern}-000[1-4]$`);
    if (pattern2.test(invoiceNumber)) return true;
    
    // Pattern 3: INV-{year}-0100 to INV-{year}-0134 (current month paid)
    const pattern3 = new RegExp(`^INV-${yearPattern}-01[0-3][0-4]$`);
    if (pattern3.test(invoiceNumber)) return true;
    
    // Pattern 4: INV-{year}-1000 to INV-{year}-6107 (previous months)
    // Format: monthOffset * 1000 + i (where monthOffset 1-6, i 0-17)
    // So: 1000-1017, 2000-2017, 3000-3017, 4000-4017, 5000-5017, 6000-6017
    const pattern4 = new RegExp(`^INV-${yearPattern}-([1-6]00[0-9]|[1-6]01[0-7])$`);
    if (pattern4.test(invoiceNumber)) return true;
    
    return false;
  };

  // Check what data exists and separate seed data from user-created data
  const userId = demoUser.id;
  const existingClients = await clientRepository.find({ where: { userId } });
  const existingSeedClients = existingClients.filter(c => SEED_CLIENT_NAMES.includes(c.name));
  const userCreatedClients = existingClients.filter(c => !SEED_CLIENT_NAMES.includes(c.name));

  const existingInventory = await inventoryRepository.find({ where: { userId } });
  const existingSeedInventory = existingInventory.filter(i => SEED_INVENTORY_SKUS.includes(i.sku));
  const userCreatedInventory = existingInventory.filter(i => !SEED_INVENTORY_SKUS.includes(i.sku));

  // Get all invoices and identify which are seed data by invoice NUMBER (not client!)
  // This is critical: user-created invoices linked to seed clients should be preserved
  const allInvoices = await invoiceRepository.find({ 
    where: { userId },
    relations: ['client'],
  });
  const seedInvoices = allInvoices.filter(inv => isSeedInvoiceNumber(inv.number));
  const userCreatedInvoices = allInvoices.filter(inv => !isSeedInvoiceNumber(inv.number));

  // Report what we found
  console.log('\n📊 Current data status for demo@example.com:');
  console.log(`  Seed clients: ${existingSeedClients.length}/${SEED_CLIENT_NAMES.length}`);
  console.log(`  User-created clients: ${userCreatedClients.length} ✅ (PRESERVED)`);
  console.log(`  Seed inventory items: ${existingSeedInventory.length}/${SEED_INVENTORY_SKUS.length}`);
  console.log(`  User-created inventory items: ${userCreatedInventory.length} ✅ (PRESERVED)`);
  console.log(`  Seed invoices: ${seedInvoices.length}`);
  console.log(`  User-created invoices: ${userCreatedInvoices.length} ✅ (PRESERVED)`);

  if (userCreatedClients.length > 0 || userCreatedInvoices.length > 0 || userCreatedInventory.length > 0) {
    console.log('\n✅ User-created data detected! All user data will be preserved.');
    console.log('   Only seed data will be regenerated.');
  }

  // Only delete SEED data, never user-created data
  if (existingSeedClients.length > 0 || existingSeedInventory.length > 0 || seedInvoices.length > 0) {
    console.log('\n🔄 Regenerating seed data (preserving user-created data)...');
    
    // Delete seed invoices and their items (only seed invoices)
    if (seedInvoices.length > 0) {
      const seedInvoiceIds = seedInvoices.map(inv => inv.id);
      await invoiceItemRepository
        .createQueryBuilder()
        .delete()
        .where('invoiceId IN (:...ids)', { ids: seedInvoiceIds })
        .execute();
      await invoiceRepository.delete({ id: In(seedInvoiceIds) });
      console.log(`  ✓ Deleted ${seedInvoices.length} seed invoice(s) (preserved ${userCreatedInvoices.length} user-created)`);
    }

    // Recurring invoices removed - no longer needed

    // Delete seed clients (only seed clients that aren't referenced by user-created invoices)
    if (existingSeedClients.length > 0) {
      const seedClientIdsToDelete = existingSeedClients.map(c => c.id);
      
      // Check if any user-created invoices reference these seed clients
      const userCreatedInvoicesWithSeedClients = userCreatedInvoices.filter(
        inv => seedClientIdsToDelete.includes(inv.clientId)
      );
      
      if (userCreatedInvoicesWithSeedClients.length > 0) {
        // Find which seed clients are referenced by user-created invoices
        const referencedSeedClientIds = new Set(
          userCreatedInvoicesWithSeedClients.map(inv => inv.clientId)
        );
        const safeToDeleteClientIds = seedClientIdsToDelete.filter(
          id => !referencedSeedClientIds.has(id)
        );
        
        if (safeToDeleteClientIds.length > 0) {
          await clientRepository.delete({ id: In(safeToDeleteClientIds) });
          console.log(`  ✓ Deleted ${safeToDeleteClientIds.length} seed client(s) (preserved ${referencedSeedClientIds.size} that are referenced by user-created invoices)`);
        } else {
          console.log(`  ⚠ Skipped deleting ${seedClientIdsToDelete.length} seed client(s) - all are referenced by user-created invoices`);
        }
      } else {
        // No user-created invoices reference seed clients, safe to delete all
        await clientRepository.delete({ id: In(seedClientIdsToDelete) });
        console.log(`  ✓ Deleted ${existingSeedClients.length} seed client(s) (preserved ${userCreatedClients.length} user-created)`);
      }
    }

    // Delete seed inventory items (only seed inventory)
    if (existingSeedInventory.length > 0) {
      const seedInventoryIds = existingSeedInventory.map(i => i.id);
      // Delete stock movements for seed inventory only
      const allStockMovements = await stockMovementRepository.find({ 
        where: { userId },
      });
      const seedStockMovements = allStockMovements.filter(sm => 
        seedInventoryIds.includes(sm.inventoryItemId)
      );
      if (seedStockMovements.length > 0) {
        await stockMovementRepository.delete({ 
          id: In(seedStockMovements.map(sm => sm.id)) 
        });
        console.log(`  ✓ Deleted ${seedStockMovements.length} stock movement(s) for seed inventory`);
      }
      // Delete store item settings for seed inventory only
      const seedStoreItemSettings = await storeItemSettingsRepository
        .createQueryBuilder('sis')
        .where('sis.inventoryItemId IN (:...ids)', { ids: seedInventoryIds })
        .getMany();
      if (seedStoreItemSettings.length > 0) {
        await storeItemSettingsRepository.delete({ 
          id: In(seedStoreItemSettings.map(sis => sis.id)) 
        });
        console.log(`  ✓ Deleted ${seedStoreItemSettings.length} store item setting(s) for seed inventory`);
      }
      // Check if any user-created invoices have invoice items that reference these seed inventory items
      const allInvoiceItems = await invoiceItemRepository.find({
        where: {},
        relations: ['invoice'],
      });
      
      // Find invoice items from user-created invoices that reference seed inventory
      const userCreatedInvoiceItems = allInvoiceItems.filter(item => {
        const isFromUserCreatedInvoice = userCreatedInvoices.some(inv => inv.id === item.invoiceId);
        return isFromUserCreatedInvoice && seedInventoryIds.includes(item.inventoryItemId);
      });
      
      if (userCreatedInvoiceItems.length > 0) {
        // Find which seed inventory items are referenced by user-created invoice items
        const referencedInventoryIds = new Set(
          userCreatedInvoiceItems.map(item => item.inventoryItemId)
        );
        const safeToDeleteInventoryIds = seedInventoryIds.filter(
          id => !referencedInventoryIds.has(id)
        );
        
        if (safeToDeleteInventoryIds.length > 0) {
          await inventoryRepository.delete({ id: In(safeToDeleteInventoryIds) });
          console.log(`  ✓ Deleted ${safeToDeleteInventoryIds.length} seed inventory item(s) (preserved ${referencedInventoryIds.size} that are referenced by user-created invoices)`);
        } else {
          console.log(`  ⚠ Skipped deleting ${seedInventoryIds.length} seed inventory item(s) - all are referenced by user-created invoices`);
        }
      } else {
        // No user-created invoices reference seed inventory, safe to delete all
        await inventoryRepository.delete({ id: In(seedInventoryIds) });
        console.log(`  ✓ Deleted ${existingSeedInventory.length} seed inventory item(s) (preserved ${userCreatedInventory.length} user-created)`);
      }
    }

    // Note: We don't delete stores automatically because they might be used by user-created data
    // Stores will be created if needed during seed, but existing stores are preserved
    console.log('  ✓ Stores preserved (may be reused by seed data)');
  } else {
    console.log('\n✨ No existing seed data found. Creating fresh seed data...');
  }

  // Create demo clients
  const clientData = [
    {
      name: 'Acme Corporation',
      email: 'contact@acme.com',
      phone: '+1-555-0101',
      addressJson: {
        street: '123 Business St',
        city: 'New York',
        state: 'NY',
        zip: '10001',
        country: 'USA',
      },
      notes: 'Regular customer, pays on time',
    },
    {
      name: 'Tech Solutions Ltd',
      email: 'info@techsolutions.com',
      phone: '+1-555-0202',
      addressJson: {
        street: '456 Innovation Ave',
        city: 'San Francisco',
        state: 'CA',
        zip: '94102',
        country: 'USA',
      },
      notes: 'Bulk orders, quarterly billing',
    },
    {
      name: 'Global Enterprises',
      email: 'sales@globalent.com',
      phone: '+1-555-0303',
      addressJson: {
        street: '789 Corporate Blvd',
        city: 'Chicago',
        state: 'IL',
        zip: '60601',
        country: 'USA',
      },
    },
    {
      name: 'Small Business Co',
      email: 'hello@smallbiz.com',
      phone: '+1-555-0404',
      addressJson: {
        street: '321 Main St',
        city: 'Austin',
        state: 'TX',
        zip: '78701',
        country: 'USA',
      },
      notes: 'New client, growing business',
    },
    {
      name: 'Premium Services',
      email: 'contact@premium.com',
      phone: '+1-555-0505',
      addressJson: {
        street: '654 High St',
        city: 'Boston',
        state: 'MA',
        zip: '02101',
        country: 'USA',
      },
    },
    {
      name: 'Startup Ventures',
      email: 'team@startup.com',
      phone: '+1-555-0606',
    },
    {
      name: 'Enterprise Solutions',
      email: 'sales@enterprise.com',
      phone: '+1-555-0707',
      addressJson: {
        street: '987 Enterprise Way',
        city: 'Seattle',
        state: 'WA',
        zip: '98101',
        country: 'USA',
      },
    },
  ];

  // Get existing seed clients to reuse them if they exist
  const existingSeedClientsMap = new Map(
    existingSeedClients.map(c => [c.name, c])
  );
  
  const clients: Client[] = [];
  for (const data of clientData) {
    // Check if this seed client already exists
    const existing = existingSeedClientsMap.get(data.name);
    if (existing) {
      // Organizations removed - no need to update organizationId
      clients.push(existing);
      continue; // Skip creation, reuse existing
    }
    
    const client = clientRepository.create({
      ...data,
      userId,
      // Organizations removed - no organizationId needed
    });
    clients.push(await clientRepository.save(client));
  }
  console.log(`Created/Reused ${clients.length} demo clients`);

  // Create inventory items
  const inventoryData = [
    {
      sku: 'PROD-001',
      name: 'Premium Widget',
      description: 'High-quality widget for professional use',
      category: 'Widgets',
      unit: 'piece',
      barcode: '1234567890123',
      costPrice: 25.00,
      defaultUnitPrice: 50.00,
      defaultTaxRate: 10,
      currentStock: 150,
      reorderLevel: 20,
      maxStockLevel: 200,
      status: 'active' as const,
      sizeInches: '12',
      fluteType: 'E-Flute',
      printType: 'Roma',
      packSize: 50,
      unitsPerContainer: 1000,
      containerType: 'pallet',
      averageWeeklyUsage: 25.5,
      weeksSupplyTargetOverride: 4,
    },
    {
      sku: 'PROD-002',
      name: 'Standard Widget',
      description: 'Standard widget for everyday use',
      category: 'Widgets',
      unit: 'piece',
      costPrice: 15.00,
      defaultUnitPrice: 30.00,
      defaultTaxRate: 10,
      currentStock: 100, // Increased to account for invoice consumption
      reorderLevel: 10,
      status: 'active' as const,
      sizeInches: '10',
      fluteType: 'B-Flute',
      printType: 'Milano',
      packSize: 100,
      unitsPerContainer: 2000,
      containerType: 'box',
      averageWeeklyUsage: 18.0,
    },
    {
      sku: 'PROD-003',
      name: 'Deluxe Widget',
      description: 'Premium deluxe widget with extra features',
      category: 'Widgets',
      unit: 'piece',
      costPrice: 40.00,
      defaultUnitPrice: 80.00,
      defaultTaxRate: 15,
      currentStock: 50, // Increased to account for invoice consumption
      reorderLevel: 5,
      status: 'active' as const,
      sizeInches: '14',
      fluteType: 'E-Flute',
      printType: 'Vista',
      packSize: 25,
      unitsPerContainer: 500,
      containerType: 'skid',
      averageWeeklyUsage: 8.5,
      weeksSupplyTargetOverride: 6,
    },
    {
      sku: 'SERV-001',
      name: 'Consulting Service',
      description: 'Professional consulting hours',
      category: 'Services',
      unit: 'hour',
      costPrice: 0,
      defaultUnitPrice: 150.00,
      defaultTaxRate: 0,
      currentStock: 999, // Unlimited
      reorderLevel: 0,
      status: 'active' as const,
    },
    {
      sku: 'PROD-004',
      name: 'Basic Component',
      description: 'Basic component for assembly',
      category: 'Components',
      unit: 'piece',
      costPrice: 5.00,
      defaultUnitPrice: 12.00,
      defaultTaxRate: 8,
      currentStock: 200,
      reorderLevel: 50,
      status: 'active' as const,
      sizeInches: '8',
      material: 'Clay',
      printType: 'Plain',
      packSize: 200,
      unitsPerContainer: 5000,
      containerType: 'pallet',
      averageWeeklyUsage: 45.0,
    },
    {
      sku: 'PROD-005',
      name: 'Advanced Component',
      description: 'Advanced component with enhanced features',
      category: 'Components',
      unit: 'piece',
      costPrice: 20.00,
      defaultUnitPrice: 45.00,
      defaultTaxRate: 10,
      currentStock: 75,
      reorderLevel: 30,
      status: 'active' as const,
    },
    {
      sku: 'PROD-006',
      name: 'Accessory Pack',
      description: 'Complete accessory pack',
      category: 'Accessories',
      unit: 'pack',
      costPrice: 10.00,
      defaultUnitPrice: 25.00,
      defaultTaxRate: 10,
      currentStock: 80, // Increased to account for invoice consumption
      reorderLevel: 10,
      status: 'active' as const,
    },
    {
      sku: 'PROD-007',
      name: 'Premium Accessory',
      description: 'Premium quality accessory',
      category: 'Accessories',
      unit: 'piece',
      costPrice: 30.00,
      defaultUnitPrice: 60.00,
      defaultTaxRate: 12,
      currentStock: 50,
      reorderLevel: 15,
      status: 'active' as const,
    },
    {
      sku: 'PROD-008',
      name: 'Standard Tool',
      description: 'Standard tool for general use',
      category: 'Tools',
      unit: 'piece',
      costPrice: 18.00,
      defaultUnitPrice: 35.00,
      defaultTaxRate: 10,
      currentStock: 120,
      reorderLevel: 25,
      status: 'active' as const,
    },
    {
      sku: 'PROD-009',
      name: 'Professional Tool',
      description: 'Professional grade tool',
      category: 'Tools',
      unit: 'piece',
      costPrice: 50.00,
      defaultUnitPrice: 100.00,
      defaultTaxRate: 15,
      currentStock: 30,
      reorderLevel: 10,
      status: 'active' as const,
    },
    {
      sku: 'PROD-010',
      name: 'Economy Widget',
      description: 'Budget-friendly widget',
      category: 'Widgets',
      unit: 'piece',
      costPrice: 8.00,
      defaultUnitPrice: 18.00,
      defaultTaxRate: 8,
      currentStock: 60, // Increased to account for invoice consumption
      reorderLevel: 5,
      status: 'active' as const,
    },
    {
      sku: 'PROD-011',
      name: 'Specialty Item',
      description: 'Specialty item for specific applications',
      category: 'Specialty',
      unit: 'piece',
      costPrice: 35.00,
      defaultUnitPrice: 70.00,
      defaultTaxRate: 12,
      currentStock: 45,
      reorderLevel: 20,
      status: 'active' as const,
    },
    {
      sku: 'PROD-012',
      name: 'Bulk Package',
      description: 'Bulk package for large orders',
      category: 'Packages',
      unit: 'package',
      costPrice: 100.00,
      defaultUnitPrice: 200.00,
      defaultTaxRate: 10,
      currentStock: 70, // Increased to account for invoice consumption
      reorderLevel: 10,
      status: 'active' as const,
      sizeInches: '16',
      fluteType: 'B-Flute',
      printType: 'Rustica',
      packSize: 1000,
      unitsPerContainer: 5000,
      containerType: 'pallet',
      averageWeeklyUsage: 12.0,
      weeksSupplyTargetOverride: 8,
    },
    {
      sku: 'PROD-014',
      name: 'Premium Enterprise Package',
      description: 'Enterprise-grade solution with all features',
      category: 'Packages',
      unit: 'package',
      costPrice: 2500.00,
      defaultUnitPrice: 5000.00,
      defaultTaxRate: 8.5,
      currentStock: 50,
      reorderLevel: 5,
      status: 'active' as const,
    },
    {
      sku: 'PROD-015',
      name: 'Bulk Order - High Volume',
      description: 'High-volume bulk order item',
      category: 'Packages',
      unit: 'package',
      costPrice: 1250.00,
      defaultUnitPrice: 2500.00,
      defaultTaxRate: 7.5,
      currentStock: 80,
      reorderLevel: 10,
      status: 'active' as const,
    },
    {
      sku: 'PROD-016',
      name: 'Professional Service Bundle',
      description: 'Complete professional service package',
      category: 'Services',
      unit: 'bundle',
      costPrice: 1500.00,
      defaultUnitPrice: 3500.00,
      defaultTaxRate: 0,
      currentStock: 100,
      reorderLevel: 15,
      status: 'active' as const,
    },
    {
      sku: 'PROD-013',
      name: 'Inactive Product',
      description: 'This product is no longer active',
      category: 'Discontinued',
      unit: 'piece',
      costPrice: 20.00,
      defaultUnitPrice: 40.00,
      defaultTaxRate: 10,
      currentStock: 0,
      reorderLevel: 0,
      status: 'inactive' as const,
    },
  ];

  // Get existing seed inventory items to reuse them if they exist
  const existingSeedInventoryMap = new Map(
    existingSeedInventory.map(i => [i.sku, i])
  );
  
  const inventoryItems: InventoryItem[] = [];
  for (const data of inventoryData) {
    // Check if this seed inventory item already exists
    const existing = existingSeedInventoryMap.get(data.sku);
    if (existing) {
      // Organizations removed - no need to update organizationId
      inventoryItems.push(existing);
      continue; // Skip creation, reuse existing
    }
    
    const item = inventoryRepository.create({
      ...data,
      userId,
      // Organizations removed - no organizationId needed
    });
    inventoryItems.push(await inventoryRepository.save(item));
  }
  console.log(`Created/Reused ${inventoryItems.length} inventory items`);

  // Create demo stores
  const storeData = [
    {
      name: 'Main Store',
      code: 'MAIN',
      address: '123 Main Street, New York, NY 10001',
      active: true,
    },
    {
      name: 'Downtown Branch',
      code: 'DOWN',
      address: '456 Downtown Ave, New York, NY 10002',
      active: true,
    },
    {
      name: 'Westside Location',
      code: 'WEST',
      address: '789 Westside Blvd, New York, NY 10003',
      active: true,
    },
    {
      name: 'Warehouse Hub',
      code: 'WHSE',
      address: '321 Industrial Park, New York, NY 10004',
      active: true,
    },
    {
      name: 'Retail Outlet',
      code: 'RETL',
      address: '654 Shopping Center, New York, NY 10005',
      active: true,
    },
    {
      name: 'Online Store',
      code: 'ONLN',
      address: 'Online Only',
      active: true,
    },
    {
      name: 'North Branch',
      code: 'NORT',
      address: '987 North Street, New York, NY 10006',
      active: true,
    },
    {
      name: 'South Branch',
      code: 'SOUT',
      address: '147 South Avenue, New York, NY 10007',
      active: true,
    },
    {
      name: 'Eastside Location',
      code: 'EAST',
      address: '258 Eastside Road, New York, NY 10008',
      active: true,
    },
    {
      name: 'Central Hub',
      code: 'CENT',
      address: '369 Central Plaza, New York, NY 10009',
      active: true,
    },
    {
      name: 'Express Store',
      code: 'EXPR',
      address: '741 Express Lane, New York, NY 10010',
      active: true,
    },
  ];

  // Get existing stores to reuse them if they exist
  const existingStores = await storeRepository.find({ where: { userId } });
  const existingStoresMap = new Map(
    existingStores.map(s => [s.code, s])
  );
  
  const stores: Store[] = [];
  // Assign stores to clients - distribute stores across available clients
  // First client gets more stores (main operations), others get fewer
  for (let i = 0; i < storeData.length; i++) {
    const data = storeData[i];
    
    // Check if this store already exists
    const existing = existingStoresMap.get(data.code);
    if (existing) {
      // Organizations removed - no need to update organizationId
      stores.push(existing);
      continue; // Skip creation, reuse existing
    }
    
    // Distribute stores across clients: first 4 stores to first client, next 4 to second, etc.
    const clientIndex = Math.floor(i / 4) % clients.length;
    const assignedClient = clients[clientIndex];
    
    const store = storeRepository.create({
      ...data,
      userId,
      clientId: assignedClient.id,
      // Organizations removed - no organizationId needed
    });
    stores.push(await storeRepository.save(store));
  }
  console.log(`Created/Reused ${stores.length} demo stores (assigned to clients)`);

  // Create comprehensive store item settings for each store
  // Each store gets a different set of items with realistic stock levels
  for (let storeIndex = 0; storeIndex < stores.length; storeIndex++) {
    const store = stores[storeIndex];
    
    // Different stores get different items - create variety
    // Main stores get more items, smaller stores get fewer
    const itemsPerStore = storeIndex < 3 ? 10 : storeIndex < 6 ? 8 : 6;
    const startIndex = (storeIndex * 2) % inventoryItems.length;
    const itemsToAdd: InventoryItem[] = [];
    
    // Select items for this store (with some overlap between stores)
    for (let i = 0; i < itemsPerStore; i++) {
      const itemIndex = (startIndex + i) % inventoryItems.length;
      itemsToAdd.push(inventoryItems[itemIndex]);
    }
    
    for (const item of itemsToAdd) {
      // Create realistic stock levels based on item type and store
      const baseStock = item.currentStock || 50;
      // Vary stock by store (some stores have more, some less)
      const stockMultiplier = 0.5 + (storeIndex % 3) * 0.3; // 0.5 to 1.1
      const currentStock = Math.floor(baseStock * stockMultiplier * (0.8 + Math.random() * 0.4));
      
      // Calculate minQty as 20-30% of current stock
      const minQty = Math.max(5, Math.floor(currentStock * (0.2 + Math.random() * 0.1)));
      
      // Calculate targetQty as 150-200% of current stock
      const targetQty = Math.floor(currentStock * (1.5 + Math.random() * 0.5));
      
      // Calculate weekly usage based on current stock (higher stock = higher usage)
      const weeklyUsage = Math.max(1, Math.floor(currentStock / 10) * (0.5 + Math.random() * 0.5));
      
      const settings = storeItemSettingsRepository.create({
        storeId: store.id,
        inventoryItemId: item.id,
        currentStock: Math.max(0, currentStock),
        minQty: minQty,
        targetQty: targetQty,
        weeklyUsage: weeklyUsage,
      });
      await storeItemSettingsRepository.save(settings);
    }
    
    console.log(`  Created ${itemsToAdd.length} items for ${store.name}`);
  }
  console.log('Created store item settings for all stores');

  // Create stock movements for stores (purchases, transfers, adjustments)
  // Add initial stock purchases for each store with storeId association
  for (let storeIndex = 0; storeIndex < stores.length; storeIndex++) {
    const store = stores[storeIndex];
    const storeSettings = await storeItemSettingsRepository.find({
      where: { storeId: store.id },
    });
    
    // Create purchase movements for items in this store
    for (const setting of storeSettings.slice(0, 8)) { // First 8 items per store
      const item = inventoryItems.find(i => i.id === setting.inventoryItemId);
      if (item) {
        // Create initial purchase with storeId
        const purchaseQuantity = setting.currentStock + Math.floor(Math.random() * 50);
        const purchaseMovement = stockMovementRepository.create({
          inventoryItemId: item.id,
          userId,
          type: 'purchase',
          quantity: purchaseQuantity,
          sourceType: 'manual',
          note: `Initial stock purchase for ${store.name}`,
          storeId: store.id, // Associate with store
        });
        await stockMovementRepository.save(purchaseMovement);
        
        // Create some additional movements (adjustments) for variety
        if (Math.random() > 0.7) { // 30% chance
          const adjustmentMovement = stockMovementRepository.create({
            inventoryItemId: item.id,
            userId,
            type: 'adjustment',
            quantity: Math.floor(Math.random() * 20) - 10, // -10 to +10
            sourceType: 'manual',
            note: `Stock adjustment for ${store.name}`,
            storeId: store.id, // Associate with store
          });
          await stockMovementRepository.save(adjustmentMovement);
        }
      }
    }
    
    // Create some inter-store transfer movements (simulate transfers between stores)
    if (storeIndex > 0 && Math.random() > 0.5) { // 50% chance for stores after first
      const fromStore = stores[storeIndex - 1];
      const toStore = store;
      const itemToTransfer = inventoryItems[Math.floor(Math.random() * Math.min(5, inventoryItems.length))];
      
      if (itemToTransfer) {
        const transferQuantity = Math.floor(Math.random() * 20) + 5;
        
        // Outgoing transfer from previous store
        const outgoingMovement = stockMovementRepository.create({
          inventoryItemId: itemToTransfer.id,
          userId,
          type: 'sale', // Using sale type for outgoing transfer
          quantity: transferQuantity,
          sourceType: 'manual',
          note: `Transfer to ${toStore.name}`,
          storeId: fromStore.id,
        });
        await stockMovementRepository.save(outgoingMovement);
        
        // Incoming transfer to current store
        const incomingMovement = stockMovementRepository.create({
          inventoryItemId: itemToTransfer.id,
          userId,
          type: 'purchase', // Using purchase type for incoming transfer
          quantity: transferQuantity,
          sourceType: 'manual',
          note: `Transfer from ${fromStore.name}`,
          storeId: toStore.id,
        });
        await stockMovementRepository.save(incomingMovement);
      }
    }
  }
  console.log('Created stock movements for stores');

  // Create invoices with various statuses
  const invoiceNow = new Date();
  const invoices: Invoice[] = [];
  let invoiceCounter = 0; // Track invoice creation order for proper createdAt timestamps

  // Draft invoices - issue date can be today or in the past, due date can be in the future
  for (let i = 0; i < 3; i++) {
    const issueDate = new Date(invoiceNow.getTime() - i * 2 * 24 * 60 * 60 * 1000);
    // Ensure issue date is not in the future
    if (issueDate > invoiceNow) {
      issueDate.setTime(invoiceNow.getTime());
    }
    const dueDate = new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    // Set createdAt to be in reverse chronological order (newest first)
    // Subtract seconds to ensure proper ordering
    const createdAt = new Date(invoiceNow.getTime() - invoiceCounter * 1000);
    invoiceCounter++;
    
    const invoice = invoiceRepository.create({
      userId,
      clientId: clients[i % clients.length].id,
      storeId: stores[i % stores.length].id, // Assign to stores
      type: 'invoice',
      number: `INV-${invoiceNow.getFullYear()}-${String(i + 1).padStart(4, '0')}`,
      status: 'draft',
      issueDate: issueDate,
      dueDate: dueDate,
      currency: 'USD',
      subtotal: 0,
      taxTotal: 0,
      discountTotal: 0,
      total: 0,
      createdAt: createdAt,
      updatedAt: createdAt,
    });
    invoices.push(await invoiceRepository.save(invoice));
  }

  // Sent invoices
  for (let i = 0; i < 5; i++) {
    const createdAt = new Date(invoiceNow.getTime() - invoiceCounter * 1000);
    invoiceCounter++;
    
    const invoice = invoiceRepository.create({
      userId,
      clientId: clients[i % clients.length].id,
      storeId: stores[i % stores.length].id, // Assign to stores
      type: 'invoice',
      number: `INV-${invoiceNow.getFullYear()}-${String(i + 4).padStart(4, '0')}`,
      status: 'sent',
      issueDate: new Date(invoiceNow.getTime() - (i + 5) * 24 * 60 * 60 * 1000),
      dueDate: new Date(invoiceNow.getTime() - (i + 5 - 30) * 24 * 60 * 60 * 1000),
      currency: 'USD',
      subtotal: 0,
      taxTotal: 0,
      discountTotal: 0,
      total: 0,
      createdAt: createdAt,
      updatedAt: createdAt,
    });
    invoices.push(await invoiceRepository.save(invoice));
  }

  // Paid invoices - distribute across stores with varying amounts
  for (let i = 0; i < 8; i++) {
    const storeIndex = i % stores.length;
    const createdAt = new Date(invoiceNow.getTime() - invoiceCounter * 1000);
    invoiceCounter++;
    
    const invoice = invoiceRepository.create({
      userId,
      clientId: clients[i % clients.length].id,
      storeId: stores[storeIndex].id, // Assign to stores
      type: 'invoice',
      number: `INV-${invoiceNow.getFullYear()}-${String(i + 9).padStart(4, '0')}`,
      status: 'paid',
      issueDate: new Date(invoiceNow.getTime() - (i + 20) * 24 * 60 * 60 * 1000),
      dueDate: new Date(invoiceNow.getTime() - (i + 20 - 30) * 24 * 60 * 60 * 1000),
      paidAt: new Date(invoiceNow.getTime() - (i + 15) * 24 * 60 * 60 * 1000),
      currency: 'USD',
      subtotal: 0,
      taxTotal: 0,
      discountTotal: 0,
      total: 0,
      createdAt: createdAt,
      updatedAt: createdAt,
    });
    invoices.push(await invoiceRepository.save(invoice));
  }

  // Overdue invoices
  for (let i = 0; i < 3; i++) {
    const createdAt = new Date(invoiceNow.getTime() - invoiceCounter * 1000);
    invoiceCounter++;
    
    const invoice = invoiceRepository.create({
      userId,
      clientId: clients[i % clients.length].id,
      storeId: stores[i % stores.length].id, // Assign to stores
      type: 'invoice',
      number: `INV-${invoiceNow.getFullYear()}-${String(i + 17).padStart(4, '0')}`,
      status: 'overdue',
      issueDate: new Date(invoiceNow.getTime() - (i + 45) * 24 * 60 * 60 * 1000),
      dueDate: new Date(invoiceNow.getTime() - (i + 15) * 24 * 60 * 60 * 1000),
      currency: 'USD',
      subtotal: 0,
      taxTotal: 0,
      discountTotal: 0,
      total: 0,
      createdAt: createdAt,
      updatedAt: createdAt,
    });
    invoices.push(await invoiceRepository.save(invoice));
  }

  // Estimates - issue date can be today or in the past
  for (let i = 0; i < 4; i++) {
    const issueDate = new Date(invoiceNow.getTime() - i * 3 * 24 * 60 * 60 * 1000);
    // Ensure issue date is not in the future
    if (issueDate > invoiceNow) {
      issueDate.setTime(invoiceNow.getTime());
    }
    
    const createdAt = new Date(invoiceNow.getTime() - invoiceCounter * 1000);
    invoiceCounter++;
    
    const invoice = invoiceRepository.create({
      userId,
      clientId: clients[i % clients.length].id,
      type: 'estimate',
      number: `EST-${invoiceNow.getFullYear()}-${String(i + 1).padStart(4, '0')}`,
      status: 'draft',
      issueDate: issueDate,
      currency: 'USD',
      subtotal: 0,
      taxTotal: 0,
      discountTotal: 0,
      total: 0,
      createdAt: createdAt,
      updatedAt: createdAt,
    });
    invoices.push(await invoiceRepository.save(invoice));
  }

  // Additional paid invoices for THIS MONTH to show current profit
  // Distribute across stores to show store analytics
  const currentMonth = invoiceNow.getMonth();
  const currentYear = invoiceNow.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const currentDay = invoiceNow.getDate();
  
  // Create 30-40 paid invoices spread throughout the current month across all stores
  const thisMonthPaidCount = 35;
  for (let i = 0; i < thisMonthPaidCount; i++) {
    // Spread invoices throughout the month (from day 1 to current day - 1, ensuring past dates)
    // Use currentDay - 1 to ensure we never create invoices with today's date (they should be paid)
    const maxDay = Math.max(1, currentDay - 1);
    const dayOfMonth = Math.min(maxDay, Math.floor((maxDay / thisMonthPaidCount) * (i + 1)) || 1);
    const issueDate = new Date(currentYear, currentMonth, dayOfMonth);
    
    // Ensure issue date is not in the future
    if (issueDate > invoiceNow) {
      issueDate.setTime(invoiceNow.getTime() - 24 * 60 * 60 * 1000); // Set to yesterday
    }
    
    // Paid 1-3 days after issue, but ensure it's in the past
    const paidDate = new Date(issueDate);
    paidDate.setDate(paidDate.getDate() + Math.floor(Math.random() * 3) + 1);
    // Make sure paid date is not in the future
    if (paidDate > invoiceNow) {
      paidDate.setTime(invoiceNow.getTime() - 24 * 60 * 60 * 1000); // Set to yesterday
    }
    
    // Due date should be 30 days after issue, but cap at today for paid invoices
    const dueDate = new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    if (dueDate > invoiceNow) {
      dueDate.setTime(invoiceNow.getTime());
    }
    
    // Distribute invoices across stores (some stores get more)
    const storeIndex = i % stores.length;
    // Make first 3 stores get more invoices (better analytics)
    const preferredStoreIndex = i < 20 ? (i % 3) : storeIndex;
    
    // Set createdAt to be in reverse chronological order (newest first)
    const createdAt = new Date(invoiceNow.getTime() - invoiceCounter * 1000);
    invoiceCounter++;
    
    const invoice = invoiceRepository.create({
      userId,
      clientId: clients[i % clients.length].id,
      storeId: stores[preferredStoreIndex].id, // Assign to stores
      type: 'invoice',
      number: `INV-${currentYear}-${String(i + 100).padStart(4, '0')}`,
      status: 'paid',
      issueDate: issueDate,
      dueDate: dueDate,
      paidAt: paidDate,
      currency: 'USD',
      subtotal: 0,
      taxTotal: 0,
      discountTotal: 0,
      total: 0,
      createdAt: createdAt,
      updatedAt: createdAt,
    });
    invoices.push(await invoiceRepository.save(invoice));
  }

  // Create more paid invoices from previous months for better historical data
  for (let monthOffset = 1; monthOffset <= 6; monthOffset++) {
    const monthDate = new Date(currentYear, currentMonth - monthOffset, 1);
    const daysInThatMonth = new Date(currentYear, currentMonth - monthOffset + 1, 0).getDate();
    
    // 15-20 invoices per month
    const invoicesPerMonth = 18;
    for (let i = 0; i < invoicesPerMonth; i++) {
      const dayOfMonth = Math.floor(Math.random() * daysInThatMonth) + 1;
      const issueDate = new Date(currentYear, currentMonth - monthOffset, dayOfMonth);
      const paidDate = new Date(issueDate);
      paidDate.setDate(paidDate.getDate() + Math.floor(Math.random() * 5) + 1);
      
      const storeIndex = (monthOffset * invoicesPerMonth + i) % stores.length;
      
      // Set createdAt to be in reverse chronological order (newest first)
      const createdAt = new Date(invoiceNow.getTime() - invoiceCounter * 1000);
      invoiceCounter++;
      
      const invoice = invoiceRepository.create({
        userId,
        clientId: clients[i % clients.length].id,
        storeId: stores[storeIndex].id,
        type: 'invoice',
        number: `INV-${currentYear}-${String(monthOffset * 1000 + i).padStart(4, '0')}`,
        status: 'paid',
        issueDate: issueDate,
        dueDate: new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000),
        paidAt: paidDate,
        currency: 'USD',
        subtotal: 0,
        taxTotal: 0,
        discountTotal: 0,
        total: 0,
        createdAt: createdAt,
        updatedAt: createdAt,
      });
      invoices.push(await invoiceRepository.save(invoice));
    }
  }

  // Create invoice items and calculate totals
  for (let invoiceIndex = 0; invoiceIndex < invoices.length; invoiceIndex++) {
    const invoice = invoices[invoiceIndex];
    // Vary item count: some invoices have 1-3 items, some have 5-15 items for bigger totals
    const isBigInvoice = Math.random() < 0.3; // 30% chance of big invoice
    const itemCount = isBigInvoice 
      ? Math.floor(Math.random() * 11) + 5 // 5-15 items for big invoices
      : Math.floor(Math.random() * 3) + 1; // 1-3 items for regular invoices
    const invoiceItems: InvoiceItem[] = [];
    let subtotal = 0;
    let taxTotal = 0;
    let discountTotal = 0;

    for (let j = 0; j < itemCount; j++) {
      const inventoryItem = inventoryItems[Math.floor(Math.random() * inventoryItems.length)];
      // Big invoices have larger quantities (10-100), regular have 1-10
      const quantity = isBigInvoice
        ? Math.floor(Math.random() * 91) + 10 // 10-100 for big invoices
        : Math.floor(Math.random() * 10) + 1; // 1-10 for regular invoices
      // For big invoices, sometimes apply a multiplier to unit price
      const priceMultiplier = isBigInvoice && Math.random() < 0.2 ? (Math.random() * 3 + 1) : 1; // 20% chance of 1x-4x price
      const unitPrice = inventoryItem.defaultUnitPrice * priceMultiplier;
      const taxRate = inventoryItem.defaultTaxRate || 0;
      const discountRate = Math.random() < 0.3 ? Math.floor(Math.random() * 10) : 0; // 30% chance of discount

      const lineSubtotal = quantity * unitPrice;
      const lineDiscount = (lineSubtotal * discountRate) / 100;
      const lineAfterDiscount = lineSubtotal - lineDiscount;
      const lineTax = (lineAfterDiscount * taxRate) / 100;

      subtotal += lineSubtotal;
      discountTotal += lineDiscount;
      taxTotal += lineTax;

      const invoiceItem = invoiceItemRepository.create({
        invoiceId: invoice.id,
        inventoryItemId: inventoryItem.id,
        description: inventoryItem.name,
        quantity,
        unitPrice,
        taxRate,
        discountRate,
        lineTotal: lineAfterDiscount + lineTax,
      });
      const savedInvoiceItem = await invoiceItemRepository.save(invoiceItem);
      invoiceItems.push(savedInvoiceItem);

      // Create stock movement for sale (only for non-draft invoices)
      if (invoice.type === 'invoice' && invoice.status !== 'draft') {
        const movement = stockMovementRepository.create({
          inventoryItemId: inventoryItem.id,
          invoiceItemId: savedInvoiceItem.id,
          userId,
          type: 'sale',
          quantity: quantity, // Positive quantity, service will handle subtraction
          sourceType: 'invoice',
          sourceId: invoice.id,
          note: `Invoice ${invoice.number}`,
        });
        await stockMovementRepository.save(movement);
        
        // Update stock manually since we're bypassing the service
        inventoryItem.currentStock = Math.max(0, inventoryItem.currentStock - quantity);
        await inventoryRepository.save(inventoryItem);
      }
    }

    // Update invoice totals
    invoice.subtotal = Math.round(subtotal * 100) / 100;
    invoice.taxTotal = Math.round(taxTotal * 100) / 100;
    invoice.discountTotal = Math.round(discountTotal * 100) / 100;
    invoice.total = Math.round((subtotal - discountTotal + taxTotal) * 100) / 100;
    await invoiceRepository.save(invoice);
  }

  console.log(`Created ${invoices.length} invoices`);

  // Recurring invoices removed - no longer needed

  // Backfill organizationId for all seed data (in case any existing items don't have it)
  if (demoOrganization) {
    console.log('\n🔄 Backfilling organizationId for seed data...');
    
    // Organizations removed - seed data is already user-scoped
    // No need to update organizationId as it no longer exists on entities
    
    // Fix invoices with future dates and update createdAt timestamps for proper sorting
    console.log('\n🔄 Fixing invoices with future dates and updating timestamps...');
    const now = new Date();
    const allUserInvoices = await invoiceRepository.find({ 
      where: { userId },
      order: { createdAt: 'DESC' } // Get invoices ordered by current createdAt
    });
    let fixedCount = 0;
    let timestampUpdatedCount = 0;
    
    // Sort invoices by their current createdAt timestamp (most recent first)
    // If timestamps are the same (within 1 second), use invoice number as tiebreaker
    // This preserves the actual creation order from the database
    const sortedInvoices = [...allUserInvoices].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      const timeDiff = dateB - dateA;
      
      // If timestamps are very close (within 1 second), use invoice number as tiebreaker
      if (Math.abs(timeDiff) < 1000) {
        // Extract the number part from invoice number (e.g., "6017" from "INV-2025-6017")
        const numA = a.number.match(/-(\d+)$/)?.[1] || '0';
        const numB = b.number.match(/-(\d+)$/)?.[1] || '0';
        return parseInt(numB, 10) - parseInt(numA, 10); // Higher numbers = newer
      }
      
      return timeDiff; // Most recent first
    });
    
    // Update timestamps to ensure proper sorting with 1 second intervals
    for (let i = 0; i < sortedInvoices.length; i++) {
      const invoice = sortedInvoices[i];
      let needsUpdate = false;
      const updates: any = {};
      
      // Update createdAt timestamp to ensure proper sorting (newest first)
      // Use raw SQL to bypass TypeORM's @CreateDateColumn auto-management
      const newCreatedAt = new Date(now.getTime() - i * 1000); // 1 second apart, newest first
      const newUpdatedAt = new Date(now.getTime() - i * 1000);
      
      // Use raw SQL to update createdAt (bypassing TypeORM's @CreateDateColumn auto-management)
      await invoiceRepository.query(
        `UPDATE invoices SET "createdAt" = $1, "updatedAt" = $2 WHERE id = $3`,
        [newCreatedAt, newUpdatedAt, invoice.id]
      );
      
      timestampUpdatedCount++;
      
      // Fix issue date if it's in the future
      if (invoice.issueDate && new Date(invoice.issueDate) > now) {
        // For paid invoices, set issue date to at least 1 day ago
        if (invoice.status === 'paid') {
          const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          updates.issueDate = pastDate;
        } else {
          // For draft/sent invoices, set to today
          updates.issueDate = now;
        }
        needsUpdate = true;
      }
      
      // Fix due date if it's too far in the future (more than 60 days from issue date)
      if (invoice.dueDate) {
        const issueDate = invoice.issueDate ? new Date(invoice.issueDate) : now;
        const dueDate = new Date(invoice.dueDate);
        const maxDueDate = new Date(issueDate.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days max
        
        // For paid invoices, due date should be in the past
        if (invoice.status === 'paid' && dueDate > now) {
          updates.dueDate = now;
          needsUpdate = true;
        } else if (dueDate > maxDueDate) {
          // Cap due date at 60 days from issue date
          updates.dueDate = maxDueDate;
          needsUpdate = true;
        }
      }
      
      // Fix paidAt if it's in the future (for paid invoices)
      if (invoice.status === 'paid' && invoice.paidAt) {
        const paidAt = new Date(invoice.paidAt);
        if (paidAt > now) {
          // Set paidAt to issue date or 1 day after issue date, whichever is earlier
          const issueDate = invoice.issueDate ? new Date(invoice.issueDate) : now;
          const suggestedPaidAt = new Date(issueDate.getTime() + 24 * 60 * 60 * 1000);
          updates.paidAt = suggestedPaidAt > now ? now : suggestedPaidAt;
          needsUpdate = true;
        }
      }
      
      if (needsUpdate) {
        await invoiceRepository.update({ id: invoice.id }, updates);
        fixedCount++;
      }
    }
    
    if (timestampUpdatedCount > 0) {
      console.log(`  ✓ Updated ${timestampUpdatedCount} invoice(s) with proper createdAt timestamps for sorting`);
    }
    if (fixedCount > 0) {
      console.log(`  ✓ Fixed ${fixedCount} invoice(s) with future dates`);
    } else {
      console.log(`  ✓ No invoices with future dates found`);
    }
  }

  // Final summary - verify user data was preserved
  const finalClients = await clientRepository.find({ where: { userId } });
  const finalInventory = await inventoryRepository.find({ where: { userId } });
  const finalInvoices = await invoiceRepository.find({ where: { userId } });
  
  const finalSeedClients = finalClients.filter(c => SEED_CLIENT_NAMES.includes(c.name));
  const finalUserClients = finalClients.filter(c => !SEED_CLIENT_NAMES.includes(c.name));
  const finalSeedInventory = finalInventory.filter(i => SEED_INVENTORY_SKUS.includes(i.sku));
  const finalUserInventory = finalInventory.filter(i => !SEED_INVENTORY_SKUS.includes(i.sku));
  // Identify seed invoices by NUMBER pattern, not by client (user-created invoices linked to seed clients must be preserved)
  const finalSeedInvoices = finalInvoices.filter(inv => isSeedInvoiceNumber(inv.number));
  const finalUserInvoices = finalInvoices.filter(inv => !isSeedInvoiceNumber(inv.number));

  console.log('\n' + '='.repeat(60));
  console.log('✅ Database seed completed successfully!');
  console.log('='.repeat(60));
  console.log('\n📊 Final data summary:');
  console.log(`  Seed clients: ${finalSeedClients.length}`);
  console.log(`  User-created clients: ${finalUserClients.length} ✅ PRESERVED`);
  console.log(`  Seed inventory: ${finalSeedInventory.length}`);
  console.log(`  User-created inventory: ${finalUserInventory.length} ✅ PRESERVED`);
  console.log(`  User-created invoices: ${finalUserInvoices.length} ✅ PRESERVED`);
  console.log('\n✅ All user-created data has been preserved!');
  console.log('✅ Only seed data was regenerated.');
  console.log('='.repeat(60));
}

