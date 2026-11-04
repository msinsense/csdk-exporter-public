import type { Filter } from '@sisense/sdk-data';
import { type NumberFormatConfig, type WidgetModel, widgetModelTranslator } from '@sisense/sdk-ui';
import { type FlatQueryParams, mergeFilters, toFlatQueryParams } from '@/lib/flatten-pivot-query';

/**
 * The widget's own query as a flat query for `useExecuteQuery`, with
 * `extraFilters` added. Pivot widgets are flattened (see
 * flatten-pivot-query.ts); other widgets already have a flat query.
 */
export function toWidgetQueryParams(
  widget: WidgetModel | undefined,
  extraFilters: Filter[] = [],
): FlatQueryParams | undefined {
  if (!widget) return undefined;
  if (widget.widgetType === 'pivot') {
    return toFlatQueryParams(widgetModelTranslator.toExecutePivotQueryParams(widget), extraFilters);
  }

  const params = widgetModelTranslator.toExecuteQueryParams(widget);
  return {
    dataSource: params.dataSource,
    dimensions: params.dimensions ?? [],
    measures: params.measures ?? [],
    filters: mergeFilters(extraFilters, params.filters),
  };
}

/** Number format of each value column, in query order. Only Pivot widgets
 * carry them here; other widgets get the default format. */
export function toValueFormats(
  widget: WidgetModel,
  measureCount: number,
): (NumberFormatConfig | undefined)[] {
  if (widget.widgetType !== 'pivot') return Array.from({ length: measureCount }, () => undefined);
  const values = widgetModelTranslator.toPivotTableWidgetProps(widget).dataOptions.values ?? [];
  return values.map((value) =>
    'numberFormatConfig' in value ? value.numberFormatConfig : undefined,
  );
}
