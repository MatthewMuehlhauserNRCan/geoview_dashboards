import { describe, expect, it } from 'vitest';
import { formatTemplateValue, resolveTemplateValue } from './resolveTemplateValue';

const rows = [
  { name: 'Alpha', amount: 1.234, label: 'x' },
  { name: 'Beta', amount: 2, label: 'y' },
  { name: 'Gamma', amount: null, label: 'z' },
];

describe('formatTemplateValue', () => {
  it('returns the value as-is when decimals is unset', () => {
    expect(formatTemplateValue(1.23456, undefined)).toBe('1.23456');
    expect(formatTemplateValue(1000000, undefined)).toBe('1000000');
    expect(formatTemplateValue('text', undefined)).toBe('text');
  });

  it('fixes numeric values (including numeric strings) to `decimals` places', () => {
    expect(formatTemplateValue(1.23456, 2)).toBe('1.23');
    expect(formatTemplateValue('3.5', 0)).toBe('4');
    expect(formatTemplateValue(2, 1)).toBe('2.0');
  });

  it('leaves non-numeric/blank values untouched even when decimals is set', () => {
    expect(formatTemplateValue('Ontario', 2)).toBe('Ontario');
    expect(formatTemplateValue('', 2)).toBe('');
    expect(formatTemplateValue(true, 2)).toBe('true');
  });

  it('treats null/undefined as no value', () => {
    expect(formatTemplateValue(null, 2)).toBeUndefined();
    expect(formatTemplateValue(undefined, undefined)).toBeUndefined();
  });
});

describe('resolveTemplateValue', () => {
  it("defaults to the first row's field", () => {
    expect(resolveTemplateValue(rows, { id: 'v', dataSource: 's', field: 'name' })).toBe('Alpha');
    expect(resolveTemplateValue([], { id: 'v', dataSource: 's', field: 'name' })).toBeUndefined();
  });

  it('counts rows without needing a field', () => {
    expect(resolveTemplateValue(rows, { id: 'v', dataSource: 's', aggregation: 'count' })).toBe('3');
    expect(resolveTemplateValue([], { id: 'v', dataSource: 's', aggregation: 'count' })).toBe('0');
  });

  it('aggregates numeric fields, applying decimals', () => {
    expect(resolveTemplateValue(rows, { id: 'v', dataSource: 's', aggregation: 'sum', field: 'amount', decimals: 2 })).toBe('3.23');
    expect(resolveTemplateValue(rows, { id: 'v', dataSource: 's', aggregation: 'max', field: 'amount' })).toBe('2');
  });

  it('gives no value (not 0) for avg/min/max with nothing numeric to aggregate', () => {
    expect(resolveTemplateValue([], { id: 'v', dataSource: 's', aggregation: 'avg', field: 'amount' })).toBeUndefined();
    expect(resolveTemplateValue(rows, { id: 'v', dataSource: 's', aggregation: 'min', field: 'label' })).toBeUndefined();
    expect(resolveTemplateValue([], { id: 'v', dataSource: 's', aggregation: 'sum', field: 'amount' })).toBe('0');
  });
});
