import type { FieldFilterValue } from '../linking/rowFilter';

// Combines every active field's selected values into a single SQL-like WHERE expression (GeoView's
// layer filters are plain SQL-like string fragments - see docs/programming/layer-filters.md),
// e.g. `(E_Regulated IN ('Yes')) AND (Symbol IN ('A'))`. Fields with no selection are omitted
// entirely (no constraint), and `undefined` is returned (clears the filter) when nothing is set.
export function buildFilterExpression(filter: FieldFilterValue | undefined): string | undefined {
  if (!filter) return undefined;
  const clauses = Object.entries(filter)
    .filter(([, values]) => values.length > 0)
    .map(([field, values]) => `${field} IN (${values.map(formatValue).join(', ')})`);

  if (clauses.length === 0) return undefined;
  return clauses.length === 1 ? clauses[0] : clauses.map((clause) => `(${clause})`).join(' AND ');
}

// Numeric fields must be unquoted (`Symbol IN (1, 2)`) - quoting them (`IN ('1', '2')`) compares
// a string literal against a numeric column, which GeoView/ESRI never matches, silently filtering
// out every feature. Only genuinely non-numeric values get SQL string-literal quoting/escaping.
function formatValue(value: string): string {
  return value.trim() !== '' && !Number.isNaN(Number(value)) ? value : quoteValue(value);
}

function quoteValue(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
