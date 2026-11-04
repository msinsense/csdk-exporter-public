import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('shows the connection form when not connected', () => {
    render(<App />);
    expect(screen.getByText('Connect to Sisense')).toBeInTheDocument();
    expect(screen.getByLabelText('Sisense URL')).toBeInTheDocument();
  });

  it('introduces what the app does, on the home screen', () => {
    render(<App />);
    expect(screen.getByText('CSDK Extract Application')).toBeInTheDocument();
    expect(screen.getByText(/Export large Sisense widget datasets/)).toBeInTheDocument();
  });

  it('shows the CORS disclaimer below the connection form, on the home screen', () => {
    render(<App />);
    expect(screen.getByText('Before you connect')).toBeInTheDocument();
    expect(screen.getByText(window.location.origin)).toBeInTheDocument();
  });

  it('shows the experimental-app disclaimer', () => {
    render(<App />);
    expect(screen.getByText(/experimental proof-of-concept application/)).toBeInTheDocument();
  });
});
