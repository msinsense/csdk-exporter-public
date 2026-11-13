import { beforeEach, describe, expect, it } from 'vitest';
import { CHUNK_DURATION_WINDOW, useExportStore } from './export-store';

const initialState = useExportStore.getState();

beforeEach(() => {
  useExportStore.setState(initialState, true);
});

describe('useExportStore', () => {
  it('starts on the connect step with no selections', () => {
    const state = useExportStore.getState();
    expect(state.step).toBe('connect');
    expect(state.connection).toBeNull();
    expect(state.dashboard).toBeNull();
    expect(state.widget).toBeNull();
  });

  it('advances connect -> dashboard -> widget -> export as selections are made', () => {
    const { connect, selectDashboard, setFilters, selectWidget } = useExportStore.getState();

    connect({ url: 'https://example.sisense.com', token: 'abc' });
    expect(useExportStore.getState().step).toBe('dashboard');

    selectDashboard({ oid: 'dash-1', title: 'Sales', dataSource: 'Sample ECommerce' });
    expect(useExportStore.getState().step).toBe('widget');
    expect(useExportStore.getState().widget).toBeNull();

    // Widget step: pick a widget, then optionally filter before continuing —
    // both happen in place, without changing `step`.
    selectWidget({ oid: 'widget-1', title: 'Revenue by region' });
    setFilters([{ some: 'filter' } as never]);
    expect(useExportStore.getState().step).toBe('widget');

    useExportStore.getState().goForward();
    expect(useExportStore.getState().step).toBe('export');
  });

  it('picking a new dashboard clears any previously selected widget and filters', () => {
    const { connect, selectDashboard, setFilters, selectWidget } = useExportStore.getState();

    connect({ url: 'https://example.sisense.com', token: 'abc' });
    selectDashboard({ oid: 'dash-1', title: 'Sales', dataSource: 'Sample ECommerce' });
    selectWidget({ oid: 'widget-1', title: 'Revenue by region' });
    setFilters([{ some: 'filter' } as never]);

    selectDashboard({ oid: 'dash-2', title: 'Marketing', dataSource: 'Sample ECommerce' });
    expect(useExportStore.getState().widget).toBeNull();
    expect(useExportStore.getState().selectedFilters).toEqual([]);
    expect(useExportStore.getState().step).toBe('widget');
  });

  it('tracks export progress via startExport/advanceOffset/finishExport', () => {
    const { startExport, advanceOffset, finishExport } = useExportStore.getState();

    startExport();
    expect(useExportStore.getState().status).toBe('running');
    expect(useExportStore.getState().offset).toBe(0);

    advanceOffset(20_000);
    advanceOffset(20_000);
    expect(useExportStore.getState().offset).toBe(40_000);
    expect(useExportStore.getState().rowsExported).toBe(40_000);

    finishExport(5_000);
    expect(useExportStore.getState().status).toBe('done');
    expect(useExportStore.getState().step).toBe('done');
    expect(useExportStore.getState().rowsExported).toBe(45_000);
  });

  it('records an error via failExport without changing the step', () => {
    const { startExport, failExport } = useExportStore.getState();

    startExport();
    failExport('network error');

    const state = useExportStore.getState();
    expect(state.status).toBe('error');
    expect(state.error).toBe('network error');
  });

  it('disconnect resets everything back to the connect step', () => {
    const { connect, selectDashboard, disconnect } = useExportStore.getState();

    connect({ url: 'https://example.sisense.com', token: 'abc' });
    selectDashboard({ oid: 'dash-1', title: 'Sales', dataSource: 'Sample ECommerce' });

    disconnect();

    const state = useExportStore.getState();
    expect(state.step).toBe('connect');
    expect(state.connection).toBeNull();
    expect(state.dashboard).toBeNull();
  });

  it('selecting a new widget resets stale progress from a previous attempt', () => {
    const { connect, selectDashboard, selectWidget, startExport, failExport } =
      useExportStore.getState();

    connect({ url: 'https://example.sisense.com', token: 'abc' });
    selectDashboard({ oid: 'dash-1', title: 'Sales', dataSource: 'Sample ECommerce' });
    selectWidget({ oid: 'widget-1', title: 'Revenue' });
    startExport();
    failExport('boom');
    expect(useExportStore.getState().status).toBe('error');

    selectWidget({ oid: 'widget-2', title: 'Costs' });

    const state = useExportStore.getState();
    expect(state.status).toBe('idle');
    expect(state.error).toBeNull();
  });

  describe('goBack / goForward', () => {
    function setUpAtExportStep() {
      const { connect, selectDashboard, selectWidget, goForward } = useExportStore.getState();
      connect({ url: 'https://example.sisense.com', token: 'abc' });
      selectDashboard({ oid: 'dash-1', title: 'Sales', dataSource: 'Sample ECommerce' });
      selectWidget({ oid: 'widget-1', title: 'Revenue' });
      goForward(); // widget -> export
    }

    it('goBack from dashboard disconnects back to the connect step', () => {
      useExportStore.getState().connect({ url: 'https://example.sisense.com', token: 'abc' });

      useExportStore.getState().goBack();

      const state = useExportStore.getState();
      expect(state.step).toBe('connect');
      expect(state.connection).toBeNull();
    });

    it('goBack from widget returns to dashboard without clearing the widget', () => {
      setUpAtExportStep();
      useExportStore.getState().goBack(); // export -> widget

      useExportStore.getState().goBack(); // widget -> dashboard

      const state = useExportStore.getState();
      expect(state.step).toBe('dashboard');
      expect(state.widget).toEqual({ oid: 'widget-1', title: 'Revenue' });
    });

    it('goForward from dashboard returns to widget when a widget is still selected', () => {
      setUpAtExportStep();
      useExportStore.getState().goBack(); // export -> widget
      useExportStore.getState().goBack(); // widget -> dashboard

      useExportStore.getState().goForward();

      expect(useExportStore.getState().step).toBe('widget');
    });

    it('goForward from dashboard is a no-op when nothing is selected yet', () => {
      useExportStore.getState().connect({ url: 'https://example.sisense.com', token: 'abc' });

      useExportStore.getState().goForward();

      expect(useExportStore.getState().step).toBe('dashboard');
    });

    it('goBack from export is disabled while the export is running', () => {
      setUpAtExportStep();
      useExportStore.getState().startExport();
      expect(useExportStore.getState().status).toBe('running');

      useExportStore.getState().goBack();

      expect(useExportStore.getState().step).toBe('export');
    });

    it('goBack from export goes to widget once not running', () => {
      setUpAtExportStep();
      useExportStore.getState().startExport();
      useExportStore.getState().failExport('boom');

      useExportStore.getState().goBack();

      expect(useExportStore.getState().step).toBe('widget');
    });

    it('goForward from export only advances to done once the export has finished', () => {
      setUpAtExportStep();
      useExportStore.getState().startExport();

      useExportStore.getState().goForward();
      expect(useExportStore.getState().step).toBe('export');

      useExportStore.getState().finishExport(100);
      useExportStore.getState().goToStep('export');
      useExportStore.getState().goForward();
      expect(useExportStore.getState().step).toBe('done');
    });
  });

  it('startExport resets a stale totalRowsEstimate from a previous run', () => {
    const { connect, selectDashboard, selectWidget, startExport, setTotalRowsEstimate } =
      useExportStore.getState();
    connect({ url: 'https://example.sisense.com', token: 'abc' });
    selectDashboard({ oid: 'dash-1', title: 'Sales', dataSource: 'Sample ECommerce' });
    selectWidget({ oid: 'widget-1', title: 'Revenue' });

    setTotalRowsEstimate(1_000_000);
    expect(useExportStore.getState().totalRowsEstimate).toBe(1_000_000);

    startExport();

    expect(useExportStore.getState().totalRowsEstimate).toBeNull();
  });

  describe('cancelExport', () => {
    it('stops a running export, staying on the export step so the user can retry', () => {
      const { connect, selectDashboard, selectWidget, goForward, startExport, cancelExport } =
        useExportStore.getState();
      connect({ url: 'https://example.sisense.com', token: 'abc' });
      selectDashboard({ oid: 'dash-1', title: 'Sales', dataSource: 'Sample ECommerce' });
      selectWidget({ oid: 'widget-1', title: 'Revenue' });
      goForward(); // widget -> export
      startExport();
      useExportStore.setState({ rowsExported: 40_000, offset: 40_000, totalRowsEstimate: 500_000 });

      cancelExport();

      const state = useExportStore.getState();
      expect(state.status).toBe('idle');
      expect(state.step).toBe('export');
      expect(state.rowsExported).toBe(0);
      expect(state.offset).toBe(0);
      expect(state.totalRowsEstimate).toBeNull();
    });
  });

  it('records the exported file name, and clears it on the next startExport', () => {
    const { connect, selectDashboard, selectWidget, startExport, setExportedFileName } =
      useExportStore.getState();
    connect({ url: 'https://example.sisense.com', token: 'abc' });
    selectDashboard({ oid: 'dash-1', title: 'Sales', dataSource: 'Sample ECommerce' });
    selectWidget({ oid: 'widget-1', title: 'Revenue' });
    startExport();

    setExportedFileName('export.csv');
    expect(useExportStore.getState().exportedFileName).toBe('export.csv');

    startExport();
    expect(useExportStore.getState().exportedFileName).toBeNull();
  });

  describe('recordChunkDuration', () => {
    it('keeps only the most recent CHUNK_DURATION_WINDOW durations', () => {
      const { recordChunkDuration } = useExportStore.getState();

      for (let i = 1; i <= CHUNK_DURATION_WINDOW + 2; i++) {
        recordChunkDuration(i * 100);
      }

      const { recentChunkDurationsMs } = useExportStore.getState();
      expect(recentChunkDurationsMs).toHaveLength(CHUNK_DURATION_WINDOW);
      // Oldest entries (100, 200) dropped, most recent kept, in order.
      expect(recentChunkDurationsMs).toEqual([300, 400, 500, 600, 700]);
    });

    it("is reset by startExport, so a new run does not inherit the last one's pacing", () => {
      const { recordChunkDuration, startExport } = useExportStore.getState();
      recordChunkDuration(5000);
      expect(useExportStore.getState().recentChunkDurationsMs).toEqual([5000]);

      startExport();

      expect(useExportStore.getState().recentChunkDurationsMs).toEqual([]);
    });
  });

  it('setCurrentRequestStartedAt sets and clears the in-flight request timestamp', () => {
    const { setCurrentRequestStartedAt } = useExportStore.getState();
    const now = Date.now();

    setCurrentRequestStartedAt(now);
    expect(useExportStore.getState().currentRequestStartedAt).toBe(now);

    setCurrentRequestStartedAt(null);
    expect(useExportStore.getState().currentRequestStartedAt).toBeNull();
  });

  describe('setFilters', () => {
    it("stores the filters picked in the widget step's filters panel", () => {
      const { connect, selectDashboard, setFilters } = useExportStore.getState();
      connect({ url: 'https://example.sisense.com', token: 'abc' });
      selectDashboard({ oid: 'dash-1', title: 'Sales', dataSource: 'Sample ECommerce' });

      const filters = [{ some: 'filter' } as never];
      setFilters(filters);

      expect(useExportStore.getState().selectedFilters).toBe(filters);
    });

    it('is reset by disconnect', () => {
      const { connect, selectDashboard, setFilters, disconnect } = useExportStore.getState();
      connect({ url: 'https://example.sisense.com', token: 'abc' });
      selectDashboard({ oid: 'dash-1', title: 'Sales', dataSource: 'Sample ECommerce' });
      setFilters([{ some: 'filter' } as never]);

      disconnect();

      expect(useExportStore.getState().selectedFilters).toEqual([]);
    });
  });

  describe('applyDeepLink', () => {
    it('connects straight away with a valid url and token, keeping the ids pending', () => {
      useExportStore.getState().applyDeepLink({
        url: 'https://my.sisense.com',
        token: 'abc',
        dashboardId: 'd-1',
        widgetId: 'w-1',
      });

      const state = useExportStore.getState();
      expect(state.connection).toEqual({ url: 'https://my.sisense.com', token: 'abc' });
      expect(state.step).toBe('dashboard');
      expect(state.pendingDeepLink).toEqual({ dashboardId: 'd-1', widgetId: 'w-1' });
    });

    it('only prefills the connection form without a token or with an invalid url', () => {
      useExportStore
        .getState()
        .applyDeepLink({ url: 'https://my.sisense.com', dashboardId: 'd-1' });
      expect(useExportStore.getState().connection).toBeNull();
      expect(useExportStore.getState().connectionPrefill).toEqual({
        url: 'https://my.sisense.com',
        token: undefined,
      });
      // Still applied once the user connects through the form.
      expect(useExportStore.getState().pendingDeepLink).toEqual({
        dashboardId: 'd-1',
        widgetId: undefined,
      });

      useExportStore.getState().applyDeepLink({ url: 'javascript:alert(1)', token: 'abc' });
      expect(useExportStore.getState().connection).toBeNull();
    });

    it('keeps the embedded flag, which stops Back from disconnecting', () => {
      useExportStore
        .getState()
        .applyDeepLink({ url: 'https://my.sisense.com', token: 'abc', embedded: true });
      expect(useExportStore.getState().embedded).toBe(true);

      useExportStore.getState().goBack();
      expect(useExportStore.getState().connection).not.toBeNull();
      expect(useExportStore.getState().step).toBe('dashboard');
    });

    it('connects with the Sisense session and no token', () => {
      useExportStore.getState().applyDeepLink({
        url: 'https://my.sisense.com',
        embedded: true,
        useSession: true,
        dashboardId: 'd-1',
      });
      expect(useExportStore.getState().connection).toEqual({
        url: 'https://my.sisense.com',
        token: '',
        useSession: true,
      });
      expect(useExportStore.getState().step).toBe('dashboard');
    });

    it('ignores a widget id without a dashboard id', () => {
      useExportStore
        .getState()
        .applyDeepLink({ url: 'https://my.sisense.com', token: 'abc', widgetId: 'w-1' });
      expect(useExportStore.getState().pendingDeepLink).toBeNull();
    });

    it('a manual dashboard pick clears any pending link and error', () => {
      useExportStore.setState({ pendingDeepLink: { widgetId: 'w-1' }, deepLinkError: 'oops' });
      useExportStore
        .getState()
        .selectDashboard({ oid: 'd-2', title: 'Marketing', dataSource: 'Sample ECommerce' });

      expect(useExportStore.getState().pendingDeepLink).toBeNull();
      expect(useExportStore.getState().deepLinkError).toBeNull();
    });
  });

  describe('fileFormat', () => {
    it('defaults to xlsx and survives starting a new export', () => {
      expect(useExportStore.getState().fileFormat).toBe('xlsx');
      useExportStore.getState().setFileFormat('csv');
      useExportStore.getState().startExport();
      expect(useExportStore.getState().fileFormat).toBe('csv');
    });

    it('finishExport records whether the export was truncated, and startExport clears it', () => {
      const { startExport, finishExport } = useExportStore.getState();
      startExport();
      finishExport(3, true);
      expect(useExportStore.getState().truncatedAtRowLimit).toBe(true);

      startExport();
      expect(useExportStore.getState().truncatedAtRowLimit).toBe(false);
    });
  });

  describe('seedDashboardFilters', () => {
    it('seeds filters once per dashboard selection', () => {
      const { connect, selectDashboard, seedDashboardFilters } = useExportStore.getState();
      connect({ url: 'https://example.sisense.com', token: 'abc' });
      selectDashboard({ oid: 'dash-1', title: 'Sales', dataSource: 'Sample ECommerce' });

      seedDashboardFilters([{ name: 'first' } as never]);
      seedDashboardFilters([{ name: 'second' } as never]);
      expect(useExportStore.getState().selectedFilters).toEqual([{ name: 'first' }]);

      selectDashboard({ oid: 'dash-2', title: 'Marketing', dataSource: 'Sample ECommerce' });
      seedDashboardFilters([{ name: 'other' } as never]);
      expect(useExportStore.getState().selectedFilters).toEqual([{ name: 'other' }]);
    });
  });

  describe('clearWidget', () => {
    it('clears just the widget, keeping the dashboard and filters so WidgetPicker falls back to the combobox', () => {
      const { connect, selectDashboard, selectWidget, setFilters, clearWidget } =
        useExportStore.getState();
      connect({ url: 'https://example.sisense.com', token: 'abc' });
      selectDashboard({ oid: 'dash-1', title: 'Sales', dataSource: 'Sample ECommerce' });
      const filters = [{ some: 'filter' } as never];
      setFilters(filters);
      selectWidget({ oid: 'widget-1', title: 'Revenue' });

      clearWidget();

      const state = useExportStore.getState();
      expect(state.widget).toBeNull();
      expect(state.step).toBe('widget');
      expect(state.dashboard).toEqual({
        oid: 'dash-1',
        title: 'Sales',
        dataSource: 'Sample ECommerce',
      });
      expect(state.selectedFilters).toBe(filters);
    });
  });
});
