// Pure row -> chart-shape helpers for ChartPanel, kept separate from the React/Chart.js rendering
// so the grouping/series/sort/limit/binning rules are unit-testable on their own.
import { aggregateValues, sortLabels, type AggregationType } from '../dataSources/aggregate';

export type Row = Record<string, unknown>;

// Internal key for the synthetic "everything past `limit`" bucket - deliberately not a plausible
// real field value, so a genuine category literally named "Other" never collides with it.
export const OTHER_CATEGORY_KEY = '\u0000other';
export const OTHER_CATEGORY_LABEL = 'Other';

// One dataset's worth of rows - a distinct `seriesField` value, or one data source in
// multi-source mode.
export interface SeriesInput {
  key: string;
  label: string;
  rows: Row[];
}

export interface ChartSeries {
  key: string;
  label: string;
  // null = no rows in that category for this series and the aggregation has no meaningful
  // "empty" value (avg/min/max) - Chart.js leaves a gap there instead of drawing a fake 0.
  values: (number | null)[];
}

export interface CategoryChartData {
  // Raw category keys (field values / bin ids / OTHER_CATEGORY_KEY), parallel to `labels`.
  keys: string[];
  labels: string[];
  series: ChartSeries[];
}

export interface CategoryChartOptions {
  aggregation: AggregationType;
  valueField?: string;
  sort?: 'label' | 'value-asc' | 'value-desc';
  limit?: number;
  // Fixed category order (e.g. histogram bins) - used as-is, including empty categories, and
  // overrides `sort`/`limit`.
  fixedCategories?: { key: string; label: string }[];
}

// Groups every series' rows by the same category axis and aggregates each (series, category)
// cell, so all datasets line up on one shared set of labels (needed for grouped/stacked bars).
// Sorting by value ranks categories by the aggregate across ALL series combined (e.g. a stacked
// bar's total height), and `limit` folds every category past the top N into one "Other" bucket
// (re-aggregated from its rows, so avg/min/max stay correct rather than summing per-group values).
export function buildCategoryChartData(
  inputs: SeriesInput[],
  categoryOf: (row: Row) => string | undefined,
  options: CategoryChartOptions,
): CategoryChartData {
  const { aggregation, valueField } = options;
  const groupsBySeries = inputs.map((input) => {
    const groups = new Map<string, Row[]>();
    for (const row of input.rows) {
      const key = categoryOf(row);
      if (key === undefined) continue;
      const group = groups.get(key);
      if (group) group.push(row);
      else groups.set(key, [row]);
    }
    return groups;
  });

  let keys: string[];
  let labels: string[];
  if (options.fixedCategories) {
    keys = options.fixedCategories.map((c) => c.key);
    labels = options.fixedCategories.map((c) => c.label);
  } else {
    const allRows = new Map<string, Row[]>();
    for (const groups of groupsBySeries) {
      for (const [key, rows] of groups) allRows.set(key, [...(allRows.get(key) ?? []), ...rows]);
    }
    keys = sortLabels(Array.from(allRows.keys()));
    if (options.sort === 'value-asc' || options.sort === 'value-desc') {
      const direction = options.sort === 'value-asc' ? 1 : -1;
      const totals = new Map(keys.map((key) => [key, aggregateValues(allRows.get(key) ?? [], aggregation, valueField)]));
      // Array.prototype.sort is stable, so ties keep their label order from above.
      keys = [...keys].sort((a, b) => direction * ((totals.get(a) ?? 0) - (totals.get(b) ?? 0)));
    }
    if (options.limit && options.limit > 0 && keys.length > options.limit) {
      const rest = keys.slice(options.limit);
      keys = [...keys.slice(0, options.limit), OTHER_CATEGORY_KEY];
      for (const groups of groupsBySeries) {
        const otherRows = rest.flatMap((key) => groups.get(key) ?? []);
        if (otherRows.length > 0) groups.set(OTHER_CATEGORY_KEY, otherRows);
      }
    }
    labels = keys.map((key) => (key === OTHER_CATEGORY_KEY ? OTHER_CATEGORY_LABEL : key));
  }

  const series = inputs.map((input, i) => ({
    key: input.key,
    label: input.label,
    values: keys.map((key) => {
      const rows = groupsBySeries[i].get(key);
      if (!rows || rows.length === 0) return aggregation === 'count' || aggregation === 'sum' ? 0 : null;
      return aggregateValues(rows, aggregation, valueField);
    }),
  }));
  return { keys, labels, series };
}

// Splits one row set into one series per distinct `seriesField` value (sorted the same way as
// category labels). Without a `seriesField`, everything is one series.
export function splitIntoSeries(rows: Row[], seriesField: string | undefined, defaultLabel: string): SeriesInput[] {
  if (!seriesField) return [{ key: '', label: defaultLabel, rows }];
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const key = String(row[seriesField] ?? 'null');
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  return sortLabels(Array.from(groups.keys())).map((key) => ({ key, label: key, rows: groups.get(key) ?? [] }));
}

export function formatChartNumber(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export interface NumericBins {
  categories: { key: string; label: string }[];
  categoryOf: (row: Row) => string | undefined;
}

// Equal-width bins over `field`'s numeric range across every given row (all series share the
// same bins). Returns undefined when the field isn't purely numeric (any present non-numeric
// value) or has no values at all - the caller then falls back to plain categorical grouping, so
// a 'histogram' over a text field still behaves like the old bar-chart alias did.
export function buildNumericBins(rows: Row[], field: string, binCount = 10): NumericBins | undefined {
  const values: number[] = [];
  for (const row of rows) {
    const raw = row[field];
    if (raw === null || raw === undefined || raw === '') continue;
    const value = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isNaN(value)) return undefined;
    values.push(value);
  }
  if (values.length === 0) return undefined;
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  const count = min === max ? 1 : Math.max(1, Math.floor(binCount));
  const width = (max - min) / count;
  const categories = Array.from({ length: count }, (_, i) => {
    const lo = min + i * width;
    const hi = i === count - 1 ? max : min + (i + 1) * width;
    return { key: `bin:${i}`, label: count === 1 ? formatChartNumber(min) : `${formatChartNumber(lo)} – ${formatChartNumber(hi)}` };
  });
  return {
    categories,
    categoryOf: (row) => {
      const raw = row[field];
      if (raw === null || raw === undefined || raw === '') return undefined;
      const value = Number(raw);
      if (Number.isNaN(value)) return undefined;
      const index = width === 0 ? 0 : Math.min(count - 1, Math.floor((value - min) / width));
      return `bin:${index}`;
    },
  };
}

// Auto-detection fallbacks for when `xField`/`yField` aren't configured.
export function pickAxisKeys(rows: Row[]): { labelKey?: string; valueKey?: string } {
  if (rows.length === 0) return {};
  const keys = Object.keys(rows[0]);
  const labelKey = keys.find((key) => typeof rows[0][key] === 'string') ?? keys[0];
  const valueKey = keys.find((key) => typeof rows[0][key] === 'number');
  return { labelKey, valueKey };
}

// Scatter x/y columns: explicit `xField`/`yField` win, any missing one is filled in from the
// row shape's numeric fields (skipping whichever key the other axis already uses).
export function resolveScatterKeys(rows: Row[], xField?: string, yField?: string): [string, string] | undefined {
  const numericKeys = rows.length > 0 ? Object.keys(rows[0]).filter((key) => typeof rows[0][key] === 'number') : [];
  const xKey = xField ?? numericKeys.find((key) => key !== yField);
  const yKey = yField ?? numericKeys.find((key) => key !== xKey);
  return xKey && yKey ? [xKey, yKey] : undefined;
}
