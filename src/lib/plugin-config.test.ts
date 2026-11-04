import { afterEach, describe, expect, it } from 'vitest';
import { loadPluginConfig, readWidgetTypes } from './plugin-config';
import { DEFAULT_WIDGET_TYPES } from './widget-types';

describe('readWidgetTypes', () => {
  it('reads the configured widget types', () => {
    expect(readWidgetTypes({ widgetTypes: ['pivot2', 'tablewidget'] })).toEqual([
      'pivot2',
      'tablewidget',
    ]);
    expect(readWidgetTypes({ widgetTypes: [] })).toEqual([]);
  });

  it('falls back to the default when missing or invalid', () => {
    expect(readWidgetTypes(undefined)).toBe(DEFAULT_WIDGET_TYPES);
    expect(readWidgetTypes({})).toBe(DEFAULT_WIDGET_TYPES);
    expect(readWidgetTypes({ widgetTypes: 'pivot2' })).toBe(DEFAULT_WIDGET_TYPES);
  });

  it('ignores entries that are not strings', () => {
    expect(readWidgetTypes({ widgetTypes: ['pivot2', 3, null] })).toEqual(['pivot2']);
  });
});

describe('loadPluginConfig', () => {
  afterEach(() => {
    for (const script of document.head.querySelectorAll('script')) script.remove();
    delete window.csdkExporterConfig;
  });

  it("loads config.js from the plugin folder, one level up from the app's", async () => {
    const loading = loadPluginConfig();
    const script = document.head.querySelector('script');
    expect(script?.src).toBe(new URL('../config.js', window.location.href).toString());

    window.csdkExporterConfig = { widgetTypes: ['tablewidget'] };
    script?.dispatchEvent(new Event('load'));

    await expect(loading).resolves.toEqual({ widgetTypes: ['tablewidget'] });
  });

  it('resolves to undefined when config.js fails to load', async () => {
    const loading = loadPluginConfig();
    document.head.querySelector('script')?.dispatchEvent(new Event('error'));

    await expect(loading).resolves.toBeUndefined();
  });
});
