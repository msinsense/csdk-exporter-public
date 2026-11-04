import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useExportStore } from '@/store/export-store';

/**
 * Back/forward controls for the middle of the wizard (dashboard, widget,
 * export steps). Not shown on 'connect' (nothing before it), 'done'
 * (ExportSummary has its own "export another widget" reset action), or once
 * a widget is picked (WidgetPreview has its own "Change widget"/"Continue
 * to export" buttons doing the same job).
 */
export function WizardNav() {
  const step = useExportStore((s) => s.step);
  const dashboard = useExportStore((s) => s.dashboard);
  const widget = useExportStore((s) => s.widget);
  const status = useExportStore((s) => s.status);
  const goBack = useExportStore((s) => s.goBack);
  const goForward = useExportStore((s) => s.goForward);
  const embedded = useExportStore((s) => s.embedded);

  if (step !== 'dashboard' && step !== 'widget' && step !== 'export') return null;
  if (step === 'widget' && widget) return null;

  const backDisabled =
    (step === 'export' && status === 'running') || (step === 'dashboard' && embedded);
  const forwardDisabled =
    (step === 'dashboard' && !dashboard) ||
    (step === 'widget' && !widget) ||
    (step === 'export' && status !== 'done');

  return (
    <div className="flex w-full max-w-sm justify-between">
      <Button variant="outline" size="sm" onClick={goBack} disabled={backDisabled}>
        <ArrowLeftIcon />
        Back
      </Button>
      <Button variant="outline" size="sm" onClick={goForward} disabled={forwardDisabled}>
        Forward
        <ArrowRightIcon />
      </Button>
    </div>
  );
}
