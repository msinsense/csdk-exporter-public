import { describe, expect, it } from 'vitest';
import { toExcelNumberFormat } from './excel-number-format';

describe('toExcelNumberFormat', () => {
  it("matches Sisense's own export for the default (auto decimals, thousands separator)", () => {
    expect(toExcelNumberFormat()).toBe('#,##0.0#');
    expect(toExcelNumberFormat({ decimalScale: 'auto' })).toBe('#,##0.0#');
  });

  it('uses a fixed number of decimals', () => {
    expect(toExcelNumberFormat({ decimalScale: 2 })).toBe('#,##0.00');
    expect(toExcelNumberFormat({ decimalScale: 0 })).toBe('#,##0');
  });

  it('drops the thousands separator when turned off', () => {
    expect(toExcelNumberFormat({ decimalScale: 1, thousandSeparator: false })).toBe('0.0');
  });

  it('formats percentages', () => {
    expect(toExcelNumberFormat({ name: 'Percent', decimalScale: 1 })).toBe('#,##0.0%');
  });

  it('formats currency with the symbol before or after the number', () => {
    expect(toExcelNumberFormat({ name: 'Currency', symbol: '$', decimalScale: 2 })).toBe(
      '"$"#,##0.00',
    );
    expect(
      toExcelNumberFormat({ name: 'Currency', symbol: '€', prefix: false, decimalScale: 2 }),
    ).toBe('#,##0.00"€"');
  });

  it('ignores abbreviations, since the cell keeps the full value', () => {
    expect(toExcelNumberFormat({ decimalScale: 0, kilo: true, million: true })).toBe('#,##0');
  });
});
