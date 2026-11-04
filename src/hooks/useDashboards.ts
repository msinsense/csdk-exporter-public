import { useGetDashboardModels } from '@sisense/sdk-ui';

/**
 * Lists dashboards the current user can access (no widgets — see useDashboardWidgets
 * for a specific dashboard's widgets).
 */
export function useDashboards() {
  const { dashboards, isLoading, isError, error } = useGetDashboardModels();
  return { dashboards, isLoading, isError, error };
}
