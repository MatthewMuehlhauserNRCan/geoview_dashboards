import { createContext, useCallback, useContext } from 'react';
import { fillTextTemplate, type TemplateValues } from '../panels/textTemplate';

export const TemplateValuesContext = createContext<TemplateValues>({});

// Every resolved `DashboardConfig.templateValues` entry, keyed by id (no `$` prefix) - empty
// outside a TemplateValuesProvider, so a template's `{{$id}}` just renders blank there.
export function useTemplateValues(): TemplateValues {
  return useContext(TemplateValuesContext);
}

// For plain (non-row) text like titles: fills `{{$id}}` placeholders and `{{#$id}}` sections.
export function useFillTemplateValues(): (text: string) => string {
  const values = useTemplateValues();
  return useCallback((text: string) => (text.includes('{{') ? fillTextTemplate(text, undefined, values) : text), [values]);
}
