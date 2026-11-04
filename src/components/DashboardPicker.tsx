import type { DashboardModel } from '@sisense/sdk-ui';
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
import { useDashboards } from '@/hooks/useDashboards';
import { getDisplayTitle } from '@/lib/display-name';
import { getErrorMessage } from '@/lib/error-message';
import { useExportStore } from '@/store/export-store';

const PAGE_SIZE = 20;
const UNTITLED_DASHBOARD = 'Untitled Dashboard';

function toDashboardSummary(dashboard: DashboardModel) {
  return {
    oid: dashboard.oid,
    title: getDisplayTitle(dashboard.title, UNTITLED_DASHBOARD),
    dataSource: dashboard.dataSource,
  };
}

export function DashboardPicker() {
  const { dashboards, isLoading, isError, error } = useDashboards();
  const selectDashboard = useExportStore((s) => s.selectDashboard);
  const pendingDashboardId = useExportStore((s) => s.pendingDeepLink?.dashboardId);
  const resolveDeepLinkDashboard = useExportStore((s) => s.resolveDeepLinkDashboard);
  const deepLinkError = useExportStore((s) => s.deepLinkError);

  // Opens the dashboard from a deep link once the list has loaded.
  useEffect(() => {
    if (!pendingDashboardId || isLoading) return;
    const match = dashboards?.find((d) => d.oid === pendingDashboardId);
    resolveDeepLinkDashboard(match ? toDashboardSummary(match) : null);
  }, [pendingDashboardId, dashboards, isLoading, resolveDeepLinkDashboard]);

  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const filter = useFilter();

  // Filtered ourselves (rather than via the Combobox's `items` prop) so we
  // know the true match count, independent of how many are actually shown —
  // that's what makes a "Show more" affordance possible on top of Base UI's
  // combobox, which otherwise only exposes the already-paginated list.
  const matches = useMemo(() => {
    const list = dashboards ?? [];
    if (!query.trim()) return list;
    return list.filter((dashboard) =>
      filter.contains(dashboard, query, (d: DashboardModel) =>
        getDisplayTitle(d.title, UNTITLED_DASHBOARD),
      ),
    );
  }, [dashboards, query, filter]);

  const visible = matches.slice(0, limit);
  const remaining = matches.length - visible.length;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Pick a dashboard</CardTitle>
        <CardDescription>Choose the dashboard that contains the widget to export.</CardDescription>
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
            Loading dashboards…
          </p>
        )}

        {isError && (
          <p className="text-sm text-destructive" role="alert">
            Couldn't load dashboards: {getErrorMessage(error, 'unknown error')}
          </p>
        )}

        {!isLoading && !isError && (
          <Combobox
            items={dashboards ?? []}
            filteredItems={visible}
            inputValue={query}
            itemToStringLabel={(dashboard: DashboardModel) =>
              getDisplayTitle(dashboard.title, UNTITLED_DASHBOARD)
            }
            isItemEqualToValue={(a: DashboardModel, b: DashboardModel) => a.oid === b.oid}
            onInputValueChange={(value) => {
              setQuery(value);
              setLimit(PAGE_SIZE);
            }}
            onValueChange={(dashboard: DashboardModel | null) => {
              if (dashboard) selectDashboard(toDashboardSummary(dashboard));
            }}
          >
            <ComboboxInput placeholder="Search dashboards…" aria-label="Search dashboards" />
            <ComboboxContent>
              <ComboboxEmpty>No dashboards found.</ComboboxEmpty>
              <ComboboxList>
                {(dashboard: DashboardModel) => (
                  <ComboboxItem key={dashboard.oid} value={dashboard}>
                    {getDisplayTitle(dashboard.title, UNTITLED_DASHBOARD)}
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
