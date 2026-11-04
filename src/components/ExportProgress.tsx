import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useEstimatedRowCount } from '@/hooks/useEstimatedRowCount';
import { resetExportSink, useExportRun } from '@/hooks/useExportRun';
import { useMemoryUsage } from '@/hooks/useMemoryUsage';
import { formatDuration } from '@/lib/format-duration';
import { XLSX_MAX_DATA_ROWS } from '@/lib/to-xlsx';
import { useExportStore } from '@/store/export-store';
import type { ExportFormat } from '@/types/export';

// A single page taking this long doesn't necessarily mean anything is
// wrong — the first request for an offset can take minutes — but the user
// should know the export hasn't silently died.
export const SLOW_REQUEST_NOTICE_MS = 30_000;

function computeElapsed(startedAt: number | null): number {
  return startedAt === null ? 0 : Math.floor((Date.now() - startedAt) / 1000);
}

function useElapsedSeconds(startedAt: number | null) {
  const [elapsed, setElapsed] = useState(() => computeElapsed(startedAt));

  useEffect(() => {
    setElapsed(computeElapsed(startedAt));
    if (startedAt === null) return;
    const interval = setInterval(() => {
      setElapsed(computeElapsed(startedAt));
    }, 250);
    return () => clearInterval(interval);
  }, [startedAt]);

  return elapsed;
}

/** Caps at 99% while running — 100% is reserved for the actual "done" state,
 * since the row-count estimate isn't guaranteed exact. */
function estimatePercentage(rowsExported: number, totalRowsEstimate: number): number {
  if (totalRowsEstimate <= 0) return 0;
  return Math.min(99, Math.round((rowsExported / totalRowsEstimate) * 100));
}

/**
 * ETA from the average of the last few chunks, not the whole run's average
 * — one slow outlier would otherwise drag the estimate
 * down for the rest of the export instead of recovering once things speed
 * back up.
 */
function estimateEtaSeconds(
  rowsExported: number,
  totalRowsEstimate: number,
  chunkSize: number,
  recentChunkDurationsMs: number[],
): number | null {
  if (recentChunkDurationsMs.length === 0) return null;
  const rowsRemaining = totalRowsEstimate - rowsExported;
  if (rowsRemaining <= 0) return null;
  const avgDurationMs =
    recentChunkDurationsMs.reduce((sum, ms) => sum + ms, 0) / recentChunkDurationsMs.length;
  const chunksRemaining = rowsRemaining / chunkSize;
  return Math.round((chunksRemaining * avgDurationMs) / 1000);
}

