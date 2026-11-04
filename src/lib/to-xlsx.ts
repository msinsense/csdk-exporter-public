import type { Cell, Column, QueryResultData } from '@sisense/sdk-data';
import { strToU8, Zip, ZipDeflate } from 'fflate';
import { cellToText } from '@/lib/to-csv';

/** Excel's per-sheet row limit is 1,048,576 — one of those is the header. */
export const XLSX_MAX_DATA_ROWS = 1_048_575;

// Excel rejects longer cell text.
const MAX_CELL_CHARS = 32_767;

// Characters not allowed in XML 1.0 (control chars other than tab/LF/CR).
// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping them is the point
const INVALID_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

const STATIC_PARTS: [string, string][] = [
  [
    '[Content_Types].xml',
    `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '</Types>',
  ],
  [
    '_rels/.rels',
    `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>',
  ],
  [
    'xl/_rels/workbook.xml.rels',
    `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>',
  ],
];

const SHEET_OPEN = `${XML_HEADER}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`;
const SHEET_END = '</sheetData></worksheet>';

// Colors and widths taken from Sisense's own Pivot Excel export.
const TEXT_COLOR = 'FF5B6372';
const STRIPE_COLOR = 'FFF4F4F8';
const BORDER_COLOR = 'FFCBCED7';
const MIN_COLUMN_WIDTH = 9;
const MAX_COLUMN_WIDTH = 60;

// Fixed cell styles (indexes into cellXfs); each number format adds two more.
const STYLE_TEXT = 1;
const STYLE_TEXT_STRIPED = 2;
const FIRST_FORMAT_STYLE = 3;

const DEFAULT_SHEET_NAME = 'Export';

function escapeXml(value: string): string {
  return value
    .replace(INVALID_XML_CHARS, '')
    .slice(0, MAX_CELL_CHARS)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stringCell(value: string, style: number): string {
  return `<c s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function isNumber(cell: Cell): cell is Cell & { data: number } {
  return typeof cell.data === 'number' && Number.isFinite(cell.data);
}

function rowXml(cells: string[]): string {
  return `<row>${cells.join('')}</row>`;
}

function columnTitle(column: Column): string {
  return column.title ?? column.name;
}

/** Excel sheet names: max 31 chars, none of []:*?/\, not empty. */
export function toSheetName(title: string | undefined): string {
  const name = (title ?? '')
    .replace(/[[\]:*?/\\]/g, ' ')
    .replace(/^'+|'+$/g, '')
    .trim()
    .slice(0, 31)
    .trim();
  return name || DEFAULT_SHEET_NAME;
}

function workbookXml(sheetName: string): string {
  return (
    `${XML_HEADER}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets>` +
    '</workbook>'
  );
}

function stylesXml(formats: string[]): string {
  const numFmts = formats
    .map((code, i) => `<numFmt numFmtId="${164 + i}" formatCode="${escapeXml(code)}"/>`)
    .join('');
  const plain = (numFmtId: number) =>
    `<xf numFmtId="${numFmtId}" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"${numFmtId ? ' applyNumberFormat="1"' : ''}/>`;
  const striped = (numFmtId: number) =>
    `<xf numFmtId="${numFmtId}" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"${numFmtId ? ' applyNumberFormat="1"' : ''}/>`;
  const formatXfs = formats.map((_, i) => plain(164 + i) + striped(164 + i)).join('');
  const thin = `style="thin"><color rgb="${BORDER_COLOR}"/>`;

  return (
    `${XML_HEADER}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    (formats.length > 0 ? `<numFmts count="${formats.length}">${numFmts}</numFmts>` : '') +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>' +
    `<font><sz val="11"/><color rgb="${TEXT_COLOR}"/><name val="Calibri"/></font></fonts>` +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    `<fill><patternFill patternType="solid"><fgColor rgb="${STRIPE_COLOR}"/></patternFill></fill></fills>` +
    '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
    `<border><left ${thin}</left><right ${thin}</right><top ${thin}</top><bottom ${thin}</bottom><diagonal/></border></borders>` +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    `<cellXfs count="${FIRST_FORMAT_STYLE + formats.length * 2}">` +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    plain(0) +
    striped(0) +
    formatXfs +
    '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>'
  );
}

// Rough display width: formatted text for strings, digits plus separators for numbers.
function displayLength(cell: Cell): number {
  if (isNumber(cell)) {
    const digits = String(Math.round(Math.abs(cell.data))).length;
    return digits + Math.floor((digits - 1) / 3) + 3;
  }
  return cellToText(cell).length;
}

function colsXml(columns: Column[], rows: Cell[][]): string {
  const widths = columns.map((column, i) => {
    let longest = columnTitle(column).length;
    for (const row of rows) {
      if (row[i]) longest = Math.max(longest, displayLength(row[i]));
    }
    return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, longest + 2));
  });
  if (widths.length === 0) return '';
  const cols = widths
    .map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`)
    .join('');
  return `<cols>${cols}</cols>`;
}

function concat(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export interface XlsxOptions {
  /** Usually the widget title. Made safe for Excel; defaults to "Export". */
  sheetName?: string;
  /** Excel number format per column (by index); undefined = no format. */
  columnFormats?: (string | undefined)[];
}

export interface XlsxEncoder {
  /** Encodes one query result chunk. Pass `includeHeader: true` only for the first chunk. */
  encodeChunk(
    chunk: QueryResultData,
    options?: { includeHeader?: boolean },
  ): Uint8Array<ArrayBuffer>;
  /** Closes the sheet and the zip — returns the remaining bytes of the file. */
  finish(): Uint8Array<ArrayBuffer>;
}

/**
 * Streams a single-sheet .xlsx file chunk by chunk, so it can be written to
 * disk as it's produced like the CSV path. The workbook is a zip; the sheet
 * is the last entry and is deflated as rows arrive. Cells use inline strings
 * (no shared-strings table), which keeps memory flat at the cost of a
 * somewhat larger file.
 *
 * Styled like Sisense's own Pivot export: grey text, every other data row
 * shaded with thin borders, value columns in the widget's number format.
 * Column widths come from the header and the first chunk, since they must be
 * written before any row.
 */
export function createXlsxEncoder(options: XlsxOptions = {}): XlsxEncoder {
  const columnFormats = options.columnFormats ?? [];
  const formats = [...new Set(columnFormats.filter((f): f is string => Boolean(f)))];
  const columnStyles = columnFormats.map((format) =>
    format ? FIRST_FORMAT_STYLE + formats.indexOf(format) * 2 : undefined,
  );
  let dataRowCount = 0;

  let pending: Uint8Array[] = [];
  const zip = new Zip((err, data) => {
    if (err) throw err;
    pending.push(data);
  });
  let sheet: ZipDeflate | null = null;

  function drain(): Uint8Array<ArrayBuffer> {
    const out = concat(pending);
    pending = [];
    return out;
  }

  function ensureStarted(first?: QueryResultData) {
    if (sheet) return;
    const parts: [string, string][] = [
      ...STATIC_PARTS,
      ['xl/workbook.xml', workbookXml(toSheetName(options.sheetName))],
      ['xl/styles.xml', stylesXml(formats)],
    ];
    for (const [name, content] of parts) {
      const part = new ZipDeflate(name, { level: 6 });
      zip.add(part);
      part.push(strToU8(content), true);
    }
    sheet = new ZipDeflate('xl/worksheets/sheet1.xml', { level: 6 });
    zip.add(sheet);
    const cols = first ? colsXml(first.columns, first.rows) : '';
    sheet.push(strToU8(`${SHEET_OPEN}${cols}<sheetData>`));
  }

  // Numbers stay real numbers so Excel can sum/sort them; everything else
  // uses the same formatted text as the CSV.
  function cellXml(cell: Cell, column: number, striped: boolean): string {
    const formatStyle = columnStyles[column];
    if (isNumber(cell)) {
      const style =
        formatStyle !== undefined
          ? formatStyle + (striped ? 1 : 0)
          : striped
            ? STYLE_TEXT_STRIPED
            : STYLE_TEXT;
      return `<c s="${style}"><v>${cell.data}</v></c>`;
    }
    return stringCell(cellToText(cell), striped ? STYLE_TEXT_STRIPED : STYLE_TEXT);
  }

  return {
    encodeChunk(chunk, chunkOptions = {}) {
      ensureStarted(chunk);
      const rows: string[] = [];
      if (chunkOptions.includeHeader) {
        rows.push(
          rowXml(chunk.columns.map((column) => stringCell(columnTitle(column), STYLE_TEXT))),
        );
      }
      for (const row of chunk.rows) {
        const striped = dataRowCount % 2 === 1;
        dataRowCount += 1;
        rows.push(rowXml(row.map((cell, i) => cellXml(cell, i, striped))));
      }
      if (rows.length > 0) sheet?.push(strToU8(rows.join('')));
      return drain();
    },
    finish() {
      ensureStarted();
      sheet?.push(strToU8(SHEET_END), true);
      zip.end();
      return drain();
    },
  };
}
