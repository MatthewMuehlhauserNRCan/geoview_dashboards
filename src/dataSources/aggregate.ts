// Shared row-aggregation helpers used by both StatPanel (single value) and ChartPanel
// (one value per group) - kept in one place so "add a new aggregation type" is a one-file change.

export type AggregationType = 'count' | 'sum' | 'avg' | 'min' | 'max';

type Row = Record<string, unknown>;

// Aggregates a single set of rows down to one number. `field` is required for every
// aggregation except 'count'; non-numeric/missing values are dropped rather than treated as 0,
// so e.g. an average isn't skewed by rows missing that field.
export function aggregateValues(rows: Row[], aggregation: AggregationType, field?: string): number {
  if (aggregation === 'count') return rows.length;
  if (!field) return 0;
  const values = rows.map((row) => Number(row[field])).filter((value) => !Number.isNaN(value));
  if (values.length === 0) return 0;
  switch (aggregation) {
    case 'sum':
      return values.reduce((total, value) => total + value, 0);
    case 'avg':
      return values.reduce((total, value) => total + value, 0) / values.length;
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
  }
}

// Groups rows by `groupField`'s distinct values, then aggregates each group's rows down to one
// number via the same rules as `aggregateValues`. Labels are returned in a stable, sorted order.
export function groupAndAggregate(
  rows: Row[],
  groupField: string,
  aggregation: AggregationType,
  valueField?: string,
): { labels: string[]; values: number[] } {
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const key = String(row[groupField] ?? 'null');
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  const labels = sortLabels(Array.from(groups.keys()));
  const values = labels.map((label) => aggregateValues(groups.get(label) ?? [], aggregation, valueField));
  return { labels, values };
}

// Plain string sort puts "10"/"11" before "2" - sort numerically when every label looks numeric.
function sortLabels(labels: string[]): string[] {
  const allNumeric = labels.every((label) => label.trim() !== '' && !Number.isNaN(Number(label)));
  return [...labels].sort((a, b) => (allNumeric ? Number(a) - Number(b) : a.localeCompare(b)));
}

// Human-readable label for an aggregation + optional field, e.g. for a chart's y-axis title.
export function describeAggregation(aggregation: AggregationType, field?: string): string {
  if (aggregation === 'count') return 'Count';
  const verb = { sum: 'Sum', avg: 'Average', min: 'Min', max: 'Max' }[aggregation];
  return field ? `${verb} of ${field}` : verb;
}
