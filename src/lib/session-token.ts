const TOKEN_ENDPOINT = '/api/v1/authentication/tokens/api';

export function readCookie(cookieString: string, name: string): string | undefined {
  for (const part of cookieString.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

/**
 * Gets an API token for the user signed in to Sisense, from their session
 * cookie. Only works when the app is served by Sisense itself (same origin).
 */
export async function requestSessionToken(
  origin: string = window.location.origin,
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const xsrf = readCookie(document.cookie, 'XSRF-TOKEN');
  if (xsrf) headers['X-XSRF-TOKEN'] = xsrf;

  const response = await fetchFn(`${origin}${TOKEN_ENDPOINT}`, {
    method: 'GET',
    credentials: 'include',
    headers,
  });
  if (!response.ok) throw new Error(`Could not get a Sisense token (HTTP ${response.status})`);

  const token = readToken(await response.json());
  if (!token) throw new Error('Sisense returned no token');
  return token;
}

function readToken(body: unknown): string | undefined {
  if (typeof body === 'string') return body;
  const value = body as { token?: string; access_token?: string } | null;
  return value?.token || value?.access_token;
}
