import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useExportStore } from '@/store/export-store';
import { ExportSummary } from './ExportSummary';

const initialState = useExportStore.getState();

beforeEach(() => {
  useExportStore.setState(initialState, true);
  useExportStore
    .getState()
    .selectDashboard({ oid: 'dash-1', title: 'Sales', dataSource: 'Sample ECommerce' });
  useExportStore.getState().selectWidget({ oid: 'w-1', title: 'Revenue Pivot' });
  useExportStore.getState().startExport();
  useExportStore.getState().finishExport(1_234);
});

describe('ExportSummary', () => {
  it('shows the total rows exported', () => {
    render(<ExportSummary />);
    expect(screen.getByText(/1,234 rows exported/)).toBeInTheDocument();
  });

  it('shows the file name once known', () => {
    useExportStore.getState().setExportedFileName('export (3).csv');
    render(<ExportSummary />);

    expect(screen.getByText('export (3).csv')).toBeInTheDocument();
    expect(screen.getByText(/Saved as/)).toBeInTheDocument();
  });

  it('does not show a file name line if none was recorded', () => {
    render(<ExportSummary />);

    expect(screen.queryByText(/Saved as/)).not.toBeInTheDocument();
  });

  it('explains when an Excel export stopped at the row limit', () => {
    useExportStore.setState({ truncatedAtRowLimit: true });
    render(<ExportSummary />);

    expect(screen.getByRole('status')).toHaveTextContent(/Excel's row limit/);
  });

  it('shows no row-limit notice for a complete export', () => {
    render(<ExportSummary />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('resets the wizard back to the dashboard step', async () => {
    const user = userEvent.setup();
    render(<ExportSummary />);

    await user.click(screen.getByRole('button', { name: 'Export another widget' }));

    const state = useExportStore.getState();
    expect(state.step).toBe('dashboard');
    expect(state.widget).toBeNull();
  });
});
