import { z } from 'zod';

// Client schemas
export const clientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional(),
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  country: z.string().optional(),
  notes: z.string().optional(),
});

// Inventory schemas
export const inventoryItemSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  category: z.string().optional(),
  unit: z.string().min(1, 'Unit is required'),
  barcode: z.string().optional(),
  costPrice: z.number().min(0, 'Cost price must be positive').optional(),
  defaultUnitPrice: z.number().min(0, 'Default unit price is required'),
  defaultTaxRate: z.number().min(0).max(100, 'Tax rate must be between 0 and 100').optional(),
  currentStock: z.number().int().min(0, 'Stock cannot be negative'),
  reorderLevel: z.number().int().min(0, 'Reorder level is required'),
  maxStockLevel: z.number().int().min(0).optional(),
  status: z.enum(['active', 'inactive']),
});

// Invoice item schema
export const invoiceItemSchema = z.object({
  inventoryItemId: z.string().optional(),
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().min(0.01, 'Quantity must be greater than 0'),
  unitPrice: z.number().min(0, 'Unit price is required'),
  taxRate: z.number().min(0).max(100, 'Tax rate must be between 0 and 100'),
  discountRate: z.number().min(0).max(100, 'Discount rate must be between 0 and 100'),
});

// Invoice schema
export const invoiceSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  type: z.enum(['invoice', 'estimate']),
  issueDate: z.string().min(1, 'Issue date is required'),
  dueDate: z.string().optional(),
  currency: z.string().min(1, 'Currency is required'),
  notes: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, 'At least one item is required'),
});

// Recurring invoice schema
export const recurringInvoiceSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  name: z.string().min(1, 'Name is required'),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']),
  interval: z.number().int().min(1, 'Interval must be at least 1'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional(),
  nextRunDate: z.string().min(1, 'Next run date is required'),
  currency: z.string().min(1, 'Currency is required'),
  items: z.array(invoiceItemSchema).min(1, 'At least one item is required'),
  notes: z.string().optional(),
  isActive: z.boolean(),
});

// Stock movement schema
export const stockMovementSchema = z.object({
  quantity: z.number().int('Quantity must be an integer'),
  note: z.string().optional(),
});

