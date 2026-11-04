import type { QueryResultData } from '@sisense/sdk-data';
import type { FileChunk } from '@/lib/file-sink';
import { chunkToCsv } from '@/lib/to-csv';
import { createXlsxEncoder, type XlsxOptions } from '@/lib/to-xlsx';
import type { ExportFormat } from '@/types/export';

export interface FileType {
  description: string;
  mimeType: string;
  extension: string;
}

export const FILE_TYPES: Record<ExportFormat, FileType> = {
  csv: { description: 'CSV file', mimeType: 'text/csv', extension: '.csv' },
  xlsx: {
    description: 'Excel workbook',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: '.xlsx',
  },
};

/** Turns query result chunks into file bytes for one export. */
export interface ExportEncoder {
  encodeChunk(chunk: QueryResultData, options?: { includeHeader?: boolean }): FileChunk;
  /** Whatever must be written after the last chunk (empty for CSV). */
  finish(): FileChunk;
}

export function createEncoder(format: ExportFormat, xlsxOptions?: XlsxOptions): ExportEncoder {
  if (format === 'xlsx') return createXlsxEncoder(xlsxOptions);
  return { encodeChunk: chunkToCsv, finish: () => '' };
}
