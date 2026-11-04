import type { Cell, Column, QueryResultData } from '@sisense/sdk-data';
import { describe, expect, it } from 'vitest';
import { chunkToCsv } from './to-csv';

function cell(data: unknown, text?: string): Cell {
  return text === undefined ? { data } : { data, text };
}

function chunk(columns: Column[], rows: Cell[][]): QueryResultData {
  return { columns, rows };
}

const columns: Column[] = [
  { name: 'Region', type: 'text' },
  { name: 'Revenue', type: 'number' },
];

describe('chunkToCsv', () => {
  it('renders the header only when includeHeader is true', () => {
    const result = chunkToCsv(chunk(columns, []), { includeHeader: true });
    expect(result).toBe('Region,Revenue\r\n');
  });

  it('omits the header by default', () => {
    const result = chunkToCsv(chunk(columns, [[cell('West'), cell(1000)]]));
    expect(result).toBe('West,1000\r\n');
  });

  it('prefers the formatted cell.text over the raw cell.data', () => {
    const result = chunkToCsv(chunk(columns, [[cell('West'), cell(1234.5, '$1,234.50')]]));
    expect(result).toBe('West,"$1,234.50"\r\n');
  });

  it('renders null/undefined data as an empty field', () => {
    const result = chunkToCsv(chunk(columns, [[cell(null), cell(undefined)]]));
    expect(result).toBe(',\r\n');
  });

  it('quotes fields containing commas, quotes, or newlines (RFC 4180)', () => {
    const result = chunkToCsv(
      chunk(
        [{ name: 'Note', type: 'text' }],
        [[cell('has, comma')], [cell('has "quote"')], [cell('has\nnewline')]],
      ),
    );
    expect(result).toBe('"has, comma"\r\n"has ""quote"""\r\n"has\nnewline"\r\n');
  });

  it('uses the column title over name in the header when present', () => {
    const result = chunkToCsv(chunk([{ name: 'region', title: 'Region', type: 'text' }], []), {
      includeHeader: true,
    });
    expect(result).toBe('Region\r\n');
  });

  it('joins multiple rows in order', () => {
    const result = chunkToCsv(
      chunk(columns, [
        [cell('West'), cell(1)],
        [cell('East'), cell(2)],
      ]),
    );
    expect(result).toBe('West,1\r\nEast,2\r\n');
  });

  it('returns an empty string for an empty chunk with no header', () => {
    expect(chunkToCsv(chunk(columns, []))).toBe('');
  });
});
