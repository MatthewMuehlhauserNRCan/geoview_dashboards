// Payload shape emitted by FilterPanel: selected values per field, keyed by field name. A field
// with no selection (missing or empty array) is unconstrained (matches every row).
export type FieldFilterValue = Record<string, string[]>;

export function isFieldFilterValue(value: unknown): value is FieldFilterValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.values(value as Record<string, unknown>).every((v) => Array.isArray(v))
  );
}

export function rowMatchesFieldFilter(row: Record<string, unknown>, filter: unknown): boolean {
  if (!isFieldFilterValue(filter)) return true;
  return Object.entries(filter).every(([field, values]) => values.length === 0 || values.includes(String(row[field])));
}
