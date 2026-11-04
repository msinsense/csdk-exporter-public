import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const PLUGIN_ZIP_URL = `${import.meta.env.BASE_URL}csdkExporter.zip`;
export const SISENSE_ADD_ONS_DOCS_URL =
  'https://docs.sisense.com/win/SisenseWin/sisense-add-ons.htm';

/** Download link for the Sisense plugin that opens this app from dashboards and widgets. */
export function PluginDownload() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-sm">Sisense plugin</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Adds an "Export with CSDK Exporter" action to your dashboards and widgets, which opens
          this app already connected as the logged-in user.
        </p>
        <Button asChild>
          <a href={PLUGIN_ZIP_URL} download>
            Download plugin (.zip)
          </a>
        </Button>
        <a
          href={SISENSE_ADD_ONS_DOCS_URL}
          target="_blank"
          rel="noreferrer"
          className="text-sm underline underline-offset-4"
        >
          How to install Sisense add-ons
        </a>
      </CardContent>
    </Card>
  );
}
