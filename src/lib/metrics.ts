interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface PerformanceWithMemory extends Performance {
  memory?: PerformanceMemory;
}

/**
 * Used JS heap size in MB, via Chrome's non-standard `performance.memory`.
 * Undefined on any other browser, or if the API is ever removed/restricted.
 * Used for the export's live memory readout.
 */
export function getUsedJSHeapSizeMB(): number | undefined {
  const memory = (performance as PerformanceWithMemory).memory;
  if (!memory) return undefined;
  return Math.round(memory.usedJSHeapSize / (1024 * 1024));
}
