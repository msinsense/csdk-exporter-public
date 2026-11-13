import { signInReportLines } from '@/lib/sign-in-report';
import { useExportStore } from '@/store/export-store';

/** Shows how the app signed in. Only rendered when the plugin's debug is on. */
export function SignInReportPanel() {
  const report = useExportStore((s) => s.signInReport);
  if (!report) return null;

  return (
    <section
      aria-label="Sign-in diagnostics"
      className="fixed right-2 bottom-2 z-50 border bg-background/95 p-2 text-xs shadow-sm"
    >
      <p className="mb-1 font-semibold">Sign-in diagnostics (debug)</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-2">
        {signInReportLines(report).map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
