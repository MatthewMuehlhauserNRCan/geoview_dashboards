import { describe, expect, it } from 'vitest';
import {
  buildCategoryChartData,
  buildNumericBins,
  OTHER_CATEGORY_KEY,
  OTHER_CATEGORY_LABEL,
  resolveScatterKeys,
  splitIntoSeries,
  type Row,
} from './chartData';

const fires: Row[] = [
  { agency: 'B.C.', status: 'Under Control', ha: 10 },
  { agency: 'B.C.', status: 'Under Control', ha: 20 },
  { agency: 'B.C.', status: 'Being Held', ha: 5 },
  { agency: 'B.C.', status: 'Out of Control', ha: 50 },
  { agency: 'Ont.', status: 'Under Control', ha: 3 },
  { agency: 'Ont.', status: 'Out of Control', ha: 7 },
  { agency: 'N.B.', status: 'Under Control', ha: 1 },
];
const byAgency = (row: Row) => String(row.agency);

describe('splitIntoSeries', () => {
  it('returns a single series without a series field', () => {
    const series = splitIntoSeries(fires, undefined, 'Fires');
    expect(series).toHaveLength(1);
    expect(series[0]).toMatchObject({ key: '', label: 'Fires' });
    expect(series[0].rows).toHaveLength(fires.length);
  });

  it('splits rows into one sorted series per distinct value', () => {
    expect(splitIntoSeries(fires, 'status', 'Fires').map((s) => [s.key, s.rows.length])).toEqual([
      ['Being Held', 1],
      ['Out of Control', 2],
      ['Under Control', 4],
    ]);
  });
});

describe('buildCategoryChartData', () => {
  it('aligns every series on one shared category axis, filling missing cells with 0 for count', () => {
    const data = buildCategoryChartData(splitIntoSeries(fires, 'status', ''), byAgency, { aggregation: 'count' });
    expect(data.labels).toEqual(['B.C.', 'N.B.', 'Ont.']);
    expect(data.series.map((s) => [s.key, s.values])).toEqual([
      ['Being Held', [1, 0, 0]],
      ['Out of Control', [1, 0, 1]],
      ['Under Control', [2, 1, 1]],
    ]);
  });

  it('uses null (a gap) for empty cells when aggregating avg/min/max', () => {
    const data = buildCategoryChartData(splitIntoSeries(fires, 'status', ''), byAgency, { aggregation: 'avg', valueField: 'ha' });
    expect(data.series.find((s) => s.key === 'Being Held')?.values).toEqual([5, null, null]);
  });

  it('sorts categories by their combined value across all series', () => {
    const data = buildCategoryChartData(splitIntoSeries(fires, 'status', ''), byAgency, { aggregation: 'count', sort: 'value-desc' });
    expect(data.labels).toEqual(['B.C.', 'Ont.', 'N.B.']);
    const asc = buildCategoryChartData(splitIntoSeries(fires, 'status', ''), byAgency, { aggregation: 'count', sort: 'value-asc' });
    expect(asc.labels).toEqual(['N.B.', 'Ont.', 'B.C.']);
  });

  it('folds categories past the limit into an Other bucket, re-aggregated from its rows', () => {
    const data = buildCategoryChartData([{ key: '', label: '', rows: fires }], byAgency, {
      aggregation: 'max',
      valueField: 'ha',
      sort: 'value-desc',
      limit: 1,
    });
    expect(data.keys).toEqual(['B.C.', OTHER_CATEGORY_KEY]);
    expect(data.labels).toEqual(['B.C.', OTHER_CATEGORY_LABEL]);
    expect(data.series[0].values).toEqual([50, 7]);
  });

  it('keeps a real category literally named "Other" distinct from the synthetic bucket', () => {
    const rows = [{ c: 'Other' }, { c: 'Other' }, { c: 'A' }];
    const data = buildCategoryChartData([{ key: '', label: '', rows }], (r) => String(r.c), {
      aggregation: 'count',
      sort: 'value-desc',
      limit: 1,
    });
    expect(data.keys).toEqual(['Other', OTHER_CATEGORY_KEY]);
    expect(data.series[0].values).toEqual([2, 1]);
  });

  it('uses fixed categories as-is, including empty ones', () => {
    const data = buildCategoryChartData([{ key: '', label: '', rows: fires }], byAgency, {
      aggregation: 'count',
      sort: 'value-desc',
      limit: 1,
      fixedCategories: [
        { key: 'Que.', label: 'Quebec' },
        { key: 'B.C.', label: 'British Columbia' },
      ],
    });
    expect(data.labels).toEqual(['Quebec', 'British Columbia']);
    expect(data.series[0].values).toEqual([0, 4]);
  });
});

describe('resolveScatterKeys', () => {
  const rows = [{ name: 'a', x: 1, y: 2, z: 3 }];

  it('auto-detects the first two numeric fields', () => {
    expect(resolveScatterKeys(rows)).toEqual(['x', 'y']);
  });

  it('fills in only the axis that was not configured, without reusing the other one', () => {
    expect(resolveScatterKeys(rows, 'z')).toEqual(['z', 'x']);
    expect(resolveScatterKeys(rows, undefined, 'x')).toEqual(['y', 'x']);
    expect(resolveScatterKeys([], 'a', 'b')).toEqual(['a', 'b']);
  });

  it('returns undefined when there are not enough numeric fields', () => {
    expect(resolveScatterKeys([{ name: 'a', x: 1 }])).toBeUndefined();
  });
});

describe('buildNumericBins', () => {
  it('builds equal-width bins and assigns the max value to the last bin', () => {
    const rows = [{ v: 0 }, { v: 5 }, { v: 9.99 }, { v: 10 }];
    const bins = buildNumericBins(rows, 'v', 2);
    expect(bins?.categories.map((c) => c.label)).toEqual(['0 – 5', '5 – 10']);
    expect(rows.map((r) => bins?.categoryOf(r))).toEqual(['bin:0', 'bin:1', 'bin:1', 'bin:1']);
  });

  it('accepts numeric strings and skips missing values', () => {
    const bins = buildNumericBins([{ v: '1' }, { v: '3' }, { v: null }], 'v', 2);
    expect(bins?.categoryOf({ v: '1' })).toBe('bin:0');
    expect(bins?.categoryOf({ v: null })).toBeUndefined();
  });

  it('collapses to a single bin when every value is the same', () => {
    const bins = buildNumericBins([{ v: 4 }, { v: 4 }], 'v', 10);
    expect(bins?.categories).toEqual([{ key: 'bin:0', label: '4' }]);
  });

  it('returns undefined for a non-numeric or empty field so callers fall back to categories', () => {
    expect(buildNumericBins([{ v: 1 }, { v: 'abc' }], 'v')).toBeUndefined();
    expect(buildNumericBins([{ other: 1 }], 'v')).toBeUndefined();
  });
});