export function ExportProgress() {
  const dashboard = useExportStore((s) => s.dashboard);
  const widget = useExportStore((s) => s.widget);
  const selectedFilters = useExportStore((s) => s.selectedFilters);
  const status = useExportStore((s) => s.status);
  const rowsExported = useExportStore((s) => s.rowsExported);
  const chunkSize = useExportStore((s) => s.chunkSize);
  const totalRowsEstimate = useExportStore((s) => s.totalRowsEstimate);
  const recentChunkDurationsMs = useExportStore((s) => s.recentChunkDurationsMs);
  const currentRequestStartedAt = useExportStore((s) => s.currentRequestStartedAt);
  const startedAt = useExportStore((s) => s.startedAt);
  const error = useExportStore((s) => s.error);
  const startExport = useExportStore((s) => s.startExport);
  const cancelExport = useExportStore((s) => s.cancelExport);
  const setTotalRowsEstimate = useExportStore((s) => s.setTotalRowsEstimate);

  const elapsedSeconds = useElapsedSeconds(startedAt);
  const currentRequestElapsedSeconds = useElapsedSeconds(currentRequestStartedAt);
  const isRunning = status === 'running';
  const isRequestSlow = isRunning && currentRequestElapsedSeconds * 1000 >= SLOW_REQUEST_NOTICE_MS;

  // Discards any stale/already-closed file handle before a deliberate new
  // attempt (the "Start export"/"Retry" buttons).
  const handleStart = () => {
    resetExportSink();
    startExport();
  };

  // Always call hooks (rules of hooks) — both no-op until status is 'running'.
  useExportRun(dashboard?.oid ?? '', widget?.oid ?? '');
  const { totalRowsEstimate: probedEstimate } = useEstimatedRowCount(
    dashboard?.oid ?? '',
    widget?.oid ?? '',
    isRunning,
    selectedFilters,
  );
  useEffect(() => {
    // Only lift a genuine positive estimate into the store — an `undefined`
    // result (still loading, or the probe failed) must not clobber a good
    // estimate already obtained.
    if (typeof probedEstimate === 'number' && probedEstimate > 0) {
      setTotalRowsEstimate(probedEstimate);
    }
  }, [probedEstimate, setTotalRowsEstimate]);

  const usedMemoryMB = useMemoryUsage(isRunning);

  // Once actual progress overtakes the estimate, the estimate is proven
  // wrong (the flat probe doesn't always match a pivot's real row count).
  // From that
  // point on, stop showing percentage/ETA/denominator entirely rather than
  // keep displaying numbers we know are nonsensical (e.g. "99% · 0s
  // remaining" forever).
  const estimateExceeded =
    isRunning && typeof totalRowsEstimate === 'number' && rowsExported > totalRowsEstimate;
  const hasEstimate =
    isRunning &&
    typeof totalRowsEstimate === 'number' &&
    totalRowsEstimate > 0 &&
    !estimateExceeded;
  const percentage = hasEstimate ? estimatePercentage(rowsExported, totalRowsEstimate) : null;
  const etaSeconds = hasEstimate
    ? estimateEtaSeconds(rowsExported, totalRowsEstimate, chunkSize, recentChunkDurationsMs)
    : null;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Export {widget?.title}</CardTitle>
        <CardDescription>
          From {dashboard?.title}
          {selectedFilters.length > 0
            ? ` · ${selectedFilters.length} filter${selectedFilters.length === 1 ? '' : 's'} applied`
            : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {status === 'idle' && (
          <>
            <FileFormatPicker />
            <Button onClick={handleStart}>Start export</Button>
          </>
        )}

        {status === 'running' && (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {rowsExported.toLocaleString()}
              {hasEstimate ? ` / ~${totalRowsEstimate.toLocaleString()}` : ''} rows exported
            </p>

            {percentage !== null && <Progress value={percentage} aria-label="Export progress" />}

            <p className="text-sm text-muted-foreground">
              {percentage !== null ? `${percentage}% · ` : ''}
              {formatDuration(elapsedSeconds)} elapsed
              {etaSeconds !== null ? ` · ~${formatDuration(etaSeconds)} remaining` : ''}
            </p>

            {estimateExceeded && (
              <p className="text-xs text-muted-foreground">
                This widget has more rows than the initial estimate, showing a plain count.
              </p>
            )}

            {isRequestSlow && (
              <p className="text-xs font-medium text-foreground" role="status">
                This is taking longer than expected. Please don't close this window.
              </p>
            )}

            {usedMemoryMB !== undefined && (
              <p className="text-xs text-muted-foreground">~{usedMemoryMB} MB memory used</p>
            )}

            <Button variant="outline" onClick={cancelExport}>
              Cancel
            </Button>
          </div>
        )}

        {status === 'error' && (
          <>
            <p className="text-sm text-destructive" role="alert">
              Export failed{error ? `: ${error}` : '.'}
            </p>
            <Button onClick={handleStart}>Retry</Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function FileFormatPicker() {
  const fileFormat = useExportStore((s) => s.fileFormat);
  const setFileFormat = useExportStore((s) => s.setFileFormat);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium" id="file-format-label">
        File type
      </p>
      <RadioGroup
        aria-labelledby="file-format-label"
        value={fileFormat}
        onValueChange={(value) => setFileFormat(value as ExportFormat)}
      >
        <Label className="font-normal">
          <RadioGroupItem value="csv" />
          CSV (.csv)
        </Label>
        <Label className="font-normal">
          <RadioGroupItem value="xlsx" />
          Excel (.xlsx)
        </Label>
      </RadioGroup>
      {fileFormat === 'xlsx' && (
        <p className="text-xs text-muted-foreground" role="note">
          Excel holds up to {XLSX_MAX_DATA_ROWS.toLocaleString()} rows. For more, use CSV.
        </p>
      )}
    </div>
  );
}
