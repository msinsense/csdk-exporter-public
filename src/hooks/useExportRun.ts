import type { QueryResultData } from '@sisense/sdk-data';
import { useExecuteQuery, useGetWidgetModel } from '@sisense/sdk-ui';
import { useEffect, useRef } from 'react';
import { getErrorMessage } from '@/lib/error-message';
import { toColumnFormats } from '@/lib/excel-number-format';
import { createEncoder, type ExportEncoder, FILE_TYPES } from '@/lib/export-format';
import { createFileSink, type FileSink } from '@/lib/file-sink';
import { XLSX_MAX_DATA_ROWS, type XlsxOptions } from '@/lib/to-xlsx';
import { toValueFormats, toWidgetQueryParams } from '@/lib/widget-query';
import { useExportStore } from '@/store/export-store';

// A page whose offset has never been queried before can take several
// minutes to come back (observed: ~4 min cold vs under 1s once warm — looks
// like a cache, not a hang), so the timeout needs real headroom above that.
export const STALL_TIMEOUT_MS = 600_000;

// Backstop if pagination never returns a short/empty page (our only real
// end-of-data signal) and keeps growing forever.
export const ESTIMATE_OVERSHOOT_MULTIPLIER = 3;
export const FALLBACK_ROW_CAP = 5_000_000;

// Module-level, not a ref, so a fresh attempt can tell it apart from a
// leftover handle from a previous run.
let sink: FileSink | null = null;
let encoder: ExportEncoder | null = null;

/** Closes and clears any leftover file handle before a new export attempt. */
export function resetExportSink() {
  sink?.close().catch(() => {});
  sink = null;
  encoder = null;
}

/** Writes the file's trailing bytes (e.g. the XLSX zip footer) and closes it,
 * so even a stopped export leaves a file that opens. */
async function finalizeSink() {
  const current = sink;
  const currentEncoder = encoder;
  if (!current || !currentEncoder) return;
  // Cleared first so a concurrent chunk can't write after the tail. `sink`
  // stays set until closed, so that chunk doesn't open a new file either.
  encoder = null;
  const tail = currentEncoder.finish();
  if (tail.length > 0) await current.writeChunk(tail);
  await current.close();
  if (sink === current) sink = null;
}

/**
 * Drives the export for the currently selected dashboard/widget. Fetches the
 * widget's own query as a flat query instead of by widget id — the by-id
 * path doesn't paginate correctly for Pivot widgets. Only
 * active while status is 'running'.
 */
