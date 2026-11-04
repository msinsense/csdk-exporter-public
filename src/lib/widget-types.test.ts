import { describe, expect, it } from 'vitest';
import { DEFAULT_WIDGET_TYPES, isExportableWidget, matchesWidgetTypes } from './widget-types';

const pivot = { widgetType: 'pivot' } as const;
const table = { widgetType: 'chart', chartType: 'table' } as const;
const bar = { widgetType: 'chart', chartType: 'bar' } as const;
const text = { widgetType: 'text' } as const;

describe('isExportableWidget', () => {
  it('accepts Pivot and chart widgets, not text/filter/custom ones', () => {
    expect(isExportableWidget(pivot)).toBe(true);
    expect(isExportableWidget(table)).toBe(true);
    expect(isExportableWidget(text)).toBe(false);
    expect(isExportableWidget({ widgetType: 'filter' })).toBe(false);
    expect(isExportableWidget({ widgetType: 'custom' })).toBe(false);
  });
});

describe('matchesWidgetTypes', () => {
  it('allows only Pivot widgets by default', () => {
    expect(matchesWidgetTypes(pivot, DEFAULT_WIDGET_TYPES)).toBe(true);
    expect(matchesWidgetTypes(table, DEFAULT_WIDGET_TYPES)).toBe(false);
  });

  it('maps Sisense widget types to the SDK chart types', () => {
    expect(matchesWidgetTypes(table, ['tablewidget'])).toBe(true);
    expect(matchesWidgetTypes(table, ['tablewidgetagg'])).toBe(true);
    expect(matchesWidgetTypes(bar, ['chart/bar'])).toBe(true);
    expect(matchesWidgetTypes(bar, ['tablewidget'])).toBe(false);
    expect(matchesWidgetTypes(pivot, ['tablewidget'])).toBe(false);
  });

  it('allows every exportable widget for an empty list, but never text widgets', () => {
    expect(matchesWidgetTypes(pivot, [])).toBe(true);
    expect(matchesWidgetTypes(bar, [])).toBe(true);
    expect(matchesWidgetTypes(text, [])).toBe(false);
    expect(matchesWidgetTypes(text, ['richtexteditor'])).toBe(false);
  });
});
