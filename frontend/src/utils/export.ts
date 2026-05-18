export interface ExportOptions {
  filename: string;
  title?: string;
  description?: string;
  includeMetadata?: boolean;
  metadata?: {
    companyName?: string;
    exportedBy?: string;
    additionalInfo?: string;
  };
  headers?: string[];
  formatNumbers?: boolean;
  formatCurrencyFields?: boolean;
  formatDates?: boolean;
  addBOM?: boolean; // Byte Order Mark for Excel UTF-8 compatibility
  onProgress?: (current: number, total: number) => void; // Progress callback
}

/**
 * Prevents CSV/Excel formula injection by prefixing dangerous characters
 */
const preventCSVInjection = (s: string): string => {
  return /^[=+\-@]/.test(s) ? `'${s}` : s;
};

/**
 * Formats a value for CSV export with proper escaping and injection prevention
 */
const formatCSVValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      const safe = value.join('; ').replace(/"/g, '""');
      return preventCSVInjection(safe);
    }
    const safe = JSON.stringify(value).replace(/"/g, '""');
    return preventCSVInjection(safe);
  }
  
  const stringValue = String(value);
  const safe = preventCSVInjection(stringValue);
  
  // Escape commas, quotes, and newlines
  if (safe.includes(',') || safe.includes('"') || safe.includes('\n') || safe.includes('\r')) {
    return `"${safe.replace(/"/g, '""').replace(/\r\n/g, ' ').replace(/\n/g, ' ').replace(/\r/g, ' ')}"`;
  }
  
  return safe;
};

/**
 * Formats a number with proper decimal places and thousands separators
 */
const formatNumber = (value: number | string | null | undefined, decimals: number = 2, addThousandsSeparator: boolean = true): string => {
  if (value === null || value === undefined || value === '') return '';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return String(value);
  
  const fixed = num.toFixed(decimals);
  
  if (addThousandsSeparator && num >= 1000) {
    const parts = fixed.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }
  
  return fixed;
};

/**
 * Formats currency value using Intl.NumberFormat for proper locale formatting
 */
const formatCurrencyValue = (value: number | string | null | undefined, currency: string = 'USD'): string => {
  if (value === null || value === undefined || value === '') return '';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return String(value);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(num);
};

/**
 * Professional CSV export function with enhanced features
 */
// Bug #87: Maximum file size constant (10MB)
const MAX_EXPORT_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

