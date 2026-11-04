import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useExportStore } from '@/store/export-store';
import { ConnectionForm } from './ConnectionForm';

const initialState = useExportStore.getState();

beforeEach(() => {
  useExportStore.setState(initialState, true);
});

describe('ConnectionForm', () => {
  it('shows validation errors for an invalid URL and an empty token', async () => {
    const user = userEvent.setup();
    render(<ConnectionForm />);

    await user.type(screen.getByLabelText('Sisense URL'), 'not-a-url');
    await user.click(screen.getByRole('button', { name: 'Connect' }));

    expect(await screen.findByText(/valid Sisense instance URL/i)).toBeInTheDocument();
    expect(screen.getByText('API token is required')).toBeInTheDocument();
    expect(useExportStore.getState().connection).toBeNull();
  });

  it('connects and advances the wizard step on valid input', async () => {
    const user = userEvent.setup();
    render(<ConnectionForm />);

    await user.type(screen.getByLabelText('Sisense URL'), 'https://demo.sisense.com');
    await user.type(screen.getByLabelText('API token'), 'my-token');
    await user.click(screen.getByRole('button', { name: 'Connect' }));

    const state = useExportStore.getState();
    expect(state.connection).toEqual({ url: 'https://demo.sisense.com', token: 'my-token' });
    expect(state.step).toBe('dashboard');
  });

  it('prefills fields from a deep link that could not auto-connect', () => {
    useExportStore.setState({ connectionPrefill: { url: 'https://my.sisense.com' } });
    render(<ConnectionForm />);

    expect(screen.getByLabelText('Sisense URL')).toHaveValue('https://my.sisense.com');
    expect(screen.getByLabelText('API token')).toHaveValue('');
  });
});
