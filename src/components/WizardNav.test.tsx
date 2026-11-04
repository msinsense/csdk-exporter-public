import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useExportStore } from '@/store/export-store';
import { WizardNav } from './WizardNav';

const initialState = useExportStore.getState();

beforeEach(() => {
  useExportStore.setState(initialState, true);
});

describe('WizardNav', () => {
  it('renders nothing on the connect step', () => {
    render(<WizardNav />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders nothing on the done step', () => {
    useExportStore.setState({ step: 'done' });
    render(<WizardNav />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('disables Forward on the dashboard step until a dashboard is selected', () => {
    useExportStore.getState().connect({ url: 'https://example.sisense.com', token: 'abc' });
    render(<WizardNav />);
    expect(screen.getByRole('button', { name: /forward/i })).toBeDisabled();
  });

  it('enables Forward once a dashboard is selected, and it advances the step', async () => {
    const user = userEvent.setup();
    useExportStore.getState().connect({ url: 'https://example.sisense.com', token: 'abc' });
    useExportStore
      .getState()
      .selectDashboard({ oid: 'dash-1', title: 'Sales', dataSource: 'Sample ECommerce' });
    useExportStore.getState().goBack();
    render(<WizardNav />);

    const forward = screen.getByRole('button', { name: /forward/i });
    expect(forward).toBeEnabled();
    await user.click(forward);

    expect(useExportStore.getState().step).toBe('widget');
  });

  it('disables Forward on the widget step until a widget is selected', () => {
    useExportStore.getState().connect({ url: 'https://example.sisense.com', token: 'abc' });
    useExportStore
      .getState()
      .selectDashboard({ oid: 'dash-1', title: 'Sales', dataSource: 'Sample ECommerce' });
    render(<WizardNav />);

    expect(screen.getByRole('button', { name: /forward/i })).toBeDisabled();
  });

  it('renders nothing once a widget is picked (WidgetPreview has its own nav)', () => {
    useExportStore.getState().connect({ url: 'https://example.sisense.com', token: 'abc' });
    useExportStore
      .getState()
      .selectDashboard({ oid: 'dash-1', title: 'Sales', dataSource: 'Sample ECommerce' });
    useExportStore.getState().selectWidget({ oid: 'widget-1', title: 'Revenue' });
    render(<WizardNav />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('Back on the dashboard step disconnects', async () => {
    const user = userEvent.setup();
    useExportStore.getState().connect({ url: 'https://example.sisense.com', token: 'abc' });
    render(<WizardNav />);

    await user.click(screen.getByRole('button', { name: /back/i }));

    expect(useExportStore.getState().step).toBe('connect');
    expect(useExportStore.getState().connection).toBeNull();
  });

  it('disables Back while an export is running', () => {
    useExportStore.getState().connect({ url: 'https://example.sisense.com', token: 'abc' });
    useExportStore
      .getState()
      .selectDashboard({ oid: 'dash-1', title: 'Sales', dataSource: 'Sample ECommerce' });
    useExportStore.getState().selectWidget({ oid: 'widget-1', title: 'Revenue' });
    useExportStore.getState().goForward(); // widget -> export
    useExportStore.getState().startExport();
    render(<WizardNav />);

    expect(screen.getByRole('button', { name: /back/i })).toBeDisabled();
  });
});
