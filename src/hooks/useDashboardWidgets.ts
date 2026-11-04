import type { Filter } from '@sisense/sdk-data';
import { dashboardModelTranslator, useGetDashboardModel } from '@sisense/sdk-ui';
import { useMemo } from 'react';
import { matchesWidgetTypes } from '@/lib/widget-types';
import { useExportStore } from '@/store/export-store';

/**
 * Lists the widgets within a selected dashboard that can be exported: those
 * matching the widget types in the plugin's config.js (Pivot Tables by
 * default). Text, filter and custom widgets are never listed.
 *
 * Also returns the dashboard's own filters. Read through
 * `dashboardModelTranslator.toDashboardProps` since `DashboardModel.filters`
 * isn't public SDK API. Only a plain filter list is returned — an advanced AND/OR
 * `FilterRelations` tree can't be edited as a flat list, so it's skipped.
 */
export function useDashboardWidgets(dashboardOid: string) {
  const widgetTypes = useExportStore((s) => s.widgetTypes);
  const { dashboard, isLoading, isError, error } = useGetDashboardModel({
    dashboardOid,
    includeWidgets: true,
    includeFilters: true,
  });

  const widgets = dashboard?.widgets.filter((widget) => matchesWidgetTypes(widget, widgetTypes));

  const filters = useMemo<Filter[] | undefined>(() => {
    if (!dashboard) return undefined;
    const dashboardFilters = dashboardModelTranslator.toDashboardProps(dashboard).filters;
    return Array.isArray(dashboardFilters) ? dashboardFilters : [];
  }, [dashboard]);

  return { widgets, filters, isLoading, isError, error };
}
