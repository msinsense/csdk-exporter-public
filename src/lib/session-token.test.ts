import { afterEach, describe, expect, it, vi } from 'vitest';
import { readCookie, requestSessionToken } from './session-token';

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as Response;
}

describe('readCookie', () => {
  it('reads and decodes a cookie by name', () => {
    expect(readCookie('a=1; XSRF-TOKEN=x%3Dy; b=2', 'XSRF-TOKEN')).toBe('x=y');
    expect(readCookie('a=1', 'XSRF-TOKEN')).toBeUndefined();
  });
});

describe('requestSessionToken', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls the token endpoint with the session cookie and XSRF header', async () => {
    vi.spyOn(document, 'cookie', 'get').mockReturnValue('XSRF-TOKEN=xsrf-1');
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ token: 'abc' }));

    await expect(requestSessionToken('https://bi.example.com', fetchFn)).resolves.toBe('abc');
    expect(fetchFn).toHaveBeenCalledWith(
      'https://bi.example.com/api/v1/authentication/tokens/api',
      expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({ 'X-XSRF-TOKEN': 'xsrf-1' }),
      }),
    );
  });

  it('accepts access_token or a plain string body', async () => {
    const origin = 'https://bi.example.com';
    await expect(
      requestSessionToken(origin, vi.fn().mockResolvedValue(jsonResponse({ access_token: 'a' }))),
    ).resolves.toBe('a');
    await expect(
      requestSessionToken(origin, vi.fn().mockResolvedValue(jsonResponse('b'))),
    ).resolves.toBe('b');
  });

  it('throws on an error status or a missing token', async () => {
    const origin = 'https://bi.example.com';
    await expect(
      requestSessionToken(origin, vi.fn().mockResolvedValue(jsonResponse({}, false, 401))),
    ).rejects.toThrow('HTTP 401');
    await expect(
      requestSessionToken(origin, vi.fn().mockResolvedValue(jsonResponse({}))),
    ).rejects.toThrow('no token');
  });
});
