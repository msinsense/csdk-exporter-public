import { describe, expect, it, vi } from 'vitest';
import { isValidUrl, readDeepLink, stripTokenFromUrl } from './deep-link';

describe('readDeepLink', () => {
  it('reads url/dashboardId/widgetId from the query and the token from the fragment', () => {
    expect(
      readDeepLink({
        search: '?url=https%3A%2F%2Fmy.sisense.com&dashboardId=d1&widgetId=w1',
        hash: '#token=abc',
      }),
    ).toEqual({
      url: 'https://my.sisense.com',
      token: 'abc',
      dashboardId: 'd1',
      widgetId: 'w1',
      embedded: false,
    });
  });

  it('reads the embedded flag', () => {
    expect(readDeepLink({ search: '?embedded=1', hash: '' }).embedded).toBe(true);
    expect(readDeepLink({ search: '?embedded=0', hash: '' }).embedded).toBe(false);
  });

  it('also accepts the token as a query param', () => {
    expect(readDeepLink({ search: '?token=abc', hash: '' }).token).toBe('abc');
  });

  it('treats missing or blank params as absent', () => {
    expect(readDeepLink({ search: '?dashboardId=', hash: '' })).toEqual({
      url: undefined,
      token: undefined,
      dashboardId: undefined,
      widgetId: undefined,
      embedded: false,
    });
  });
});

describe('stripTokenFromUrl', () => {
  function fakeWindow(href: string) {
    const replaceState = vi.fn();
    return {
      win: { location: { href }, history: { state: null, replaceState } } as unknown as Window,
      replaceState,
    };
  }

  it('removes the token from the fragment and the query, keeping other params', () => {
    const { win, replaceState } = fakeWindow(
      'http://localhost:5173/?url=x&token=q&dashboardId=d1#token=abc',
    );
    stripTokenFromUrl(win);
    expect(replaceState).toHaveBeenCalledWith(
      null,
      '',
      'http://localhost:5173/?url=x&dashboardId=d1',
    );
  });

  it('does nothing when there is no token', () => {
    const { win, replaceState } = fakeWindow('http://localhost:5173/?url=x');
    stripTokenFromUrl(win);
    expect(replaceState).not.toHaveBeenCalled();
  });
});

describe('isValidUrl', () => {
  it('accepts http(s) URLs only', () => {
    expect(isValidUrl('https://my.sisense.com')).toBe(true);
    expect(isValidUrl('javascript:alert(1)')).toBe(false);
    expect(isValidUrl('not a url')).toBe(false);
  });
});
