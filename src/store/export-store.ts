import type { Filter } from '@sisense/sdk-data';
import { create } from 'zustand';
import { type DeepLink, isValidUrl } from '@/lib/deep-link';
import { DEFAULT_WIDGET_TYPES } from '@/lib/widget-types';
import type {
  ConnectionInfo,
  DashboardSummary,
  ExportFormat,
  ExportStatus,
  WidgetSummary,
  WizardStep,
} from '@/types/export';

interface ExportStoreState {
  step: WizardStep;
  connection: ConnectionInfo | null;

  /** Running inside Sisense (opened by the plugin from its own folder). */
  embedded: boolean;

  /** Sisense widget types that can be picked and exported, from the
   * plugin's config.js. An empty list allows every exportable widget. */
  widgetTypes: string[];

  dashboard: DashboardSummary | null;
  widget: WidgetSummary | null;

  /** Filters picked in the widget step's filters panel, applied on top of
   * the exported widget's own saved filters. Reset when a new dashboard is
   * selected. */
  selectedFilters: Filter[];

  /** Whether `selectedFilters` has been seeded from the selected dashboard's
   * own filters yet — seeding happens once per dashboard selection, so the
   * user's edits aren't overwritten when the dashboard model re-renders. */
  dashboardFiltersSeeded: boolean;

  /** Values from a deep link that couldn't auto-connect (e.g. no token) —
   * used to prefill the connection form. */
  connectionPrefill: Partial<ConnectionInfo>;

  /** Dashboard/widget ids from a deep link, still waiting for their lists
   * to load so they can be selected. Cleared once resolved. */
  pendingDeepLink: { dashboardId?: string; widgetId?: string } | null;

  /** Why a deep-linked dashboard/widget couldn't be opened. Cleared on the
   * next manual selection. */
  deepLinkError: string | null;

  /** File type picked on the export step. Kept across exports. */
  fileFormat: ExportFormat;

  chunkSize: number;
  offset: number;
  rowsExported: number;
  status: ExportStatus;
  startedAt: number | null;
  error: string | null;

  /**
   * The row-count probe's result. `null` means "no estimate
   * available"; use `rowsExported > totalRowsEstimate` to detect the
   * estimate having been wrong (see ExportProgress).
   */
  totalRowsEstimate: number | null;

  /**
   * The file name actually used for the current/last export, once known
   * (set once `useExportRun` observes the sink open — see
   * `lib/file-sink.ts`'s `getFileName()`). Browsers don't expose a full
   * filesystem path to web pages, only the name — see ExportSummary.
   */
  exportedFileName: string | null;

  /** Set when an XLSX export stopped at Excel's per-sheet row limit with
   * more rows still left in the widget. */
  truncatedAtRowLimit: boolean;

  /** How long the last few chunks each took to settle, most recent last —
   * capped at CHUNK_DURATION_WINDOW entries. Drives the ETA off a recent
   * average instead of the whole run's average, so one slow (cold-cache)
   * chunk doesn't permanently drag down the estimate for the rest of the
   * export. */
  recentChunkDurationsMs: number[];

  /** Wall-clock time the page currently being awaited was requested at —
   * lets the UI show a "taking longer than expected" notice if a single
   * page runs long, independent of the whole export's elapsed time. */
  currentRequestStartedAt: number | null;

