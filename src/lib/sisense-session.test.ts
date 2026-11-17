import { describe, expect, it } from 'vitest';
import {
  adoptSisenseSession,
  embeddedSisenseUrl,
  readSessionRole,
  shareXsrfCookie,
} from './sisense-session';

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

describe('embeddedSisenseUrl', () => {
  const origin = 'https://bi.example.com';

  it('uses the url from the plugin when it is on this origin', () => {
    const location = { origin, pathname: '/plugins/csdkExporter/app/index.html' };
    expect(embeddedSisenseUrl(location, 'https://bi.example.com/acme/')).toBe(
      'https://bi.example.com/acme',
    );
  });

  it('ignores a url on another origin', () => {
    const location = { origin, pathname: '/acme/plugins/csdkExporter/app/index.html' };
    expect(embeddedSisenseUrl(location, 'https://evil.example.com/acme')).toBe(
      'https://bi.example.com/acme',
    );
    expect(embeddedSisenseUrl(location, 'not a url')).toBe('https://bi.example.com/acme');
  });

  it('falls back to the path the plugin folder is served under', () => {
    expect(embeddedSisenseUrl({ origin, pathname: '/plugins/csdkExporter/app/index.html' })).toBe(
      origin,
    );
    expect(
      embeddedSisenseUrl({ origin, pathname: '/acme/plugins/csdkExporter/app/index.html' }),
    ).toBe('https://bi.example.com/acme');
  });
});

describe('shareXsrfCookie', () => {
  function cookieWindow(own: string, host?: { document: { cookie: string } }) {
    const doc = { cookie: own };
    const win = {
      document: doc,
      location: { protocol: 'https:' },
      parent: host,
      opener: null,
    } as unknown as Window;
    return { win, doc };
  }

  it('copies the XSRF cookie from the Sisense page', () => {
    const { win, doc } = cookieWindow('', { document: { cookie: 'a=1; XSRF-TOKEN=x%3Dy' } });
    expect(shareXsrfCookie(win)).toBe(true);
    expect(doc.cookie).toBe('XSRF-TOKEN=x%3Dy; SameSite=Strict; Secure');
  });

  it('keeps its own XSRF cookie', () => {
    const { win, doc } = cookieWindow('XSRF-TOKEN=own', {
      document: { cookie: 'XSRF-TOKEN=other' },
    });
    expect(shareXsrfCookie(win)).toBe(false);
    expect(doc.cookie).toBe('XSRF-TOKEN=own');
  });

  it('does nothing when the host is on another origin or has no cookie', () => {
    const crossOrigin = {
      get document(): { cookie: string } {
        throw new DOMException('Blocked', 'SecurityError');
      },
    };
    expect(shareXsrfCookie(cookieWindow('', crossOrigin).win)).toBe(false);
    expect(shareXsrfCookie(cookieWindow('', { document: { cookie: 'a=1' } }).win)).toBe(false);
  });
});
