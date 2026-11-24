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

// Renders the template once per row (joined by a markdown rule) when `repeatForAllRows` is true
// (the default), or just once against the first row only when it's false.
export function renderTextTemplate(
  template: string,
  rows: DataSourceRecord[] | undefined,
  repeatForAllRows: boolean,
): string {
  if (!repeatForAllRows || !rows || rows.length <= 1) {
    return fillTextTemplate(template, rows?.[0]);
  }
  return rows.map((row) => fillTextTemplate(template, row)).join('\n\n---\n\n');
}
