interface PrismLike {
  user?: { _id?: string; roleName?: string; baseRoleName?: string };
}

type SisenseWindow = Window & { prism?: PrismLike };

/** Where the Sisense session came from: this page, the modal's parent, or the tab's opener. */
export type SessionSource = 'self' | 'parent' | 'opener';

function signedInPrism(win: Window | null | undefined): PrismLike | undefined {
  try {
    const prism = (win as SisenseWindow | null | undefined)?.prism;
    return prism?.user?._id ? prism : undefined;
  } catch {
    // Another origin: not a Sisense page we can use.
    return undefined;
  }
}

/**
 * Finds the signed-in Sisense page that opened this app (the modal's parent
 * or the tab's opener) and exposes its `prism` here, so Compose SDK's Fusion
 * auth can reuse that session. Returns null when there is none.
 */
export function adoptSisenseSession(win: Window = window): SessionSource | null {
  const self = win as SisenseWindow;
  if (signedInPrism(self)) return 'self';

  const hosts: [SessionSource, Window | null][] = [
    ['parent', win.parent],
    ['opener', win.opener as Window | null],
  ];
  for (const [source, host] of hosts) {
    if (!host || host === win) continue;
    const prism = signedInPrism(host);
    if (prism) {
      self.prism = prism;
      return source;
    }
  }
  return null;
}

/** The signed-in user's role, if a Sisense session was adopted. */
export function readSessionRole(win: Window = window): string | undefined {
  const user = signedInPrism(win)?.user;
  return user?.baseRoleName ?? user?.roleName;
}

const XSRF_COOKIE = 'XSRF-TOKEN';

function readRawCookie(cookieString: string, name: string): string | undefined {
  for (const part of cookieString.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return undefined;
}

function hostCookies(win: Window): string[] {
  const cookies: string[] = [];
  for (const host of [win.parent, win.opener as Window | null]) {
    if (!host || host === win) continue;
    try {
      cookies.push(host.document.cookie);
    } catch {
      // Another origin.
    }
  }
  return cookies;
}

/**
 * Compose SDK reads the XSRF token from this page's cookies. On a tenant,
 * Sisense may scope that cookie to the tenant path, which this page can't
 * see when it's served from the root path. Copies it from the Sisense page
 * that opened the app, scoped to this page's folder only.
 * Returns whether a cookie was copied.
 */
export function shareXsrfCookie(win: Window = window): boolean {
  if (readRawCookie(win.document.cookie, XSRF_COOKIE)) return false;
  for (const cookies of hostCookies(win)) {
    const value = readRawCookie(cookies, XSRF_COOKIE);
    if (!value) continue;
    const secure = win.location.protocol === 'https:' ? '; Secure' : '';
    win.document.cookie = `${XSRF_COOKIE}=${value}; SameSite=Strict${secure}`;
    return true;
  }
  return false;
}

/**
 * The Sisense URL to connect to when served by the plugin: the plugin's
 * `url` param if it's on this origin, else this origin plus the path the
 * plugin folder is served under (the tenant path on a multi-tenant Sisense).
 */
export function embeddedSisenseUrl(
  location: Pick<Location, 'origin' | 'pathname'>,
  fromLink?: string,
): string {
  if (fromLink) {
    try {
      const url = new URL(fromLink);
      if (url.origin === location.origin) return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
    } catch {
      // Not a URL: ignored.
    }
  }
  const pluginsAt = location.pathname.indexOf('/plugins/');
  const basePath = pluginsAt > 0 ? location.pathname.slice(0, pluginsAt) : '';
  return location.origin + basePath;
}
