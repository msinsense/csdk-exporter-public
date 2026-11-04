import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useExportStore } from '@/store/export-store';
import { WidgetPicker } from './WidgetPicker';

const {
  useGetDashboardModel,
  useGetWidgetModel,
  toPivotTableWidgetProps,
  toExecuteQueryParams,
  toDashboardProps,
  Table,
  FiltersPanel,
} = vi.hoisted(() => ({
  useGetDashboardModel: vi.fn(),
  toDashboardProps: vi.fn(),
  useGetWidgetModel: vi.fn(),
  toPivotTableWidgetProps: vi.fn(),
  toExecuteQueryParams: vi.fn(),
  Table: vi.fn(),
  FiltersPanel: vi.fn(),
}));

vi.mock('@sisense/sdk-ui', () => ({
  useGetDashboardModel,
  useGetWidgetModel,
  widgetModelTranslator: { toPivotTableWidgetProps, toExecuteQueryParams },
  dashboardModelTranslator: { toDashboardProps },
  Table,
  FiltersPanel,
}));

const initialState = useExportStore.getState();

beforeEach(() => {
  useExportStore.setState(initialState, true);
  useExportStore
    .getState()
    .selectDashboard({ oid: 'dash-1', title: 'Sales', dataSource: 'Sample ECommerce' });
  useGetDashboardModel.mockReset();
  useGetWidgetModel.mockReset();
  toPivotTableWidgetProps.mockReset();
  toExecuteQueryParams.mockReset();
  toDashboardProps.mockReset();
  Table.mockReset();
  FiltersPanel.mockReset();

  // Preview-side defaults, so combobox-focused tests below don't crash once
  // a selection re-renders WidgetPicker into the preview branch.
  useGetWidgetModel.mockReturnValue({ widget: undefined, isLoading: false, isError: false });
  toPivotTableWidgetProps.mockReturnValue({ dataOptions: {}, filters: [] });
  useGetDashboardModel.mockReturnValue({ dashboard: undefined, isLoading: true, isError: false });
  toDashboardProps.mockReturnValue({ widgets: [], filters: [] });
  Table.mockReturnValue(null);
  FiltersPanel.mockReturnValue(null);
});

