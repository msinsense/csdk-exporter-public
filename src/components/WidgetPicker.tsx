import type { Filter, FilterRelations } from '@sisense/sdk-data';
import type { TableStyleOptions, WidgetModel } from '@sisense/sdk-ui';
import { FiltersPanel, Table, useGetWidgetModel, widgetModelTranslator } from '@sisense/sdk-ui';
import { Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  useFilter,
} from '@/components/ui/combobox';
import { useDashboardWidgets } from '@/hooks/useDashboardWidgets';
import { getDisplayTitle } from '@/lib/display-name';
import { getErrorMessage } from '@/lib/error-message';
import { mergeFilters } from '@/lib/flatten-pivot-query';
import { toWidgetQueryParams } from '@/lib/widget-query';
import { useExportStore } from '@/store/export-store';

const PAGE_SIZE = 20;
const UNTITLED_WIDGET = 'Untitled widget';

type DashboardWidgetsState = ReturnType<typeof useDashboardWidgets>;

/**
 * The widget step: a combobox until a widget is picked, then a live preview
 * (beside a filters panel) in its place — see WidgetPreview.
 *
 * Seeds the filters panel with the dashboard's own filters once the
 * dashboard loads.
 */
export function WidgetPicker() {
  const dashboard = useExportStore((s) => s.dashboard);
  const widget = useExportStore((s) => s.widget);
  const seedDashboardFilters = useExportStore((s) => s.seedDashboardFilters);

  const dashboardWidgets = useDashboardWidgets(dashboard?.oid ?? '');
  const dashboardFilters = dashboardWidgets.filters;

  useEffect(() => {
    if (dashboardFilters) seedDashboardFilters(dashboardFilters);
  }, [dashboardFilters, seedDashboardFilters]);

  return widget ? <WidgetPreview /> : <WidgetPickerCombobox {...dashboardWidgets} />;
}

function toWidgetSummary(widget: WidgetModel) {
  return { oid: widget.oid, title: getDisplayTitle(widget.title, UNTITLED_WIDGET) };
}

