import { z } from 'zod';

// Helper function to validate invoice number format
const isValidInvoiceNumberFormat = (format: string | undefined | null): boolean => {
  // Optional field - undefined, null, or empty string is valid
  if (!format || format === '' || (typeof format === 'string' && format.trim() === '')) return true;
  
  // Ensure we have a string to work with
  const trimmedFormat = typeof format === 'string' ? format.trim() : String(format).trim();
  if (trimmedFormat === '') return true; // Empty after trim is valid
  
  // Check for valid placeholders (case-sensitive)
  const placeholders = ['{YYYY}', '{YY}', '{MM}', '{DD}', '{NUM}', '{####}'];
  const hasPlaceholder = placeholders.some(placeholder => trimmedFormat.includes(placeholder));
  if (!hasPlaceholder) {
    return false; // Must have at least one placeholder
  }
  
  // Check length
  if (trimmedFormat.length > 100) return false;
  
  // Check for valid characters (alphanumeric, spaces, dashes, underscores, hash for {####}, and curly braces for placeholders)
  const validPattern = /^[A-Za-z0-9\s\-_{}#]+$/;
  if (!validPattern.test(trimmedFormat)) return false;
  
  return true;
};

// Helper function to validate date format
const isValidDateFormat = (format: string): boolean => {
  if (!format || format === '' || format.trim() === '') return true; // Optional field
  const validFormats = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'DD-MM-YYYY', 'MMM DD, YYYY'];
  return validFormats.includes(format);
};

// Helper function to validate timezone
const isValidTimeZone = (timezone: string): boolean => {
  if (!timezone || timezone === '' || timezone.trim() === '') return true; // Optional field
  // Fix Issue #13: Expanded timezone list to match backend (100+ timezones)
  const validTimezones = [
    // Americas
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'America/Phoenix', 'America/Anchorage', 'America/Toronto', 'America/Vancouver',
    'America/Mexico_City', 'America/Sao_Paulo', 'America/Buenos_Aires', 'America/Lima',
    'America/Bogota', 'America/Caracas', 'America/Santiago', 'America/Montevideo',
    'America/Asuncion', 'America/La_Paz', 'America/Guayaquil', 'America/Managua',
    'America/Guatemala', 'America/Tegucigalpa', 'America/San_Jose', 'America/Panama',
    'America/Havana', 'America/Jamaica', 'America/Port-au-Prince', 'America/Santo_Domingo',
    'America/Puerto_Rico', 'America/Martinique', 'America/Cayenne', 'America/Paramaribo',
    // Europe
    'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Rome', 'Europe/Madrid',
    'Europe/Amsterdam', 'Europe/Brussels', 'Europe/Vienna', 'Europe/Prague', 'Europe/Warsaw',
    'Europe/Stockholm', 'Europe/Copenhagen', 'Europe/Oslo', 'Europe/Helsinki',
    'Europe/Dublin', 'Europe/Lisbon', 'Europe/Athens', 'Europe/Bucharest', 'Europe/Sofia',
    'Europe/Budapest', 'Europe/Zagreb', 'Europe/Belgrade', 'Europe/Kiev', 'Europe/Moscow',
    'Europe/Istanbul', 'Europe/Zurich', 'Europe/Luxembourg',
    // Asia
    'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Singapore', 'Asia/Seoul',
    'Asia/Dubai', 'Asia/Kolkata', 'Asia/Karachi', 'Asia/Dhaka', 'Asia/Bangkok',
    'Asia/Jakarta', 'Asia/Manila', 'Asia/Ho_Chi_Minh', 'Asia/Kuala_Lumpur',
    'Asia/Taipei', 'Asia/Mumbai', 'Asia/Colombo', 'Asia/Kathmandu',
    'Asia/Yangon', 'Asia/Phnom_Penh', 'Asia/Vientiane', 'Asia/Ulaanbaatar',
    'Asia/Almaty', 'Asia/Tashkent', 'Asia/Baku', 'Asia/Yerevan', 'Asia/Tbilisi',
    'Asia/Tehran', 'Asia/Baghdad', 'Asia/Riyadh', 'Asia/Kuwait', 'Asia/Qatar',
    'Asia/Bahrain', 'Asia/Muscat', 'Asia/Jerusalem', 'Asia/Beirut', 'Asia/Amman',
    'Asia/Damascus', 'Asia/Nicosia',
    // Pacific
    'Pacific/Honolulu', 'Pacific/Auckland', 'Pacific/Sydney', 'Pacific/Melbourne',
    'Pacific/Brisbane', 'Pacific/Perth', 'Pacific/Adelaide', 'Pacific/Darwin',
    'Pacific/Guam', 'Pacific/Port_Moresby', 'Pacific/Fiji', 'Pacific/Tahiti',
    'Pacific/Apia', 'Pacific/Tongatapu', 'Pacific/Chatham', 'Pacific/Easter',
    'Pacific/Galapagos', 'Pacific/Marquesas',
    // Africa
    'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Lagos', 'Africa/Nairobi',
    'Africa/Casablanca', 'Africa/Tunis', 'Africa/Algiers', 'Africa/Addis_Ababa',
    'Africa/Dar_es_Salaam', 'Africa/Kampala', 'Africa/Khartoum', 'Africa/Accra',
    'Africa/Abidjan', 'Africa/Dakar', 'Africa/Luanda', 'Africa/Maputo',
    // Atlantic
    'Atlantic/Azores', 'Atlantic/Canary', 'Atlantic/Cape_Verde', 'Atlantic/Reykjavik',
    'Atlantic/Bermuda', 'Atlantic/Madeira',
    // Indian Ocean
    'Indian/Mauritius', 'Indian/Reunion', 'Indian/Maldives', 'Indian/Seychelles',
    // Antarctica
    'Antarctica/McMurdo', 'Antarctica/Davis',
    // UTC
    'UTC',
  ];
  // Case-insensitive matching
  return validTimezones.some(tz => tz.toLowerCase() === timezone.toLowerCase());
};

