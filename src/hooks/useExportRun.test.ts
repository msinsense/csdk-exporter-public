import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useExportStore } from '@/store/export-store';
import { FALLBACK_ROW_CAP, resetExportSink, STALL_TIMEOUT_MS, useExportRun } from './useExportRun';

const { useExecuteQuery, useGetWidgetModel, toExecutePivotQueryParams, toPivotTableWidgetProps } =
  vi.hoisted(() => ({
    useExecuteQuery: vi.fn(),
    useGetWidgetModel: vi.fn(),
    toExecutePivotQueryParams: vi.fn(),
    toPivotTableWidgetProps: vi.fn(),
  }));
vi.mock('@sisense/sdk-ui', () => ({
  useExecuteQuery,
  useGetWidgetModel,
  widgetModelTranslator: { toExecutePivotQueryParams, toPivotTableWidgetProps },
}));

const { open, writeChunk, close, getFileName } = vi.hoisted(() => ({
  open: vi.fn().mockResolvedValue(undefined),
  writeChunk: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  getFileName: vi.fn().mockReturnValue('export.csv'),
}));
vi.mock('@/lib/file-sink', () => ({
  createFileSink: () => ({ open, writeChunk, close, getFileName }),
}));

// Small enough to hit in a test; only affects XLSX exports.
vi.mock('@/lib/to-xlsx', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/to-xlsx')>()),
  XLSX_MAX_DATA_ROWS: 3,
}));

const initialState = useExportStore.getState();

function page(rows: number, offset: number) {
  return {
    columns: [{ name: 'Region', type: 'text' }],
    rows: Array.from({ length: rows }, (_, i) => [{ data: `Row ${offset + i}` }]),
  };
}

