import type { NumberFormatConfig } from '@sisense/sdk-ui';

// What Sisense's own Excel export uses for 'auto' decimals.
const AUTO_DECIMALS = '0.0#';

function quote(text: string): string {
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * Turns a Sisense widget value's number format into an Excel number format
 * code. Abbreviations (1K, 1M, ...) are left out on purpose: the cell keeps
 * the full value, like Sisense's own export.
 */
export function toExcelNumberFormat(config: NumberFormatConfig = {}): string {
  const { decimalScale = 'auto', thousandSeparator = true, name = 'Numbers' } = config;

  const integer = thousandSeparator ? '#,##0' : '0';
  let decimals = AUTO_DECIMALS.slice(1);
  if (typeof decimalScale === 'number') {
    const places = Math.max(0, Math.min(30, Math.floor(decimalScale)));
    decimals = places > 0 ? `.${'0'.repeat(places)}` : '';
  }
  const number = `${integer}${decimals}`;

  if (name === 'Percent') return `${number}%`;
  if (name === 'Currency') {
    const symbol = quote(config.symbol ?? '$');
    return config.prefix === false ? `${number}${symbol}` : `${symbol}${number}`;
  }
  return number;
}

/**
 * Excel number format per export column: none for the dimension columns
 * (they come first in the flat query), then each value's own format.
 */
export function toColumnFormats(
  dimensionCount: number,
  valueFormats: (NumberFormatConfig | undefined)[] = [],
): (string | undefined)[] {
  return [
    ...Array.from({ length: dimensionCount }, () => undefined),
    ...valueFormats.map((config) => toExcelNumberFormat(config)),
  ];
}
