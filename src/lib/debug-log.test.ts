import { afterEach, describe, expect, it, vi } from 'vitest';
import { debugLog, debugWarn, setDebugLogging } from './debug-log';

describe('debug-log', () => {
  afterEach(() => {
    setDebugLogging(false);
    vi.restoreAllMocks();
  });

  it('prints nothing when debug is off', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    debugLog('hello');
    debugWarn('careful');
    expect(info).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('prints with a prefix when debug is on', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setDebugLogging(true);
    debugLog('hello', 1);
    debugWarn('careful');
    expect(info).toHaveBeenCalledWith('[csdkExporter]', 'hello', 1);
    expect(warn).toHaveBeenCalledWith('[csdkExporter]', 'careful');
  });
});
