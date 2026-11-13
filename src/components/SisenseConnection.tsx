import { SisenseContextProvider } from '@sisense/sdk-ui';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useExportStore } from '@/store/export-store';
import type { ConnectionInfo } from '@/types/export';

interface SisenseConnectionProps {
  connection: ConnectionInfo;
  children: ReactNode;
}

/**
 * Shown in place of the whole subtree when Compose SDK hits a connection
 * error (bad URL/token, CORS, network down) — without this, SisenseContextProvider's
 * own error boundary renders a full-page box with no way back to the
 * connection screen.
 */
function ConnectionErrorCard({ error, onBack }: { error: Error; onBack: () => void }) {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Connection error</CardTitle>
        <CardDescription>{error.message}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={onBack}>Back to connection screen</Button>
      </CardContent>
    </Card>
  );
}

/**
 * Mounts SisenseContextProvider once connection info exists —
 * every Compose SDK hook/component below this must be its descendant.
 */
export function SisenseConnection({ connection, children }: SisenseConnectionProps) {
  const disconnect = useExportStore((s) => s.disconnect);

  return (
    <SisenseContextProvider
      url={connection.url}
      {...(connection.useSession ? { useFusionAuth: true } : { token: connection.token })}
      onError={(error) => <ConnectionErrorCard error={error} onBack={disconnect} />}
    >
      {children}
    </SisenseContextProvider>
  );
}
