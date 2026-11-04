// Pure helpers, kept apart from main.js so they can be unit-tested.
((root) => {
  function isIdAllowed(rule, id) {
    if (!rule?.mode || rule.mode === 'all') return true;
    const listed = (rule.ids || []).includes(id);
    if (rule.mode === 'allowlist') return listed;
    if (rule.mode === 'blocklist') return !listed;
    return true;
  }

  function isDashboardAllowed(config, dashboardId) {
    return Boolean(dashboardId) && isIdAllowed(config.dashboards, dashboardId);
  }

  function isWidgetAllowed(config, dashboardId, widget) {
    if (!widget?.oid) return false;
    if (!isDashboardAllowed(config, dashboardId)) return false;
    const types = config.widgetTypes || [];
    if (types.length > 0 && !types.includes(widget.type)) return false;
    return isIdAllowed(config.widgets, widget.oid);
  }

  // Same origin as Sisense, so the app gets its own token from the session.
  function buildEmbeddedUrl(appUrl, params) {
    const url = new URL(appUrl);
    url.searchParams.set('embedded', '1');
    if (params.dashboardId) url.searchParams.set('dashboardId', params.dashboardId);
    if (params.widgetId) url.searchParams.set('widgetId', params.widgetId);
    return url.toString();
  }

  // A status message from the app's iframe, sent by useExportGuard.
  function readStatusMessage(event, iframeWindow, origin) {
    if (!iframeWindow || event.source !== iframeWindow || event.origin !== origin) return null;
    if (event.data?.type !== 'csdkExporter:status') return null;
    return { running: Boolean(event.data.running) };
  }

  function hasCaption(items, caption) {
    return items.some((item) => String(item?.caption || '').toLowerCase() === caption);
  }

  // Menu names vary across Sisense versions ('widget', 'widget-menu', ...).
  // Unknown names fall back to the menu's content: the widget and dashboard
  // "..." menus are the ones with a "Download" item.
  function menuKind(name, items = [], hasWidget = false) {
    const normalized = String(name || '')
      .toLowerCase()
      .replace(/[^a-z]/g, '');
    if (normalized === 'widget' || normalized === 'widgetmenu') return 'widget';
    if (normalized === 'dashboard' || normalized === 'dashboardmenu') return 'dashboard';
    if (hasCaption(items, 'download')) return hasWidget ? 'widget' : 'dashboard';
    return null;
  }

  // Puts the item right after "Download", or at the end after a separator.
  function insertMenuItem(items, item) {
    const download = items.findIndex(
      (existing) => String(existing?.caption || '').toLowerCase() === 'download',
    );
    if (download >= 0) items.splice(download + 1, 0, item);
    else items.push({ type: 'separator' }, item);
  }

  root.CsdkExporterLib = {
    menuKind,
    insertMenuItem,
    isIdAllowed,
    isDashboardAllowed,
    isWidgetAllowed,
    buildEmbeddedUrl,
    readStatusMessage,
  };
})(typeof window !== 'undefined' ? window : globalThis);
