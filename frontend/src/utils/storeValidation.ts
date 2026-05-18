import { z } from 'zod';

export const storeSchema = z.object({
  clientId: z.string().uuid('Client is required'),
  name: z.string().min(1, 'Store name is required'),
  code: z.string().min(1, 'Store code is required').max(20, 'Store code must be 20 characters or less'),
  address: z.string().optional(),
  // Phone is collected as (code + local number) in the UI and combined to E.164 on submit
  phoneCode: z.string().optional(),
  phoneNumber: z.string().optional(),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  country: z.string().optional(),
  notes: z.string().optional(),
  active: z.boolean().optional(),
}).superRefine((val, ctx) => {
  const code = (val.phoneCode ?? '').trim();
  const rawNumber = (val.phoneNumber ?? '').trim();

  // Allow fully empty phone
  if (!code && !rawNumber) return;

  // If either is provided, require both
  if (!code) {
    ctx.addIssue({
      code: 'custom' as const,
      path: ['phoneCode'],
      message: 'Select a city/country code',
    });
  }
  if (!rawNumber) {
    ctx.addIssue({
      code: 'custom' as const,
      path: ['phoneNumber'],
      message: 'Phone number is required',
    });
  }

  // Strip formatting characters (parentheses, dashes, spaces) for validation
  const digitsOnly = rawNumber.replace(/\D/g, '');
  
  // Validate that we have at least some digits after stripping formatting
  if (rawNumber && digitsOnly.length === 0) {
    ctx.addIssue({
      code: 'custom' as const,
      path: ['phoneNumber'],
      message: 'Phone number must contain at least some digits',
    });
  }

  // Basic sanity range for local number; full E.164 max is enforced on backend
  if (digitsOnly && (digitsOnly.length < 6 || digitsOnly.length > 14)) {
    ctx.addIssue({
      code: 'custom' as const,
      path: ['phoneNumber'],
      message: 'Phone number length must be between 6 and 14 digits',
    });
  }

  if (code && !code.startsWith('+')) {
    ctx.addIssue({
      code: 'custom' as const,
      path: ['phoneCode'],
      message: 'Code must start with +',
    });
  }
});

export const storeItemSettingsSchema = z.object({
  storeId: z.string().uuid('Invalid store ID'),
  inventoryItemId: z.string().uuid('Invalid inventory item ID'),
  currentStock: z.number().int().min(0).optional(),
  minQty: z.number().int().min(0).optional(),
  targetQty: z.number().int().min(0).optional(),
  weeklyUsage: z.number().min(0).optional(),
});

