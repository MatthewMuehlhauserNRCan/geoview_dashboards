import type { TemplateValueConfig } from '../config/types';
import type { DataSourceRecord } from '../dataSources/types';
import { aggregateValues } from '../dataSources/aggregate';

// `decimals` only applies to something that's genuinely numeric - a text value (or a blank one)
// is passed through as-is rather than being coerced into `NaN`/`0`.
export function formatTemplateValue(raw: unknown, decimals: number | undefined): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (decimals !== undefined && typeof raw !== 'boolean' && !(typeof raw === 'string' && raw.trim() === '')) {
    const numeric = Number(raw);
    if (Number.isFinite(numeric)) return numeric.toFixed(decimals);
  }
  return String(raw);
}

function hasNumericValue(rows: DataSourceRecord[], field: string): boolean {
  return rows.some((row) => {
    const value = row[field];
    return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
  });
}

// Reduces already-filtered rows down to one display string - `undefined` means "no value" (so
// `{{#$id}}...{{/$id}}` sections hide), rather than a misleading `0` for e.g. the average of nothing.
export function resolveTemplateValue(rows: DataSourceRecord[], config: TemplateValueConfig): string | undefined {
  const aggregation = config.aggregation ?? 'first';
  if (aggregation === 'first') {
    return config.field ? formatTemplateValue(rows[0]?.[config.field], config.decimals) : undefined;
  }
  if (aggregation === 'count') return formatTemplateValue(rows.length, config.decimals);
  if (!config.field) return undefined;
  if (aggregation !== 'sum' && !hasNumericValue(rows, config.field)) return undefined;
  return formatTemplateValue(aggregateValues(rows, aggregation, config.field), config.decimals);
}
