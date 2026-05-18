import { z } from 'zod';

// Client schemas
// Bug #93: Added string length validations
export const clientSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(255, 'Name must not exceed 255 characters'),
  // FIX #189: Email validation matching backend regex
  email: z.string()
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email address')
    .max(255, 'Email must not exceed 255 characters')
    .optional()
    .or(z.literal('')),
  phone: z.string()
    .max(50, 'Phone must not exceed 50 characters')
    .optional(),
  street: z.string()
    .max(500, 'Street address must not exceed 500 characters')
    .optional(),
  city: z.string()
    .max(100, 'City must not exceed 100 characters')
    .optional(),
  state: z.string()
    .max(100, 'State must not exceed 100 characters')
    .optional(),
  zip: z.string()
    .max(20, 'ZIP code must not exceed 20 characters')
    .optional(),
  country: z.string()
    .max(100, 'Country must not exceed 100 characters')
    .optional(),
  notes: z.string()
    .max(5000, 'Notes must not exceed 5000 characters')
    .optional(),
});

// Inventory schemas
// Helper to make number fields optional but validate if provided
// Handles NaN, null, undefined, and empty strings
const optionalPositiveNumber = z.preprocess(
  (val) => {
    if (val === '' || val === null || val === undefined || (typeof val === 'number' && isNaN(val))) {
      return undefined;
    }
    return val;
  },
  z.number().min(0, 'Value cannot be negative').optional()
);

const optionalPositiveInt = z.preprocess(
  (val) => {
    if (val === '' || val === null || val === undefined || (typeof val === 'number' && isNaN(val))) {
      return undefined;
    }
    return val;
  },
  z.number().int().min(0, 'Value cannot be negative').optional()
);

export const inventoryItemSchema = z.object({
  // Fix Bug #72: Add SKU format validation
  sku: z.string()
    .min(1, 'SKU is required')
    .max(100, 'SKU must not exceed 100 characters')
    .regex(/^[A-Za-z0-9_-]+$/, 'SKU can only contain letters, numbers, underscores, and hyphens'),
  // Bug #93: Added string length validations
  name: z.string()
    .min(1, 'Name is required')
    .max(255, 'Name must not exceed 255 characters'),
  description: z.string()
    .max(5000, 'Description must not exceed 5000 characters')
    .optional()
    .or(z.literal('')),
  category: z.string()
    .max(100, 'Category must not exceed 100 characters')
    .optional()
    .or(z.literal('')),
  unit: z.string()
    .min(1, 'Unit is required')
    .max(50, 'Unit must not exceed 50 characters'),
  // Fix Bug #73: Add barcode format validation
  barcode: z.string()
    .optional()
    .or(z.literal(''))
    .refine((val) => {
      if (!val || val === '') return true; // Optional field
      // Barcode should be alphanumeric, typically 8-13 digits for EAN/UPC, but allow flexible format
      return /^[A-Za-z0-9\-_]+$/.test(val) && val.length <= 100;
    }, 'Barcode can only contain letters, numbers, hyphens, and underscores (max 100 characters)'),
  // Required fields (with red stars) - these must be valid numbers
  costPrice: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined || (typeof val === 'number' && isNaN(val))) {
        return undefined;
      }
      return val;
    },
    z.number({ message: 'Cost price must be a number' })
      .min(0, 'Cost price is required')
  ),
  defaultUnitPrice: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined || (typeof val === 'number' && isNaN(val))) {
        return undefined;
      }
      return val;
    },
    z.number({ message: 'Default unit price must be a number' })
      .min(0, 'Default unit price is required')
  ),
  defaultTaxRate: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined || (typeof val === 'number' && isNaN(val))) {
        return undefined;
      }
      return val;
    },
    z.number({ message: 'Default tax rate must be a number' })
      .min(0, 'Tax rate cannot be negative')
      .max(100, 'Tax rate cannot exceed 100%')
  ),
  currentStock: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined || (typeof val === 'number' && isNaN(val))) {
        return undefined;
      }
      return val;
    },
    z.number({ message: 'Current stock must be a number' })
      .int('Current stock must be an integer')
      .min(0, 'Stock cannot be negative')
  ),
  reorderLevel: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined || (typeof val === 'number' && isNaN(val))) {
        return undefined;
      }
      return val;
    },
    z.number({ message: 'Reorder level must be a number' })
      .int('Reorder level must be an integer')
      .min(0, 'Reorder level is required')
  ),
  // Optional fields
  maxStockLevel: optionalPositiveInt,
  status: z.enum(['active', 'inactive']),
  // Size & Material
  sizeInches: z.string().optional().or(z.literal('')),
  material: z.string().optional().or(z.literal('')),
  // Bundle / Pack Information
  bundleSize: optionalPositiveInt,
  bundleUnit: z.string().optional().or(z.literal('')),
  // Space / Container Planning
  spacePerBundle: optionalPositiveNumber,
  bundlesPerContainer: optionalPositiveInt,
  targetBundles: optionalPositiveInt,
  // Print Type
  printType: z.string().optional().or(z.literal('')),
  // Flute Type
  fluteType: z.string().optional().or(z.literal('')),
  // Pack Size
  packSize: optionalPositiveInt,
  // Container Planning
  unitsPerContainer: optionalPositiveInt,
  containerType: z.string().optional().or(z.literal('')),
  // Planning Fields
  weeksSupplyTargetOverride: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined || (typeof val === 'number' && isNaN(val))) {
        return undefined;
      }
      return val;
    },
    z.number().int().min(1).max(52).optional().nullable()
  ),
  averageWeeklyUsage: optionalPositiveNumber,
});

