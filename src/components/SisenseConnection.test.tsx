import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useExportStore } from '@/store/export-store';
import { SisenseConnection } from './SisenseConnection';

type OnError = (error: Error) => ReactNode;

const { capturedOnError } = vi.hoisted(() => ({
  capturedOnError: { current: null as OnError | null },
}));

vi.mock('@sisense/sdk-ui', () => ({
  SisenseContextProvider: ({ children, onError }: { children: ReactNode; onError: OnError }) => {
    capturedOnError.current = onError;
    return children;
  },
}));

const initialState = useExportStore.getState();
const connection = { url: 'https://sisense.example.com', token: 'tok' };

beforeEach(() => {
  useExportStore.setState(initialState, true);
  capturedOnError.current = null;
});

describe('SisenseConnection', () => {
  it('renders children normally when there is no error', () => {
    render(
      <SisenseConnection connection={connection}>
        <p>Wizard content</p>
      </SisenseConnection>,
    );

    expect(screen.getByText('Wizard content')).toBeInTheDocument();
  });

  it('shows a minimal error card with the message, instead of the SDK default full-page box', () => {
    render(
      <SisenseConnection connection={connection}>
        <p>Wizard content</p>
      </SisenseConnection>,
    );

    // biome-ignore lint/style/noNonNullAssertion: set by the mocked provider on render
    const node = capturedOnError.current!(new Error('Network error. Check browser console.'));
    render(node as ReactElement);

    expect(screen.getByText('Connection error')).toBeInTheDocument();
    expect(screen.getByText('Network error. Check browser console.')).toBeInTheDocument();
  });

  it('lets the user go back to the connection screen from the error card', async () => {
    const user = userEvent.setup();
    useExportStore.getState().connect(connection);
    render(
      <SisenseConnection connection={connection}>
        <p>Wizard content</p>
      </SisenseConnection>,
    );

    // biome-ignore lint/style/noNonNullAssertion: set by the mocked provider on render
    const node = capturedOnError.current!(new Error('boom'));
    render(node as ReactElement);

    await user.click(screen.getByRole('button', { name: 'Back to connection screen' }));

    expect(useExportStore.getState().connection).toBeNull();
    expect(useExportStore.getState().step).toBe('connect');
  });
});
