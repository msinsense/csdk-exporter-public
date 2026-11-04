// Edit this file to configure the plugin, then reload Sisense.
window.csdkExporterConfig = {
  // How the app (bundled in this plugin, served by Sisense) opens:
  // 'modal' (inside Sisense) or 'tab'.
  openIn: 'modal',

  // mode: 'all' | 'allowlist' (only these ids) | 'blocklist' (all except these ids)
  dashboards: { mode: 'all', ids: [] },
  widgets: { mode: 'all', ids: [] },

  // Widget types that get the menu item and can be picked in the app.
  // [] allows every widget with data (not text, filter or custom widgets).
  widgetTypes: ['pivot2', 'pivot'],

  label: 'Export with CSDK Exporter',

  // "..." menu items on dashboards and widgets.
  showInMenus: true,

  // Logs every Sisense menu the plugin sees to the browser console.
  debug: false,

  // Window target when the app opens in a tab.
  target: '_blank',
};
