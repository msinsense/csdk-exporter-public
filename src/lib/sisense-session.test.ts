import { describe, expect, it } from 'vitest';
import { adoptSisenseSession, readSessionRole } from './sisense-session';

const signedIn = { user: { _id: 'u-1' } };

function fakeWindow(props: Record<string, unknown> = {}): Window {
  const win = { prism: undefined, opener: null, ...props } as unknown as Window & {
    parent: Window;
  };
  if (!('parent' in props)) win.parent = win;
  return win;
}

describe('adoptSisenseSession', () => {
  it('uses the modal parent session', () => {
    const win = fakeWindow({ parent: { prism: signedIn } });
    expect(adoptSisenseSession(win)).toBe('parent');
    expect((win as unknown as { prism: unknown }).prism).toBe(signedIn);
  });

  it('uses the tab opener session', () => {
    const win = fakeWindow({ opener: { prism: signedIn } });
    expect(adoptSisenseSession(win)).toBe('opener');
    expect((win as unknown as { prism: unknown }).prism).toBe(signedIn);
  });

  it('keeps its own signed-in prism', () => {
    expect(adoptSisenseSession(fakeWindow({ prism: signedIn }))).toBe('self');
  });

  it('returns false with no signed-in Sisense page', () => {
    expect(adoptSisenseSession(fakeWindow())).toBeNull();
    expect(adoptSisenseSession(fakeWindow({ parent: { prism: { user: {} } } }))).toBeNull();
  });

  it('ignores a cross-origin host', () => {
    const crossOrigin = {
      get prism() {
        throw new DOMException('Blocked', 'SecurityError');
      },
    };
    expect(adoptSisenseSession(fakeWindow({ parent: crossOrigin }))).toBeNull();
  });
});

describe('readSessionRole', () => {
  it('reads the base role, then the role name', () => {
    const user = { _id: 'u-1', roleName: 'Viewer', baseRoleName: 'consumer' };
    expect(readSessionRole(fakeWindow({ prism: { user } }))).toBe('consumer');
    expect(
      readSessionRole(fakeWindow({ prism: { user: { _id: 'u-1', roleName: 'Viewer' } } })),
    ).toBe('Viewer');
    expect(readSessionRole(fakeWindow())).toBeUndefined();
  });
});
