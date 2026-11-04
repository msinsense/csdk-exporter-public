import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEstimatedRowCount } from './useEstimatedRowCount';

const { useGetWidgetModel, useExecuteQuery, toExecutePivotQueryParams } = vi.hoisted(() => ({
  useGetWidgetModel: vi.fn(),
  useExecuteQuery: vi.fn(),
  toExecutePivotQueryParams: vi.fn(),
}));

vi.mock('@sisense/sdk-ui', () => ({
  useGetWidgetModel,
  useExecuteQuery,
  widgetModelTranslator: { toExecutePivotQueryParams },
}));

beforeEach(() => {
  useGetWidgetModel.mockReset();
  useExecuteQuery.mockReset();
  toExecutePivotQueryParams.mockReset();
});

describe('useEstimatedRowCount', () => {
  it('does not probe until the widget model has loaded', () => {
    useGetWidgetModel.mockReturnValue({ widget: undefined });
    useExecuteQuery.mockReturnValue({ rowCount: undefined, isLoading: false, isError: false });

    renderHook(() => useEstimatedRowCount('dash-1', 'widget-1', true));

    expect(toExecutePivotQueryParams).not.toHaveBeenCalled();
    expect(useExecuteQuery).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });

  it('flattens rows/columns into dimensions and values into measures, unwrapping Pivot* wrappers', () => {
    const rowAttr = { id: 'attr-region' };
    const colAttr = { attribute: { id: 'attr-year' } }; // PivotAttribute wrapper
    const valueMeasure = { measure: { id: 'measure-revenue' } }; // PivotMeasure wrapper

    useGetWidgetModel.mockReturnValue({ widget: { oid: 'widget-1', widgetType: 'pivot' } });
    toExecutePivotQueryParams.mockReturnValue({
      dataSource: 'Sample ECommerce',
      rows: [rowAttr],
      columns: [colAttr],
      values: [valueMeasure],
      filters: [],
    });
    useExecuteQuery.mockReturnValue({ rowCount: 12345, isLoading: false, isError: false });

    const { result } = renderHook(() => useEstimatedRowCount('dash-1', 'widget-1', true));

    expect(useExecuteQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        dataSource: 'Sample ECommerce',
        dimensions: [rowAttr, colAttr.attribute],
        measures: [valueMeasure.measure],
        count: 1,
        includeRowCount: true,
        enabled: true,
      }),
    );
    expect(result.current.totalRowsEstimate).toBe(12345);
  });

  it('passes extraFilters through to the flat probe query', () => {
    useGetWidgetModel.mockReturnValue({ widget: { oid: 'widget-1', widgetType: 'pivot' } });
    toExecutePivotQueryParams.mockReturnValue({
      dataSource: 'Sample ECommerce',
      rows: [],
      columns: [],
      values: [],
      filters: [{ name: 'widget-filter' }],
    });
    useExecuteQuery.mockReturnValue({ rowCount: undefined, isLoading: false, isError: false });

    renderHook(() =>
      useEstimatedRowCount('dash-1', 'widget-1', true, [{ name: 'picked-filter' } as never]),
    );

    expect(useExecuteQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: [{ name: 'picked-filter' }, { name: 'widget-filter' }],
      }),
    );
  });

  it('is disabled when the caller passes enabled=false, even with a loaded widget', () => {
    useGetWidgetModel.mockReturnValue({ widget: { oid: 'widget-1', widgetType: 'pivot' } });
    toExecutePivotQueryParams.mockReturnValue({
      dataSource: 'Sample ECommerce',
      rows: [],
      columns: [],
      values: [],
      filters: [],
    });
    useExecuteQuery.mockReturnValue({ rowCount: undefined, isLoading: false, isError: false });

    renderHook(() => useEstimatedRowCount('dash-1', 'widget-1', false));

    expect(useGetWidgetModel).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
    expect(useExecuteQuery).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });

  it('returns undefined when the probe errors or the instance does not support includeRowCount', () => {
    useGetWidgetModel.mockReturnValue({ widget: { oid: 'widget-1', widgetType: 'pivot' } });
    toExecutePivotQueryParams.mockReturnValue({
      dataSource: 'Sample ECommerce',
      rows: [],
      columns: [],
      values: [],
      filters: [],
    });
    useExecuteQuery.mockReturnValue({ rowCount: undefined, isLoading: false, isError: true });

    const { result } = renderHook(() => useEstimatedRowCount('dash-1', 'widget-1', true));

    expect(result.current.totalRowsEstimate).toBeUndefined();
    expect(result.current.isError).toBe(true);
  });
});
