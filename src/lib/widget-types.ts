import type { WidgetModel } from '@sisense/sdk-ui';

/** Sisense widget types allowed when the plugin's config doesn't set any.
 * Same default as `widgetTypes` in sisense-plugin/config.js. */
export const DEFAULT_WIDGET_TYPES = ['pivot2', 'pivot'];

const PIVOT_TYPES = ['pivot', 'pivot2'];

// Sisense widget type -> the SDK's chart type. Same mapping the SDK uses
// when it reads a widget from Sisense.
const CHART_TYPES: Record<string, string> = {
  'chart/line': 'line',
  'chart/area': 'area',
  'chart/bar': 'bar',
  'chart/column': 'column',
  'chart/polar': 'polar',
  'chart/pie': 'pie',
  'chart/funnel': 'funnel',
  treemap: 'treemap',
  sunburst: 'sunburst',
  sankey: 'sankey',
  'chart/scatter': 'scatter',
  indicator: 'indicator',
  kpi: 'kpi',
  'chart/boxplot': 'boxplot',
  'map/scatter': 'scattermap',
  'map/area': 'areamap',
  tablewidget: 'table',
  tablewidgetagg: 'table',
  heatmap: 'calendar-heatmap',
};

type WidgetTypeFields = Pick<WidgetModel, 'widgetType' | 'chartType'>;

/** Pivot and chart widgets (Table widgets are charts too) have a query to
 * export. Text, filter and custom widgets don't. */
export function isExportableWidget(widget: WidgetTypeFields): boolean {
  return widget.widgetType === 'pivot' || widget.widgetType === 'chart';
}

/**
 * Whether the widget is one of the given Sisense widget types (as written in
 * the plugin's config.js). An empty list allows every exportable widget, like
 * the plugin's own check.
 */
export function matchesWidgetTypes(widget: WidgetTypeFields, types: string[]): boolean {
  if (!isExportableWidget(widget)) return false;
  if (types.length === 0) return true;
  return types.some((type) =>
    PIVOT_TYPES.includes(type)
      ? widget.widgetType === 'pivot'
      : widget.widgetType === 'chart' && CHART_TYPES[type] === widget.chartType,
  );
}
