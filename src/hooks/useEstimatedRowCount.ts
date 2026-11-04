import type { Filter } from '@sisense/sdk-data';
import { useExecuteQuery, useGetWidgetModel } from '@sisense/sdk-ui';
import { toWidgetQueryParams } from '@/lib/widget-query';

/**
 * Approximates the total row count for a widget's export.
 *
 * Sisense has no row-count API for Pivot queries (only for flat/dimensional
 * queries).
 * As a workaround, this runs the same flat query the export uses (a Pivot's
 * `rows`+`columns` flattened into dimensions and `values` into measures, see
 * lib/widget-query.ts) as a probe with `includeRowCount: true` (`count: 1` —
 * we only want the total, not the data). For a Pivot this is an ESTIMATE,
 * not a guarantee: it assumes the flat group-by count matches the pivot's
 * flattened table row count, which should hold in the common case but isn't
 * verified against every pivot configuration. Other widgets already have a
 * flat query, so their count is exact.
 *
 * Gracefully returns `undefined` if the widget model hasn't loaded yet, the
 * probe query fails, or the connected instance doesn't support
 * `includeRowCount` (pre-2026.3.0) — callers should treat that as "no
 * estimate available" and fall back to a plain counter.
 */
export function useEstimatedRowCount(
  dashboardOid: string,
  widgetOid: string,
  enabled: boolean,
  extraFilters: Filter[] = [],
) {
  const { widget } = useGetWidgetModel({ dashboardOid, widgetOid, enabled });

  const flatParams = toWidgetQueryParams(widget, extraFilters);

  const { rowCount, isLoading, isError } = useExecuteQuery({
    dataSource: flatParams?.dataSource,
    dimensions: flatParams?.dimensions ?? [],
    measures: flatParams?.measures ?? [],
    filters: flatParams?.filters,
    count: 1,
    includeRowCount: true,
    enabled: enabled && !!flatParams,
  });

  return { totalRowsEstimate: rowCount, isLoading, isError };
}
