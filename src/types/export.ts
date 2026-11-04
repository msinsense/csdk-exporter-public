import type { DataSource } from '@sisense/sdk-data';

export type WizardStep = 'connect' | 'dashboard' | 'widget' | 'export' | 'done';

export interface ConnectionInfo {
  url: string;
  token: string;
}

export interface DashboardSummary {
  oid: string;
  title: string;
  dataSource: DataSource;
}

export interface WidgetSummary {
  oid: string;
  title: string;
}

export type ExportStatus = 'idle' | 'running' | 'done' | 'error';

export type ExportFormat = 'csv' | 'xlsx';
