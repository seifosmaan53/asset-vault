import { 
  IsString, 
  IsOptional, 
  IsNumber, 
  IsEmail, 
  IsBoolean, 
  IsInt, 
  ValidateIf,
  IsEnum,
  Min,
  Max,
  Length,
  Matches,
  IsIn,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  registerDecorator,
} from 'class-validator';
import { isURL } from 'validator';

// Custom validator for timezone
// Fix Issue #13: Expanded timezone list with comprehensive IANA timezone support
@ValidatorConstraint({ name: 'isValidTimezone', async: false })
export class IsValidTimezoneConstraint implements ValidatorConstraintInterface {
  private readonly validTimezones = [
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
    'Europe/Istanbul', 'Europe/Zurich', 'Europe/Brussels', 'Europe/Luxembourg',
    // Asia
    'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Singapore', 'Asia/Seoul',
    'Asia/Dubai', 'Asia/Kolkata', 'Asia/Karachi', 'Asia/Dhaka', 'Asia/Bangkok',
    'Asia/Jakarta', 'Asia/Manila', 'Asia/Ho_Chi_Minh', 'Asia/Kuala_Lumpur',
    'Asia/Taipei', 'Asia/Mumbai', 'Asia/Colombo', 'Asia/Kathmandu', 'Asia/Dhaka',
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

  validate(timezone: string, args: ValidationArguments) {
    if (!timezone) return true; // Optional field
    // Fix Issue #13: Case-insensitive matching for better UX
    return this.validTimezones.some(tz => tz.toLowerCase() === timezone.toLowerCase());
  }

  defaultMessage(args: ValidationArguments) {
    return 'Timezone must be a valid IANA timezone identifier';
  }
}

function IsValidTimezone(validationOptions?: any) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidTimezoneConstraint,
    });
  };
}

// Custom validator for hex color
@ValidatorConstraint({ name: 'isValidHexColor', async: false })
export class IsValidHexColorConstraint implements ValidatorConstraintInterface {
  validate(color: string, args: ValidationArguments) {
    if (!color) return true; // Optional field
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
  }

  defaultMessage(args: ValidationArguments) {
    return 'Color must be a valid hex color (e.g., #FF5733 or #F53)';
  }
}

function IsValidHexColor(validationOptions?: any) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidHexColorConstraint,
    });
  };
}

// Custom validator for invoice number format
@ValidatorConstraint({ name: 'isValidInvoiceNumberFormat', async: false })
export class IsValidInvoiceNumberFormatConstraint implements ValidatorConstraintInterface {
  validate(format: string, args: ValidationArguments) {
    if (!format) return true; // Optional field
    // Must contain at least one placeholder
    const placeholders = ['{YYYY}', '{YY}', '{MM}', '{DD}', '{NUM}', '{####}'];
    const hasPlaceholder = placeholders.some(placeholder => format.includes(placeholder));
    
    // Also check that format is not too long (max 100 characters)
    if (format.length > 100) return false;
    
    // Check for invalid characters (only allow alphanumeric, dashes, underscores, spaces, hash for {####}, and placeholders)
    const validPattern = /^[A-Za-z0-9\s\-_{}#]+$/;
    if (!validPattern.test(format)) return false;
    
    return hasPlaceholder;
  }

  defaultMessage(args: ValidationArguments) {
    return 'Invoice number format must contain at least one placeholder: {YYYY}, {YY}, {MM}, {DD}, {NUM}, or {####}';
  }
}

function IsValidInvoiceNumberFormat(validationOptions?: any) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidInvoiceNumberFormatConstraint,
    });
  };
}

// Custom validator for ISO language code
@ValidatorConstraint({ name: 'isValidLanguageCode', async: false })
export class IsValidLanguageCodeConstraint implements ValidatorConstraintInterface {
  private readonly validLanguages = [
    'en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'zh', 'ar', 'hi', 'ru',
    'nl', 'sv', 'no', 'da', 'fi', 'pl', 'cs', 'hu', 'ro', 'bg', 'hr',
    'sk', 'sl', 'et', 'lv', 'lt', 'el', 'tr', 'he', 'th', 'vi', 'ko',
  ];