// Bug #83: Helper function to validate hex color format
const isValidHexColor = (color: string): boolean => {
  if (!color || color === '' || color.trim() === '') return true; // Optional field
  // Validates hex color format: #RRGGBB or #RGB
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
};

// Bug #85: Helper function to validate URL format
const isValidUrl = (url: string): boolean => {
  if (!url || url === '' || url.trim() === '') return true; // Optional field
  try {
    const urlObj = new URL(url);
    // Must have http or https protocol
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
};

// Helper to convert string numbers to numbers (used for numeric fields)
const numberOrStringToNumber = z.union([z.number(), z.string(), z.undefined(), z.literal('')]).transform((val) => {
  if (val === '' || val === null || val === undefined) return undefined;
  if (typeof val === 'string') {
    const num = parseFloat(val);
    return isNaN(num) ? undefined : num;
  }
  return val;
});

// Settings validation schema
export const settingsSchema = z.object({
  invoiceNumberFormat: z
    .union([z.string(), z.undefined(), z.literal('')])
    .optional()
    .superRefine((val, ctx) => {
      // Only validate if a value is provided (not undefined/empty)
      if (!val || val === '' || (typeof val === 'string' && val.trim() === '')) {
        return; // Optional field - no validation needed
      }
      
      // Trim the value for validation
      const trimmed = typeof val === 'string' ? val.trim() : String(val).trim();
      
      // Check for valid placeholders
      const placeholders = ['{YYYY}', '{YY}', '{MM}', '{DD}', '{NUM}', '{####}'];
      const hasPlaceholder = placeholders.some(placeholder => trimmed.includes(placeholder));
      
      if (!hasPlaceholder) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invoice number format must contain at least one placeholder: {YYYY}, {YY}, {MM}, {DD}, {NUM}, or {####}',
        });
        return;
      }
      
      // Check length
      if (trimmed.length > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invoice number format must not exceed 100 characters',
        });
        return;
      }
      
      // Check for valid characters (alphanumeric, spaces, dashes, underscores, hash for {####}, and curly braces)
      const validPattern = /^[A-Za-z0-9\s\-_{}#]+$/;
      if (!validPattern.test(trimmed)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invoice number format contains invalid characters. Allowed: letters, numbers, spaces, hyphens, underscores, curly braces, and # (for {####})',
        });
        return;
      }
    })
    .transform((val) => {
      // Transform after validation - normalize empty strings to undefined
      if (!val || (typeof val === 'string' && val.trim() === '')) return undefined;
      if (typeof val === 'string') {
        return val.trim();
      }
      return val;
    })
    .optional(), // Make it truly optional
  
  companyTaxId: z
    .string()
    .optional()
    .refine(
      (val) => !val || val === '' || val.length <= 100,
      'Tax ID must not exceed 100 characters'
    )
    .refine(
      (val) => !val || val === '' || /^[A-Z0-9\-]*$/i.test(val),
      'Tax ID can only contain letters, numbers, and hyphens'
    )
    .transform((val) => (val === '' ? undefined : val)),
  
  companyRegistrationNumber: z
    .string()
    .optional()
    .refine(
      (val) => !val || val === '' || val.length <= 100,
      'Registration number must not exceed 100 characters'
    )
    .refine(
      (val) => !val || val === '' || /^[A-Z0-9\-]*$/i.test(val),
      'Registration number can only contain letters, numbers, and hyphens'
    )
    .transform((val) => (val === '' ? undefined : val)),
  
  companyVatNumber: z
    .string()
    .optional()
    .refine(
      (val) => !val || val === '' || val.length <= 100,
      'VAT number must not exceed 100 characters'
    )
    .refine(
      (val) => !val || val === '' || /^[A-Z0-9\-]*$/i.test(val),
      'VAT number can only contain letters, numbers, and hyphens'
    )
    .transform((val) => (val === '' ? undefined : val)),
  
  taxRegistrationNumber: z
    .string()
    .optional()
    .refine(
      (val) => !val || val === '' || val.length <= 100,
      'Tax registration number must not exceed 100 characters'
    )
    .refine(
      (val) => !val || val === '' || /^[A-Z0-9\-]*$/i.test(val),
      'Tax registration number can only contain letters, numbers, and hyphens'
    )
    .transform((val) => (val === '' ? undefined : val)),
  
  defaultClientPaymentMethod: z
    .union([
      z.enum(['cash', 'check', 'credit_card', 'bank_transfer', 'paypal', 'stripe', 'other']),
      z.literal(''),
    ])
    .optional()
    .transform((val) => (val === '' ? undefined : val)),
  
  defaultClientCurrency: z
    .string()
    .optional()
    .refine(
      (val) => !val || val === '' || val.length === 3,
      'Currency code must be exactly 3 characters (ISO 4217)'
    )
    .refine(
      (val) => !val || val === '' || /^[A-Z]{3}$/.test(val),
      'Currency code must be uppercase letters only'
    )
    .transform((val) => (val === '' ? undefined : val)),
  
  defaultInventoryUnit: z
    .union([
      z.enum(['piece', 'kg', 'g', 'lb', 'oz', 'l', 'ml', 'm', 'cm', 'ft', 'in', 'box', 'pack', 'case', 'pallet', 'other']),
      z.literal(''),
    ])
    .optional()
    .transform((val) => (val === '' ? undefined : val)),
  
  backupSchedule: z
    .union([
      z.enum(['daily', 'weekly', 'monthly']),
      z.literal(''),
    ])
    .optional()
    .transform((val) => (val === '' ? undefined : val)),
  
  // Bug #68: Missing Validation on Currency Format
  defaultCurrency: z
    .string()
    .optional()
    .refine(
      (val) => !val || val === '' || val.length === 3,
      'Currency code must be exactly 3 characters (ISO 4217)'
    )
    .refine(
      (val) => !val || val === '' || /^[A-Z]{3}$/.test(val),
      'Currency code must be uppercase letters only'
    )
    .transform((val) => (val === '' ? undefined : val)),
  
  // Bug #75: Missing Validation on Date Format
  dateFormat: z
    .string()
    .optional()
    .refine(
      (val) => !val || val === '' || isValidDateFormat(val),
      'Date format must be one of: MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY, MMM DD, YYYY'
    )
    .transform((val) => (val === '' ? undefined : val)),
  
  // Bug #77: Missing Validation on Timezone
  timezone: z
    .string()
    .optional()
    .refine(
      (val) => !val || val === '' || isValidTimeZone(val),
      'Timezone must be a valid IANA timezone identifier'
    )
    .transform((val) => (val === '' ? undefined : val)),
  
  // Bug #83: Missing Validation on Color Format
  primaryColor: z
    .string()
    .optional()
    .refine(
      (val) => !val || val === '' || isValidHexColor(val),
      'Primary color must be a valid hex color format (e.g., #1976d2 or #fff)'
    )
    .transform((val) => (val === '' ? undefined : val)),
  
  secondaryColor: z
    .string()
    .optional()
    .refine(
      (val) => !val || val === '' || isValidHexColor(val),
      'Secondary color must be a valid hex color format (e.g., #dc004e or #fff)'
    )
    .transform((val) => (val === '' ? undefined : val)),
  
  // Bug #85: Missing Validation on URL Format
  companyLogo: z
    .string()
    .optional()
    .refine(
      (val) => !val || val === '' || isValidUrl(val),
      'Logo URL must be a valid URL with http:// or https:// protocol'
    )
    .transform((val) => (val === '' ? undefined : val)),
  
  companyWebsite: z
    .string()
    .optional()
    .refine(
      (val) => !val || val === '' || isValidUrl(val),
      'Website URL must be a valid URL with http:// or https:// protocol'
    )
    .transform((val) => (val === '' ? undefined : val)),
  
  // Bug #95: Missing Validation on Numeric Ranges
  itemsPerPage: numberOrStringToNumber
    .refine(
      (val) => val === undefined || (typeof val === 'number' && val >= 5 && val <= 100),
      'Items per page must be between 5 and 100'
    ),
  
  defaultPaymentTermsDays: numberOrStringToNumber
    .refine(
      (val) => val === undefined || (typeof val === 'number' && val >= 0 && val <= 365),
      'Payment terms days must be between 0 and 365'
    ),
  
  defaultReorderLevel: numberOrStringToNumber
    .refine(
      (val) => val === undefined || (typeof val === 'number' && val >= 0 && val <= 1000000),
      'Reorder level must be between 0 and 1,000,000'
    ),
  
  backupRetentionDays: numberOrStringToNumber
    .refine(
      (val) => val === undefined || (typeof val === 'number' && val >= 1 && val <= 365),
      'Backup retention days must be between 1 and 365'
    ),
  
  weeksSupplyTarget: numberOrStringToNumber
    .refine(
      (val) => val === undefined || (typeof val === 'number' && val >= 1 && val <= 52),
      'Weeks supply target must be between 1 and 52'
    ),
  
  stockAlertThreshold: numberOrStringToNumber
    .refine(
      (val) => val === undefined || (typeof val === 'number' && val >= 0 && val <= 1000000),
      'Stock alert threshold must be between 0 and 1,000,000'
    ),
  
  defaultTaxRate: z
    .union([z.number(), z.string(), z.undefined(), z.literal('')])
    .transform((val) => {
      // Convert empty strings to undefined
      if (val === '' || val === null || val === undefined) return undefined;
      // Convert string numbers to numbers
      if (typeof val === 'string') {
        const num = parseFloat(val);
        return isNaN(num) ? undefined : num;
      }
      return val;
    })
    .refine(
      (val) => val === undefined || (typeof val === 'number' && val >= 0 && val <= 100),
      'Default tax rate must be between 0 and 100'
    ),
  
  // Fix Issue #17: Add email validation for companyEmail and emailFromAddress
  companyEmail: z
    .string()
    .optional()
    .refine(
      (val) => !val || val === '' || z.string().email().safeParse(val).success,
      'Company email must be a valid email address'
    )
    .transform((val) => (val === '' ? undefined : val)),
  
  emailFromAddress: z
    .string()
    .optional()
    .refine(
      (val) => !val || val === '' || z.string().email().safeParse(val).success,
      'Email from address must be a valid email address'
    )
    .transform((val) => (val === '' ? undefined : val)),
  
  // Fix Issue #22: Add phone validation
  companyPhone: z
    .string()
    .optional()
    .refine(
      (val) => !val || val === '' || /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/.test(val),
      'Phone number must be in valid format (e.g., +1 (555) 123-4567 or 555-123-4567)'
    )
    .transform((val) => (val === '' ? undefined : val)),
}).passthrough(); // Allow other fields through

export type SettingsFormData = z.infer<typeof settingsSchema>;
