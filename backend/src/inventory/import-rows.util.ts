/**
 * Rows produced by ImportService.parseCSV / parseExcel: one object per data row,
 * keyed by the header text, every value the cell's text.
 */
export type ImportRow = Record<string, string>;

/**
 * Narrow the parser output to ImportRow[]. The parsers only emit string cell
 * values; anything else (not an array, a non-object row, a non-string value) is
 * dropped rather than trusted.
 */
export function toImportRows(parsed: unknown): ImportRow[] {
  if (!Array.isArray(parsed)) {
    return [];
  }
  const items: unknown[] = parsed;
  return items.map((item) => {
    const row: ImportRow = {};
    if (typeof item === 'object' && item !== null) {
      for (const [header, value] of Object.entries(item)) {
        if (typeof value === 'string') {
          row[header] = value;
        }
      }
    }
    return row;
  });
}

/**
 * The first non-empty value among the given header spellings, matching the
 * `row.a || row.A || row['Long A']` lookups this replaces.
 */
export function firstFilled(
  row: ImportRow,
  ...headers: string[]
): string | undefined {
  for (const header of headers) {
    const value = row[header];
    if (value) {
      return value;
    }
  }
  return undefined;
}
