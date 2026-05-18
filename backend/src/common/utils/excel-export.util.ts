import * as ExcelJS from 'exceljs';

export interface ExcelExportOptions {
  filename?: string;
  sheets?: ExcelSheet[];
}

export interface ExcelSheet {
  name: string;
  data: any[][];
  headers?: string[];
  columnWidths?: number[];
}

/**
 * Create an Excel workbook with multiple sheets
 */
export async function createExcelWorkbook(options: ExcelExportOptions): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  
  if (!options.sheets || options.sheets.length === 0) {
    throw new Error('At least one sheet is required');
  }

  for (const sheetConfig of options.sheets) {
    const worksheet = workbook.addWorksheet(sheetConfig.name);
    
    // Add headers if provided
    if (sheetConfig.headers && sheetConfig.headers.length > 0) {
      const headerRow = worksheet.addRow(sheetConfig.headers);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    }

    // Add data rows
    for (const row of sheetConfig.data) {
      worksheet.addRow(row);
    }

    // Set column widths
    if (sheetConfig.columnWidths && sheetConfig.columnWidths.length > 0) {
      sheetConfig.columnWidths.forEach((width, index) => {
        worksheet.getColumn(index + 1).width = width;
      });
    } else {
      // Auto-fit columns if widths not specified
      worksheet.columns.forEach((column, index) => {
        if (column.eachCell) {
          let maxLength = 10;
          column.eachCell({ includeEmpty: false }, (cell) => {
            const columnLength = cell.value ? cell.value.toString().length : 10;
            if (columnLength > maxLength) {
              maxLength = columnLength;
            }
          });
          column.width = Math.min(maxLength + 2, 50);
        }
      });
    }

    // Format header row
    if (sheetConfig.headers && sheetConfig.headers.length > 0) {
      const headerRow = worksheet.getRow(1);
      headerRow.height = 20;
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    }
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Format currency value for Excel
 */
export function formatCurrencyForExcel(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Format date for Excel
 */
export function formatDateForExcel(date: Date | string): Date {
  if (typeof date === 'string') {
    return new Date(date);
  }
  return date;
}

