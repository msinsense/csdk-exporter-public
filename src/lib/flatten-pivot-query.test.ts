import type { Attribute, Measure, PivotAttribute, PivotMeasure } from '@sisense/sdk-data';
import { describe, expect, it } from 'vitest';
import { toFlatQueryParams } from './flatten-pivot-query';

const rowAttribute = { name: 'OrderID' } as unknown as Attribute;
const columnAttribute = { name: 'Region' } as unknown as Attribute;
const wrappedPivotAttribute = { attribute: { name: 'Category' } } as unknown as PivotAttribute;
const measure = { name: 'Total' } as unknown as Measure;
const wrappedPivotMeasure = { measure: { name: 'Quantity' } } as unknown as PivotMeasure;

describe('toFlatQueryParams', () => {
  it('returns undefined when there are no pivot params yet', () => {
    expect(toFlatQueryParams(undefined)).toBeUndefined();
  });

  it('concatenates rows then columns into dimensions, unwrapping PivotAttribute', () => {
    const result = toFlatQueryParams({
      dataSource: 'Sample ECommerce',
      rows: [rowAttribute],
      columns: [columnAttribute, wrappedPivotAttribute],
      values: [],
      filters: [],
    });

    expect(result?.dimensions).toEqual([rowAttribute, columnAttribute, { name: 'Category' }]);
  });

  it('unwraps PivotMeasure but leaves a plain Measure untouched', () => {
    const result = toFlatQueryParams({
      dataSource: 'Sample ECommerce',
      rows: [],
      columns: [],
      values: [measure, wrappedPivotMeasure],
      filters: [],
    });

    expect(result?.measures).toEqual([measure, { name: 'Quantity' }]);
  });

  it('carries dataSource and filters through unchanged', () => {
    const filters = [{ some: 'filter' }] as never;
    const result = toFlatQueryParams({
      dataSource: 'Sample ECommerce',
      rows: [],
      columns: [],
      values: [],
      filters,
    });

    expect(result?.dataSource).toBe('Sample ECommerce');
    expect(result?.filters).toBe(filters);
  });

  it('defaults to empty dimensions/measures when rows/columns/values are missing', () => {
    const result = toFlatQueryParams({ dataSource: 'Sample ECommerce', filters: [] });

    expect(result?.dimensions).toEqual([]);
    expect(result?.measures).toEqual([]);
  });

  describe('extraFilters', () => {
    const widgetFilter = { name: 'widget-filter' } as unknown as Attribute;
    const extraFilter = { name: 'extra-filter' } as unknown as Attribute;

    it("prepends extraFilters to the widget's own filters", () => {
      const result = toFlatQueryParams(
        { dataSource: 'Sample ECommerce', filters: [widgetFilter as never] },
        [extraFilter as never],
      );

      expect(result?.filters).toEqual([extraFilter, widgetFilter]);
    });

    it("leaves the widget's filters untouched when there are no extraFilters", () => {
      const result = toFlatQueryParams(
        { dataSource: 'Sample ECommerce', filters: [widgetFilter as never] },
        [],
      );

      expect(result?.filters).toEqual([widgetFilter]);
    });

    it('leaves an advanced FilterRelations tree untouched rather than guessing how to merge it', () => {
      const filterRelations = { operator: 'AND' } as never;
      const result = toFlatQueryParams(
        { dataSource: 'Sample ECommerce', filters: filterRelations },
        [extraFilter as never],
      );

      expect(result?.filters).toBe(filterRelations);
    });
  });
});
