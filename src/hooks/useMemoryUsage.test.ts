import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMemoryUsage } from './useMemoryUsage';

const { getUsedJSHeapSizeMB } = vi.hoisted(() => ({
  getUsedJSHeapSizeMB: vi.fn(),
}));

vi.mock('@/lib/metrics', () => ({ getUsedJSHeapSizeMB }));

beforeEach(() => {
  getUsedJSHeapSizeMB.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useMemoryUsage', () => {
  it('returns undefined and does not sample while disabled', () => {
    getUsedJSHeapSizeMB.mockReturnValue(100);
    const { result } = renderHook(() => useMemoryUsage(false));

    expect(result.current).toBeUndefined();
    expect(getUsedJSHeapSizeMB).not.toHaveBeenCalled();
  });

  it('samples immediately and then on each interval while enabled', async () => {
    vi.useFakeTimers();
    getUsedJSHeapSizeMB.mockReturnValueOnce(100).mockReturnValueOnce(150);

    const { result } = renderHook(() => useMemoryUsage(true));
    expect(result.current).toBe(100);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current).toBe(150);
  });
});