describe('WidgetPicker combobox', () => {
  it('shows only Pivot Table widgets by default, filtering out other widget types', async () => {
    const user = userEvent.setup();
    useGetDashboardModel.mockReturnValue({
      isLoading: false,
      isError: false,
      dashboard: {
        widgets: [
          { oid: 'w-1', title: 'Revenue Pivot', widgetType: 'pivot' },
          { oid: 'w-2', title: 'Revenue Chart', widgetType: 'chart' },
        ],
      },
    });
    render(<WidgetPicker />);

    await user.click(screen.getByRole('combobox', { name: 'Search widgets' }));

    expect(await screen.findByRole('option', { name: 'Revenue Pivot' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Revenue Chart' })).not.toBeInTheDocument();
  });

  it('extracts a friendly message from a Sisense JSON-shaped error', () => {
    useGetDashboardModel.mockReturnValue({
      isLoading: false,
      isError: true,
      error: new Error('{"error":true,"type":500,"details":"Socket disconnected"}'),
      dashboard: undefined,
    });
    render(<WidgetPicker />);
    expect(screen.getByRole('alert')).toHaveTextContent('Socket disconnected');
  });

  it('lists the widget types set in the plugin config, never text widgets', async () => {
    const user = userEvent.setup();
    useExportStore.setState({ widgetTypes: ['tablewidget'] });
    useGetDashboardModel.mockReturnValue({
      isLoading: false,
      isError: false,
      dashboard: {
        widgets: [
          { oid: 'w-1', title: 'Revenue Pivot', widgetType: 'pivot' },
          { oid: 'w-2', title: 'Revenue Table', widgetType: 'chart', chartType: 'table' },
          { oid: 'w-3', title: 'Revenue Bars', widgetType: 'chart', chartType: 'bar' },
          { oid: 'w-4', title: 'Notes', widgetType: 'text' },
        ],
      },
    });
    render(<WidgetPicker />);

    await user.click(screen.getByRole('combobox', { name: 'Search widgets' }));

    expect(await screen.findByRole('option', { name: 'Revenue Table' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Revenue Pivot' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Revenue Bars' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Notes' })).not.toBeInTheDocument();
  });

  it('shows a dedicated message when the dashboard has no widget to export', () => {
    useGetDashboardModel.mockReturnValue({
      isLoading: false,
      isError: false,
      dashboard: { widgets: [{ oid: 'w-2', title: 'Revenue Chart', widgetType: 'chart' }] },
    });
    render(<WidgetPicker />);

    expect(screen.getByText('There is no widget to export in this dashboard.')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('shows the combobox empty state for a search with no matches (widgets do exist)', async () => {
    const user = userEvent.setup();
    useGetDashboardModel.mockReturnValue({
      isLoading: false,
      isError: false,
      dashboard: { widgets: [{ oid: 'w-1', title: 'Revenue Pivot', widgetType: 'pivot' }] },
    });
    render(<WidgetPicker />);

    const input = screen.getByRole('combobox', { name: 'Search widgets' });
    await user.click(input);
    await user.type(input, 'nonexistent');

    expect(await screen.findByText('No widgets found.')).toBeInTheDocument();
  });

  it('selecting a widget stores it and switches the step to its live preview', async () => {
    const user = userEvent.setup();
    useGetDashboardModel.mockReturnValue({
      isLoading: false,
      isError: false,
      dashboard: { widgets: [{ oid: 'w-1', title: 'Revenue Pivot', widgetType: 'pivot' }] },
    });
    render(<WidgetPicker />);

    await user.click(screen.getByRole('combobox', { name: 'Search widgets' }));
    await user.click(await screen.findByRole('option', { name: 'Revenue Pivot' }));

    const state = useExportStore.getState();
    expect(state.widget).toEqual({ oid: 'w-1', title: 'Revenue Pivot' });
    expect(state.step).toBe('widget');
    expect(await screen.findByRole('heading', { name: 'Revenue Pivot' })).toBeInTheDocument();
  });

  it('paginates long lists with a "Show more" control', async () => {
    const user = userEvent.setup();
    const widgets = Array.from({ length: 25 }, (_, i) => ({
      oid: `w-${i}`,
      title: `Pivot ${String(i).padStart(2, '0')}`,
      widgetType: 'pivot',
    }));
    useGetDashboardModel.mockReturnValue({
      isLoading: false,
      isError: false,
      dashboard: { widgets },
    });
    render(<WidgetPicker />);

    await user.click(screen.getByRole('combobox', { name: 'Search widgets' }));

    expect(await screen.findAllByRole('option')).toHaveLength(20);
    expect(screen.getByText('Show 5 more (5 left)')).toBeInTheDocument();

    await user.click(screen.getByText('Show 5 more (5 left)'));
    expect(await screen.findAllByRole('option')).toHaveLength(25);
    expect(screen.queryByText(/Show .* more/)).not.toBeInTheDocument();
  });

  it('shows a fallback name for a widget with a blank title, and stores that fallback on selection', async () => {
    const user = userEvent.setup();
    useGetDashboardModel.mockReturnValue({
      isLoading: false,
      isError: false,
      dashboard: { widgets: [{ oid: 'w-1', title: '', widgetType: 'pivot' }] },
    });
    render(<WidgetPicker />);

    await user.click(screen.getByRole('combobox', { name: 'Search widgets' }));
    const option = await screen.findByRole('option', { name: 'Untitled widget' });
    await user.click(option);

    expect(useExportStore.getState().widget).toEqual({
      oid: 'w-1',
      title: 'Untitled widget',
    });
  });
});

describe('WidgetPicker deep link', () => {
  const dashboard = { widgets: [{ oid: 'w-1', title: 'Revenue Pivot', widgetType: 'pivot' }] };

  it('opens the linked widget preview once the widgets load', async () => {
    useExportStore.setState({ pendingDeepLink: { widgetId: 'w-1' } });
    useGetDashboardModel.mockReturnValue({ isLoading: false, isError: false, dashboard });
    render(<WidgetPicker />);

    expect(useExportStore.getState().widget).toEqual({ oid: 'w-1', title: 'Revenue Pivot' });
    expect(useExportStore.getState().step).toBe('widget');
    expect(useExportStore.getState().pendingDeepLink).toBeNull();
    expect(await screen.findByRole('heading', { name: 'Revenue Pivot' })).toBeInTheDocument();
  });

  it('shows a message and the picker for a widget that is missing or not a pivot', () => {
    useExportStore.setState({ pendingDeepLink: { widgetId: 'w-9' } });
    useGetDashboardModel.mockReturnValue({ isLoading: false, isError: false, dashboard });
    render(<WidgetPicker />);

    expect(screen.getByRole('alert')).toHaveTextContent('Widget "w-9" wasn\'t found');
    expect(useExportStore.getState().widget).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Search widgets' })).toBeInTheDocument();
  });
});

describe('WidgetPicker dashboard filters', () => {
  const dashboard = { widgets: [{ oid: 'w-1', title: 'Revenue Pivot', widgetType: 'pivot' }] };

  it("seeds selectedFilters with the dashboard's own filters once it loads", () => {
    useGetDashboardModel.mockReturnValue({ isLoading: false, isError: false, dashboard });
    toDashboardProps.mockReturnValue({ widgets: [], filters: [{ name: 'dash-filter' }] });
    render(<WidgetPicker />);

    // Filters aren't loaded into the dashboard model unless asked for.
    expect(useGetDashboardModel).toHaveBeenCalledWith(
      expect.objectContaining({ dashboardOid: 'dash-1', includeFilters: true }),
    );
    expect(toDashboardProps).toHaveBeenCalledWith(dashboard);
    expect(useExportStore.getState().selectedFilters).toEqual([{ name: 'dash-filter' }]);
  });

  it("doesn't overwrite filters the user already edited for this dashboard", () => {
    useGetDashboardModel.mockReturnValue({ isLoading: false, isError: false, dashboard });
    toDashboardProps.mockReturnValue({ widgets: [], filters: [{ name: 'dash-filter' }] });
    const { rerender } = render(<WidgetPicker />);

    useExportStore.getState().setFilters([{ name: 'edited' } as never]);
    rerender(<WidgetPicker />);

    expect(useExportStore.getState().selectedFilters).toEqual([{ name: 'edited' }]);
  });

  it('skips dashboard filters saved as an advanced AND/OR relations tree', () => {
    useGetDashboardModel.mockReturnValue({ isLoading: false, isError: false, dashboard });
    toDashboardProps.mockReturnValue({
      widgets: [],
      filters: { operator: 'AND', left: {}, right: {} },
    });
    render(<WidgetPicker />);

    expect(useExportStore.getState().selectedFilters).toEqual([]);
  });
});

describe('WidgetPicker preview', () => {
  beforeEach(() => {
    useExportStore.getState().selectWidget({ oid: 'w-1', title: 'Revenue Pivot' });
    useGetWidgetModel.mockReturnValue({
      widget: { oid: 'w-1', widgetType: 'pivot' } as never,
      isLoading: false,
      isError: false,
    });
  });

  it('fetches the full widget model and renders the live preview as a flat table', () => {
    toPivotTableWidgetProps.mockReturnValue({
      dataSource: 'Sample ECommerce',
      dataOptions: {},
      filters: [],
    });
    render(<WidgetPicker />);

    expect(useGetWidgetModel).toHaveBeenCalledWith(
      expect.objectContaining({ dashboardOid: 'dash-1', widgetOid: 'w-1', enabled: true }),
    );
    expect(Table).toHaveBeenCalled();
  });

  it("merges picked filters ahead of the widget's own filters into the preview", () => {
    useExportStore.setState({ selectedFilters: [{ name: 'picked' } as never] });
    toPivotTableWidgetProps.mockReturnValue({
      dataSource: 'Sample ECommerce',
      dataOptions: {},
      filters: [{ name: 'widget-filter' }],
    });
    render(<WidgetPicker />);

    const props = Table.mock.calls[0][0];
    expect(props.filters).toEqual([{ name: 'picked' }, { name: 'widget-filter' }]);
  });

  it("previews the widget's rows, columns and values as table columns, with its colors", () => {
    toPivotTableWidgetProps.mockReturnValue({
      dataSource: 'Sample ECommerce',
      dataOptions: { rows: ['row'], columns: ['col'], values: ['value'] },
      filters: [],
      styleOptions: { headersColor: true, alternatingRowsColor: true },
    });
    render(<WidgetPicker />);

    const props = Table.mock.calls[0][0];
    expect(props.dataOptions.columns).toEqual(['row', 'col', 'value']);
    expect(props.styleOptions.header.color.enabled).toBe(true);
    expect(props.styleOptions.rows.alternatingColor.enabled).toBe(true);
    expect(props.styleOptions.columns.alternatingColor.enabled).toBe(false);
  });

  it("previews a non-Pivot widget's dimensions and measures as table columns", () => {
    useGetWidgetModel.mockReturnValue({
      widget: { oid: 'w-1', widgetType: 'chart', chartType: 'table' } as never,
      isLoading: false,
      isError: false,
    });
    toExecuteQueryParams.mockReturnValue({
      dataSource: 'Sample ECommerce',
      dimensions: ['dim'],
      measures: ['measure'],
      filters: [{ name: 'widget-filter' }],
    });
    render(<WidgetPicker />);

    const props = Table.mock.calls[0][0];
    expect(props.dataOptions.columns).toEqual(['dim', 'measure']);
    expect(props.filters).toEqual([{ name: 'widget-filter' }]);
    expect(toPivotTableWidgetProps).not.toHaveBeenCalled();
  });

  it("scopes FiltersPanel to the dashboard's data source, starting from selectedFilters", () => {
    useExportStore.setState({ selectedFilters: [{ name: 'picked' } as never] });
    render(<WidgetPicker />);

    const props = FiltersPanel.mock.calls[0][0];
    expect(props.defaultDataSource).toBe('Sample ECommerce');
    expect(props.filters).toEqual([{ name: 'picked' }]);
  });

  it("lists the widget's own saved filters read-only", () => {
    toPivotTableWidgetProps.mockReturnValue({
      dataSource: 'Sample ECommerce',
      dataOptions: {},
      filters: [{ name: 'f1', attribute: { name: 'Country' }, config: { guid: 'g1' } }],
    });
    render(<WidgetPicker />);

    expect(screen.getByText('Widget filters')).toBeInTheDocument();
    expect(screen.getByText('Country')).toBeInTheDocument();
  });

  it('stores filters picked in the panel', () => {
    FiltersPanel.mockImplementation(({ onFiltersChange }) => (
      <button type="button" onClick={() => onFiltersChange([{ name: 'picked-filter' }])}>
        Add filter
      </button>
    ));
    render(<WidgetPicker />);

    screen.getByText('Add filter').click();

    expect(useExportStore.getState().selectedFilters).toEqual([{ name: 'picked-filter' }]);
  });

  it('"Change widget" clears the widget, falling back to the combobox', async () => {
    const user = userEvent.setup();
    useGetDashboardModel.mockReturnValue({
      isLoading: false,
      isError: false,
      dashboard: { widgets: [{ oid: 'w-1', title: 'Revenue Pivot', widgetType: 'pivot' }] },
    });
    render(<WidgetPicker />);

    await user.click(screen.getByRole('button', { name: 'Change widget' }));

    expect(useExportStore.getState().widget).toBeNull();
    expect(await screen.findByRole('combobox', { name: 'Search widgets' })).toBeInTheDocument();
  });

  it('"Continue to export" advances the wizard to the export step', async () => {
    const user = userEvent.setup();
    render(<WidgetPicker />);

    await user.click(screen.getByRole('button', { name: 'Continue to export' }));

    expect(useExportStore.getState().step).toBe('export');
  });
});