// Invoice item schema
// FIX #186-200: Enhanced validation matching backend exactly
export const invoiceItemSchema = z.object({
  inventoryItemId: z.string().uuid('Invalid inventory item ID').optional(),
  // FIX #195: Description length validation (max 1000 chars)
  description: z.string()
    .min(1, 'Description is required')
    .max(1000, 'Description must not exceed 1000 characters'),
  // FIX #187: Quantity must be integer >= 1 (not just > 0)
  quantity: z.number()
    .int('Quantity must be an integer')
    .min(1, 'Quantity must be at least 1')
    .max(1000000, 'Quantity exceeds maximum allowed'),
  // FIX #194: Unit price with upper bound
  unitPrice: z.number()
    .min(0, 'Unit price cannot be negative')
    .max(999999999.99, 'Unit price exceeds maximum allowed'),
  // FIX #192: Tax rate validation (0-100, no negative)
  taxRate: z.number()
    .min(0, 'Tax rate cannot be negative')
    .max(100, 'Tax rate must be between 0 and 100'),
  // FIX #193: Discount rate validation (0-100)
  discountRate: z.number()
    .min(0, 'Discount rate cannot be negative')
    .max(100, 'Discount rate must be between 0 and 100'),
});

// Invoice schema
// FIX #186-200: Enhanced validation matching backend exactly
export const invoiceSchema = z.object({
  // FIX #190: UUID validation for client ID
  clientId: z.string().uuid('Invalid client ID').min(1, 'Client is required'),
  type: z.enum(['invoice']), // Only invoices, no estimates
  // FIX #188: Date validation (ISO format, UTC)
  issueDate: z.string()
    .min(1, 'Issue date is required')
    .refine((val) => !isNaN(Date.parse(val)), 'Invalid date format'),
  // FIX #188, #197: Due date validation with timezone handling
  dueDate: z.string()
    .optional()
    .refine((val) => {
      if (!val) return true;
      const date = new Date(val);
      return !isNaN(date.getTime());
    }, 'Invalid date format'),
  // FIX #191: Currency code validation (ISO 4217 format)
  currency: z.string()
    .length(3, 'Currency must be a 3-letter ISO code')
    .regex(/^[A-Z]{3}$/, 'Currency must be uppercase ISO 4217 code'),
  // FIX #199: Notes field length validation (max 10000 chars)
  notes: z.string()
    .max(10000, 'Notes must not exceed 10000 characters')
    .optional(),
  // FIX #198: Store ID validation (optional UUID)
  storeId: z.string().uuid('Invalid store ID').optional().nullable(),
  items: z.array(invoiceItemSchema).min(1, 'At least one item is required'),
}).refine((data) => {
  // FIX #197: Due date must be after issue date (timezone-aware)
  if (data.dueDate && data.issueDate) {
    const issue = new Date(data.issueDate);
    const due = new Date(data.dueDate);
    return due >= issue;
  }
  return true;
}, {
  message: 'Due date must be on or after issue date',
  path: ['dueDate'],
});

// Recurring invoices removed
// export const recurringInvoiceSchema = z.object({
//   clientId: z.string().min(1, 'Client is required'),
//   name: z.string().min(1, 'Name is required'),
//   frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']),
//   interval: z.number().int().min(1, 'Interval must be at least 1'),
//   startDate: z.string().min(1, 'Start date is required'),
//   endDate: z.string().optional(),
//   nextRunDate: z.string().min(1, 'Next run date is required'),
//   currency: z.string().min(1, 'Currency is required'),
//   items: z.array(invoiceItemSchema).min(1, 'At least one item is required'),
//   notes: z.string().optional(),
//   isActive: z.boolean(),
// });

// Stock movement schema
export const stockMovementSchema = z.object({
  quantity: z.number().int('Quantity must be an integer'),
  note: z.string().optional(),
});

// User schemas
export const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['owner', 'admin'], {
    message: 'Role is required',
  }),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  companyName: z.string().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  role: z.enum(['owner', 'admin']).optional(),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .optional()
    .or(z.literal(''))
    .transform((val) => (val === '' ? undefined : val)),
});

