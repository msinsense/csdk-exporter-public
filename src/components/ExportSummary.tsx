import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useExportStore } from '@/store/export-store';

export function ExportSummary() {
  const widget = useExportStore((s) => s.widget);
  const rowsExported = useExportStore((s) => s.rowsExported);
  const startedAt = useExportStore((s) => s.startedAt);
  const exportedFileName = useExportStore((s) => s.exportedFileName);
  const truncatedAtRowLimit = useExportStore((s) => s.truncatedAtRowLimit);
  const reset = useExportStore((s) => s.reset);

  const elapsedSeconds = startedAt !== null ? Math.round((Date.now() - startedAt) / 1000) : 0;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Export complete</CardTitle>
        <CardDescription>{widget?.title}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          {rowsExported.toLocaleString()} rows exported in {elapsedSeconds}s.
        </p>
        {exportedFileName && (
          <p className="text-sm text-muted-foreground">
            Saved as <span className="font-medium text-foreground">{exportedFileName}</span>
          </p>
        )}
        {truncatedAtRowLimit && (
          <p className="text-sm font-medium text-foreground" role="status">
            Stopped at Excel's row limit. Export as CSV to get every row.
          </p>
        )}
        <Button variant="outline" onClick={() => reset()}>
          Export another widget
        </Button>
      </CardContent>
    </Card>
  );
}
