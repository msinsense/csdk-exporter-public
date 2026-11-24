// Console output only when the plugin's debug option is on.
let enabled = false;

export function setDebugLogging(on: boolean): void {
  enabled = on;
}

export function debugLog(...args: unknown[]): void {
  if (enabled) console.info('[csdkExporter]', ...args);
}

export function debugWarn(...args: unknown[]): void {
  if (enabled) console.warn('[csdkExporter]', ...args);
}
