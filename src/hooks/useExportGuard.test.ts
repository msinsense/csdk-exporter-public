import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useExportStore } from '@/store/export-store';
import { STATUS_MESSAGE_TYPE, useExportGuard } from './useExportGuard';

const initialState = useExportStore.getState();

beforeEach(() => {
  useExportStore.setState(initialState, true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useExportGuard', () => {
  it('blocks unload only while an export runs', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    renderHook(() => useExportGuard());
    expect(addSpy).not.toHaveBeenCalledWith('beforeunload', expect.any(Function));

    act(() => useExportStore.setState({ status: 'running' }));
    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    act(() => useExportStore.setState({ status: 'done' }));
    expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
  });

  it('reports the status to the parent frame when embedded', () => {
    const postMessage = vi.fn();
    vi.spyOn(window, 'parent', 'get').mockReturnValue({ postMessage } as unknown as Window);
    renderHook(() => useExportGuard());

    act(() => useExportStore.setState({ status: 'running' }));
    expect(postMessage).toHaveBeenLastCalledWith(
      { type: STATUS_MESSAGE_TYPE, running: true },
      window.location.origin,
    );
  });
});
