export interface DeepLink {
  url?: string;
  token?: string;
  dashboardId?: string;
  widgetId?: string;
  /** Opened by the Sisense plugin from its own folder: connect to this
   * origin with the user's Sisense session. */
  embedded?: boolean;
  /** Connect with the Sisense session of the page that opened the app. */
  useSession?: boolean;
}

function readParam(params: URLSearchParams, name: string): string | undefined {
  const value = params.get(name)?.trim();
  return value ? value : undefined;
}

/**
 * Reads a deep link like
 * `/?url=https://my.sisense.com&dashboardId=abc&widgetId=xyz#token=...`.
 *
 * The token is read from the fragment, which browsers never send to a
 * server or include in the Referer header. `?token=` is accepted too, but
 * is stripped from the address bar all the same — see stripTokenFromUrl.
 */
export function readDeepLink(location: Pick<Location, 'search' | 'hash'>): DeepLink {
  const query = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));

  return {
    url: readParam(query, 'url'),
    token: readParam(hash, 'token') ?? readParam(query, 'token'),
    dashboardId: readParam(query, 'dashboardId'),
    widgetId: readParam(query, 'widgetId'),
    embedded: query.get('embedded') === '1',
  };
}

/** Removes the token from the address bar, so it doesn't stay in history or
 * get copied along with the link. Other params are left as they are. */
export function stripTokenFromUrl(win: Window = window) {
  const current = new URL(win.location.href);
  const hash = new URLSearchParams(current.hash.replace(/^#/, ''));
  if (!hash.has('token') && !current.searchParams.has('token')) return;

  hash.delete('token');
  current.searchParams.delete('token');
  const rest = hash.toString();
  current.hash = rest ? `#${rest}` : '';
  win.history.replaceState(win.history.state, '', current.toString());
}

export function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
