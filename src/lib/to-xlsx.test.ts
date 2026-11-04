import type { Cell, Column, QueryResultData } from '@sisense/sdk-data';
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { createXlsxEncoder, toSheetName } from './to-xlsx';

const columns: Column[] = [
  { name: 'region', title: 'Region', type: 'text' },
  { name: 'Revenue', type: 'number' },
];

function chunk(rows: Cell[][]): QueryResultData {
  return { columns, rows };
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function part(parts: Uint8Array[], name: string): string {
  return strFromU8(unzipSync(concat(parts))[name]);
}

function sheetXml(parts: Uint8Array[]): string {
  return part(parts, 'xl/worksheets/sheet1.xml');
}

describe('createXlsxEncoder', () => {
  it('produces a valid zip with the workbook parts and the sheet', () => {
    const encoder = createXlsxEncoder();
    const parts = [encoder.encodeChunk(chunk([]), { includeHeader: true }), encoder.finish()];

    const files = unzipSync(concat(parts));
    expect(Object.keys(files)).toEqual(
      expect.arrayContaining([
        '[Content_Types].xml',
        '_rels/.rels',
        'xl/workbook.xml',
        'xl/_rels/workbook.xml.rels',
        'xl/styles.xml',
        'xl/worksheets/sheet1.xml',
      ]),
    );
  });

  it('writes the header once, then rows from every chunk in order', () => {
    const encoder = createXlsxEncoder();
    const parts = [
      encoder.encodeChunk(chunk([[{ data: 'West' }, { data: 1 }]]), { includeHeader: true }),
      encoder.encodeChunk(chunk([[{ data: 'East' }, { data: 2 }]])),
      encoder.finish(),
    ];

    const xml = sheetXml(parts);
    expect(xml.match(/<row>/g)).toHaveLength(3);
    expect(xml.indexOf('Region')).toBeLessThan(xml.indexOf('West'));
    expect(xml.indexOf('West')).toBeLessThan(xml.indexOf('East'));
    expect(xml.endsWith('</sheetData></worksheet>')).toBe(true);
  });

  it('writes numbers as numeric cells and everything else as formatted text', () => {
    const encoder = createXlsxEncoder();
    const parts = [
      encoder.encodeChunk(chunk([[{ data: '2024-01-01', text: 'Jan 2024' }, { data: 1234.5 }]])),
      encoder.finish(),
    ];

    const xml = sheetXml(parts);
    expect(xml).toContain('<c s="1"><v>1234.5</v></c>');
    expect(xml).toContain('Jan 2024');
  });

  it('escapes XML special characters and strips invalid control characters', () => {
    const encoder = createXlsxEncoder();
    const parts = [
      encoder.encodeChunk(chunk([[{ data: 'A & B <c> "d"\u0001' }, { data: null }]])),
      encoder.finish(),
    ];

    const xml = sheetXml(parts);
    expect(xml).toContain('A &amp; B &lt;c&gt; &quot;d&quot;</t>');
  });

  it('still produces a valid file when finished before any chunk', () => {
    const encoder = createXlsxEncoder();
    expect(sheetXml([encoder.finish()])).toContain('<sheetData></sheetData>');
  });

  it('applies each column number format to its numeric cells', () => {
    const encoder = createXlsxEncoder({ columnFormats: [undefined, '#,##0.0#'] });
    const parts = [encoder.encodeChunk(chunk([[{ data: 7 }, { data: 1234.5 }]])), encoder.finish()];

    expect(part(parts, 'xl/styles.xml')).toContain(
      '<numFmt numFmtId="164" formatCode="#,##0.0#"/>',
    );
    // Dimension column: grey text style; value column: its number format style.
    expect(sheetXml(parts)).toContain('<c s="1"><v>7</v></c><c s="3"><v>1234.5</v></c>');
  });

  it('shades every other data row, across chunks', () => {
    const encoder = createXlsxEncoder({ columnFormats: [undefined, '0.00'] });
    const parts = [
      encoder.encodeChunk(chunk([[{ data: 'A' }, { data: 1 }]]), { includeHeader: true }),
      encoder.encodeChunk(chunk([[{ data: 'B' }, { data: 2 }]])),
      encoder.encodeChunk(chunk([[{ data: 'C' }, { data: 3 }]])),
      encoder.finish(),
    ];

    const styles = [...sheetXml(parts).matchAll(/<c s="(\d+)"/g)].map((m) => m[1]);
    // Header, then rows A (plain), B (striped), C (plain).
    expect(styles).toEqual(['1', '1', '1', '3', '2', '4', '1', '3']);
  });

  it('sizes columns from the header and the first chunk', () => {
    const encoder = createXlsxEncoder();
    const parts = [
      encoder.encodeChunk(chunk([[{ data: 'A much longer region name' }, { data: 1 }]]), {
        includeHeader: true,
      }),
      encoder.finish(),
    ];

    const xml = sheetXml(parts);
    expect(xml).toContain('<col min="1" max="1" width="27" customWidth="1"/>');
    expect(xml).toContain('<col min="2" max="2" width="9" customWidth="1"/>');
    expect(xml.indexOf('<cols>')).toBeLessThan(xml.indexOf('<sheetData>'));
  });

  it('names the sheet after the widget', () => {
    const encoder = createXlsxEncoder({ sheetName: 'Half 1M Pivot' });
    const parts = [encoder.finish()];
    expect(part(parts, 'xl/workbook.xml')).toContain('<sheet name="Half 1M Pivot"');
  });
});

describe('toSheetName', () => {
  it('removes characters Excel rejects and caps the length at 31', () => {
    expect(toSheetName('Sales [2024]: Q1/Q2?')).toBe('Sales  2024   Q1 Q2');
    expect(toSheetName('x'.repeat(40))).toHaveLength(31);
  });

  it('falls back to "Export" when there is no usable name', () => {
    expect(toSheetName(undefined)).toBe('Export');
    expect(toSheetName(' :: ')).toBe('Export');
  });
});
