import { afterEach, describe, expect, it } from 'vitest';
import { getUsedJSHeapSizeMB } from './metrics';

interface PerformanceWithMemory extends Performance {
  memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };
}

afterEach(() => {
  delete (performance as PerformanceWithMemory).memory;
});

describe('getUsedJSHeapSizeMB', () => {
  it('returns undefined when performance.memory is unavailable', () => {
    expect(getUsedJSHeapSizeMB()).toBeUndefined();
  });

  it('converts bytes to a rounded MB value', () => {
    (performance as PerformanceWithMemory).memory = {
      usedJSHeapSize: 123 * 1024 * 1024,
      totalJSHeapSize: 200 * 1024 * 1024,
      jsHeapSizeLimit: 4000 * 1024 * 1024,
    };
    expect(getUsedJSHeapSizeMB()).toBe(123);
  });
});
