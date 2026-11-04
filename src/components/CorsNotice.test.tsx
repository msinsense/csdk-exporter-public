import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CorsNotice } from './CorsNotice';

describe('CorsNotice', () => {
  it('shows the current origin, so the user knows exactly what to allow-list', () => {
    render(<CorsNotice />);

    expect(screen.getByText(window.location.origin)).toBeInTheDocument();
  });

  it('explains why, in plain terms', () => {
    render(<CorsNotice />);

    expect(screen.getByText(/CORS allow-list/)).toBeInTheDocument();
  });
});
