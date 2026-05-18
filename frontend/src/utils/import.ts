// Note: xlsx library needs to be installed: npm install xlsx
// For now, using a simple CSV parser and Excel parsing will be handled on backend

export type ImportResult<T> = {
  valid: T[];
  invalid: Array<{ row: number; data: any; errors: string[] }>;
};

export type ColumnMapping = {
  sourceColumn: string;
  targetField: string;
  required?: boolean;
  transform?: (value: any) => any;
};

/**
 * Parse CSV file
 */
export const parseCSV = async (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length === 0) {
          resolve([]);
          return;
        }
        
        // Parse header
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        
        // Parse rows
        const rows: any[] = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          const row: any = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          rows.push(row);
        }
        
        resolve(rows);
      } catch (error) {
        reject(new Error(`Failed to parse CSV: ${error}`));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};

/**
 * Parse Excel file
 * Note: For Excel files, we'll send to backend for parsing
 * This is a placeholder - actual parsing happens on backend
 */
export const parseExcel = async (file: File): Promise<any[]> => {
  // For now, return empty array - backend will handle Excel parsing
  // Frontend can still validate file type
  return Promise.resolve([]);
};

/**
 * Validate and transform imported data
 */
export const validateAndTransform = <T>(
  rows: any[],
  columnMappings: ColumnMapping[],
  validator?: (row: any) => { valid: boolean; errors: string[] },
): ImportResult<T> => {
  const valid: T[] = [];
  const invalid: Array<{ row: number; data: any; errors: string[] }> = [];

  rows.forEach((row, index) => {
    const errors: string[] = [];
    const transformed: any = {};

    // Map columns
    columnMappings.forEach(mapping => {
      const sourceValue = row[mapping.sourceColumn];
      
      if (mapping.required && (sourceValue === undefined || sourceValue === null || sourceValue === '')) {
        errors.push(`Missing required field: ${mapping.targetField}`);
        return;
      }

      if (sourceValue !== undefined && sourceValue !== null && sourceValue !== '') {
        transformed[mapping.targetField] = mapping.transform
          ? mapping.transform(sourceValue)
          : sourceValue;
      }
    });

    // Run custom validator if provided
    if (validator) {
      const validation = validator(transformed);
      if (!validation.valid) {
        errors.push(...validation.errors);
      }
    }

    if (errors.length > 0) {
      invalid.push({ row: index + 2, data: transformed, errors }); // +2 because of header and 0-based index
    } else {
      valid.push(transformed as T);
    }
  });

  return { valid, invalid };
};

/**
 * Get file extension
 */
export const getFileExtension = (filename: string): string => {
  return filename.split('.').pop()?.toLowerCase() || '';
};

/**
 * Check if file is supported
 */
export const isSupportedFile = (file: File): boolean => {
  const ext = getFileExtension(file.name);
  return ['csv', 'xlsx', 'xls'].includes(ext);
};
