import { useEffect, useState } from 'react';
import { getUsedJSHeapSizeMB } from '@/lib/metrics';

const SAMPLE_INTERVAL_MS = 2000;

/** Polls the used JS heap size (Chrome-only) while `enabled`. */
export function useMemoryUsage(enabled: boolean) {
  const [usedMB, setUsedMB] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!enabled) return;
    setUsedMB(getUsedJSHeapSizeMB());
    const interval = setInterval(() => {
      setUsedMB(getUsedJSHeapSizeMB());
    }, SAMPLE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [enabled]);

  return usedMB;
}
