import { describe, expect, it } from 'vitest';
import { signInReportLines } from './sign-in-report';

describe('signInReportLines', () => {
  it('describes a session sign-in', () => {
    expect(
      signInReportLines({
        method: 'session',
        sessionSource: 'parent',
        role: 'consumer',
        tokenEndpoint: 'Could not get a Sisense token (HTTP 403)',
      }),
    ).toEqual([
      ['Sign-in', 'Sisense session (no token)'],
      ['Session from', 'Sisense page behind the modal'],
      ['Role', 'consumer'],
      ['API token endpoint', 'Could not get a Sisense token (HTTP 403)'],
    ]);
  });

  it('fills in missing values', () => {
    expect(signInReportLines({ method: 'form', sessionSource: null })).toEqual([
      ['Sign-in', 'Connection form (no session, no token)'],
      ['Session from', 'not found'],
      ['Role', 'unknown'],
      ['API token endpoint', 'not tried'],
    ]);
  });
});
