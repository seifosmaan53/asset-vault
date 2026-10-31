import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

/** One imported row: column header -> cell text ('' for an empty cell). */
export type ImportRow = Record<string, string>;

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  /**
   * Parse CSV file content
   */
  parseCSV(content: string): ImportRow[] {
    try {
      const lines = content.split('\n').filter((line) => line.trim());
      if (lines.length === 0) {
        return [];
      }

      // Parse header
      const headers = this.parseCSVLine(lines[0]);

      // Parse rows
      const rows: ImportRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = this.parseCSVLine(lines[i]);
        const row: ImportRow = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        rows.push(row);
      }

      return rows;
    } catch (error) {
      this.logger.error('Failed to parse CSV', error);
      throw new Error(`Failed to parse CSV: ${error}`);
    }
  }

  /**
   * Parse Excel file buffer
   */
  async parseExcel(buffer: Buffer): Promise<ImportRow[]> {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        return [];
      }

      const rows: ImportRow[] = [];
      const headers: string[] = [];

      // Get headers from first row
      worksheet.getRow(1).eachCell((cell, colNumber) => {
        headers[colNumber - 1] = cell.text || '';
      });

      // Get data rows
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header row

        const rowData: ImportRow = {};
        row.eachCell((cell, colNumber) => {
          const header = headers[colNumber - 1];
          if (header) {
            rowData[header] = cell.text || '';
          }
        });
        rows.push(rowData);
      });

      return rows;
    } catch (error) {
      this.logger.error('Failed to parse Excel', error);
      throw new Error(`Failed to parse Excel: ${error}`);
    }
  }

  /**
   * Parse CSV line handling quoted values
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    // Add last field
    result.push(current.trim());
    return result;
  }
}
