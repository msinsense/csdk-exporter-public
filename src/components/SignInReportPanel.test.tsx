import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useExportStore } from '@/store/export-store';
import { SignInReportPanel } from './SignInReportPanel';

const initialState = useExportStore.getState();

beforeEach(() => {
  useExportStore.setState(initialState, true);
});

describe('SignInReportPanel', () => {
  it('renders nothing without a report', () => {
    const { container } = render(<SignInReportPanel />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the report', () => {
    useExportStore
      .getState()
      .setSignInReport({ method: 'session', sessionSource: 'opener', role: 'contributor' });
    render(<SignInReportPanel />);
    expect(screen.getByText('Sisense session (no token)')).toBeInTheDocument();
    expect(screen.getByText('Sisense tab that opened this one')).toBeInTheDocument();
    expect(screen.getByText('contributor')).toBeInTheDocument();
  });
});