function WidgetPickerCombobox({ widgets, isLoading, isError, error }: DashboardWidgetsState) {
  const dashboard = useExportStore((s) => s.dashboard);
  const selectWidget = useExportStore((s) => s.selectWidget);
  const pendingWidgetId = useExportStore((s) => s.pendingDeepLink?.widgetId);
  const resolveDeepLinkWidget = useExportStore((s) => s.resolveDeepLinkWidget);
  const deepLinkError = useExportStore((s) => s.deepLinkError);

  // Opens the widget from a deep link once the dashboard's widgets have loaded.
  useEffect(() => {
    if (!pendingWidgetId || isLoading) return;
    const match = widgets?.find((w) => w.oid === pendingWidgetId);
    resolveDeepLinkWidget(match ? toWidgetSummary(match) : null);
  }, [pendingWidgetId, widgets, isLoading, resolveDeepLinkWidget]);

  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const filter = useFilter();

  // Filtered ourselves (not via the combobox's `items` prop) so we know the
  // true match count, independent of how many are shown. useFilteredItems()
  // returns the list after the limit, so it can't give this count.
  const matches = useMemo(() => {
    const list = widgets ?? [];
    if (!query.trim()) return list;
    return list.filter((widget) =>
      filter.contains(widget, query, (w: WidgetModel) => getDisplayTitle(w.title, UNTITLED_WIDGET)),
    );
  }, [widgets, query, filter]);

  const visible = matches.slice(0, limit);
  const remaining = matches.length - visible.length;

  const hasNoWidgets = !isLoading && !isError && (widgets?.length ?? 0) === 0;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Pick a widget</CardTitle>
        <CardDescription>
          Widgets in {dashboard?.title ?? 'the selected dashboard'}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {deepLinkError && (
          <p className="text-sm text-destructive" role="alert">
            {deepLinkError}
          </p>
        )}

        {isLoading && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading widgets…
          </p>
        )}

        {isError && (
          <p className="text-sm text-destructive" role="alert">
            Couldn't load widgets: {getErrorMessage(error, 'unknown error')}
          </p>
        )}

        {hasNoWidgets && (
          <p className="text-sm text-muted-foreground">
            There is no widget to export in this dashboard.
          </p>
        )}

        {!isLoading && !isError && !hasNoWidgets && (
          <Combobox
            items={widgets ?? []}
            filteredItems={visible}
            inputValue={query}
            itemToStringLabel={(widget: WidgetModel) =>
              getDisplayTitle(widget.title, UNTITLED_WIDGET)
            }
            isItemEqualToValue={(a: WidgetModel, b: WidgetModel) => a.oid === b.oid}
            onInputValueChange={(value) => {
              setQuery(value);
              setLimit(PAGE_SIZE);
            }}
            onValueChange={(widget: WidgetModel | null) => {
              if (widget) selectWidget(toWidgetSummary(widget));
            }}
          >
            <ComboboxInput placeholder="Search widgets…" aria-label="Search widgets" />
            <ComboboxContent>
              <ComboboxEmpty>No widgets found.</ComboboxEmpty>
              <ComboboxList>
                {(widget: WidgetModel) => (
                  <ComboboxItem key={widget.oid} value={widget}>
                    {getDisplayTitle(widget.title, UNTITLED_WIDGET)}
                  </ComboboxItem>
                )}
              </ComboboxList>
              {remaining > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-center text-muted-foreground"
                  onClick={() => setLimit((n) => n + PAGE_SIZE)}
                >
                  Show {Math.min(PAGE_SIZE, remaining)} more ({remaining} left)
                </Button>
              )}
            </ComboboxContent>
          </Combobox>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Shown once a widget is picked: a live preview (a flat `Table` with the
 * same columns the export writes, see toPreview) beside a
 * `FiltersPanel`. Both read `selectedFilters` from the store, so picking a
 * filter re-queries the preview immediately. The same filters are merged
 * into the export query later (lib/widget-query.ts) — this is where
 * the user builds them, not a separate step.
 *
 * Rendering the real widget means it can hit the same server-side limits a
 * huge, unfiltered Pivot hits in Sisense's own UI — that's expected, not a
 * bug to route around here; narrowing with filters is the way through it.
 */
function WidgetPreview() {
  const dashboard = useExportStore((s) => s.dashboard);
  const widget = useExportStore((s) => s.widget);
  const selectedFilters = useExportStore((s) => s.selectedFilters);
  const setFilters = useExportStore((s) => s.setFilters);
  const clearWidget = useExportStore((s) => s.clearWidget);
  const goForward = useExportStore((s) => s.goForward);

  const {
    widget: widgetModel,
    isLoading,
    isError,
    error,
  } = useGetWidgetModel({
    dashboardOid: dashboard?.oid ?? '',
    widgetOid: widget?.oid ?? '',
    enabled: !!dashboard && !!widget,
  });

  const preview = widgetModel ? toPreview(widgetModel) : undefined;

  return (
    // On desktop, fills the window height (minus main's padding) so the preview can grow.
    <div className="flex w-full flex-col gap-4 md:h-[calc(100svh-3.5rem)]">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{widget?.title}</h2>
          <p className="text-sm text-muted-foreground">From {dashboard?.title}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={clearWidget}>
          Change widget
        </Button>
      </div>

      <div className="flex flex-col gap-4 md:min-h-0 md:flex-1 md:flex-row">
        <Card className="md:min-w-0 md:flex-1">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>Updates as filters change.</CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col">
            {isLoading && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Loading preview…
              </p>
            )}
            {isError && (
              <p className="text-sm text-destructive" role="alert">
                Couldn't load the preview: {getErrorMessage(error, 'unknown error')}
              </p>
            )}
            {preview && (
              // A flat Table instead of the widget itself, to avoid the Pivot's
              // row limits. It takes its container's height.
              <div className="h-125 md:h-auto md:min-h-0 md:flex-1">
                <Table
                  dataSet={preview.dataSet}
                  dataOptions={{ columns: preview.columns }}
                  filters={mergeFilters(selectedFilters, preview.filters)}
                  // Shows the total row count and links to the last pages (Sisense 2026.3+).
                  includeTotalRows
                  styleOptions={preview.styleOptions}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="w-full md:w-80 md:overflow-y-auto">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>
              Starts from the dashboard's filters. Applied to both the preview and the export.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FiltersPanel
              filters={selectedFilters}
              defaultDataSource={dashboard?.dataSource}
              onFiltersChange={(filters) => setFilters(Array.isArray(filters) ? filters : [])}
              config={{
                actions: {
                  addFilter: { enabled: true },
                  editFilter: { enabled: true },
                  deleteFilter: { enabled: true },
                },
              }}
            />
            <WidgetOwnFilters filters={preview?.filters} />
          </CardContent>
        </Card>
      </div>

      <Button onClick={() => goForward()}>Continue to export</Button>
    </div>
  );
}

/**
 * What the preview Table shows: the same columns the export writes, the
 * widget's own filters and, for a Pivot, its header and row colors.
 */
function toPreview(widgetModel: WidgetModel) {
  if (widgetModel.widgetType !== 'pivot') {
    const params = toWidgetQueryParams(widgetModel);
    return {
      dataSet: params?.dataSource,
      columns: [...(params?.dimensions ?? []), ...(params?.measures ?? [])],
      filters: params?.filters,
      styleOptions: undefined,
    };
  }

  const pivotProps = widgetModelTranslator.toPivotTableWidgetProps(widgetModel);
  const style = pivotProps.styleOptions;
  const styleOptions: TableStyleOptions = {
    header: { color: { enabled: style?.headersColor ?? false } },
    rows: { alternatingColor: { enabled: style?.alternatingRowsColor ?? false } },
    columns: { alternatingColor: { enabled: style?.alternatingColumnsColor ?? false } },
  };
  return {
    dataSet: pivotProps.dataSource,
    columns: [
      ...(pivotProps.dataOptions.rows ?? []),
      ...(pivotProps.dataOptions.columns ?? []),
      ...(pivotProps.dataOptions.values ?? []),
    ],
    filters: pivotProps.filters,
    styleOptions,
  };
}

/** Read-only list of the filters saved on the widget itself — always applied
 * on top of the panel's filters, but not editable here. */
function WidgetOwnFilters({ filters }: { filters: Filter[] | FilterRelations | undefined }) {
  if (!Array.isArray(filters) || filters.length === 0) return null;

  return (
    <div className="mt-4 flex flex-col gap-1 border-t pt-3">
      <p className="text-sm font-medium">Widget filters</p>
      <p className="text-xs text-muted-foreground">Saved on the widget, always applied.</p>
      <ul className="text-sm text-muted-foreground">
        {filters.map((filter) => (
          <li key={filter.config?.guid ?? filter.name}>{filter.attribute?.name ?? filter.name}</li>
        ))}
      </ul>
    </div>
  );
}
