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

  // Paths Sisense may be served under, most specific first, taken from the
  // page path: '/proxy/acme/app/main/...' -> ['/proxy/acme', '/proxy', ''].
  // Covers the root, tenants, reverse-proxy prefixes and their mix.
  function candidateBasePaths(pathname) {
    const segments = String(pathname || '')
      .split('/')
      .filter(Boolean);
    let end = -1;
    segments.forEach((segment, index) => {
      if (segment.toLowerCase() === 'app') end = index;
    });
    if (end < 0) end = Math.min(segments.length, 3);
    const paths = [];
    for (let length = end; length >= 0; length--) {
      paths.push(length ? `/${segments.slice(0, length).join('/')}` : '');
    }
    return paths;
  }

  // Whether an /api/auth/isauth response says the user is signed in there.
  function isSignedInResponse(status, contentType, body) {
    if (status !== 200 || !String(contentType || '').includes('application/json')) return false;
    return Boolean(body?.isAuthenticated);
  }

  // Same origin as Sisense, so the app reuses the user's session.
  // `url` is the Sisense base URL to connect to, with the tenant path.
  function buildEmbeddedUrl(appUrl, params) {
    const url = new URL(appUrl);
    url.searchParams.set('embedded', '1');
    if (params.url) url.searchParams.set('url', params.url);
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
    candidateBasePaths,
    isSignedInResponse,
    buildEmbeddedUrl,
    readStatusMessage,
  };
})(typeof window !== 'undefined' ? window : globalThis);