  applyDeepLink: (link: DeepLink) => void;
  setWidgetTypes: (widgetTypes: string[]) => void;
  resolveDeepLinkDashboard: (dashboard: DashboardSummary | null) => void;
  resolveDeepLinkWidget: (widget: WidgetSummary | null) => void;
  connect: (connection: ConnectionInfo) => void;
  disconnect: () => void;
  selectDashboard: (dashboard: DashboardSummary) => void;
  setFilters: (filters: Filter[]) => void;
  setFileFormat: (fileFormat: ExportFormat) => void;
  seedDashboardFilters: (filters: Filter[]) => void;
  selectWidget: (widget: WidgetSummary) => void;
  clearWidget: () => void;
  goToStep: (step: WizardStep) => void;
  goBack: () => void;
  goForward: () => void;
  startExport: () => void;
  cancelExport: () => void;
  advanceOffset: (rowsInChunk: number) => void;
  recordChunkDuration: (durationMs: number) => void;
  setCurrentRequestStartedAt: (startedAt: number | null) => void;
  setTotalRowsEstimate: (totalRowsEstimate: number) => void;
  setExportedFileName: (exportedFileName: string) => void;
  finishExport: (finalChunkRows?: number, truncatedAtRowLimit?: boolean) => void;
  failExport: (error: string) => void;
  reset: () => void;
}

/** How many recent chunk durations the ETA averages over. */
export const CHUNK_DURATION_WINDOW = 5;

// Raised from 20,000 — no documented max in the SDK, and fewer distinct
// offsets means fewer slow first requests for a new offset.
// Untested at this size; revisit if a single chunk's cold cost turns out to
// scale with count rather than being roughly a flat per-offset tax.
const CHUNK_SIZE = 50_000;

const initialExportState = {
  chunkSize: CHUNK_SIZE,
  offset: 0,
  rowsExported: 0,
  status: 'idle' as ExportStatus,
  startedAt: null,
  error: null,
  totalRowsEstimate: null as number | null,
  exportedFileName: null as string | null,
  truncatedAtRowLimit: false,
  recentChunkDurationsMs: [] as number[],
  currentRequestStartedAt: null as number | null,
};