  validate(language: string, args: ValidationArguments) {
    if (!language) return true; // Optional field
    // Must be 2 characters (ISO 639-1)
    if (language.length !== 2) return false;
    return this.validLanguages.includes(language.toLowerCase());
  }

  defaultMessage(args: ValidationArguments) {
    return 'Language must be a valid ISO 639-1 language code (2 letters, e.g., en, es, fr)';
  }
}

function IsValidLanguageCode(validationOptions?: any) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidLanguageCodeConstraint,
    });
  };
}

// Custom validator for URL
@ValidatorConstraint({ name: 'isValidUrl', async: false })
export class IsValidUrlConstraint implements ValidatorConstraintInterface {
  validate(url: string, args: ValidationArguments) {
    if (!url) return true; // Optional field
    return isURL(url, { require_protocol: true, require_valid_protocol: true });
  }

  defaultMessage(args: ValidationArguments) {
    return 'Must be a valid URL with protocol (e.g., https://example.com)';
  }
}

function IsValidUrl(validationOptions?: any) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidUrlConstraint,
    });
  };
}





// Custom validator for phone number
@ValidatorConstraint({ name: 'isValidPhoneNumber', async: false })
export class IsValidPhoneNumberConstraint implements ValidatorConstraintInterface {
  validate(phone: string, args: ValidationArguments) {
    if (!phone) return true; // Optional field
    // Allow international format: +, digits, spaces, dashes, parentheses
    return /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/.test(phone);
  }

  defaultMessage(args: ValidationArguments) {
    return 'Phone number must be in valid format (e.g., +1 (555) 123-4567 or 555-123-4567)';
  }
}

function IsValidPhoneNumber(validationOptions?: any) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidPhoneNumberConstraint,
    });
  };
}


