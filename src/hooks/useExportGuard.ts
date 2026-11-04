import { useEffect } from 'react';
import { useExportStore } from '@/store/export-store';

export const STATUS_MESSAGE_TYPE = 'csdkExporter:status';

/**
 * While an export runs: warns before the page is closed or reloaded, and
 * tells the Sisense plugin's modal (parent frame, same origin) so it can ask
 * before closing.
 */
export function useExportGuard() {
  const running = useExportStore((s) => s.status === 'running');

  useEffect(() => {
    if (window.parent !== window) {
      window.parent.postMessage({ type: STATUS_MESSAGE_TYPE, running }, window.location.origin);
    }
    if (!running) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [running]);
}
