import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../users/entities/user.entity';
import { Client } from '../clients/entities/client.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { InvoiceItem } from '../invoices/entities/invoice-item.entity';
import { StockMovement } from '../inventory/entities/stock-movement.entity';

export async function seedDatabase(dataSource: DataSource) {
  const userRepository = dataSource.getRepository(User);
  const clientRepository = dataSource.getRepository(Client);
  const inventoryRepository = dataSource.getRepository(InventoryItem);
  const invoiceRepository = dataSource.getRepository(Invoice);
  const invoiceItemRepository = dataSource.getRepository(InvoiceItem);
  const stockMovementRepository = dataSource.getRepository(StockMovement);

  console.log('Starting database seed...');

  // Check if demo user already exists
  let demoUser = await userRepository.findOne({ where: { email: 'demo@example.com' } });
  
  if (!demoUser) {
    // Create demo user
    const hashedPassword = await bcrypt.hash('password123', 10);
    demoUser = userRepository.create({
      email: 'demo@example.com',
      password: hashedPassword,
      name: 'Demo User',
      companyName: 'Demo Company Inc.',
    });
    demoUser = await userRepository.save(demoUser);
    console.log('Created demo user: demo@example.com / password123');
  } else {
    console.log('Demo user already exists, skipping user creation');
    // Clear existing data for this user
    await invoiceItemRepository.delete({ invoice: { userId: demoUser.id } as any });
    await invoiceRepository.delete({ userId: demoUser.id });
    await stockMovementRepository.delete({ userId: demoUser.id });
    await inventoryRepository.delete({ userId: demoUser.id });
    await clientRepository.delete({ userId: demoUser.id });
    console.log('Cleared existing demo data');
  }

  const userId = demoUser.id;

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

  const clients = [];
  for (const data of clientData) {
    const client = clientRepository.create({
      ...data,
      userId,
    });
    clients.push(await clientRepository.save(client));
  }
  console.log(`Created ${clients.length} demo clients`);

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
      reservedStock: 10,
      reorderLevel: 20,
      maxStockLevel: 200,
      status: 'active' as const,
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
      currentStock: 5, // Low stock
      reservedStock: 2,
      reorderLevel: 10,
      status: 'active' as const,
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
      currentStock: 0, // Out of stock
      reservedStock: 0,
      reorderLevel: 5,
      status: 'active' as const,
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
      reservedStock: 0,
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
      reservedStock: 5,
      reorderLevel: 50,
      status: 'active' as const,
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
      reservedStock: 15,
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
      currentStock: 8, // Low stock
      reservedStock: 1,
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
      reservedStock: 5,
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
      reservedStock: 8,
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
      reservedStock: 3,
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
      currentStock: 3, // Very low stock
      reservedStock: 0,
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
      reservedStock: 5,
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
      currentStock: 15,
      reservedStock: 2,
      reorderLevel: 10,
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
      reservedStock: 0,
      reorderLevel: 0,
      status: 'inactive' as const,
    },
  ];

  const inventoryItems = [];
  for (const data of inventoryData) {
    const item = inventoryRepository.create({
      ...data,
      userId,
    });
    inventoryItems.push(await inventoryRepository.save(item));
  }
  console.log(`Created ${inventoryItems.length} inventory items`);

  // Create some stock movements
  for (let i = 0; i < 5; i++) {
    const item = inventoryItems[i];
    if (item) {
      const movement = stockMovementRepository.create({
        inventoryItemId: item.id,
        userId,
        type: 'purchase',
        quantity: 50,
        sourceType: 'manual',
        note: 'Initial stock purchase',
      });
      await stockMovementRepository.save(movement);
    }
  }

  // Create invoices with various statuses
  const now = new Date();
  const invoices = [];

  // Draft invoices
  for (let i = 0; i < 3; i++) {
    const invoice = invoiceRepository.create({
      userId,
      clientId: clients[i % clients.length].id,
      type: 'invoice',
      number: `INV-${now.getFullYear()}-${String(i + 1).padStart(4, '0')}`,
      status: 'draft',
      issueDate: new Date(now.getTime() - i * 2 * 24 * 60 * 60 * 1000),
      dueDate: new Date(now.getTime() + (30 - i * 2) * 24 * 60 * 60 * 1000),
      currency: 'USD',
      subtotal: 0,
      taxTotal: 0,
      discountTotal: 0,
      total: 0,
    });
    invoices.push(await invoiceRepository.save(invoice));
  }

  // Sent invoices
  for (let i = 0; i < 5; i++) {
    const invoice = invoiceRepository.create({
      userId,
      clientId: clients[i % clients.length].id,
      type: 'invoice',
      number: `INV-${now.getFullYear()}-${String(i + 4).padStart(4, '0')}`,
      status: 'sent',
      issueDate: new Date(now.getTime() - (i + 5) * 24 * 60 * 60 * 1000),
      dueDate: new Date(now.getTime() - (i + 5 - 30) * 24 * 60 * 60 * 1000),
      currency: 'USD',
      subtotal: 0,
      taxTotal: 0,
      discountTotal: 0,
      total: 0,
    });
    invoices.push(await invoiceRepository.save(invoice));
  }

  // Paid invoices
  for (let i = 0; i < 8; i++) {
    const invoice = invoiceRepository.create({
      userId,
      clientId: clients[i % clients.length].id,
      type: 'invoice',
      number: `INV-${now.getFullYear()}-${String(i + 9).padStart(4, '0')}`,
      status: 'paid',
      issueDate: new Date(now.getTime() - (i + 20) * 24 * 60 * 60 * 1000),
      dueDate: new Date(now.getTime() - (i + 20 - 30) * 24 * 60 * 60 * 1000),
      paidAt: new Date(now.getTime() - (i + 15) * 24 * 60 * 60 * 1000),
      currency: 'USD',
      subtotal: 0,
      taxTotal: 0,
      discountTotal: 0,
      total: 0,
    });
    invoices.push(await invoiceRepository.save(invoice));
  }

  // Overdue invoices
  for (let i = 0; i < 3; i++) {
    const invoice = invoiceRepository.create({
      userId,
      clientId: clients[i % clients.length].id,
      type: 'invoice',
      number: `INV-${now.getFullYear()}-${String(i + 17).padStart(4, '0')}`,
      status: 'overdue',
      issueDate: new Date(now.getTime() - (i + 45) * 24 * 60 * 60 * 1000),
      dueDate: new Date(now.getTime() - (i + 15) * 24 * 60 * 60 * 1000),
      currency: 'USD',
      subtotal: 0,
      taxTotal: 0,
      discountTotal: 0,
      total: 0,
    });
    invoices.push(await invoiceRepository.save(invoice));
  }

  // Estimates
  for (let i = 0; i < 4; i++) {
    const invoice = invoiceRepository.create({
      userId,
      clientId: clients[i % clients.length].id,
      type: 'estimate',
      number: `EST-${now.getFullYear()}-${String(i + 1).padStart(4, '0')}`,
      status: 'draft',
      issueDate: new Date(now.getTime() - i * 3 * 24 * 60 * 60 * 1000),
      currency: 'USD',
      subtotal: 0,
      taxTotal: 0,
      discountTotal: 0,
      total: 0,
    });
    invoices.push(await invoiceRepository.save(invoice));
  }

  // Create invoice items and calculate totals
  for (const invoice of invoices) {
    const itemCount = Math.floor(Math.random() * 3) + 1; // 1-3 items per invoice
    const invoiceItems = [];
    let subtotal = 0;
    let taxTotal = 0;
    let discountTotal = 0;

    for (let j = 0; j < itemCount; j++) {
      const inventoryItem = inventoryItems[Math.floor(Math.random() * inventoryItems.length)];
      const quantity = Math.floor(Math.random() * 5) + 1;
      const unitPrice = inventoryItem.defaultUnitPrice;
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
      invoiceItems.push(await invoiceItemRepository.save(invoiceItem));

      // Create stock movement for sale (only for non-draft invoices)
      if (invoice.type === 'invoice' && invoice.status !== 'draft') {
        const movement = stockMovementRepository.create({
          inventoryItemId: inventoryItem.id,
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
  console.log('Database seed completed successfully!');
}

