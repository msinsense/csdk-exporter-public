import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useExportStore } from '@/store/export-store';
import { DashboardPicker } from './DashboardPicker';

const { useGetDashboardModels } = vi.hoisted(() => ({
  useGetDashboardModels: vi.fn(),
}));

vi.mock('@sisense/sdk-ui', () => ({ useGetDashboardModels }));

const initialState = useExportStore.getState();

beforeEach(() => {
  useExportStore.setState(initialState, true);
  useGetDashboardModels.mockReset();
});

describe('DashboardPicker', () => {
  it('shows a loading state', () => {
    useGetDashboardModels.mockReturnValue({
      isLoading: true,
      isError: false,
      dashboards: undefined,
    });
    render(<DashboardPicker />);
    expect(screen.getByText('Loading dashboards…')).toBeInTheDocument();
  });

  it('shows an error state', () => {
    useGetDashboardModels.mockReturnValue({
      isLoading: false,
      isError: true,
      error: new Error('network down'),
      dashboards: undefined,
    });
    render(<DashboardPicker />);
    expect(screen.getByRole('alert')).toHaveTextContent('network down');
  });

  it('extracts a friendly message from a Sisense JSON-shaped error', () => {
    useGetDashboardModels.mockReturnValue({
      isLoading: false,
      isError: true,
      error: new Error('{"error":true,"type":500,"details":"Socket disconnected"}'),
      dashboards: undefined,
    });
    render(<DashboardPicker />);
    expect(screen.getByRole('alert')).toHaveTextContent('Socket disconnected');
  });

  it('opens on click and lists dashboards, filtering as you type', async () => {
    const user = userEvent.setup();
    useGetDashboardModels.mockReturnValue({
      isLoading: false,
      isError: false,
      dashboards: [
        { oid: 'dash-1', title: 'Sales' },
        { oid: 'dash-2', title: 'Marketing' },
      ],
    });
    render(<DashboardPicker />);

    const input = screen.getByRole('combobox', { name: 'Search dashboards' });
    await user.click(input);

    expect(await screen.findByRole('option', { name: 'Sales' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Marketing' })).toBeInTheDocument();

    await user.type(input, 'mark');
    expect(screen.queryByRole('option', { name: 'Sales' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Marketing' })).toBeInTheDocument();
  });

  it('selecting a dashboard advances the wizard to the widget step, carrying its data source', async () => {
    const user = userEvent.setup();
    useGetDashboardModels.mockReturnValue({
      isLoading: false,
      isError: false,
      dashboards: [{ oid: 'dash-1', title: 'Sales', dataSource: 'Sample ECommerce' }],
    });
    render(<DashboardPicker />);

    await user.click(screen.getByRole('combobox', { name: 'Search dashboards' }));
    await user.click(await screen.findByRole('option', { name: 'Sales' }));

    const state = useExportStore.getState();
    expect(state.dashboard).toEqual({
      oid: 'dash-1',
      title: 'Sales',
      dataSource: 'Sample ECommerce',
    });
    expect(state.step).toBe('widget');
  });

  it('paginates long lists with a "Show more" control', async () => {
    const user = userEvent.setup();
    const dashboards = Array.from({ length: 45 }, (_, i) => ({
      oid: `dash-${i}`,
      title: `Dashboard ${String(i).padStart(2, '0')}`,
    }));
    useGetDashboardModels.mockReturnValue({ isLoading: false, isError: false, dashboards });
    render(<DashboardPicker />);

    await user.click(screen.getByRole('combobox', { name: 'Search dashboards' }));

    expect(await screen.findAllByRole('option')).toHaveLength(20);
    expect(screen.getByText('Show 20 more (25 left)')).toBeInTheDocument();

    await user.click(screen.getByText('Show 20 more (25 left)'));
    expect(await screen.findAllByRole('option')).toHaveLength(40);
    expect(screen.getByText('Show 5 more (5 left)')).toBeInTheDocument();

    await user.click(screen.getByText('Show 5 more (5 left)'));
    expect(await screen.findAllByRole('option')).toHaveLength(45);
    expect(screen.queryByText(/Show .* more/)).not.toBeInTheDocument();
  });

  it('shows a fallback name for a dashboard with a blank title, and stores that fallback on selection', async () => {
    const user = userEvent.setup();
    useGetDashboardModels.mockReturnValue({
      isLoading: false,
      isError: false,
      dashboards: [{ oid: 'dash-1', title: '' }],
    });
    render(<DashboardPicker />);

    await user.click(screen.getByRole('combobox', { name: 'Search dashboards' }));
    const option = await screen.findByRole('option', { name: 'Untitled Dashboard' });
    await user.click(option);

    expect(useExportStore.getState().dashboard).toEqual({
      oid: 'dash-1',
      title: 'Untitled Dashboard',
    });
  });

  describe('deep link', () => {
    const dashboards = [
      { oid: 'd-1', title: 'Sales', dataSource: 'Sample ECommerce' },
      { oid: 'd-2', title: 'Marketing', dataSource: 'Sample ECommerce' },
    ];

    it('opens the linked dashboard once the list loads, keeping the widget id pending', () => {
      useExportStore.setState({ pendingDeepLink: { dashboardId: 'd-2', widgetId: 'w-1' } });
      useGetDashboardModels.mockReturnValue({ isLoading: false, isError: false, dashboards });
      render(<DashboardPicker />);

      const state = useExportStore.getState();
      expect(state.dashboard).toEqual({
        oid: 'd-2',
        title: 'Marketing',
        dataSource: 'Sample ECommerce',
      });
      expect(state.step).toBe('widget');
      expect(state.pendingDeepLink).toEqual({ widgetId: 'w-1' });
    });

    it('waits while dashboards are still loading', () => {
      useExportStore.setState({ pendingDeepLink: { dashboardId: 'd-2' } });
      useGetDashboardModels.mockReturnValue({ isLoading: true, isError: false });
      render(<DashboardPicker />);

      expect(useExportStore.getState().pendingDeepLink).toEqual({ dashboardId: 'd-2' });
    });

    it('shows a message and falls back to the picker for an unknown dashboard', () => {
      useExportStore.setState({ pendingDeepLink: { dashboardId: 'nope', widgetId: 'w-1' } });
      useGetDashboardModels.mockReturnValue({ isLoading: false, isError: false, dashboards });
      render(<DashboardPicker />);

      expect(screen.getByRole('alert')).toHaveTextContent('Dashboard "nope" wasn\'t found');
      expect(useExportStore.getState().pendingDeepLink).toBeNull();
      expect(screen.getByRole('combobox', { name: 'Search dashboards' })).toBeInTheDocument();
    });
  });
});
