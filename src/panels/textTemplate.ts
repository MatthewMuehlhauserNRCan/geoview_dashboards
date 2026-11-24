import type { DataSourceRecord } from '../dataSources/types';

// Fills `{{FieldName}}` placeholders in a markdown template from one data row - a missing field
// (or no row at all, e.g. still loading) renders as an empty string rather than leaving the raw
// placeholder behind.
export function fillTextTemplate(template: string, row: DataSourceRecord | undefined): string {
  return template.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_match, field: string) => {
    const value = row?.[field];
    return value === undefined || value === null ? '' : String(value);
  });
}
