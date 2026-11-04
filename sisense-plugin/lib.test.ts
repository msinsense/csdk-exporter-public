import { beforeAll, describe, expect, it } from 'vitest';

type Lib = {
  isIdAllowed: (rule: unknown, id: string) => boolean;
  isDashboardAllowed: (config: unknown, dashboardId?: string) => boolean;
  isWidgetAllowed: (config: unknown, dashboardId: string, widget: unknown) => boolean;
  buildEmbeddedUrl: (appUrl: string, params: Record<string, string | undefined>) => string;
  readStatusMessage: (
    event: { source: unknown; origin: string; data: unknown },
    iframeWindow: unknown,
    origin: string,
  ) => { running: boolean } | null;
  menuKind: (
    name: unknown,
    items?: { caption?: string }[],
    hasWidget?: boolean,
  ) => 'widget' | 'dashboard' | null;
  insertMenuItem: (items: { type?: string; caption?: string }[], item: { caption: string }) => void;
};

let lib: Lib;

beforeAll(async () => {
  await import('./lib.js');
  lib = (globalThis as unknown as { CsdkExporterLib: Lib }).CsdkExporterLib;
});

describe('isIdAllowed', () => {
  it('allows everything in "all" mode or with no rule', () => {
    expect(lib.isIdAllowed({ mode: 'all', ids: ['a'] }, 'b')).toBe(true);
    expect(lib.isIdAllowed(undefined, 'b')).toBe(true);
  });

  it('allows only listed ids in allowlist mode', () => {
    const rule = { mode: 'allowlist', ids: ['a'] };
    expect(lib.isIdAllowed(rule, 'a')).toBe(true);
    expect(lib.isIdAllowed(rule, 'b')).toBe(false);
  });

  it('blocks listed ids in blocklist mode', () => {
    const rule = { mode: 'blocklist', ids: ['a'] };
    expect(lib.isIdAllowed(rule, 'a')).toBe(false);
    expect(lib.isIdAllowed(rule, 'b')).toBe(true);
  });
});

describe('isWidgetAllowed', () => {
  const config = {
    dashboards: { mode: 'blocklist', ids: ['blockedDash'] },
    widgets: { mode: 'blocklist', ids: ['blockedWidget'] },
    widgetTypes: ['pivot2'],
  };

  it('allows a pivot widget on an allowed dashboard', () => {
    expect(lib.isWidgetAllowed(config, 'dash', { oid: 'w', type: 'pivot2' })).toBe(true);
  });

  it('rejects other widget types', () => {
    expect(lib.isWidgetAllowed(config, 'dash', { oid: 'w', type: 'chart/bar' })).toBe(false);
  });

  it('rejects widgets on a blocked dashboard', () => {
    expect(lib.isWidgetAllowed(config, 'blockedDash', { oid: 'w', type: 'pivot2' })).toBe(false);
  });

  it('rejects blocked widgets', () => {
    expect(lib.isWidgetAllowed(config, 'dash', { oid: 'blockedWidget', type: 'pivot2' })).toBe(
      false,
    );
  });

  it('allows any type when widgetTypes is empty', () => {
    expect(lib.isWidgetAllowed({ widgetTypes: [] }, 'dash', { oid: 'w', type: 'x' })).toBe(true);
  });
});

describe('menuKind', () => {
  it('recognizes the widget and dashboard menu name variants', () => {
    expect(lib.menuKind('widget')).toBe('widget');
    expect(lib.menuKind('widget-menu')).toBe('widget');
    expect(lib.menuKind('widgetMenu')).toBe('widget');
    expect(lib.menuKind('dashboard')).toBe('dashboard');
    expect(lib.menuKind('dashboard-menu')).toBe('dashboard');
  });

  it('ignores other menus', () => {
    expect(lib.menuKind('widget-metadataitem')).toBeNull();
    expect(lib.menuKind(undefined)).toBeNull();
    expect(lib.menuKind('other', [{ caption: 'Sort' }], true)).toBeNull();
  });

  it('falls back to menus with a Download item when the name is unknown', () => {
    const items = [{ caption: 'Duplicate' }, { caption: 'Download' }];
    expect(lib.menuKind('something-else', items, true)).toBe('widget');
    expect(lib.menuKind('something-else', items, false)).toBe('dashboard');
  });
});

describe('insertMenuItem', () => {
  it('puts the item right after Download', () => {
    const items = [{ caption: 'Duplicate' }, { caption: 'Download' }, { type: 'separator' }];
    lib.insertMenuItem(items, { caption: 'Export' });
    expect(items.map((item) => item.caption ?? item.type)).toEqual([
      'Duplicate',
      'Download',
      'Export',
      'separator',
    ]);
  });

  it('appends after a separator when there is no Download item', () => {
    const items = [{ caption: 'Duplicate' }];
    lib.insertMenuItem(items, { caption: 'Export' });
    expect(items.map((item) => item.caption ?? item.type)).toEqual([
      'Duplicate',
      'separator',
      'Export',
    ]);
  });
});

describe('buildEmbeddedUrl', () => {
  it('adds the embedded flag and the ids, never a token', () => {
    const url = lib.buildEmbeddedUrl('https://bi.example.com/plugins/csdkExporter/app/index.html', {
      dashboardId: 'd1',
      widgetId: 'w1',
    });
    expect(url).toBe(
      'https://bi.example.com/plugins/csdkExporter/app/index.html?embedded=1&dashboardId=d1&widgetId=w1',
    );
  });

  it('leaves out missing ids', () => {
    expect(lib.buildEmbeddedUrl('https://bi.example.com/app/', { dashboardId: 'd1' })).toBe(
      'https://bi.example.com/app/?embedded=1&dashboardId=d1',
    );
  });
});

describe('readStatusMessage', () => {
  const iframeWindow = {};
  const origin = 'https://bi.example.com';

  it('reads the running flag from the app iframe', () => {
    const event = {
      source: iframeWindow,
      origin,
      data: { type: 'csdkExporter:status', running: true },
    };
    expect(lib.readStatusMessage(event, iframeWindow, origin)).toEqual({ running: true });
  });

  it('ignores other sources, origins and message types', () => {
    const data = { type: 'csdkExporter:status', running: true };
    expect(lib.readStatusMessage({ source: {}, origin, data }, iframeWindow, origin)).toBeNull();
    expect(
      lib.readStatusMessage(
        { source: iframeWindow, origin: 'https://evil.example', data },
        iframeWindow,
        origin,
      ),
    ).toBeNull();
    expect(
      lib.readStatusMessage(
        { source: iframeWindow, origin, data: { type: 'other' } },
        iframeWindow,
        origin,
      ),
    ).toBeNull();
    expect(
      lib.readStatusMessage({ source: iframeWindow, origin, data }, undefined, origin),
    ).toBeNull();
  });
});
