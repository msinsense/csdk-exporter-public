import type { Cell, Column, QueryResultData } from '@sisense/sdk-data';

const CRLF = '\r\n';
const NEEDS_QUOTING = /["\n\r,]/;

/** RFC 4180 field quoting: wrap in quotes and double any embedded quotes. */
function csvEscape(value: string): string {
  return NEEDS_QUOTING.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * A query result cell's display-formatted value, falling back to the raw
 * value when no formatted text is present. Compose SDK already returns
 * formatted values via `cell.text`.
 */
export function cellToText(cell: Cell): string {
  if (cell.text !== undefined) return cell.text;
  if (cell.data === null || cell.data === undefined) return '';
  return String(cell.data);
}

function columnsToCsvLine(columns: Column[]): string {
  return columns.map((column) => csvEscape(column.title ?? column.name)).join(',');
}

function rowToCsvLine(row: Cell[]): string {
  return row.map((cell) => csvEscape(cellToText(cell))).join(',');
}

/**
 * Converts one query result chunk to CSV text. Pass `includeHeader: true` only
 * for the first chunk of an export — later chunks should not repeat the header.
 */
export function chunkToCsv(
  chunk: QueryResultData,
  options: { includeHeader?: boolean } = {},
): string {
  const lines: string[] = [];
  if (options.includeHeader) {
    lines.push(columnsToCsvLine(chunk.columns));
  }
  for (const row of chunk.rows) {
    lines.push(rowToCsvLine(row));
  }
  return lines.length > 0 ? lines.join(CRLF) + CRLF : '';
}
