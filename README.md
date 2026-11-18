# CSDK Exporter

A Sisense plugin that exports a widget's full result set to **Excel (.xlsx)** or
**CSV**, up to about a million rows, without rendering the data in the
dashboard.

It adds an **Export with CSDK Exporter** item to the "..." menu of dashboards
and widgets. The item opens a small app inside Sisense, already signed in as
the current user, where you can:

- pick the widget (Pivot Tables by default; other types can be enabled),
- preview its data and add filters,
- export it to a file on your computer, page by page, with progress and an
  estimated time left.

The export runs the widget's own query as the signed-in user, so it respects
the same data security as the dashboard. The app is built with
[Compose SDK](https://sisense.dev/guides/sdk/) and ships inside the plugin, so
there is nothing to host.

## Disclaimer: a custom, unofficial plugin

**CSDK Exporter is *not* an official Sisense product, plugin or add-on.** It
is a custom, external solution built on Sisense's public APIs and Compose SDK,
shared as-is.

- **No SLA or official support:** it isn't covered by any Sisense Service
  Level Agreement or support contract. Don't open Sisense Support tickets for
  it.
- **Not part of Sisense's product processes:** it doesn't go through
  Sisense's product QA, security review or release lifecycle.
- **No compatibility guarantees:** Sisense and Compose SDK may change between
  versions, and the plugin may break as a result.
- **No guaranteed updates:** this repository is where the plugin is
  published, not a maintained product. Fork it and make the changes you need
  in your own copy.
- **Use at your own risk:** test it in a non-production environment first.

## Install

1. Download `csdkExporter.zip` from the
   [latest release](../../releases/latest) and unzip it. You get a
   `csdkExporter` folder.
2. In Sisense, go to **Admin → App Configuration → File Management** and copy
   the `csdkExporter` folder into `plugins`. See
   [Sisense add-ons](https://docs.sisense.com/win/SisenseWin/sisense-add-ons.htm).
3. Wait for Sisense to rebuild its plugins, then reload a dashboard.

To update, replace the folder with the one from a newer release. Keep your
own `config.js` if you changed it.

## Configure

Edit `csdkExporter/config.js`:

| Key | Description |
|---|---|
| `openIn` | `'modal'` (default, inside Sisense) or `'tab'`. |
| `dashboards` / `widgets` | `{ mode, ids }`. `mode`: `'all'`, `'allowlist'` (only these ids) or `'blocklist'` (all except these ids). |
| `widgetTypes` | Sisense widget types that get the menu item and can be exported, e.g. `'pivot2'`, `'tablewidget'`, `'chart/bar'`. `[]` allows every widget with data. Default: `['pivot2', 'pivot']`. |
| `label` | Menu item text. |
| `showInMenus` | `false` hides the menu item. |
| `debug` | `true` logs the menus the plugin sees to the browser console. |
| `target` | Window the app opens in when `openIn` is `'tab'`. Default: `'_blank'`. |

Text, filter and custom widgets have no data and are never exported.

## Good to know

- **Browser:** Chrome and Edge write the file to disk as it's exported, so
  memory stays flat. Firefox and Safari build the file in memory and download
  it at the end, so very large exports may fail there. Writing to disk also
  needs Sisense served over HTTPS.
- **Excel limit:** a sheet holds up to 1,048,575 data rows. Larger exports
  stop there and say so; use CSV for more.
- **Pivot Tables** export as a flat table, one row per combination of row and
  column values. Subtotals and grand totals aren't included.
- **Keep the tab open:** the export runs in the Sisense tab and stops if the
  tab is closed or reloaded. Moving between dashboards is fine.
- **Sign-in:** the app reuses the signed-in user's Sisense session, so it
  works for every role. It finds the right Sisense URL on its own, including
  tenants (`/<tenant>/app/main`), reverse-proxy paths and subdomains. Set
  `debug: true` to see the URL it connected to.

## Build from source

Requires Node 24 or later.

```bash
npm ci
npm run build
```

`dist/csdkExporter.zip` is the plugin, with the app under `app/`. Run
`npm test` for the tests, and `npm run dev` to work on the app on its own
(connect with your Sisense URL and an API token; add the dev server's origin
to Sisense's CORS allow-list first).

## License

[MIT](LICENSE)
