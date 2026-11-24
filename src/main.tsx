import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { debugLog, debugWarn, setDebugLogging } from './lib/debug-log';
import { readDeepLink, stripTokenFromUrl } from './lib/deep-link';
import { loadPluginConfig, readDebug, readWidgetTypes } from './lib/plugin-config';
import { readCookie, requestSessionToken } from './lib/session-token';
import type { SignInReport } from './lib/sign-in-report';
import {
  adoptSisenseSession,
  embeddedSisenseUrl,
  readSessionRole,
  shareXsrfCookie,
} from './lib/sisense-session';
import { useExportStore } from './store/export-store';

async function init() {
  const link = readDeepLink(window.location);
  // Served by Sisense from the plugin folder: connect to it as the signed-in user.
  if (link.embedded) {
    // Includes the tenant path on a multi-tenant Sisense.
    link.url = embeddedSisenseUrl(window.location, link.url);
    const tokenFromLink = !!link.token;
    // Reuse the Sisense session (works for every role). The API token
    // endpoint is only a fallback, since non-admin roles can't use it.
    const sessionSource = tokenFromLink ? null : adoptSisenseSession();
    link.useSession = !!sessionSource;
    const xsrfCopied = shareXsrfCookie();

    const pluginConfig = await loadPluginConfig();
    const debug = readDebug(pluginConfig);
    setDebugLogging(debug);
    useExportStore.getState().setWidgetTypes(readWidgetTypes(pluginConfig));

    // With debug on, the endpoint is also called just to report what it returns.
    let tokenEndpoint: string | undefined;
    if (!tokenFromLink && (!link.useSession || debug)) {
      try {
        const token = await requestSessionToken(link.url);
        tokenEndpoint = 'ok';
        if (!link.useSession) link.token = token;
      } catch (error) {
        tokenEndpoint = error instanceof Error ? error.message : String(error);
        if (!link.useSession) {
          debugWarn('Falling back to the connection form:', error);
        }
      }
    }

    if (debug) {
      const report: SignInReport = {
        method: link.useSession
          ? 'session'
          : tokenFromLink
            ? 'token-from-link'
            : link.token
              ? 'token-endpoint'
              : 'form',
        sessionSource,
        role: readSessionRole(),
        tokenEndpoint,
        sisenseUrl: link.url,
        xsrfCookie: xsrfCopied
          ? 'copied'
          : readCookie(document.cookie, 'XSRF-TOKEN')
            ? 'own'
            : 'missing',
      };
      debugLog('Sign-in:', report);
      useExportStore.getState().setSignInReport(report);
    }
  }
  useExportStore.getState().applyDeepLink(link);
  stripTokenFromUrl();

  // biome-ignore lint/style/noNonNullAssertion: index.html always defines #root
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

init();
