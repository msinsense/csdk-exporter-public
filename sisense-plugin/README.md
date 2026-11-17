# csdkExporter — Sisense plugin

Adds an **Export with CSDK Exporter** item to the "..." menu of Sisense
dashboards and widgets (Pivot Tables by default). Clicking it opens the CSDK Exporter app,
already connected as the logged-in user, on that dashboard or widget.

The app is bundled in the plugin (`app/`, added by `npm run build` to
`dist/csdkExporter.zip`) and opens in a modal inside Sisense. Nothing to host.

## Configure

Edit `config.js`:

| Key | Description |
|---|---|
| `openIn` | `'modal'` (default, inside Sisense) or `'tab'`. |
| `dashboards` / `widgets` | `{ mode, ids }`. `mode`: `'all'`, `'allowlist'` (only these ids) or `'blocklist'` (all except these ids). |
| `widgetTypes` | Sisense widget types that get the menu item and can be picked in the app, e.g. `'pivot2'`, `'tablewidget'`, `'chart/bar'`. `[]` allows every widget with data. Default: `['pivot2', 'pivot']`. |
| `label` | Menu item text. |
| `showInMenus` | `false` hides the menu item. |
| `debug` | `true` logs the menus the plugin sees to the browser console. |
| `target` | Window the app opens in when `openIn` is `'tab'`. Default: `'_blank'`. |

## Run

1. Copy the `csdkExporter` folder into Sisense's `plugins` folder
   (Admin → App Configuration → File Management). See
   [Sisense add-ons](https://docs.sisense.com/win/SisenseWin/sisense-add-ons.htm).
2. Wait for the plugins to rebuild, then reload a dashboard.

## Sisense URLs

The plugin works out where Sisense is served from the page URL, so it works
at the root (`/app/main`), on a tenant (`/acme/app/main`), and behind a
reverse-proxy path (`/bi/acme/app/main`) with no extra settings. It asks each
possible path whether the user is signed in there and uses the first that
says yes. With `debug: true`, the app shows the Sisense URL it connected to.