export class UpdateSettingsDto {
  // Existing fields
  @IsOptional()
  @ValidateIf((o) => o.invoiceNumberFormat !== undefined && o.invoiceNumberFormat !== null && o.invoiceNumberFormat !== '')
  @IsString()
  @IsValidInvoiceNumberFormat({ message: 'Invoice number format must contain at least one placeholder: {YYYY}, {YY}, {MM}, {DD}, {NUM}, or {####}' })
  invoiceNumberFormat?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3, { message: 'Currency code must be exactly 3 characters (ISO 4217)' })
  @Matches(/^[A-Z]{3}$/, { message: 'Currency code must be uppercase letters only' })
  defaultCurrency?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Tax rate must be a number with max 2 decimal places' })
  @Min(0, { message: 'Tax rate cannot be negative' })
  @Max(100, { message: 'Tax rate cannot exceed 100%' })
  defaultTaxRate?: number;

  @IsOptional()
  @IsString()
  @Length(0, 255, { message: 'Company name must not exceed 255 characters' })
  companyName?: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000, { message: 'Company address must not exceed 1000 characters' })
  companyAddress?: string;

  @IsOptional()
  @IsString()
  @Length(0, 50, { message: 'Phone number must not exceed 50 characters' })
  @IsValidPhoneNumber({ message: 'Phone number must be in valid format' })
  companyPhone?: string;

  @IsOptional()
  @IsString()
  @Length(0, 255, { message: 'Email must not exceed 255 characters' })
  @ValidateIf((o) => o.companyEmail !== '' && o.companyEmail !== null && o.companyEmail !== undefined)
  @IsEmail({}, { message: 'Company email must be a valid email address' })
  companyEmail?: string;

  @IsOptional()
  @IsString()
  @Length(0, 500, { message: 'Website URL must not exceed 500 characters' })
  @IsValidUrl({ message: 'Website must be a valid URL with protocol' })
  companyWebsite?: string;

  @IsOptional()
  @IsString()
  @Length(0, 500, { message: 'Logo URL must not exceed 500 characters' })
  @IsValidUrl({ message: 'Logo URL must be a valid URL with protocol' })
  companyLogo?: string;

  @IsOptional()
  @IsString()
  @Length(0, 100, { message: 'Tax ID must not exceed 100 characters' })
  @Matches(/^[A-Z0-9\-]+$/i, { message: 'Tax ID can only contain letters, numbers, and hyphens' })
  companyTaxId?: string;

  @IsOptional()
  @IsString()
  @Length(0, 100, { message: 'Registration number must not exceed 100 characters' })
  @Matches(/^[A-Z0-9\-]+$/i, { message: 'Registration number can only contain letters, numbers, and hyphens' })
  companyRegistrationNumber?: string;

  @IsOptional()
  @IsString()
  @Length(0, 100, { message: 'VAT number must not exceed 100 characters' })
  @Matches(/^[A-Z0-9\-]+$/i, { message: 'VAT number can only contain letters, numbers, and hyphens' })
  companyVatNumber?: string;

  // Invoice Defaults
  @IsOptional()
  @IsInt({ message: 'Payment terms days must be an integer' })
  @Min(0, { message: 'Payment terms days cannot be negative' })
  @Max(365, { message: 'Payment terms days cannot exceed 365' })
  defaultPaymentTermsDays?: number;

  @IsOptional()
  @IsString()
  @Length(0, 5000, { message: 'Invoice notes must not exceed 5000 characters' })
  defaultInvoiceNotes?: string;

  @IsOptional()
  @IsString()
  @Length(0, 5000, { message: 'Invoice terms must not exceed 5000 characters' })
  defaultInvoiceTerms?: string;

  @IsOptional()
  @IsBoolean()
  autoGenerateInvoiceNumber?: boolean;

  @IsOptional()
  @IsBoolean()
  showInvoiceNumberOnPDF?: boolean;

  @IsOptional()
  @IsBoolean()
  showPaymentInstructions?: boolean;

  @IsOptional()
  @IsString()
  @Length(0, 2000, { message: 'Invoice footer text must not exceed 2000 characters' })
  invoiceFooterText?: string;

  // Date & Time Formats
  @IsOptional()
  @IsEnum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'DD-MM-YYYY', 'MMM DD, YYYY'], {
    message: 'Date format must be one of: MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY, MMM DD, YYYY',
  })
  dateFormat?: string;

  @IsOptional()
  @IsEnum(['12', '24'], { message: 'Time format must be either "12" or "24"' })
  timeFormat?: string;

  @IsOptional()
  @IsString()
  @IsValidTimezone({ message: 'Timezone must be a valid IANA timezone identifier' })
  timezone?: string;

  // Number & Currency Formats
  @IsOptional()
  @IsString()
  @Length(1, 1, { message: 'Decimal separator must be exactly 1 character' })
  decimalSeparator?: string;

  @IsOptional()
  @IsString()
  @Length(1, 1, { message: 'Thousands separator must be exactly 1 character' })
  thousandsSeparator?: string;

  @IsOptional()
  @IsEnum(['left', 'right'], { message: 'Currency symbol position must be either "left" or "right"' })
  currencySymbolPosition?: string;

  @IsOptional()
  @IsBoolean()
  showCurrencySymbol?: boolean;

  // Tax Settings
  @IsOptional()
  @IsBoolean()
  taxInclusive?: boolean;

  @IsOptional()
  @IsString()
  @Length(0, 100, { message: 'Tax registration number must not exceed 100 characters' })
  @Matches(/^[A-Z0-9\-]+$/i, { message: 'Tax registration number can only contain letters, numbers, and hyphens' })
  taxRegistrationNumber?: string;

  // Inventory Defaults
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Reorder level must be a number with max 2 decimal places' })
  @Min(0, { message: 'Reorder level cannot be negative' })
  defaultReorderLevel?: number;

  @IsOptional()
  @IsEnum(['piece', 'kg', 'g', 'lb', 'oz', 'l', 'ml', 'm', 'cm', 'ft', 'in', 'box', 'pack', 'case', 'pallet', 'other'], {
    message: 'Inventory unit must be one of: piece, kg, g, lb, oz, l, ml, m, cm, ft, in, box, pack, case, pallet, other',
  })
  defaultInventoryUnit?: string;

  @IsOptional()
  @IsBoolean()
  trackInventory?: boolean;

  @IsOptional()
  @IsBoolean()
  allowNegativeStock?: boolean;

  @IsOptional()
  @IsBoolean()
  autoReorderEnabled?: boolean;

  @IsOptional()
  @IsInt({ message: 'Stock alert threshold must be an integer' })
  @Min(0, { message: 'Stock alert threshold cannot be negative' })
  @Max(1000000, { message: 'Stock alert threshold cannot exceed 1,000,000' })
  stockAlertThreshold?: number;

  // Email/SMTP Settings
  @ValidateIf((o) => o.smtpPort !== undefined && o.smtpPort !== null)
  @IsString({ message: 'SMTP host is required when SMTP port is provided' })
  @Length(1, 255, { message: 'SMTP host must be between 1 and 255 characters' })
  @IsOptional()
  smtpHost?: string;

  @ValidateIf((o) => o.smtpHost !== undefined && o.smtpHost !== null && o.smtpHost !== '')
  @IsInt({ message: 'SMTP port is required when SMTP host is provided' })
  @Min(1, { message: 'SMTP port must be between 1 and 65535' })
  @Max(65535, { message: 'SMTP port must be between 1 and 65535' })
  @IsOptional()
  smtpPort?: number;

  @IsOptional()
  @IsBoolean()
  smtpSecure?: boolean;

  @ValidateIf((o) => o.smtpPassword !== undefined && o.smtpPassword !== null && o.smtpPassword !== '')
  @IsString({ message: 'SMTP user is required when SMTP password is provided' })
  @Length(1, 255, { message: 'SMTP user must be between 1 and 255 characters' })
  @IsOptional()
  smtpUser?: string;

  @IsOptional()
  @IsString()
  @Length(1, 500, { message: 'SMTP password must be between 1 and 500 characters' })
  smtpPassword?: string;

  @IsOptional()
  @IsString()
  @Length(0, 255, { message: 'Email from name must not exceed 255 characters' })
  emailFromName?: string;

  @ValidateIf((o) => {
    // Required if SMTP is configured
    const hasSmtpConfig = (o.smtpHost && o.smtpHost !== '') || (o.smtpPort !== undefined && o.smtpPort !== null);
    return hasSmtpConfig || (o.emailFromAddress !== '' && o.emailFromAddress !== null && o.emailFromAddress !== undefined);
  })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @Length(0, 255, { message: 'Email address must not exceed 255 characters' })
  @IsOptional()
  emailFromAddress?: string;

  // Notification Settings
  @IsOptional()
  @IsBoolean()
  emailInvoiceSent?: boolean;

  @IsOptional()
  @IsBoolean()
  emailInvoicePaid?: boolean;

  @IsOptional()
  @IsBoolean()
  emailInvoiceOverdue?: boolean;

  @IsOptional()
  @IsBoolean()
  emailLowStockAlert?: boolean;

  @IsOptional()
  @IsBoolean()
  emailInvoiceReminder?: boolean;

  @IsOptional()
  @IsBoolean()
  emailWeeklyReport?: boolean;

  @IsOptional()
  @IsBoolean()
  emailMonthlyReport?: boolean;

  // UI/Display Settings
  @IsOptional()
  @IsEnum(['light', 'dark'], { message: 'Theme must be either "light" or "dark"' })
  theme?: string;

  @IsOptional()
  @IsInt({ message: 'Items per page must be an integer' })
  @Min(1, { message: 'Items per page must be at least 1' })
  @Max(1000, { message: 'Items per page cannot exceed 1000' })
  itemsPerPage?: number;

  @IsOptional()
  @IsString()
  @IsValidLanguageCode({ message: 'Language must be a valid ISO 639-1 language code' })
  language?: string;

  @IsOptional()
  @IsString()
  @Length(4, 7, { message: 'Primary color must be a valid hex color (4-7 characters)' })
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, { message: 'Primary color must be a valid hex color (e.g., #FF5733 or #F53)' })
  primaryColor?: string;

  @IsOptional()
  @IsString()
  @Length(4, 7, { message: 'Secondary color must be a valid hex color (4-7 characters)' })
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, { message: 'Secondary color must be a valid hex color (e.g., #FF5733 or #F53)' })
  secondaryColor?: string;
}
