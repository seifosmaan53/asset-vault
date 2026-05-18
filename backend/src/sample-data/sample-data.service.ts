// Copyright (c) 2025 Asset Vault. All rights reserved.

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Client } from '../clients/entities/client.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { InvoiceItem } from '../invoices/entities/invoice-item.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { UserOrganization } from '../organizations/entities/user-organization.entity';
import { Store } from '../inventory/entities/store.entity';
import { OrganizationsService } from '../organizations/organizations.service';

@Injectable()
export class SampleDataService {
  private readonly logger = new Logger(SampleDataService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Client)
    private clientRepository: Repository<Client>,
    @InjectRepository(InventoryItem)
    private inventoryRepository: Repository<InventoryItem>,
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private invoiceItemRepository: Repository<InvoiceItem>,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    @InjectRepository(UserOrganization)
    private userOrganizationRepository: Repository<UserOrganization>,
    @InjectRepository(Store)
    private storeRepository: Repository<Store>,
    private organizationsService: OrganizationsService,
  ) {}

  private generateClientData(): Array<{
    name: string;
    email: string;
    phone: string;
    addressJson: { street: string; city: string; state: string; zip: string; country: string };
    notes?: string;
    tags?: string[];
  }> {
    const companies = [
      'Acme', 'Tech', 'Global', 'Premier', 'Elite', 'Prime', 'Superior', 'Advanced', 'Innovative', 'Dynamic',
      'Progressive', 'Strategic', 'Enterprise', 'Corporate', 'Business', 'Commercial', 'Industrial', 'Professional',
      'National', 'International', 'Regional', 'Local', 'Metro', 'Urban', 'Suburban', 'Rural', 'Coastal', 'Mountain',
      'Valley', 'Plains', 'Riverside', 'Lakeside', 'Bay', 'Harbor', 'Port', 'Gateway', 'Crossroads', 'Summit',
      'Peak', 'Crest', 'Ridge', 'Horizon', 'Apex', 'Vertex', 'Zenith', 'Pinnacle', 'Summit', 'Crown'
    ];
    const types = ['Corp', 'Inc', 'LLC', 'Ltd', 'Co', 'Group', 'Solutions', 'Services', 'Systems', 'Industries'];
    const cities = [
      { city: 'New York', state: 'NY', zip: '10001' }, { city: 'Los Angeles', state: 'CA', zip: '90001' },
      { city: 'Chicago', state: 'IL', zip: '60601' }, { city: 'Houston', state: 'TX', zip: '77001' },
      { city: 'Phoenix', state: 'AZ', zip: '85001' }, { city: 'Philadelphia', state: 'PA', zip: '19101' },
      { city: 'San Antonio', state: 'TX', zip: '78201' }, { city: 'San Diego', state: 'CA', zip: '92101' },
      { city: 'Dallas', state: 'TX', zip: '75201' }, { city: 'San Jose', state: 'CA', zip: '95101' },
      { city: 'Austin', state: 'TX', zip: '78701' }, { city: 'Jacksonville', state: 'FL', zip: '32201' },
      { city: 'Fort Worth', state: 'TX', zip: '76101' }, { city: 'Columbus', state: 'OH', zip: '43201' },
      { city: 'Charlotte', state: 'NC', zip: '28201' }, { city: 'San Francisco', state: 'CA', zip: '94101' },
      { city: 'Indianapolis', state: 'IN', zip: '46201' }, { city: 'Seattle', state: 'WA', zip: '98101' },
      { city: 'Denver', state: 'CO', zip: '80201' }, { city: 'Washington', state: 'DC', zip: '20001' },
      { city: 'Boston', state: 'MA', zip: '02101' }, { city: 'El Paso', state: 'TX', zip: '79901' },
      { city: 'Nashville', state: 'TN', zip: '37201' }, { city: 'Detroit', state: 'MI', zip: '48201' },
      { city: 'Oklahoma City', state: 'OK', zip: '73101' }, { city: 'Portland', state: 'OR', zip: '97201' },
      { city: 'Las Vegas', state: 'NV', zip: '89101' }, { city: 'Memphis', state: 'TN', zip: '38101' },
      { city: 'Louisville', state: 'KY', zip: '40201' }, { city: 'Baltimore', state: 'MD', zip: '21201' },
      { city: 'Milwaukee', state: 'WI', zip: '53201' }, { city: 'Albuquerque', state: 'NM', zip: '87101' },
      { city: 'Tucson', state: 'AZ', zip: '85701' }, { city: 'Fresno', state: 'CA', zip: '93701' },
      { city: 'Sacramento', state: 'CA', zip: '95814' }, { city: 'Kansas City', state: 'MO', zip: '64101' },
      { city: 'Mesa', state: 'AZ', zip: '85201' }, { city: 'Atlanta', state: 'GA', zip: '30301' },
      { city: 'Omaha', state: 'NE', zip: '68101' }, { city: 'Colorado Springs', state: 'CO', zip: '80901' },
      { city: 'Raleigh', state: 'NC', zip: '27601' }, { city: 'Virginia Beach', state: 'VA', zip: '23451' },
      { city: 'Miami', state: 'FL', zip: '33101' }, { city: 'Oakland', state: 'CA', zip: '94601' },
      { city: 'Minneapolis', state: 'MN', zip: '55401' }, { city: 'Tulsa', state: 'OK', zip: '74101' },
      { city: 'Cleveland', state: 'OH', zip: '44101' }, { city: 'Wichita', state: 'KS', zip: '67201' },
      { city: 'Arlington', state: 'TX', zip: '76010' }, { city: 'New Orleans', state: 'LA', zip: '70112' }
    ];
    const streets = ['Main', 'Oak', 'Park', 'First', 'Second', 'Third', 'Maple', 'Elm', 'Cedar', 'Pine', 'Washington', 'Lincoln', 'Jefferson', 'Madison', 'Broadway', 'Market', 'Center', 'High', 'Church', 'School'];
    const notes = [
      'Regular customer, pays on time', 'Bulk orders, quarterly billing', 'New client, growing business',
      'VIP customer, priority service', 'Long-term partnership', 'Seasonal orders', 'High volume client',
      'Requires special handling', 'Fast payment terms', 'Monthly recurring orders', 'Annual contract',
      'Preferred customer', 'Established relationship', 'Growing account', 'Strategic partner'
    ];
    const tags = ['VIP', 'Regular', 'New', 'Bulk', 'Priority', 'Contract', 'Seasonal', 'High-Volume'];

    const clients: Array<{
      name: string;
      email: string;
      phone: string;
      addressJson: { street: string; city: string; state: string; zip: string; country: string };
      notes?: string;
      tags?: string[];
    }> = [];

    for (let i = 0; i < 50; i++) {
      const company = companies[i % companies.length];
      const type = types[i % types.length];
      const cityData = cities[i % cities.length];
      const streetName = streets[i % streets.length];
      const streetNum = Math.floor(Math.random() * 9999) + 1;
      const clientNum = String(i + 1).padStart(3, '0');
      
      clients.push({
        name: `${company} ${type} ${clientNum}`,
        email: `contact${clientNum}@${company.toLowerCase()}${type.toLowerCase()}.com`,
        phone: `+1-555-${String(Math.floor(Math.random() * 9000) + 1000)}`,
        addressJson: {
          street: `${streetNum} ${streetName} Street`,
          city: cityData.city,
          state: cityData.state,
          zip: cityData.zip,
          country: 'USA',
        },
        notes: notes[i % notes.length],
        tags: [tags[i % tags.length], tags[(i + 1) % tags.length]].filter((v, idx, arr) => arr.indexOf(v) === idx),
      });
    }

    return clients;
  }

  private generateStoreData(clients: Client[]): Array<{
    clientId: string;
    name: string;
    code: string;
    address: string;
    phone: string;
    email: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    notes?: string;
    active: boolean;
  }> {
    const storeTypes = ['Main', 'Downtown', 'Uptown', 'Westside', 'Eastside', 'North', 'South', 'Central', 'Express', 'Premium', 'Outlet', 'Warehouse', 'Distribution', 'Retail', 'Flagship'];
    const locations = ['Store', 'Location', 'Branch', 'Outlet', 'Center', 'Hub', 'Depot', 'Facility'];
    const stores: Array<{
      clientId: string;
      name: string;
      code: string;
      address: string;
      phone: string;
      email: string;
      city: string;
      state: string;
      zip: string;
      country: string;
      notes?: string;
      active: boolean;
    }> = [];

    // Always generate exactly 100 stores
    // Distribute them across available clients (2 stores per client, cycling through clients if needed)
    const totalStoresToCreate = 100;
    const clientsToUse = clients.length > 0 ? clients : [];
    
    // If no clients available, we can't create stores (this shouldn't happen, but handle gracefully)
    if (clientsToUse.length === 0) {
      return stores;
    }

    let storeCounter = 0;
    for (let i = 0; i < totalStoresToCreate; i++) {
      // Cycle through clients to distribute stores evenly
      const client = clientsToUse[i % clientsToUse.length];
      storeCounter++;
      
      const storeType = storeTypes[storeCounter % storeTypes.length];
      const location = locations[storeCounter % locations.length];
      const storeNum = String(storeCounter).padStart(3, '0');
      const code = `${storeType.substring(0, 3).toUpperCase()}-${storeNum}`;
      
      stores.push({
        clientId: client.id,
        name: `${storeType} ${location} ${storeNum}`,
        code: code,
        address: `${Math.floor(Math.random() * 9999) + 1} Commerce Blvd`,
        phone: `+1-555-${String(Math.floor(Math.random() * 9000) + 1000)}`,
        email: `store${storeNum}@${client.name.toLowerCase().replace(/\s+/g, '')}.com`,
        city: client.addressJson?.city || 'Unknown',
        state: client.addressJson?.state || 'NY',
        zip: client.addressJson?.zip || '10001',
        country: client.addressJson?.country || 'USA',
        notes: `Store location for ${client.name}`,
        active: true,
      });
    }

    return stores;
  }

  private generateInventoryData(): Array<Partial<InventoryItem>> {
    const categories = ['Widgets', 'Products', 'Components', 'Accessories', 'Tools', 'Materials', 'Supplies', 'Equipment', 'Parts', 'Services', 'Electronics', 'Hardware', 'Software', 'Furniture', 'Appliances'];
    const units = ['piece', 'box', 'pack', 'set', 'pair', 'dozen', 'case', 'pallet', 'roll', 'sheet', 'yard', 'foot', 'meter', 'gallon', 'liter', 'pound', 'kilogram', 'hour', 'day', 'month'];
    const materials = ['Steel', 'Aluminum', 'Plastic', 'Wood', 'Glass', 'Ceramic', 'Fabric', 'Leather', 'Rubber', 'Carbon Fiber', 'Titanium', 'Copper', 'Brass', 'Bronze', 'Silicon'];
    const shapes = ['rectangular', 'square', 'round', 'oval', 'cylindrical', 'custom', 'die-cut'];
    const printTypes = ['Roma', 'Milano', 'Vista', 'Rustica', 'Plain', 'Custom', 'Full Color', 'Spot Color'];
    const fluteTypes = ['A-Flute', 'B-Flute', 'C-Flute', 'E-Flute', 'F-Flute', 'BC-Flute', 'EB-Flute'];
    const containerTypes = ['box', 'pallet', 'crate', 'skid', 'carton', 'tote', 'bin'];
    const bundleUnits = ['piece', 'box', 'pack', 'set'];
    const statuses: ('active' | 'inactive')[] = ['active', 'active', 'active', 'active', 'active', 'inactive']; // Mostly active

    const items: Array<Partial<InventoryItem>> = [];

    for (let i = 0; i < 300; i++) {
      const itemNum = String(i + 1).padStart(4, '0');
      const category = categories[i % categories.length];
      const unit = units[i % units.length];
      const material = materials[i % materials.length];
      const shape = shapes[i % shapes.length];
      const printType = printTypes[i % printTypes.length];
      const fluteType = fluteTypes[i % fluteTypes.length];
      const containerType = containerTypes[i % containerTypes.length];
      const bundleUnit = bundleUnits[i % bundleUnits.length];
      const status = statuses[i % statuses.length];
      
      const costPrice = Math.round((Math.random() * 500 + 5) * 100) / 100;
      const defaultUnitPrice = Math.round(costPrice * (1.5 + Math.random() * 1.5) * 100) / 100;
      const defaultTaxRate = Math.round((Math.random() * 15 + 5) * 10) / 10;
      const currentStock = Math.floor(Math.random() * 1000 + 10);
      const reorderLevel = Math.floor(currentStock * 0.2);
      const maxStockLevel = Math.floor(currentStock * 1.5);
      const sizeInches = `${Math.floor(Math.random() * 20 + 5)}" x ${Math.floor(Math.random() * 20 + 5)}"`;
      const bundleSize = Math.floor(Math.random() * 50 + 5);
      const packSize = Math.floor(Math.random() * 100 + 10);
      const unitsPerContainer = Math.floor(Math.random() * 5000 + 100);
      const bundlesPerContainer = Math.floor(unitsPerContainer / bundleSize);
      const spacePerBundle = Math.round((Math.random() * 10 + 1) * 100) / 100;
      const targetBundles = Math.floor(bundlesPerContainer * 0.8);
      const weeksSupplyTargetOverride = Math.floor(Math.random() * 8 + 4);
      const averageWeeklyUsage = Math.round((currentStock / (weeksSupplyTargetOverride * 4)) * 100) / 100;
      const barcode = `1234567890${itemNum}`;

      items.push({
        sku: `ITEM-${itemNum}`,
        name: `${category} ${itemNum} - ${material} ${shape}`,
        description: `High-quality ${material.toLowerCase()} ${category.toLowerCase()} in ${shape} shape. Perfect for professional use. Features ${printType} print type and ${fluteType} construction.`,
        unit: unit,
        barcode: barcode,
        costPrice: costPrice,
        defaultUnitPrice: defaultUnitPrice,
        defaultTaxRate: defaultTaxRate,
        currentStock: currentStock,
        reorderLevel: reorderLevel,
        maxStockLevel: maxStockLevel,
        status: status,
        bundleSize: bundleSize,
        bundleUnit: bundleUnit,
        spacePerBundle: spacePerBundle,
        bundlesPerContainer: bundlesPerContainer,
        targetBundles: targetBundles,
        packSize: packSize,
        unitsPerContainer: unitsPerContainer,
        weeksSupplyTargetOverride: weeksSupplyTargetOverride,
        averageWeeklyUsage: averageWeeklyUsage,
      });
    }

    return items;
  }

  async addSampleData(userId: string): Promise<{ clients: number; stores: number; inventory: number; invoices: number }> {
    // Get user
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    this.logger.log(`Adding comprehensive sample data for user: ${user.email} (${userId})`);

    // Ensure user has organization
    await this.organizationsService.ensureUserHasOrganization(userId);

    const userOrgs = await this.userOrganizationRepository.find({
      where: { userId, isActive: true },
      relations: ['organization'],
    });

    if (userOrgs.length === 0) {
      throw new BadRequestException('User has no organization');
    }

    // Organizations removed - no organizationId needed
    // const organization = userOrgs[0].organization;
    // const organizationId = organization.id;

    // Generate and create clients
    this.logger.log('Generating 50 clients...');
    const clientData = this.generateClientData();
    const clientNames = clientData.map(d => d.name);
    const clientEmails = clientData.map(d => d.email).filter(Boolean);
    
    const existingClients = await this.clientRepository
      .createQueryBuilder('client')
      .where('client.userId = :userId', { userId }) // Organizations removed - filter by userId only
      .andWhere('client.deletedAt IS NULL')
      .andWhere('(client.name IN (:...names) OR client.email IN (:...emails))', { names: clientNames, emails: clientEmails })
      .getMany();

    const existingClientMap = new Map<string, Client>();
    existingClients.forEach(client => {
      if (client.name) existingClientMap.set(client.name.toLowerCase(), client);
      if (client.email) existingClientMap.set(client.email.toLowerCase(), client);
    });

    const clients: Client[] = [];
    for (const data of clientData) {
      const nameKey = data.name.toLowerCase();
      const emailKey = data.email?.toLowerCase();
      const existing = existingClientMap.get(nameKey) || (emailKey ? existingClientMap.get(emailKey) : undefined);

      if (existing) {
        clients.push(existing);
        continue;
      }

      const client = this.clientRepository.create({
        ...data,
        userId,
        // Organizations removed - no organizationId needed
      });
      clients.push(await this.clientRepository.save(client));
    }
    this.logger.log(`Created ${clients.length} clients (${clients.length - existingClients.length} new, ${existingClients.length} existing)`);

    // Generate and create stores
    this.logger.log('Generating 100 stores...');
    // Ensure we have enough clients for stores (need at least 50 clients for 100 stores)
    // If we have fewer clients, we'll still create 100 stores but distribute them across available clients
    const storeData = this.generateStoreData(clients);
    
    // Get ALL existing stores (including soft-deleted) to check for code conflicts
    const allExistingStores = await this.storeRepository
      .createQueryBuilder('store')
      .withDeleted() // Include soft-deleted stores
      .where('store.userId = :userId', { userId }) // Organizations removed - filter by userId only
      .getMany();

    const existingStoreCodeSet = new Set(
      allExistingStores.map(store => store.code?.toLowerCase()).filter(Boolean)
    );
    const activeStores = allExistingStores.filter(s => !s.deletedAt);

    const stores: Store[] = [];
    const usedCodesInBatch = new Set<string>(); // Track codes used in this batch
    let newStoresCount = 0;
    let reusedStoresCount = 0;
    
    for (const data of storeData) {
      let codeToUse = data.code;
      const codeLower = codeToUse.toLowerCase();
      
      // Check if code exists in database (including soft-deleted) OR in current batch
      if (existingStoreCodeSet.has(codeLower) || usedCodesInBatch.has(codeLower)) {
        // If it's an active store in database, reuse it (only if not already in batch)
        const existing = activeStores.find(s => s.code?.toLowerCase() === codeLower);
        if (existing && !usedCodesInBatch.has(codeLower)) {
          stores.push(existing);
          usedCodesInBatch.add(codeLower); // Mark as used
          reusedStoresCount++;
          continue;
        }
        
        // Generate a new unique code (either soft-deleted exists or duplicate in batch)
        let counter = 1;
        let uniqueCode = `${data.code}-${counter}`;
        while (existingStoreCodeSet.has(uniqueCode.toLowerCase()) || usedCodesInBatch.has(uniqueCode.toLowerCase())) {
          counter++;
          uniqueCode = `${data.code}-${counter}`;
        }
        codeToUse = uniqueCode;
      }
      
      // Final safety check - ensure code is truly unique
      const finalCodeLower = codeToUse.toLowerCase();
      if (usedCodesInBatch.has(finalCodeLower) || existingStoreCodeSet.has(finalCodeLower)) {
        // Generate a truly unique code with timestamp to avoid any conflicts
        const timestamp = Date.now().toString().slice(-6);
        codeToUse = `${codeToUse}-${timestamp}`;
      }
      
      // Mark this code as used in current batch
      const finalCode = codeToUse.toLowerCase();
      usedCodesInBatch.add(finalCode);
      existingStoreCodeSet.add(finalCode);
      
      const store = this.storeRepository.create({
        ...data,
        code: codeToUse, // Use the unique code
        userId,
        // Organizations removed - no organizationId needed
      });
      const savedStore = await this.storeRepository.save(store);
      stores.push(savedStore);
      newStoresCount++;
    }
    this.logger.log(`Created ${stores.length} stores (${newStoresCount} new, ${reusedStoresCount} existing)`);

    // Generate and create inventory items
    this.logger.log('Generating 300 inventory items...');
    const inventoryData = this.generateInventoryData();
    const existingSkus = inventoryData.map(d => d.sku!);
    
    const existingItems = await this.inventoryRepository
      .createQueryBuilder('item')
      .where('item.userId = :userId', { userId }) // Organizations removed - filter by userId only
      .andWhere('item.sku IN (:...skus)', { skus: existingSkus })
      .getMany();
    
    const existingSkuSet = new Set(existingItems.map(item => item.sku));

    const inventoryItems: InventoryItem[] = [];
    let newInventoryCount = 0;
    let reusedInventoryCount = 0;
    
    for (const data of inventoryData) {
      if (existingSkuSet.has(data.sku!)) {
        const existing = existingItems.find(item => item.sku === data.sku);
        if (existing) {
          inventoryItems.push(existing);
          reusedInventoryCount++;
        }
        continue;
      }

      const item = this.inventoryRepository.create({
        sku: data.sku!,
        name: data.name!,
        description: data.description,
        unit: data.unit!,
        barcode: data.barcode,
        costPrice: data.costPrice,
        defaultUnitPrice: data.defaultUnitPrice!,
        defaultTaxRate: data.defaultTaxRate,
        currentStock: data.currentStock!,
        reorderLevel: data.reorderLevel!,
        maxStockLevel: data.maxStockLevel,
        status: data.status!,
        bundleSize: data.bundleSize,
        bundleUnit: data.bundleUnit,
        spacePerBundle: data.spacePerBundle,
        bundlesPerContainer: data.bundlesPerContainer,
        targetBundles: data.targetBundles,
        packSize: data.packSize,
        unitsPerContainer: data.unitsPerContainer,
        weeksSupplyTargetOverride: data.weeksSupplyTargetOverride,
        averageWeeklyUsage: data.averageWeeklyUsage,
        userId,
        // Organizations removed - no organizationId needed
      });
      const savedItem = await this.inventoryRepository.save(item);
      inventoryItems.push(savedItem);
      newInventoryCount++;
    }
    this.logger.log(`Created ${inventoryItems.length} inventory items (${newInventoryCount} new, ${reusedInventoryCount} existing)`);

    // Create sample invoices
    this.logger.log('Creating sample invoices...');
    const now = new Date();
    const invoices: Invoice[] = [];

    const existingInvoiceCount = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .where('invoice.type = :type', { type: 'invoice' })
      .andWhere('invoice.deletedAt IS NULL')
      .andWhere(
        'invoice.userId = :userId', // Organizations removed - filter by userId only
        { userId },
      )
      .getCount();

    const startNumber = existingInvoiceCount + 1;
    const year = now.getFullYear();

    // Create 200 invoices distributed across stores to ensure all stores have revenue
    // Spread invoices across the last 6 months to ensure they show up in dashboard
    const invoicesToCreate = 200;
    for (let i = 0; i < invoicesToCreate; i++) {
      // Distribute clients and stores evenly so each gets multiple invoices
      const client = clients[i % clients.length];
      const store = stores[i % stores.length];
      const statuses: Array<'draft' | 'sent' | 'paid' | 'overdue'> = ['draft', 'sent', 'paid', 'overdue'];
      const status = statuses[i % statuses.length];
      
      // Spread invoices across last 6 months (0 to 180 days ago)
      // This ensures they appear in dashboard date range filters
      const daysAgo = Math.floor((i / invoicesToCreate) * 180); // Distribute evenly across 6 months
      const issueDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      const dueDate = new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      const numItems = Math.floor(Math.random() * 5) + 1;
      let subtotal = 0;
      let taxTotal = 0;
      
      const invoice = this.invoiceRepository.create({
        userId,
        // Organizations removed - no organizationId needed
        clientId: client.id,
        storeId: store.id,
        type: 'invoice',
        number: `INV-${year}-${String(startNumber + i).padStart(4, '0')}`,
        status: status,
        issueDate: issueDate,
        dueDate: dueDate,
        paidAt: status === 'paid' ? new Date(issueDate.getTime() + Math.floor(Math.random() * 20) * 24 * 60 * 60 * 1000) : undefined,
        currency: 'USD',
        subtotal: 0, // Will calculate
        taxTotal: 0, // Will calculate
        discountTotal: 0,
        total: 0, // Will calculate
      });
      
      const savedInvoice = await this.invoiceRepository.save(invoice);
      
      // Create invoice items
      for (let j = 0; j < numItems; j++) {
        const item = inventoryItems[(i * numItems + j) % inventoryItems.length];
        const quantity = Math.floor(Math.random() * 10) + 1;
        const unitPrice = Number(item.defaultUnitPrice);
        const taxRate = Number(item.defaultTaxRate);
        const lineSubtotal = quantity * unitPrice;
        const lineTax = lineSubtotal * (taxRate / 100);
        const lineTotal = lineSubtotal + lineTax;
        
        subtotal += lineSubtotal;
        taxTotal += lineTax;
        
        await this.invoiceItemRepository.save(
          this.invoiceItemRepository.create({
            invoiceId: savedInvoice.id,
            inventoryItemId: item.id,
            description: item.name,
            quantity: quantity,
            unitPrice: unitPrice,
            taxRate: taxRate,
            discountRate: 0,
            lineTotal: Math.round(lineTotal * 100) / 100, // Calculate and round line total
          }),
        );
      }
      
      // Update invoice totals
      savedInvoice.subtotal = Math.round(subtotal * 100) / 100;
      savedInvoice.taxTotal = Math.round(taxTotal * 100) / 100;
      savedInvoice.total = Math.round((subtotal + taxTotal) * 100) / 100;
      await this.invoiceRepository.save(savedInvoice);
      
      invoices.push(savedInvoice);
    }

    this.logger.log(`Created ${invoices.length} invoices with items`);

    const result = {
      clients: clients.length,
      stores: stores?.length || 0,
      inventory: inventoryItems.length,
      invoices: invoices.length,
    };

    this.logger.log(`Sample data summary: ${result.clients} clients, ${result.stores} stores, ${result.inventory} inventory items, ${result.invoices} invoices`);

    return result;
  }

  async deleteSampleData(userId: string): Promise<{ deleted: { clients: number; stores: number; inventory: number; invoices: number } }> {
    // Get user
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    this.logger.log(`Deleting sample data for user: ${user.email} (${userId})`);

    // Get organization
    const userOrgs = await this.userOrganizationRepository.find({
      where: { userId, isActive: true },
      relations: ['organization'],
    });

    if (userOrgs.length === 0) {
      throw new BadRequestException('User has no organization');
    }

    // Organizations removed - no organizationId needed
    // const organization = userOrgs[0].organization;
    // const organizationId = organization.id;

    // Identify sample data by patterns
    // Sample clients: Names matching pattern "XXX Corp/Inc/LLC ###" or "XXX ###"
    // Sample stores: Codes matching pattern "XXX-###"
    // Sample inventory: SKUs matching pattern "ITEM-####"
    // Sample invoices: We'll delete all invoices for this user (since they're all sample)

    // Get all user data - include soft-deleted invoices too
    const allInvoices = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .withDeleted() // Include soft-deleted invoices
      .where(
        'invoice.userId = :userId', // Organizations removed - filter by userId only
        { userId },
      )
      .getMany();

    const allClients = await this.clientRepository
      .createQueryBuilder('client')
      .where(
        'client.userId = :userId', // Organizations removed - filter by userId only
        { userId },
      )
      .andWhere('client.deletedAt IS NULL')
      .getMany();

    const allStores = await this.storeRepository
      .createQueryBuilder('store')
      .where(
        'store.userId = :userId', // Organizations removed - filter by userId only
        { userId },
      )
      .andWhere('store.deletedAt IS NULL')
      .getMany();

    const allInventory = await this.inventoryRepository
      .createQueryBuilder('item')
      .where(
        'item.userId = :userId', // Organizations removed - filter by userId only
        { userId },
      )
      .getMany();

    // Identify sample data by patterns
    // This includes:
    // 1. Sample data from addSampleData (ITEM-####, "Company Type 001")
    // 2. Seed data from seed.ts (PROD-###, SERV-###, seed client names)
    // 3. Variations that might exist (SRV-###, WID-###, PRD-###)
    
    // Get the exact companies and types used in generation
    const sampleCompanies = [
      'Acme', 'Tech', 'Global', 'Premier', 'Elite', 'Prime', 'Superior', 'Advanced', 'Innovative', 'Dynamic',
      'Progressive', 'Strategic', 'Enterprise', 'Corporate', 'Business', 'Commercial', 'Industrial', 'Professional',
      'National', 'International', 'Regional', 'Local', 'Metro', 'Urban', 'Suburban', 'Rural', 'Coastal', 'Mountain',
      'Valley', 'Plains', 'Riverside', 'Lakeside', 'Bay', 'Harbor', 'Port', 'Gateway', 'Crossroads', 'Summit',
      'Peak', 'Crest', 'Ridge', 'Horizon', 'Apex', 'Vertex', 'Zenith', 'Pinnacle', 'Summit', 'Crown'
    ];
    const sampleTypes = ['Corp', 'Inc', 'LLC', 'Ltd', 'Co', 'Group', 'Solutions', 'Services', 'Systems', 'Industries'];
    
    // More flexible pattern - match any combination of sample company + type + 3 digits
    // Escape special regex characters in company/type names
    const escapedCompanies = sampleCompanies.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const escapedTypes = sampleTypes.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const sampleClientPattern = new RegExp(
      `^(${escapedCompanies.join('|')})\\s+(${escapedTypes.join('|')})\\s+\\d{3}$`,
      'i'
    );
    
    // Store codes: first 3 letters of store type + dash + 3 digits
    // Also match variations with suffixes like -1, -2, etc. (for duplicate handling)
    // Pattern matches: MAI-001, MAI-001-1, MAI-001-123456, etc.
    const sampleStorePattern = /^(MAI|DOW|UPT|WES|EAS|NOR|SOU|CEN|EXP|PRE|OUT|WAR|DIS|RET|FLA|HUB|DEP|FAC|LOC|BRA)-\d{3}(-\d+)?$/i;
    
    // Inventory SKUs: Match multiple patterns
    // - ITEM-#### (sample data) - exact match for 4 digits
    // - PROD-###, SERV-### (seed data) - 3 digits
    // - SRV-###, WID-###, PRD-### (variations) - 3 digits
    // Note: ITEM-#### is the primary pattern for sample data (300 items with ITEM-0001 to ITEM-0300)
    const sampleInventoryPattern = /^(ITEM-\d{4}|PROD-\d{3}|SERV-\d{3}|SRV-\d{3}|WID-\d{3}|PRD-\d{3})$/i;

    // Filter sample data - also check email pattern for clients
    // Sample client emails: contact001@acmecorp.com, contact002@techinc.com, etc.
    const sampleClientEmailPattern = /^contact\d{3}@[a-z]+(corp|inc|llc|ltd|co|group|solutions|services|systems|industries)\.com$/i;
    
    // Seed data client names (from seed.ts)
    const seedClientNames = [
      'Acme Corporation', 'Tech Solutions Ltd', 'Global Enterprises', 'Small Business Co',
      'Premium Services', 'Startup Ventures', 'Enterprise Solutions',
      // Variations that might exist
      'Local Business Co', 'Global Services LLC', 'Tech Solutions Inc', 'ABC Corporation'
    ];
    const seedClientPattern = new RegExp(`^(${seedClientNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`, 'i');
    
    const sampleClients = allClients.filter(c => {
      // Check sample data pattern (Company Type 001)
      const nameMatches = sampleClientPattern.test(c.name || '');
      // Check seed data pattern
      const seedMatches = seedClientPattern.test(c.name || '');
      // Check email pattern
      const emailMatches = c.email ? sampleClientEmailPattern.test(c.email) : false;
      const matches = nameMatches || seedMatches || emailMatches;
      
      if (!matches && c.name) {
        // Log non-matching clients for debugging - use log instead of debug to see in production
        this.logger.log(`Client "${c.name}" (email: ${c.email}) does not match sample pattern`);
      }
      return matches;
    });
    
    const sampleStores = allStores.filter(s => {
      if (!s.code) return false;
      const matches = sampleStorePattern.test(s.code);
      if (!matches) {
        this.logger.debug(`Store "${s.code}" does not match sample pattern`);
      }
      return matches;
    });
    
    const sampleInventory = allInventory.filter(i => {
      if (!i.sku) return false;
      // Check SKU pattern - must match exactly ITEM-#### (primary pattern for sample data)
      const skuMatches = sampleInventoryPattern.test(i.sku);
      // Also check if name matches sample pattern (category + number + material + shape)
      // Pattern: "Category 0001 - Material Shape"
      const nameMatches = i.name ? /^(Widgets|Products|Components|Accessories|Tools|Materials|Supplies|Equipment|Parts|Services|Electronics|Hardware|Software|Furniture|Appliances)\s+\d{1,4}\s*-\s*(Steel|Aluminum|Plastic|Wood|Glass|Ceramic|Fabric|Leather|Rubber|Carbon Fiber|Titanium|Copper|Brass|Bronze|Silicon)\s+(rectangular|square|round|oval|cylindrical|custom|die-cut)/i.test(i.name) : false;
      const matches = skuMatches || nameMatches;
      
      if (!matches) {
        // Log non-matching inventory for debugging
        this.logger.debug(`Inventory "${i.sku}" (name: ${i.name}) does not match sample pattern`);
      }
      return matches;
    });

    this.logger.log(`Found ${sampleClients.length} sample clients out of ${allClients.length} total`);
    this.logger.log(`Found ${sampleStores.length} sample stores out of ${allStores.length} total`);
    this.logger.log(`Found ${sampleInventory.length} sample inventory items out of ${allInventory.length} total`);

    // Delete in correct order (respecting foreign keys)
    let deletedInvoices = 0;
    let deletedClients = 0;
    let deletedStores = 0;
    let deletedInventory = 0;

    // 1. Delete invoice items and invoices FIRST (before clients, stores, inventory)
    // Delete ALL invoices that reference ANY sample data (clients, stores, or inventory items)
    const sampleClientIds = sampleClients.map(c => c.id);
    const sampleStoreIds = sampleStores.map(s => s.id);
    const sampleInventoryIds = sampleInventory.map(i => i.id);
    
    // Get all invoices (including soft-deleted) that reference sample clients OR sample stores
    const invoicesToDeleteByClient = sampleClientIds.length > 0 ? await this.invoiceRepository
      .createQueryBuilder('invoice')
      .withDeleted() // Include soft-deleted invoices
      .where(
        'invoice.userId = :userId', // Organizations removed - filter by userId only
        { userId },
      )
      .andWhere('invoice.clientId IN (:...clientIds)', { clientIds: sampleClientIds })
      .getMany() : [];
    
    const invoicesToDeleteByStore = sampleStoreIds.length > 0 ? await this.invoiceRepository
      .createQueryBuilder('invoice')
      .withDeleted() // Include soft-deleted invoices
      .where(
        'invoice.userId = :userId', // Organizations removed - filter by userId only
        { userId },
      )
      .andWhere('invoice.storeId IN (:...storeIds)', { storeIds: sampleStoreIds })
      .getMany() : [];
    
    // Get invoices that reference sample inventory items via invoice items
    const invoicesToDeleteByInventory = sampleInventoryIds.length > 0 ? await this.invoiceRepository
      .createQueryBuilder('invoice')
      .innerJoin('invoice_items', 'item', 'item.invoiceId = invoice.id')
      .withDeleted() // Include soft-deleted invoices
      .where(
        'invoice.userId = :userId', // Organizations removed - filter by userId only
        { userId },
      )
      .andWhere('item.inventoryItemId IN (:...inventoryIds)', { inventoryIds: sampleInventoryIds })
      .getMany() : [];
    
    // Combine all invoices to delete (remove duplicates)
    const allInvoicesToDelete = [
      ...invoicesToDeleteByClient,
      ...invoicesToDeleteByStore,
      ...invoicesToDeleteByInventory,
    ];
    
    // Remove duplicates by ID
    const uniqueInvoiceMap = new Map<string, Invoice>();
    allInvoicesToDelete.forEach(inv => {
      uniqueInvoiceMap.set(inv.id, inv);
    });
    const invoicesToDelete = Array.from(uniqueInvoiceMap.values());
    
    if (invoicesToDelete.length > 0) {
      const invoiceIds = invoicesToDelete.map(inv => inv.id);
      
      // Delete invoice items first
      await this.invoiceItemRepository
        .createQueryBuilder()
        .delete()
        .where('invoiceId IN (:...ids)', { ids: invoiceIds })
        .execute();
      
      // Hard delete invoices using raw DELETE to bypass soft delete
      // This must happen before deleting clients/stores/inventory due to foreign key constraints
      await this.invoiceRepository
        .createQueryBuilder()
        .delete()
        .where('id IN (:...ids)', { ids: invoiceIds })
        .execute();
      
      deletedInvoices = invoicesToDelete.length;
      this.logger.log(`Deleted ${deletedInvoices} invoices (hard delete, including soft-deleted). Breakdown: ${invoicesToDeleteByClient.length} by client, ${invoicesToDeleteByStore.length} by store, ${invoicesToDeleteByInventory.length} by inventory`);
    }

    // 2. Delete stores (they reference clients, but invoices are already deleted)
    // First, collect all stores to delete (sample stores + stores linked to sample clients)
    const allStoresToDelete = new Map<string, Store>();
    
    // Add sample stores
    sampleStores.forEach(store => {
      allStoresToDelete.set(store.id, store);
    });
    
    // Add stores linked to sample clients (if not already included)
    if (sampleClients.length > 0) {
      const clientIds = sampleClients.map(c => c.id);
      const storesLinkedToClients = await this.storeRepository
        .createQueryBuilder('store')
        .where('store.clientId IN (:...clientIds)', { clientIds })
        .andWhere('store.deletedAt IS NULL')
        .getMany();
      
      storesLinkedToClients.forEach(store => {
        if (!allStoresToDelete.has(store.id)) {
          allStoresToDelete.set(store.id, store);
        }
      });
    }
    
    // Hard delete all stores (permanent deletion for sample data)
    if (allStoresToDelete.size > 0) {
      const storesArray = Array.from(allStoresToDelete.values());
      await this.storeRepository.remove(storesArray);
      deletedStores = storesArray.length;
      this.logger.log(`Deleted ${deletedStores} stores (hard delete)`);
    }

    // 3. Delete inventory items (invoices are already deleted, so safe to delete)
    if (sampleInventory.length > 0) {
      await this.inventoryRepository.remove(sampleInventory);
      deletedInventory = sampleInventory.length;
      this.logger.log(`Deleted ${deletedInventory} inventory items (hard delete)`);
    }

    // 4. Delete clients (last, as they're referenced by stores and invoices, but those are already deleted)
    if (sampleClients.length > 0) {
      // Hard delete clients (permanent deletion for sample data)
      await this.clientRepository.remove(sampleClients);
      deletedClients = sampleClients.length;
      this.logger.log(`Deleted ${deletedClients} clients (hard delete)`);
    }
    
    // Log what wasn't deleted for debugging
    const remainingClients = allClients.length - deletedClients;
    const remainingInventory = allInventory.length - deletedInventory;
    if (remainingClients > 0 || remainingInventory > 0) {
      this.logger.warn(`Warning: ${remainingClients} clients and ${remainingInventory} inventory items were not deleted (may not be sample data)`);
      
      // Log the actual names/SKUs that weren't deleted to help debug
      if (remainingClients > 0) {
        const notDeletedClients = allClients.filter(c => !sampleClients.includes(c));
        const clientNames = notDeletedClients.map(c => `"${c.name}" (${c.email || 'no email'})`).join(', ');
        this.logger.warn(`Clients not deleted (first 10): ${clientNames.substring(0, 500)}`);
      }
      if (remainingInventory > 0) {
        const notDeletedInventory = allInventory.filter(i => !sampleInventory.includes(i));
        const inventoryList = notDeletedInventory.slice(0, 10).map(i => `"${i.sku}" (${i.name?.substring(0, 30) || 'no name'})`).join(', ');
        this.logger.warn(`Inventory not deleted (first 10): ${inventoryList}`);
      }
    }

    return {
      deleted: {
        clients: deletedClients,
        stores: deletedStores,
        inventory: deletedInventory,
        invoices: deletedInvoices,
      },
    };
  }
}
