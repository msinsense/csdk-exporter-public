import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useExportStore } from '@/store/export-store';
import { ExportProgress, SLOW_REQUEST_NOTICE_MS } from './ExportProgress';

const { useExecuteQuery, useGetWidgetModel, toExecutePivotQueryParams } = vi.hoisted(() => ({
  useExecuteQuery: vi.fn(),
  useGetWidgetModel: vi.fn(),
  toExecutePivotQueryParams: vi.fn(),
}));

vi.mock('@sisense/sdk-ui', () => ({
  useExecuteQuery,
  useGetWidgetModel,
  widgetModelTranslator: {
    toExecutePivotQueryParams,
    toPivotTableWidgetProps: () => ({ dataOptions: { values: [] } }),
  },
}));

const { getUsedJSHeapSizeMB } = vi.hoisted(() => ({
  getUsedJSHeapSizeMB: vi.fn(),
}));
vi.mock('@/lib/metrics', () => ({ getUsedJSHeapSizeMB }));

const initialState = useExportStore.getState();

/**
 * useExecuteQuery backs both the row-count estimate probe (includeRowCount:
 * true) and the actual page fetch (no includeRowCount) — distinguish the two
 * calls the same way the app does.
 */
function isEstimateCall(params: { includeRowCount?: boolean }) {
  return params.includeRowCount === true;
}

