// Adds "Export with CSDK Exporter" to dashboards and Pivot widgets. Clicking it
// opens the exporter app bundled in this plugin, in a modal or a tab. The app
// gets its own token from the user's Sisense session.
(() => {
  const config = window.csdkExporterConfig || {};
  const lib = window.CsdkExporterLib;
  const BUNDLED_APP_PATH = '/plugins/csdkExporter/app/index.html';

  console.info('[csdkExporter] loaded', {
    openIn: config.openIn || 'modal',
    debug: Boolean(config.debug),
  });

  function debug(...args) {
    if (config.debug) console.info('[csdkExporter]', ...args);
  }

  // Modal with the bundled app in a same-origin iframe.
  let modal = null;
  let exportRunning = false;

  window.addEventListener('message', (event) => {
    const status = lib.readStatusMessage(
      event,
      modal?.iframe.contentWindow,
      window.location.origin,
    );
    if (status) exportRunning = status.running;
  });

  function onModalKeyDown(event) {
    if (event.key === 'Escape') closeModal();
  }

  function closeModal() {
    if (!modal) return;
    if (exportRunning && !window.confirm('An export is running. Close it and stop the export?')) {
      return;
    }
    modal.root.remove();
    modal = null;
    exportRunning = false;
    document.removeEventListener('keydown', onModalKeyDown);
  }

  function openModal(url) {
    if (modal) return;

    // On document.body, outside Sisense's views, so moving between dashboards
    // doesn't close it.
    const root = document.createElement('div');
    root.style.cssText =
      'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;';
    root.addEventListener('mousedown', (event) => {
      if (event.target === root) closeModal();
    });

    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', config.label || 'CSDK Exporter');
    panel.style.cssText =
      'width:94vw;height:92vh;background:#fff;display:flex;flex-direction:column;box-shadow:0 10px 40px rgba(0,0,0,0.3);';

    const header = document.createElement('div');
    header.style.cssText =
      'display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid #e5e5e5;font:600 14px sans-serif;color:#333;';
    header.textContent = 'CSDK Exporter';

    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '\u00d7';
    close.setAttribute('aria-label', 'Close');
    close.style.cssText =
      'border:0;background:none;font-size:22px;line-height:1;cursor:pointer;color:#555;padding:0 4px;';
    close.addEventListener('click', closeModal);
    header.appendChild(close);

    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.title = 'CSDK Exporter';
    iframe.style.cssText = 'flex:1;width:100%;border:0;';

    panel.append(header, iframe);
    root.appendChild(panel);
    document.body.appendChild(root);
    document.addEventListener('keydown', onModalKeyDown);

    modal = { root, iframe };
  }

  function openExporter(dashboardId, widgetId) {
    const appUrl = new URL(BUNDLED_APP_PATH, window.location.origin).toString();
    const url = lib.buildEmbeddedUrl(appUrl, { dashboardId, widgetId });
    if (config.openIn === 'tab') {
      // Keeps window.opener so the app can reuse this Sisense session.
      window.open(url, config.target || '_blank');
    } else {
      openModal(url);
    }
  }

  function activeDashboardId() {
    return window.prism && prism.activeDashboard ? prism.activeDashboard.oid : undefined;
  }

  // "..." menus
  if (config.showInMenus !== false) {
    prism.on('beforemenu', (_event, args) => {
      const settings = args?.settings;
      if (!settings?.items) return;
      const scope = settings.scope || {};
      const widget = scope.widget || scope.$parent?.widget || args.widget;
      const kind = lib.menuKind(settings.name, settings.items, Boolean(widget));

      debug('beforemenu', {
        name: settings.name,
        kind,
        widgetType: widget?.type,
        widgetId: widget?.oid,
        captions: settings.items.map((item) => item.caption),
      });

      if (kind === 'widget') {
        const dashboardId = widget?.dashboard?.oid || activeDashboardId();
        if (!lib.isWidgetAllowed(config, dashboardId, widget)) {
          debug('widget skipped (type or allow/block list)', {
            dashboardId,
            widget,
          });
          return;
        }
        lib.insertMenuItem(settings.items, {
          caption: config.label,
          execute: () => openExporter(dashboardId, widget.oid),
        });
        return;
      }

      if (kind === 'dashboard') {
        const dashboardId = scope.dashboard?.oid || activeDashboardId();
        if (!lib.isDashboardAllowed(config, dashboardId)) {
          debug('dashboard skipped (allow/block list)', { dashboardId });
          return;
        }
        lib.insertMenuItem(settings.items, {
          caption: config.label,
          execute: () => openExporter(dashboardId),
        });
      }
    });
  }
})();
