import type {
  Attribute,
  Filter,
  FilterRelations,
  Measure,
  PivotAttribute,
  PivotMeasure,
} from '@sisense/sdk-data';
import type { widgetModelTranslator } from '@sisense/sdk-ui';

type ExecutePivotQueryParams = ReturnType<typeof widgetModelTranslator.toExecutePivotQueryParams>;

function toAttribute(item: Attribute | PivotAttribute): Attribute {
  return 'attribute' in item ? item.attribute : item;
}

function toMeasure(item: Measure | PivotMeasure): Measure {
  return 'measure' in item ? item.measure : item;
}

/**
 * Prepends `extraFilters` (e.g. picked in the wizard's filters panel) to
 * `baseFilters`. Only handles the plain-array case — a widget saved with an
 * advanced AND/OR filter group (`FilterRelations`, not an array) can't be
 * safely combined with a flat filter list, so it's left as-is. Shared by the
 * export query (below) and the widget preview in WidgetPicker.tsx.
 */
export function mergeFilters(
  extraFilters: Filter[],
  baseFilters: Filter[] | FilterRelations | undefined,
): Filter[] | FilterRelations | undefined {
  if (extraFilters.length === 0) return baseFilters;
  if (!baseFilters || Array.isArray(baseFilters)) {
    return [...extraFilters, ...(baseFilters ?? [])];
  }
  return baseFilters;
}

export interface FlatQueryParams {
  dataSource: ExecutePivotQueryParams['dataSource'];
  dimensions: Attribute[];
  measures: Measure[];
  filters: ExecutePivotQueryParams['filters'];
}

/**
 * Flattens a Pivot widget's own query definition (rows/columns dimensions,
 * values measures) into the shape `useExecuteQuery` expects.
 *
 * Why: Pivot Table widget queries (`useExecuteQueryByWidgetId` for a pivot
 * widget, and `useExecutePivotQuery` directly — confirmed both) route through
 * a socket-based mechanism that does not correctly honor `offset` — every
 * page request returns the first page, regardless of the offset requested.
 * `useExecuteQuery` is the one public API confirmed to
 * take a different (REST-based, non-pivot) execution path, so we derive the
 * widget's own dimensions/measures/filters via
 * `widgetModelTranslator.toExecutePivotQueryParams` and execute that flat
 * shape instead — the same translation the row-count estimate uses.
 *
 * The result is a flat group-by table (one row per unique dimension
 * combination) rather than a hierarchical pivot — CSV can't represent a
 * pivot's subtotal hierarchy anyway, so this is an acceptable, arguably more
 * useful, representation for an export.
 */
export function toFlatQueryParams(
  pivotParams: ExecutePivotQueryParams | undefined,
  extraFilters: Filter[] = [],
): FlatQueryParams | undefined {
  if (!pivotParams) return undefined;

  return {
    dataSource: pivotParams.dataSource,
    dimensions: [...(pivotParams.rows ?? []), ...(pivotParams.columns ?? [])].map(toAttribute),
    measures: (pivotParams.values ?? []).map(toMeasure),
    filters: mergeFilters(extraFilters, pivotParams.filters),
  };
}