beforeEach(() => {
  useExportStore.setState(initialState, true);
  useExportStore.getState().connect({ url: 'https://sisense.example.com', token: 'tok' });
  useExportStore
    .getState()
    .selectDashboard({ oid: 'dash-1', title: 'Sales', dataSource: 'Sample ECommerce' });
  useExportStore.getState().selectWidget({ oid: 'w-1', title: 'Revenue Pivot' });
  useGetWidgetModel.mockReturnValue({ widget: undefined });
  useExecuteQuery.mockReturnValue({
    data: undefined,
    rowCount: undefined,
    isLoading: false,
    isError: false,
  });
  toExecutePivotQueryParams.mockReturnValue({ rows: [], columns: [], values: [], filters: [] });
  getUsedJSHeapSizeMB.mockReturnValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ExportProgress', () => {
  it('shows a start button while idle', () => {
    render(<ExportProgress />);
    expect(screen.getByRole('button', { name: 'Start export' })).toBeInTheDocument();
  });

  it('defaults to Excel, with the 1M-row disclaimer', () => {
    render(<ExportProgress />);
    expect(screen.getByRole('radio', { name: 'Excel (.xlsx)' })).toBeChecked();
    expect(screen.getByRole('note')).toHaveTextContent(
      /Excel holds up to .* rows\. For more, use CSV\./,
    );
  });

  it('picking CSV stores the format and hides the Excel row-limit note', async () => {
    const user = userEvent.setup();
    render(<ExportProgress />);

    await user.click(screen.getByRole('radio', { name: 'CSV (.csv)' }));

    expect(useExportStore.getState().fileFormat).toBe('csv');
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('starts the export when clicked', async () => {
    const user = userEvent.setup();
    render(<ExportProgress />);

    await user.click(screen.getByRole('button', { name: 'Start export' }));

    expect(useExportStore.getState().status).toBe('running');
  });

  it('shows a plain row counter with no percentage/ETA when no estimate is available', () => {
    useExportStore.getState().startExport();
    useExportStore.setState({ rowsExported: 42_000 });
    render(<ExportProgress />);

    expect(screen.getByText(/42,000 rows exported/)).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('shows a percentage bar and ETA when a row-count estimate is available', () => {
    useGetWidgetModel.mockReturnValue({ widget: { oid: 'w-1', widgetType: 'pivot' } });
    useExecuteQuery.mockImplementation((params: { includeRowCount?: boolean }) =>
      isEstimateCall(params)
        ? { rowCount: 100_000, isLoading: false, isError: false }
        : { data: undefined, isLoading: true, isError: false },
    );
    useExportStore.getState().startExport();
    useExportStore.setState({
      rowsExported: 25_000,
      startedAt: Date.now() - 10_000,
      chunkSize: 25_000,
      recentChunkDurationsMs: [1000],
    });

    render(<ExportProgress />);

    expect(screen.getByText(/25,000 \/ ~100,000 rows exported/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText(/25% ·/)).toBeInTheDocument();
    expect(screen.getByText(/remaining/)).toBeInTheDocument();
  });

  it('bases the ETA on the average of recent chunk durations, not the whole run', () => {
    useExportStore.getState().startExport();
    useExportStore.setState({
      rowsExported: 20_000,
      totalRowsEstimate: 60_000,
      startedAt: Date.now() - 60_000,
      chunkSize: 20_000,
      // One slow (cold) chunk followed by two fast ones — a whole-run
      // average would still show a large ETA; a recent-average one should
      // recover once the fast chunks dominate the window.
      recentChunkDurationsMs: [60_000, 1000, 1000],
    });

    render(<ExportProgress />);

    // 2 chunks remaining * avg(60000, 1000, 1000)=20667ms ≈ 41s.
    expect(screen.getByText(/~41s remaining/)).toBeInTheDocument();
  });

  it('shows no ETA yet before any chunk has settled', () => {
    useExportStore.getState().startExport();
    useExportStore.setState({
      rowsExported: 0,
      totalRowsEstimate: 100_000,
      startedAt: Date.now(),
      recentChunkDurationsMs: [],
    });

    render(<ExportProgress />);

    expect(screen.queryByText(/remaining/)).not.toBeInTheDocument();
  });

  it('caps the displayed percentage at 99% while still running', () => {
    useGetWidgetModel.mockReturnValue({ widget: { oid: 'w-1', widgetType: 'pivot' } });
    useExecuteQuery.mockImplementation((params: { includeRowCount?: boolean }) =>
      isEstimateCall(params)
        ? { rowCount: 1000, isLoading: false, isError: false }
        : { data: undefined, isLoading: true, isError: false },
    );
    useExportStore.getState().startExport();
    useExportStore.setState({
      rowsExported: 999,
      startedAt: Date.now() - 1000,
      chunkSize: 1,
      recentChunkDurationsMs: [10],
    });

    render(<ExportProgress />);

    expect(screen.getByText(/99% ·/)).toBeInTheDocument();
  });

  it('falls back to a plain counter once actual rows exceed the estimate', () => {
    useExportStore.getState().startExport();
    // The estimate proved wrong —
    // exactly what the user hit with a large pivot: rows counted past the
    // ~1,000,000 estimate while still running.
    useExportStore.setState({
      rowsExported: 1_200_000,
      totalRowsEstimate: 1_000_000,
      startedAt: Date.now() - 10_000,
    });

    render(<ExportProgress />);

    expect(screen.getByText(/1,200,000 rows exported/)).toBeInTheDocument();
    expect(screen.queryByText(/~1,000,000/)).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText(/remaining/)).not.toBeInTheDocument();
    expect(screen.getByText(/more rows than the initial estimate/)).toBeInTheDocument();
  });

  it('shows a cancel button while running, which stops the export', async () => {
    const user = userEvent.setup();
    useExportStore.getState().startExport();
    render(<ExportProgress />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(useExportStore.getState().status).toBe('idle');
    expect(screen.getByRole('button', { name: 'Start export' })).toBeInTheDocument();
  });

  it('shows a notice once the current page has been pending for a while', async () => {
    vi.useFakeTimers();
    useExportStore.getState().startExport();
    // useExportRun sets currentRequestStartedAt itself on mount — advance
    // real (fake) time past it rather than pre-setting the field, which
    // would just be immediately overwritten.
    render(<ExportProgress />);

    await vi.advanceTimersByTimeAsync(SLOW_REQUEST_NOTICE_MS);

    expect(
      screen.getByText(/taking longer than expected.*don't close this window/i),
    ).toBeInTheDocument();
  });

  it('does not show the slow-request notice for a page that just started', () => {
    useExportStore.getState().startExport();
    useExportStore.setState({ currentRequestStartedAt: Date.now() });

    render(<ExportProgress />);

    expect(screen.queryByText(/taking longer than expected/i)).not.toBeInTheDocument();
  });

  it('shows memory usage when available', () => {
    getUsedJSHeapSizeMB.mockReturnValue(512);
    useExportStore.getState().startExport();

    render(<ExportProgress />);

    expect(screen.getByText('~512 MB memory used')).toBeInTheDocument();
  });

  it('shows an error state with a retry button', () => {
    useExportStore.getState().startExport();
    useExportStore.getState().failExport('network error');
    render(<ExportProgress />);

    expect(screen.getByRole('alert')).toHaveTextContent('network error');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('passes the widget-derived flat query to useExecuteQuery once running', () => {
    useGetWidgetModel.mockReturnValue({ widget: { oid: 'w-1', widgetType: 'pivot' } });
    toExecutePivotQueryParams.mockReturnValue({
      dataSource: 'Sample ECommerce',
      rows: [{ name: 'OrderID' }],
      columns: [],
      values: [],
      filters: [],
    });
    useExportStore.getState().startExport();
    useExportStore.setState({ chunkSize: 20_000 });

    render(<ExportProgress />);

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
});