beforeEach(() => {
  useExportStore.setState(initialState, true);
  // Most tests assert on CSV text output.
  useExportStore.setState({ fileFormat: 'csv' });
  useExecuteQuery.mockReset();
  useGetWidgetModel.mockReturnValue({
    widget: { oid: 'w-1', title: 'Revenue Pivot', widgetType: 'pivot' },
  });
  toPivotTableWidgetProps.mockReturnValue({ dataOptions: { values: [] } });
  toExecutePivotQueryParams.mockReturnValue({
    dataSource: 'Sample ECommerce',
    rows: [{ name: 'Region' }],
    columns: [],
    values: [],
    filters: [],
  });
  open.mockClear();
  writeChunk.mockClear();
  close.mockClear();
  getFileName.mockReturnValue('export.csv');
  resetExportSink();
  close.mockClear(); // resetExportSink() itself calls close() on any leftover sink
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useExportRun', () => {
  it('does nothing while status is idle', () => {
    useExecuteQuery.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    renderHook(() => useExportRun('dash-1', 'widget-1'));

    expect(open).not.toHaveBeenCalled();
    expect(useExecuteQuery).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });

  it('does not query until the widget model has resolved', () => {
    useGetWidgetModel.mockReturnValue({ widget: undefined });
    useExecuteQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    useExportStore.getState().startExport();

    renderHook(() => useExportRun('dash-1', 'widget-1'));

    expect(useExecuteQuery).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });

  it('passes the widget-derived dimensions/measures/filters plus offset/count to useExecuteQuery', () => {
    toExecutePivotQueryParams.mockReturnValue({
      dataSource: 'Sample ECommerce',
      rows: [{ name: 'OrderID' }],
      columns: [],
      values: [],
      filters: [],
    });
    useExecuteQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    useExportStore.setState({ chunkSize: 20_000 });
    useExportStore.getState().startExport();

    renderHook(() => useExportRun('dash-1', 'widget-1'));

    expect(useExecuteQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        dataSource: 'Sample ECommerce',
        dimensions: [{ name: 'OrderID' }],
        offset: 0,
        count: 20_000,
        enabled: true,
      }),
    );
  });

  it("merges filters picked in the widget step's filters panel ahead of the widget's own filters", () => {
    toExecutePivotQueryParams.mockReturnValue({
      dataSource: 'Sample ECommerce',
      rows: [],
      columns: [],
      values: [],
      filters: [{ name: 'widget-filter' }],
    });
    useExecuteQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    useExportStore.setState({ selectedFilters: [{ name: 'picked-filter' } as never] });
    useExportStore.getState().startExport();

    renderHook(() => useExportRun('dash-1', 'widget-1'));

    expect(useExecuteQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: [{ name: 'picked-filter' }, { name: 'widget-filter' }],
      }),
    );
  });

  it('writes a single short page (fewer rows than chunkSize) and finishes', async () => {
    useExportStore.setState({ chunkSize: 5 });
    useExecuteQuery.mockReturnValue({
      data: page(3, 0),
      isLoading: false,
      isError: false,
    });
    useExportStore.getState().startExport();

    renderHook(() => useExportRun('dash-1', 'widget-1'));

    await waitFor(() => expect(useExportStore.getState().status).toBe('done'));

    expect(open).toHaveBeenCalledWith('export.csv', expect.objectContaining({ extension: '.csv' }));
    expect(writeChunk).toHaveBeenCalledOnce();
    expect(writeChunk.mock.calls[0][0]).toContain('Region');
    expect(close).toHaveBeenCalledOnce();
    expect(useExportStore.getState().rowsExported).toBe(3);
  });

  it('captures the actual saved file name once the sink opens', async () => {
    getFileName.mockReturnValue('my-export.csv');
    useExportStore.setState({ chunkSize: 5 });
    useExecuteQuery.mockReturnValue({ data: page(3, 0), isLoading: false, isError: false });
    useExportStore.getState().startExport();

    renderHook(() => useExportRun('dash-1', 'widget-1'));

    await waitFor(() => expect(useExportStore.getState().exportedFileName).toBe('my-export.csv'));
  });

  it('records how long a settled chunk took, for the ETA average', async () => {
    useExportStore.setState({ chunkSize: 2 });
    // Only the first page resolves (a full page); the next stays pending —
    // otherwise a static full-page mock never produces the short/terminal
    // page needed to stop the export from advancing forever.
    useExecuteQuery.mockImplementation(({ offset }: { offset: number }) =>
      offset === 0
        ? { data: page(2, 0), isLoading: false, isError: false }
        : { data: undefined, isLoading: true, isError: false },
    );
    useExportStore.getState().startExport();

    renderHook(() => useExportRun('dash-1', 'widget-1'));

    await waitFor(() => expect(useExportStore.getState().recentChunkDurationsMs).toHaveLength(1));
    expect(useExportStore.getState().recentChunkDurationsMs[0]).toBeGreaterThanOrEqual(0);
  });

  it('sets currentRequestStartedAt when a new page is requested', () => {
    useExecuteQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    useExportStore.getState().startExport();

    renderHook(() => useExportRun('dash-1', 'widget-1'));

    expect(useExportStore.getState().currentRequestStartedAt).not.toBeNull();
  });

  it('advances offset across full pages and stops on a short final page', async () => {
    useExportStore.setState({ chunkSize: 2 });
    useExecuteQuery.mockImplementation(({ offset }: { offset: number }) => {
      if (offset === 0) return { data: page(2, 0), isLoading: false, isError: false };
      if (offset === 2) return { data: page(1, 2), isLoading: false, isError: false };
      return { data: undefined, isLoading: true, isError: false };
    });
    useExportStore.getState().startExport();

    renderHook(() => useExportRun('dash-1', 'widget-1'));

    await waitFor(() => expect(useExportStore.getState().status).toBe('done'));

    expect(writeChunk).toHaveBeenCalledTimes(2);
    expect(writeChunk.mock.calls[0][0]).toContain('Region'); // header on first chunk
    expect(writeChunk.mock.calls[1][0]).not.toContain('Region'); // no repeated header
    expect(close).toHaveBeenCalledOnce();
    expect(useExportStore.getState().rowsExported).toBe(3);
  });

  describe('xlsx', () => {
    it('opens an .xlsx file and writes zip bytes, finished with the zip footer', async () => {
      useExportStore.setState({ chunkSize: 5, fileFormat: 'xlsx' });
      useExecuteQuery.mockReturnValue({ data: page(2, 0), isLoading: false, isError: false });
      useExportStore.getState().startExport();

      renderHook(() => useExportRun('dash-1', 'widget-1'));

      await waitFor(() => expect(useExportStore.getState().status).toBe('done'));
      expect(open).toHaveBeenCalledWith(
        'export.xlsx',
        expect.objectContaining({ extension: '.xlsx' }),
      );
      expect(writeChunk).toHaveBeenCalledTimes(2); // rows, then the zip footer
      expect(writeChunk.mock.calls[0][0]).toBeInstanceOf(Uint8Array);
      expect(close).toHaveBeenCalledOnce();
      expect(useExportStore.getState().truncatedAtRowLimit).toBe(false);
    });

    it("stops at Excel's row limit and flags the export as truncated", async () => {
      useExportStore.setState({ chunkSize: 2, fileFormat: 'xlsx' });
      useExecuteQuery.mockImplementation(({ offset }: { offset: number }) => ({
        data: page(2, offset),
        isLoading: false,
        isError: false,
      }));
      useExportStore.getState().startExport();

      renderHook(() => useExportRun('dash-1', 'widget-1'));

      await waitFor(() => expect(useExportStore.getState().status).toBe('done'));
      expect(useExportStore.getState().rowsExported).toBe(3);
      expect(useExportStore.getState().truncatedAtRowLimit).toBe(true);
      expect(close).toHaveBeenCalledOnce();
    });

    it('does not truncate CSV exports at the XLSX limit', async () => {
      useExportStore.setState({ chunkSize: 2 });
      useExecuteQuery.mockImplementation(({ offset }: { offset: number }) => ({
        data: offset < 6 ? page(2, offset) : page(0, offset),
        isLoading: false,
        isError: false,
      }));
      useExportStore.getState().startExport();

      renderHook(() => useExportRun('dash-1', 'widget-1'));

      await waitFor(() => expect(useExportStore.getState().status).toBe('done'));
      expect(useExportStore.getState().rowsExported).toBe(6);
      expect(useExportStore.getState().truncatedAtRowLimit).toBe(false);
    });
  });

  it('fails the export when the query errors', async () => {
    useExecuteQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('boom'),
    });
    useExportStore.getState().startExport();

    renderHook(() => useExportRun('dash-1', 'widget-1'));

    await waitFor(() => expect(useExportStore.getState().status).toBe('error'));
    expect(useExportStore.getState().error).toBe('boom');
  });

  it('extracts a friendly message from a Sisense JSON-shaped error', async () => {
    useExecuteQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('{"error":true,"type":500,"details":"Socket disconnected"}'),
    });
    useExportStore.getState().startExport();

    renderHook(() => useExportRun('dash-1', 'widget-1'));

    await waitFor(() => expect(useExportStore.getState().status).toBe('error'));
    expect(useExportStore.getState().error).toBe('Socket disconnected');
  });

  it('fails with a stall message when nothing happens for the timeout period', async () => {
    vi.useFakeTimers();
    useExecuteQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    useExportStore.getState().startExport();

    renderHook(() => useExportRun('dash-1', 'widget-1'));

    await vi.advanceTimersByTimeAsync(STALL_TIMEOUT_MS);

    expect(useExportStore.getState().status).toBe('error');
    expect(useExportStore.getState().error).toMatch(/connection may have/);
  });

  it('resets the stall timer on real progress, so it only fires after a subsequent silent period', async () => {
    vi.useFakeTimers();
    useExportStore.setState({ chunkSize: 2 });
    useExecuteQuery.mockImplementation(({ offset }: { offset: number }) => {
      if (offset === 0) return { data: page(2, 0), isLoading: false, isError: false };
      return { data: undefined, isLoading: true, isError: false };
    });
    useExportStore.getState().startExport();

    renderHook(() => useExportRun('dash-1', 'widget-1'));
    await vi.advanceTimersByTimeAsync(0); // let the first page resolve and advance offset

    expect(useExportStore.getState().offset).toBe(2);

    await vi.advanceTimersByTimeAsync(STALL_TIMEOUT_MS - 5_000);
    expect(useExportStore.getState().status).toBe('running');

    await vi.advanceTimersByTimeAsync(6_000);
    expect(useExportStore.getState().status).toBe('error');
  });

  describe('runaway-export safety cap', () => {
    it('fails once rows exported clearly overshoot the row-count estimate', async () => {
      useExportStore.setState({ chunkSize: 100 });
      useExecuteQuery.mockImplementation(({ offset }: { offset: number }) => ({
        data: page(100, offset),
        isLoading: false,
        isError: false,
      }));
      useExportStore.getState().startExport();
      // startExport() resets totalRowsEstimate to null — set it after, as it
      // would realistically arrive: the probe resolving after export starts.
      useExportStore.setState({ totalRowsEstimate: 100 });

      renderHook(() => useExportRun('dash-1', 'widget-1'));

      // Cap is 3x the estimate (300); a pagination bug that never produces a
      // genuine short page keeps this running forever without the cap. The
      // exact stopping point can land a chunk or two past the cap (the mock
      // resolves instantly, letting more than one page settle before the
      // failed status propagates) — what matters is that it stops at all,
      // past the cap, without crashing or looping forever.
      await waitFor(() => expect(useExportStore.getState().status).toBe('error'));
      expect(useExportStore.getState().error).toMatch(/pagination problem/);
      expect(useExportStore.getState().rowsExported).toBeGreaterThan(300);
      expect(useExportStore.getState().rowsExported).toBeLessThan(1000);
      expect(close).toHaveBeenCalledOnce(); // partial file finalized, not left dangling
    });

    it('falls back to a large absolute cap when no row-count estimate is available', async () => {
      useExportStore.setState({
        chunkSize: 10,
        offset: FALLBACK_ROW_CAP - 5,
        rowsExported: FALLBACK_ROW_CAP - 5,
      });
      useExecuteQuery.mockReturnValue({
        data: page(10, FALLBACK_ROW_CAP - 5),
        isLoading: false,
        isError: false,
      });
      useExportStore.getState().startExport();
      // startExport() resets offset/rowsExported to 0 — re-apply the
      // near-the-cap position after it, as if this were deep into a long run.
      useExportStore.setState({ offset: FALLBACK_ROW_CAP - 5, rowsExported: FALLBACK_ROW_CAP - 5 });

      renderHook(() => useExportRun('dash-1', 'widget-1'));

      await waitFor(() => expect(useExportStore.getState().status).toBe('error'));
      expect(useExportStore.getState().error).toMatch(/pagination problem/);
    });

    it('does not fail an export that is progressing normally within the cap', async () => {
      useExportStore.setState({ chunkSize: 5 });
      useExecuteQuery.mockReturnValue({ data: page(3, 0), isLoading: false, isError: false });
      useExportStore.getState().startExport();
      useExportStore.setState({ totalRowsEstimate: 100 });

      renderHook(() => useExportRun('dash-1', 'widget-1'));

      await waitFor(() => expect(useExportStore.getState().status).toBe('done'));
    });

    it('does not double-write a chunk when the row-count estimate arrives after it already settled', async () => {
      useExportStore.setState({ chunkSize: 5 });
      useExecuteQuery.mockReturnValue({ data: page(3, 0), isLoading: false, isError: false });
      useExportStore.getState().startExport();

      renderHook(() => useExportRun('dash-1', 'widget-1'));
      await waitFor(() => expect(useExportStore.getState().status).toBe('done'));
      expect(writeChunk).toHaveBeenCalledOnce();

      // An estimate arriving after the export already finished must not
      // trigger a re-run of the write effect (it's not a dependency of it).
      useExportStore.getState().setTotalRowsEstimate(1_000_000);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(writeChunk).toHaveBeenCalledOnce();
      expect(close).toHaveBeenCalledOnce();
    });
  });

  describe('resetExportSink', () => {
    it('makes the next export open a fresh file instead of reusing a stale handle', async () => {
      useExportStore.setState({ chunkSize: 5 });
      useExecuteQuery.mockReturnValue({
        data: page(3, 0),
        isLoading: false,
        isError: false,
      });
      useExportStore.getState().startExport();

      const { unmount } = renderHook(() => useExportRun('dash-1', 'widget-1'));
      await waitFor(() => expect(useExportStore.getState().status).toBe('done'));
      expect(open).toHaveBeenCalledOnce();
      unmount();

      // A deliberate new attempt (what ExportProgress's "Start export"/"Retry"
      // buttons do) resets the sink first.
      resetExportSink();
      useExportStore.getState().startExport();
      renderHook(() => useExportRun('dash-1', 'widget-1'));

      await waitFor(() => expect(useExportStore.getState().status).toBe('done'));
      expect(open).toHaveBeenCalledTimes(2);
    });
  });

  describe('cancel', () => {
    it('closes and clears the sink once status leaves running without finishing/failing', async () => {
      useExportStore.setState({ chunkSize: 5 });
      // Only the first page resolves (a full page, so the export keeps
      // running) — the next one stays pending forever, like a real request
      // that just hasn't settled yet when cancel is clicked.
      useExecuteQuery.mockImplementation(({ offset }: { offset: number }) =>
        offset === 0
          ? { data: page(5, 0), isLoading: false, isError: false }
          : { data: undefined, isLoading: true, isError: false },
      );
      useExportStore.getState().startExport();

      const { rerender } = renderHook(() => useExportRun('dash-1', 'widget-1'));
      await waitFor(() => expect(open).toHaveBeenCalledOnce());
      close.mockClear();

      useExportStore.getState().cancelExport();
      rerender();

      await waitFor(() => expect(close).toHaveBeenCalledOnce());
    });
  });
});
