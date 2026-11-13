import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { readDeepLink, stripTokenFromUrl } from './lib/deep-link';
import { loadPluginConfig, readDebug, readWidgetTypes } from './lib/plugin-config';
import { requestSessionToken } from './lib/session-token';
import type { SignInReport } from './lib/sign-in-report';
import { adoptSisenseSession, readSessionRole } from './lib/sisense-session';
import { useExportStore } from './store/export-store';

async function init() {
  const link = readDeepLink(window.location);
  // Served by Sisense from the plugin folder: connect to it as the signed-in user.
  if (link.embedded) {
    link.url ??= window.location.origin;
    const tokenFromLink = !!link.token;
    // Reuse the Sisense session (works for every role). The API token
    // endpoint is only a fallback, since non-admin roles can't use it.
    const sessionSource = tokenFromLink ? null : adoptSisenseSession();
    link.useSession = !!sessionSource;

    const pluginConfig = await loadPluginConfig();
    const debug = readDebug(pluginConfig);
    useExportStore.getState().setWidgetTypes(readWidgetTypes(pluginConfig));

    // With debug on, the endpoint is also called just to report what it returns.
    let tokenEndpoint: string | undefined;
    if (!tokenFromLink && (!link.useSession || debug)) {
      try {
        const token = await requestSessionToken();
        tokenEndpoint = 'ok';
        if (!link.useSession) link.token = token;
      } catch (error) {
        tokenEndpoint = error instanceof Error ? error.message : String(error);
        if (!link.useSession) {
          console.warn('[csdkExporter] Falling back to the connection form:', error);
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
      };
      console.info('[csdkExporter] Sign-in:', report);
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