export const useExportStore = create<ExportStoreState>((set, get) => ({
  step: 'connect',
  connection: null,
  embedded: false,
  widgetTypes: DEFAULT_WIDGET_TYPES,
  dashboard: null,
  widget: null,
  selectedFilters: [],
  dashboardFiltersSeeded: false,
  connectionPrefill: {},
  pendingDeepLink: null,
  deepLinkError: null,
  fileFormat: 'xlsx',
  ...initialExportState,

  applyDeepLink: ({ url, token, dashboardId, widgetId, embedded = false }) => {
    // Kept even when we can't connect yet, so it still applies once the
    // user finishes the connection form.
    const pendingDeepLink = dashboardId ? { dashboardId, widgetId } : null;
    const validUrl = url && isValidUrl(url) ? url : undefined;
    if (!validUrl || !token) {
      set({ connectionPrefill: { url, token }, pendingDeepLink, embedded });
      return;
    }
    set({ connection: { url: validUrl, token }, step: 'dashboard', pendingDeepLink, embedded });
  },

  setWidgetTypes: (widgetTypes) => set({ widgetTypes }),

  resolveDeepLinkDashboard: (dashboard) => {
    const pending = get().pendingDeepLink;
    if (!pending) return;
    if (!dashboard) {
      set({
        pendingDeepLink: null,
        deepLinkError: `Dashboard "${pending.dashboardId}" wasn't found, or you don't have access to it.`,
      });
      return;
    }
    get().selectDashboard(dashboard);
    set({ pendingDeepLink: pending.widgetId ? { widgetId: pending.widgetId } : null });
  },

  resolveDeepLinkWidget: (widget) => {
    const pending = get().pendingDeepLink;
    if (!pending) return;
    if (!widget) {
      set({
        pendingDeepLink: null,
        deepLinkError: `Widget "${pending.widgetId}" wasn't found in this dashboard, or can't be exported.`,
      });
      return;
    }
    get().selectWidget(widget);
    set({ pendingDeepLink: null });
  },

  connect: (connection) => set({ connection, step: 'dashboard' }),

  disconnect: () =>
    set({
      connection: null,
      dashboard: null,
      widget: null,
      selectedFilters: [],
      dashboardFiltersSeeded: false,
      pendingDeepLink: null,
      deepLinkError: null,
      step: 'connect',
      ...initialExportState,
    }),

  selectDashboard: (dashboard) =>
    set({
      dashboard,
      widget: null,
      selectedFilters: [],
      dashboardFiltersSeeded: false,
      pendingDeepLink: null,
      deepLinkError: null,
      step: 'widget',
    }),

  setFilters: (selectedFilters) => set({ selectedFilters }),

  setFileFormat: (fileFormat) => set({ fileFormat }),

  seedDashboardFilters: (filters) => {
    if (get().dashboardFiltersSeeded) return;
    set({ selectedFilters: filters, dashboardFiltersSeeded: true });
  },

  selectWidget: (widget) =>
    set({
      widget,
      deepLinkError: null,
      // A fresh widget selection shouldn't carry over a previous widget's
      // stale status/error — navigating back and forth on the *same*
      // widget (via goBack/goForward) intentionally preserves it instead.
      // Stays on 'widget': WidgetPicker shows the preview + filters panel
      // in place, and the user moves on via goForward (Continue to export).
      ...initialExportState,
    }),

  // Clears just the widget selection so WidgetPicker falls back to the
  // combobox — used by its "Change widget" action. Dashboard and filters
  // stay put, unlike selectDashboard.
  clearWidget: () => set({ widget: null, ...initialExportState }),

  goToStep: (step) => set({ step }),

  goBack: () => {
    const { step, status } = get();
    if (step === 'dashboard') {
      // Inside Sisense the connection comes from the session, not the form.
      if (!get().embedded) get().disconnect();
    } else if (step === 'widget') {
      set({ step: 'dashboard' });
    } else if (step === 'export' && status !== 'running') {
      set({ step: 'widget' });
    }
  },

  goForward: () => {
    const { step, dashboard, widget, status } = get();
    if (step === 'dashboard' && dashboard) {
      set({ step: 'widget' });
    } else if (step === 'widget' && widget) {
      set({ step: 'export' });
    } else if (step === 'export' && status === 'done') {
      set({ step: 'done' });
    }
  },

  startExport: () =>
    set({
      status: 'running',
      offset: 0,
      rowsExported: 0,
      startedAt: Date.now(),
      error: null,
      totalRowsEstimate: null,
      exportedFileName: null,
      truncatedAtRowLimit: false,
      recentChunkDurationsMs: [],
      currentRequestStartedAt: null,
    }),

  // Deliberately leaves `step` at 'export' — the user stays on this screen,
  // which now shows its 'idle' substate (the "Start export" button) so they
  // can immediately retry. See useExportRun.ts for how the in-flight write
  // is stopped and the partial file is closed.
  cancelExport: () => set({ ...initialExportState }),

  advanceOffset: (rowsInChunk) =>
    set((s) => ({
      offset: s.offset + rowsInChunk,
      rowsExported: s.rowsExported + rowsInChunk,
    })),

  recordChunkDuration: (durationMs) =>
    set((s) => ({
      recentChunkDurationsMs: [...s.recentChunkDurationsMs, durationMs].slice(
        -CHUNK_DURATION_WINDOW,
      ),
    })),

  setCurrentRequestStartedAt: (currentRequestStartedAt) => set({ currentRequestStartedAt }),

  setTotalRowsEstimate: (totalRowsEstimate) => set({ totalRowsEstimate }),

  setExportedFileName: (exportedFileName) => set({ exportedFileName }),

  finishExport: (finalChunkRows = 0, truncatedAtRowLimit = false) =>
    set((s) => ({
      status: 'done',
      step: 'done',
      rowsExported: s.rowsExported + finalChunkRows,
      truncatedAtRowLimit,
    })),

  failExport: (error) => set({ status: 'error', error }),

  reset: () =>
    set({
      step: 'dashboard',
      widget: null,
      selectedFilters: [],
      dashboardFiltersSeeded: false,
      pendingDeepLink: null,
      deepLinkError: null,
      ...initialExportState,
    }),
}));
