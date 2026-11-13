import { ConnectionForm } from '@/components/ConnectionForm';
import { CorsNotice } from '@/components/CorsNotice';
import { DashboardPicker } from '@/components/DashboardPicker';
import { ExportProgress } from '@/components/ExportProgress';
import { ExportSummary } from '@/components/ExportSummary';
import { PluginDownload } from '@/components/PluginDownload';
import { SignInReportPanel } from '@/components/SignInReportPanel';
import { SisenseConnection } from '@/components/SisenseConnection';
import { WidgetPicker } from '@/components/WidgetPicker';
import { WizardNav } from '@/components/WizardNav';
import { useExportGuard } from '@/hooks/useExportGuard';
import { useExportStore } from '@/store/export-store';

function WizardStep() {
  const step = useExportStore((s) => s.step);

  switch (step) {
    case 'dashboard':
      return <DashboardPicker />;
    case 'widget':
      return <WidgetPicker />;
    case 'export':
      return <ExportProgress />;
    case 'done':
      return <ExportSummary />;
    default:
      return null;
  }
}

function App() {
  const connection = useExportStore((s) => s.connection);
  const embedded = useExportStore((s) => s.embedded);
  useExportGuard();

  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center gap-4 p-4 pb-10">
      {connection ? (
        <SisenseConnection connection={connection}>
          <WizardStep />
          <WizardNav />
        </SisenseConnection>
      ) : (
        <>
          <div className="flex max-w-sm flex-col items-center gap-1 text-center">
            <h1 className="text-xl font-semibold">CSDK Extract Application</h1>
            <p className="text-sm text-muted-foreground">
              Export large Sisense widget datasets to CSV or Excel directly from the browser,
              without waiting for the full result set to render.
            </p>
          </div>
          <ConnectionForm />
          {!embedded && <CorsNotice />}
          {!embedded && <PluginDownload />}
        </>
      )}
      <SignInReportPanel />
      {!embedded && (
        <p className="absolute inset-x-4 bottom-2 text-left text-xs text-muted-foreground/50">
          This is an experimental proof-of-concept application. It may have issues, and this
          specific website has not been actively maintained.
        </p>
      )}
    </main>
  );
}

export default App;
