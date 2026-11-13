import type { SessionSource } from './sisense-session';

/** How the embedded app signed in. Shown when the plugin's `debug` is on. */
export interface SignInReport {
  method: 'session' | 'token-from-link' | 'token-endpoint' | 'form';
  sessionSource: SessionSource | null;
  role?: string;
  /** Result of calling the API token endpoint: 'ok', an error message, or not tried. */
  tokenEndpoint?: string;
}

const METHOD_LABELS: Record<SignInReport['method'], string> = {
  session: 'Sisense session (no token)',
  'token-from-link': 'Token from the link',
  'token-endpoint': 'API token endpoint',
  form: 'Connection form (no session, no token)',
};

const SOURCE_LABELS: Record<SessionSource, string> = {
  self: 'this page',
  parent: 'Sisense page behind the modal',
  opener: 'Sisense tab that opened this one',
};

export function signInReportLines(report: SignInReport): [string, string][] {
  return [
    ['Sign-in', METHOD_LABELS[report.method]],
    ['Session from', report.sessionSource ? SOURCE_LABELS[report.sessionSource] : 'not found'],
    ['Role', report.role ?? 'unknown'],
    ['API token endpoint', report.tokenEndpoint ?? 'not tried'],
  ];
}