export const exportToCSV = (
  data: Record<string, unknown>[],
  options: string | ExportOptions
): void => {
  if (!data || data.length === 0) {
    throw new Error('No data to export');
  }
  
  // Bug #87: Validate data size before export to prevent memory issues
  const estimatedSize = JSON.stringify(data).length;
  if (estimatedSize > MAX_EXPORT_FILE_SIZE) {
    throw new Error(
      `Data size (${(estimatedSize / 1024 / 1024).toFixed(2)}MB) exceeds maximum export size (${MAX_EXPORT_FILE_SIZE / 1024 / 1024}MB). Please filter or paginate your data.`
    );
  }

  // Handle legacy string filename parameter
  const opts: ExportOptions = typeof options === 'string' 
    ? { filename: options }
    : options;

  const {
    filename,
    title,
    description,
    includeMetadata = true,
    metadata = {},
    headers,
    formatNumbers = false,
    formatCurrencyFields = false,
    formatDates = false,
    addBOM = true, // Default to true for Excel compatibility
    onProgress,
  } = opts;

  // Get headers from first object if not provided
  const csvHeaders = headers || Object.keys(data[0]);
  
  // Build CSV content
  const csvLines: string[] = [];

  // Add metadata header section
  if (includeMetadata) {
    const exportDate = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });

    // Add metadata section with proper formatting (using formatCSVValue for safe escaping)
    if (title) {
      csvLines.push(formatCSVValue(title.toUpperCase()));
      csvLines.push(''); // Empty line
    }

    if (description) {
      csvLines.push(formatCSVValue(description));
      csvLines.push(''); // Empty line
    }

    csvLines.push(formatCSVValue(`Export Date: ${exportDate}`));
    
    if (metadata.companyName) {
      csvLines.push(formatCSVValue(`Company: ${metadata.companyName}`));
    }
    
    if (metadata.exportedBy) {
      csvLines.push(formatCSVValue(`Exported By: ${metadata.exportedBy}`));
    }
    
    if (metadata.additionalInfo) {
      csvLines.push(formatCSVValue(metadata.additionalInfo));
    }

    csvLines.push(formatCSVValue(`Total Records: ${data.length.toLocaleString()}`));
    csvLines.push(''); // Empty line before headers
  }

  // Add headers
  csvLines.push(csvHeaders.map(header => formatCSVValue(header)).join(','));

  // Add data rows with proper formatting
  const totalItems = data.length;
  let processedItems = 0;
  const progressInterval = Math.max(1, Math.floor(totalItems / 100)); // Report progress every 1% or at least every item
  
  data.forEach((row, index) => {
    const rowData = csvHeaders.map(header => {
      let value = row[header];
      
      // Handle empty/null values
      if (value === null || value === undefined || value === '') {
        return '';
      }
      
      // Apply formatting based on value type and options
      if (typeof value === 'number') {
        // Check if it's a currency field (Total, Subtotal, Tax, Discount, Price, etc.)
        const isCurrencyField = /^(total|subtotal|tax|discount|price|amount|cost|value|unit.*price|line.*total)/i.test(header);
        
        if (formatCurrencyFields && isCurrencyField) {
          value = formatCurrencyValue(value);
        } else if (formatNumbers) {
          // Format numbers with thousands separator for large numbers
          value = formatNumber(value, 2, value >= 1000);
        } else {
          // Default: format with 2 decimals if it's a decimal number
          value = value % 1 !== 0 ? formatNumber(value, 2, value >= 1000) : String(value);
        }
      } else if (formatDates && value && (value instanceof Date || typeof value === 'string')) {
        // Date formatting is handled by caller, just ensure it's a string
        value = String(value);
      } else if (typeof value === 'string' && value.trim() === '') {
        // Empty strings
        return '';
      }
      
      return formatCSVValue(value);
    });
    
    csvLines.push(rowData.join(','));
    processedItems++;
    
    // Report progress at intervals or on last item
    if (onProgress && (index % progressInterval === 0 || index === totalItems - 1)) {
      onProgress(processedItems, totalItems);
    }
  });

  // Join all lines with \r\n for Excel compatibility
  const csvContent = csvLines.join('\r\n');
  
  // Prepend BOM to final content (not as separate line) for Excel UTF-8 compatibility
  const finalContent = addBOM ? '\uFEFF' + csvContent : csvContent;

  // Create blob with proper MIME type
  const blob = new Blob([finalContent], { 
    type: 'text/csv;charset=utf-8;' 
  });

  // Generate filename with timestamp (date and time) to prevent duplicates
  // Use local time, not UTC, to match user's timezone
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`; // YYYY-MM-DD (local time)
  
  // Get time in HH-MM-SS format (24-hour, local time)
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const timeStr = `${hours}-${minutes}-${seconds}`;
  
  const safeFilename = filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const downloadFilename = `${safeFilename}_${dateStr}_${timeStr}.csv`;

  // Create download link
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', downloadFilename);
  link.style.visibility = 'hidden';
  link.setAttribute('aria-hidden', 'true');
  
  // Trigger download
  document.body.appendChild(link);
  link.click();
  
  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Export data to Excel-compatible CSV with enhanced formatting
 */
export const exportToExcel = (
  data: Record<string, unknown>[],
  options: ExportOptions
): void => {
  exportToCSV(data, {
    ...options,
    addBOM: true,
    formatNumbers: true,
  });
};

