import { describe, expect, it } from 'vitest';
import { getDisplayTitle } from './display-name';

describe('getDisplayTitle', () => {
  it('returns the title when present', () => {
    expect(getDisplayTitle('Revenue by Region', 'Untitled')).toBe('Revenue by Region');
  });

  it('falls back for an empty string', () => {
    expect(getDisplayTitle('', 'Untitled')).toBe('Untitled');
  });

  it('falls back for a whitespace-only title', () => {
    expect(getDisplayTitle('   ', 'Untitled')).toBe('Untitled');
  });

  it('falls back for null or undefined', () => {
    expect(getDisplayTitle(null, 'Untitled')).toBe('Untitled');
    expect(getDisplayTitle(undefined, 'Untitled')).toBe('Untitled');
  });
});
