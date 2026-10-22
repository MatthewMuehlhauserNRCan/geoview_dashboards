// Payload shape emitted by FilterPanel: selected values per field, keyed by field name. A field
// with no selection (missing or empty array) is unconstrained (matches every row).
export type FieldFilterValue = Record<string, string[]>;

// Reserved/virtual field key used by a multi-source chart's selection (values are the selected
// `dataSourceId`s, not a real row field) - MUST live on its own dedicated channel, never mixed
// with a channel that also carries real row-field filters for the same reason the legend panel's
// alias-vs-raw value spaces couldn't share one channel (see docs/ARCHITECTURE.md).
export const CHART_SOURCE_FIELD = '__chartSource';

// Companion field: every `dataSourceId` a multi-source chart COULD select from (its full
// `sources[]` list), not just the currently-selected ones. A listening map panel needs this to
// know which of ITS OWN map-layer-backed layers are actually "in scope" for this channel - without
// it, a layer backed by a data source the chart never even listed would also get hidden whenever
// anything else on the chart is selected, since "not in the selected set" alone can't distinguish
// "deliberately filtered out" from "never part of this chart to begin with".
export const CHART_SOURCE_UNIVERSE_FIELD = '__chartSourceUniverse';

export function isFieldFilterValue(value: unknown): value is FieldFilterValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.values(value as Record<string, unknown>).every((v) => Array.isArray(v))
  );
}

// A classification can be based on MULTIPLE fields combined (e.g. a legend whose symbology is
// driven by 3 fields together) - one checked item then represents a specific TUPLE of values, not
// independently-OK-able values per field (plain per-field IN-lists would also match combinations
// that mix-and-match across checked items, which is wrong). A composite field key (the real field
// names joined by this separator) + composite values (each item's per-field values joined the
// same way) lets that still fit the plain FieldFilterValue shape without changing every consumer.
const COMPOSITE_FIELD_SEPARATOR = '\u0001';

export function makeCompositeField(fields: string[]): string {
  return fields.join(COMPOSITE_FIELD_SEPARATOR);
}

export function makeCompositeValue(values: (string | number)[]): string {
  return values.map(String).join(COMPOSITE_FIELD_SEPARATOR);
}

export function rowMatchesFieldFilter(row: Record<string, unknown>, filter: unknown): boolean {
  if (!isFieldFilterValue(filter)) return true;
  return Object.entries(filter).every(([field, values]) => {
    if (values.length === 0) return true;
    const rowValue = field.includes(COMPOSITE_FIELD_SEPARATOR)
      ? makeCompositeValue(field.split(COMPOSITE_FIELD_SEPARATOR).map((subField) => row[subField] as string | number))
      : String(row[field]);
    return values.includes(rowValue);
  });
}
