import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Compose SDK calls the Sisense REST/socket APIs directly from the browser —
 * unlike Sisense's own dashboard pages, this app's origin isn't already
 * trusted by the instance, so a connection attempt fails with an opaque CORS
 * error unless an admin allow-lists it first. Shown only on the connect
 * screen, below the connection form, so it's visible before the user hits
 * that error rather than after.
 */
export function CorsNotice() {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-sm">Before you connect</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          This app calls your Sisense instance directly from the browser. Add its origin to
          Sisense's CORS allow-list first, or the connection will fail.
        </p>
        <code className="break-all bg-muted px-2 py-1 text-sm">{origin}</code>
      </CardContent>
    </Card>
  );
}