export function useExportRun(dashboardOid: string, widgetOid: string) {
  const status = useExportStore((s) => s.status);
  const offset = useExportStore((s) => s.offset);
  const chunkSize = useExportStore((s) => s.chunkSize);
  const fileFormat = useExportStore((s) => s.fileFormat);
  const selectedFilters = useExportStore((s) => s.selectedFilters);
  const advanceOffset = useExportStore((s) => s.advanceOffset);
  const recordChunkDuration = useExportStore((s) => s.recordChunkDuration);
  const setCurrentRequestStartedAt = useExportStore((s) => s.setCurrentRequestStartedAt);
  const setExportedFileName = useExportStore((s) => s.setExportedFileName);
  const finishExport = useExportStore((s) => s.finishExport);
  const failExport = useExportStore((s) => s.failExport);

  const isRunning = status === 'running';

  const { widget } = useGetWidgetModel({ dashboardOid, widgetOid, enabled: isRunning });
  const flatParams = toWidgetQueryParams(widget, selectedFilters);

  // Read when the file is created; a ref so it doesn't re-run the write effect.
  const xlsxOptionsRef = useRef<XlsxOptions | undefined>(undefined);
  if (widget && flatParams) {
    xlsxOptionsRef.current = {
      sheetName: widget.title,
      columnFormats: toColumnFormats(
        flatParams.dimensions.length,
        toValueFormats(widget, flatParams.measures.length),
      ),
    };
  }

  const { data, isLoading, isError, error } = useExecuteQuery({
    dataSource: flatParams?.dataSource,
    dimensions: flatParams?.dimensions ?? [],
    measures: flatParams?.measures ?? [],
    filters: flatParams?.filters,
    offset,
    count: chunkSize,
    enabled: isRunning && !!flatParams,
  });

  // Logs how long each page takes, and tells the store when the current
  // request started so the UI can flag one that's running unusually long.
  const requestStartedAtRef = useRef<number | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: offset marks a new request starting
  useEffect(() => {
    if (status !== 'running') return;
    requestStartedAtRef.current = performance.now();
    setCurrentRequestStartedAt(Date.now());
  }, [status, offset, setCurrentRequestStartedAt]);

  useEffect(() => {
    if (status !== 'running') return;
    // Stops a stale invocation from writing after a newer one has started.
    let cancelled = false;

    async function writeChunkAndAdvance(chunk: QueryResultData) {
      // The file is being finalized — this export is already over.
      if (sink && !encoder) return;
      if (!sink) {
        const fileType = FILE_TYPES[fileFormat];
        sink = createFileSink();
        encoder = createEncoder(fileFormat, xlsxOptionsRef.current);
        await sink.open(`export${fileType.extension}`, fileType);
        const fileName = sink.getFileName();
        if (fileName) setExportedFileName(fileName);
      }
      if (cancelled) return;

      // XLSX sheets hold at most XLSX_MAX_DATA_ROWS rows — stop there.
      const rowLimit = fileFormat === 'xlsx' ? XLSX_MAX_DATA_ROWS - offset : Infinity;
      const truncated = chunk.rows.length > rowLimit;
      const rows = truncated ? chunk.rows.slice(0, rowLimit) : chunk.rows;
      const rowsInChunk = rows.length;

      if (rowsInChunk > 0) {
        const encoded = encoder?.encodeChunk({ ...chunk, rows }, { includeHeader: offset === 0 });
        if (encoded && encoded.length > 0) await sink.writeChunk(encoded);
      }
      if (cancelled) return;

      if (truncated || rowsInChunk < chunkSize) {
        // sink may already be null if another invocation closed it first.
        await finalizeSink();
        finishExport(rowsInChunk, truncated);
        return;
      }

      advanceOffset(rowsInChunk);

      // Read directly from the store, not a dependency — an estimate
      // arriving later shouldn't re-run this effect and double-write.
      const currentEstimate = useExportStore.getState().totalRowsEstimate;
      const rowCap =
        typeof currentEstimate === 'number' && currentEstimate > 0
          ? currentEstimate * ESTIMATE_OVERSHOOT_MULTIPLIER
          : FALLBACK_ROW_CAP;
      if (useExportStore.getState().rowsExported > rowCap) {
        await finalizeSink();
        failExport(
          `Export stopped after exceeding ${rowCap.toLocaleString()} rows without finishing — ` +
            'this looks like a pagination problem (e.g. duplicate pages), not the real row count. ' +
            'The partial file has been kept so it can be inspected.',
        );
      }
    }

    if (isError) {
      failExport(getErrorMessage(error, 'Query failed'));
      return;
    }
    if (isLoading || !data) return;

    const startedAt = requestStartedAtRef.current;
    if (startedAt !== null) {
      const durationMs = Math.round(performance.now() - startedAt);
      console.info(`[csdk-exporter] page at offset=${offset} settled in ${durationMs}ms`);
      recordChunkDuration(durationMs);
    }

    writeChunkAndAdvance(data).catch((err: unknown) => {
      failExport(getErrorMessage(err, 'Failed to write the export file'));
    });

    return () => {
      cancelled = true;
    };
  }, [
    data,
    isLoading,
    isError,
    error,
    status,
    offset,
    chunkSize,
    fileFormat,
    advanceOffset,
    recordChunkDuration,
    setExportedFileName,
    finishExport,
    failExport,
  ]);

  // Closes the file if the export stops without finishing/failing on its
  // own — i.e. cancelExport() or a failed query. finishExport already
  // closes and nulls sink itself, so this is a no-op for that.
  useEffect(() => {
    if (status === 'running' || !sink) return;
    finalizeSink().catch(() => {});
  }, [status]);

  // Fails the export if no page settles for a while, instead of spinning forever.
  // biome-ignore lint/correctness/useExhaustiveDependencies: offset resets the timer on each page advance
  useEffect(() => {
    if (status !== 'running') return;
    const timer = setTimeout(() => {
      failExport(
        `No response from Sisense for ${Math.round(STALL_TIMEOUT_MS / 60_000)} minutes — the ` +
          'connection may have dropped, or this page is taking unusually long. Try again.',
      );
    }, STALL_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [status, offset, failExport]);
}
