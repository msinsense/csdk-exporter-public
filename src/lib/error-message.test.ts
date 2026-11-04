import { describe, expect, it } from 'vitest';
import { getErrorMessage } from './error-message';

describe('getErrorMessage', () => {
  it('returns the fallback for a null/undefined error', () => {
    expect(getErrorMessage(null, 'fallback')).toBe('fallback');
    expect(getErrorMessage(undefined, 'fallback')).toBe('fallback');
  });

  it('extracts the details field from a JSON-stringified message', () => {
    const error = new Error('{"error":true,"type":500,"details":"Socket disconnected"}');
    expect(getErrorMessage(error, 'fallback')).toBe('Socket disconnected');
  });

  it('returns a plain Error message as-is', () => {
    expect(getErrorMessage(new Error('network error'), 'fallback')).toBe('network error');
  });

  it('returns the fallback for an empty message', () => {
    expect(getErrorMessage(new Error(''), 'fallback')).toBe('fallback');
  });

  it('stringifies a non-Error value', () => {
    expect(getErrorMessage('boom', 'fallback')).toBe('boom');
  });

  it('falls back to the raw message when JSON has no details field', () => {
    const error = new Error('{"error":true,"type":500}');
    expect(getErrorMessage(error, 'fallback')).toBe('{"error":true,"type":500}');
  });
});
