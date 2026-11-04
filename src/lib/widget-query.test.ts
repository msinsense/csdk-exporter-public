import type { WidgetModel } from '@sisense/sdk-ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toValueFormats, toWidgetQueryParams } from './widget-query';

const { toExecutePivotQueryParams, toExecuteQueryParams, toPivotTableWidgetProps } = vi.hoisted(
  () => ({
    toExecutePivotQueryParams: vi.fn(),
    toExecuteQueryParams: vi.fn(),
    toPivotTableWidgetProps: vi.fn(),
  }),
);
vi.mock('@sisense/sdk-ui', () => ({
  widgetModelTranslator: {
    toExecutePivotQueryParams,
    toExecuteQueryParams,
    toPivotTableWidgetProps,
  },
}));

const pivot = { widgetType: 'pivot' } as WidgetModel;
const table = { widgetType: 'chart', chartType: 'table' } as WidgetModel;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('toWidgetQueryParams', () => {
  it('returns undefined until the widget has loaded', () => {
    expect(toWidgetQueryParams(undefined)).toBeUndefined();
  });

  it("flattens a Pivot widget's rows, columns and values", () => {
    toExecutePivotQueryParams.mockReturnValue({
      dataSource: 'Sample ECommerce',
      rows: [{ id: 'region' }],
      columns: [{ attribute: { id: 'year' } }],
      values: [{ measure: { id: 'revenue' } }],
      filters: [{ name: 'widget' }],
    });

    expect(toWidgetQueryParams(pivot, [{ name: 'picked' } as never])).toEqual({
      dataSource: 'Sample ECommerce',
      dimensions: [{ id: 'region' }, { id: 'year' }],
      measures: [{ id: 'revenue' }],
      filters: [{ name: 'picked' }, { name: 'widget' }],
    });
    expect(toExecuteQueryParams).not.toHaveBeenCalled();
  });

  it("uses a non-Pivot widget's own flat query, with the picked filters added", () => {
    toExecuteQueryParams.mockReturnValue({
      dataSource: 'Sample ECommerce',
      dimensions: [{ id: 'region' }],
      measures: [{ id: 'revenue' }],
      filters: [{ name: 'widget' }],
    });

    expect(toWidgetQueryParams(table, [{ name: 'picked' } as never])).toEqual({
      dataSource: 'Sample ECommerce',
      dimensions: [{ id: 'region' }],
      measures: [{ id: 'revenue' }],
      filters: [{ name: 'picked' }, { name: 'widget' }],
    });
    expect(toExecutePivotQueryParams).not.toHaveBeenCalled();
  });

  it('treats missing dimensions or measures as empty', () => {
    toExecuteQueryParams.mockReturnValue({ dataSource: 'Sample ECommerce' });

    expect(toWidgetQueryParams(table)).toMatchObject({ dimensions: [], measures: [] });
  });
});

describe('toValueFormats', () => {
  it("reads each Pivot value's number format", () => {
    const format = { name: 'Currency', symbol: '€' };
    toPivotTableWidgetProps.mockReturnValue({
      dataOptions: { values: [{ numberFormatConfig: format }, { column: {} }] },
    });

    expect(toValueFormats(pivot, 2)).toEqual([format, undefined]);
  });

  it('uses the default format for every measure of a non-Pivot widget', () => {
    expect(toValueFormats(table, 2)).toEqual([undefined, undefined]);
    expect(toPivotTableWidgetProps).not.toHaveBeenCalled();
  });
});
