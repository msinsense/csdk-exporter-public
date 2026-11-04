import { describe, expect, it } from 'vitest';
import { formatDuration } from './format-duration';

describe('formatDuration', () => {
  it('formats seconds only', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(59)).toBe('59s');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(60)).toBe('1m 00s');
    expect(formatDuration(135)).toBe('2m 15s');
    expect(formatDuration(3599)).toBe('59m 59s');
  });

  it('formats hours and minutes', () => {
    expect(formatDuration(3600)).toBe('1h 00m');
    expect(formatDuration(3900)).toBe('1h 05m');
    expect(formatDuration(7325)).toBe('2h 02m');
  });

  it('rounds and clamps negative input to zero', () => {
    expect(formatDuration(44.6)).toBe('45s');
    expect(formatDuration(-5)).toBe('0s');
  });
});
