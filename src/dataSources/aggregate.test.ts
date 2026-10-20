import { describe, expect, it } from 'vitest';
import { aggregateValues, describeAggregation, groupAndAggregate } from './aggregate';

const rows = [
  { region: 'East', value: 10 },
  { region: 'East', value: 20 },
  { region: 'West', value: 5 },
];

describe('aggregateValues', () => {
  it('counts rows regardless of field', () => {
    expect(aggregateValues(rows, 'count')).toBe(3);
  });

  it('sums/averages/mins/maxes a numeric field', () => {
    expect(aggregateValues(rows, 'sum', 'value')).toBe(35);
    expect(aggregateValues(rows, 'avg', 'value')).toBeCloseTo(35 / 3);
    expect(aggregateValues(rows, 'min', 'value')).toBe(5);
    expect(aggregateValues(rows, 'max', 'value')).toBe(20);
  });

  it('ignores rows with a non-numeric or missing value for the field', () => {
    const withGaps = [...rows, { region: 'North', value: 'n/a' }, { region: 'South' }];
    expect(aggregateValues(withGaps, 'sum', 'value')).toBe(35);
    expect(aggregateValues(withGaps, 'avg', 'value')).toBeCloseTo(35 / 3);
  });

  it('returns 0 for an empty row set or a missing field', () => {
    expect(aggregateValues([], 'sum', 'value')).toBe(0);
    expect(aggregateValues(rows, 'sum')).toBe(0);
  });
});

describe('groupAndAggregate', () => {
  it('groups by the given field and counts rows per group by default', () => {
    expect(groupAndAggregate(rows, 'region', 'count')).toEqual({
      labels: ['East', 'West'],
      values: [2, 1],
    });
  });

  it('aggregates a value field within each group', () => {
    expect(groupAndAggregate(rows, 'region', 'sum', 'value')).toEqual({
      labels: ['East', 'West'],
      values: [30, 5],
    });
    expect(groupAndAggregate(rows, 'region', 'avg', 'value')).toEqual({
      labels: ['East', 'West'],
      values: [15, 5],
    });
  });

  it('sorts purely-numeric-looking labels numerically, not lexically', () => {
    const numericRows = [{ code: '2' }, { code: '10' }, { code: '1' }];
    expect(groupAndAggregate(numericRows, 'code', 'count').labels).toEqual(['1', '2', '10']);
  });
});

describe('describeAggregation', () => {
  it('describes count without a field', () => {
    expect(describeAggregation('count')).toBe('Count');
  });

  it('describes sum/avg/min/max with their field name', () => {
    expect(describeAggregation('sum', 'value')).toBe('Sum of value');
    expect(describeAggregation('avg', 'value')).toBe('Average of value');
    expect(describeAggregation('min', 'value')).toBe('Min of value');
    expect(describeAggregation('max', 'value')).toBe('Max of value');
  });
});
