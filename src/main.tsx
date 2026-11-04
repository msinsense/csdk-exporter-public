import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { readDeepLink, stripTokenFromUrl } from './lib/deep-link';
import { loadPluginConfig, readWidgetTypes } from './lib/plugin-config';
import { requestSessionToken } from './lib/session-token';
import { useExportStore } from './store/export-store';

async function init() {
  const link = readDeepLink(window.location);
  // Served by Sisense from the plugin folder: connect to it as the signed-in user.
  if (link.embedded) {
    link.url ??= window.location.origin;
    const [token, pluginConfig] = await Promise.all([
      link.token ??
        requestSessionToken().catch((error) => {
          console.warn('[csdkExporter] Falling back to the connection form:', error);
          return undefined;
        }),
      loadPluginConfig(),
    ]);
    link.token = token;
    useExportStore.getState().setWidgetTypes(readWidgetTypes(pluginConfig));
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
