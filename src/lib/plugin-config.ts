import { DEFAULT_WIDGET_TYPES } from '@/lib/widget-types';

/** The part of sisense-plugin/config.js the app reads. */
export interface PluginConfig {
  widgetTypes?: unknown;
}

declare global {
  interface Window {
    csdkExporterConfig?: PluginConfig;
  }
}

// The app is bundled under the plugin's app/ folder, next to config.js.
const CONFIG_PATH = '../config.js';

/**
 * Loads the plugin's config.js, so the app follows the same settings as the
 * plugin. Resolves to undefined if it can't be loaded.
 */
export function loadPluginConfig(win: Window = window): Promise<PluginConfig | undefined> {
  return new Promise((resolve) => {
    const script = win.document.createElement('script');
    script.src = new URL(CONFIG_PATH, win.location.href).toString();
    script.onload = () => resolve(win.csdkExporterConfig);
    script.onerror = () => resolve(undefined);
    win.document.head.appendChild(script);
  });
}

/** The configured widget types, or the default when missing or invalid. */
export function readWidgetTypes(config: PluginConfig | undefined): string[] {
  const types = config?.widgetTypes;
  if (!Array.isArray(types)) return DEFAULT_WIDGET_TYPES;
  return types.filter((type): type is string => typeof type === 'string');
}
