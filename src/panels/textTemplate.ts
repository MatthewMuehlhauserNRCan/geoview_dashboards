import type { DataSourceRecord } from '../dataSources/types';

// A field counts as "empty" for `{{#Field}}...{{/Field}}` purposes if it's missing, null, or a
// blank/whitespace-only string - a real `0` or `false` value still counts as present.
export function isEmptyValue(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

// Already-resolved dashboard-wide named values (`DashboardConfig.templateValues`), keyed by id
// WITHOUT the `$` prefix - see src/templateValues/.
export type TemplateValues = Record<string, string | undefined>;

// `{{$name}}` always reads a named value, never a row field - the `$` prefix is what keeps the two
// namespaces from colliding in a template that has both (e.g. a text panel's own row fields).
function lookup(field: string, row: DataSourceRecord | undefined, values: TemplateValues | undefined): unknown {
  return field.startsWith('$') ? values?.[field.slice(1)] : row?.[field];
}

const SECTION_PATTERN = /\{\{#\s*([^{}#/\s]+)\s*\}\}([\s\S]*?)\{\{\/\s*\1\s*\}\}/g;
// Safety cap, not a realistic nesting depth - stops a pathological/malformed template from
// looping forever rather than reflecting any real authoring limit.
const MAX_SECTION_PASSES = 20;

// Strips every `{{#Field}}...{{/Field}}` section, keeping or dropping each one's inner content
// based on `Field`. A single `.replace()` pass only resolves the OUTERMOST section on any given
// span - a truthy section's captured inner text is returned as-is, still containing any nested
// section's raw tags - so this re-runs until a pass makes no further change, which is what lets a
// differently-named section nest inside another and still resolve correctly.
function stripSections(template: string, row: DataSourceRecord | undefined, values: TemplateValues | undefined): string {
  let result = template;
  for (let pass = 0; pass < MAX_SECTION_PASSES; pass += 1) {
    const next = result.replace(SECTION_PATTERN, (_match, field: string, inner: string) =>
      isEmptyValue(lookup(field, row, values)) ? '' : inner,
    );
    if (next === result) break;
    result = next;
  }
  return result;
}

// Fills `{{FieldName}}` placeholders in a markdown template from one data row - a missing field
// (or no row at all, e.g. still loading) renders as an empty string rather than leaving the raw
// placeholder behind. Also supports Mustache-style conditional sections, `{{#Field}}...{{/Field}}`
// - the whole section (including its own tags) is dropped entirely when `Field` is empty on the
// row, so e.g. a section header only shows up alongside content that's actually there. Sections
// may nest as long as an inner section has a DIFFERENT field name than any section enclosing it.
// `{{$name}}` / `{{#$name}}...{{/$name}}` read from `values` instead of the row.
export function fillTextTemplate(template: string, row: DataSourceRecord | undefined, values?: TemplateValues): string {
  return stripSections(template, row, values).replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_match, field: string) => {
    const value = lookup(field, row, values);
    return value === undefined || value === null ? '' : String(value);
  });
}

// Renders the template once per row (joined by a markdown rule) when `repeatForAllRows` is true
// (the default), or just once against the first row only when it's false.
export function renderTextTemplate(
  template: string,
  rows: DataSourceRecord[] | undefined,
  repeatForAllRows: boolean,
  values?: TemplateValues,
): string {
  if (!repeatForAllRows || !rows || rows.length <= 1) {
    return fillTextTemplate(template, rows?.[0], values);
  }
  return rows.map((row) => fillTextTemplate(template, row, values)).join('\n\n---\n\n');
}
